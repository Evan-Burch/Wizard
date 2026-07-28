import * as tf from '@tensorflow/tfjs';
import { buildBiddingModel, buildCardPlayModel } from './models';
import { saveBiddingModel, loadBiddingModel, saveCardPlayModel, loadCardPlayModel, saveModelMeta, fetchAllSamples, fetchSampleStats } from './storage';

const MIN_SAMPLES_TO_TRAIN = 200;
const TRAINING_EPOCHS = 10;
const BATCH_SIZE = 32;

let biddingModel: tf.LayersModel | null = null;
let cardPlayModel: tf.LayersModel | null = null;
let isTraining = false;
let trainingProgress = 0;
let biddingNeuralReady = false;
let cardPlayNeuralReady = false;
let modelsReady = false;

export type AIPhase = 'neural' | 'rule-based' | 'shadow';
export type DecisionType = 'bidding' | 'playing';

export function getBiddingModel(): tf.LayersModel | null { return biddingModel; }
export function getCardPlayModel(): tf.LayersModel | null { return cardPlayModel; }
export function getIsTraining(): boolean { return isTraining; }
export function getTrainingProgress(): number { return trainingProgress; }
export function getBiddingNeuralReady(): boolean { return biddingNeuralReady; }
export function getCardPlayNeuralReady(): boolean { return cardPlayNeuralReady; }
export function getModelsReady(): boolean { return modelsReady; }

export type TrainingStatus = 'idle' | 'loading' | 'training' | 'ready';

let trainingStatusCallback: ((status: TrainingStatus, progress: number) => void) | null = null;

export function onTrainingStatusChange(cb: (status: TrainingStatus, progress: number) => void): void {
  trainingStatusCallback = cb;
}

function notifyStatus(status: TrainingStatus, progress: number = 0): void {
  trainingStatusCallback?.(status, progress);
}

function anyNeuralReady(): boolean { return biddingNeuralReady || cardPlayNeuralReady; }

export async function initializeModels(): Promise<void> {
  notifyStatus('loading');

  try {
    biddingModel = await loadBiddingModel();
    if (!biddingModel) {
      biddingModel = buildBiddingModel();
    }

    await tf.nextFrame();

    cardPlayModel = await loadCardPlayModel();
    if (!cardPlayModel) {
      cardPlayModel = buildCardPlayModel();
    }

    modelsReady = true;

    const stats = await fetchSampleStats();
    if (stats.bid >= MIN_SAMPLES_TO_TRAIN) {
      biddingNeuralReady = true;
    }
    if (stats.play >= MIN_SAMPLES_TO_TRAIN) {
      cardPlayNeuralReady = true;
    }

    notifyStatus(anyNeuralReady() ? 'ready' : 'idle');
  } catch (e) {
    console.warn('Failed to initialize TF models:', e);
    modelsReady = false;
    notifyStatus('idle');
  }
}

export function determineAIPhase(_playerIndex: number, decisionType: DecisionType): { phase: AIPhase; confidence: number } {
  if (!modelsReady || isTraining) {
    return { phase: 'rule-based', confidence: 1.0 };
  }
  const ready = decisionType === 'bidding' ? biddingNeuralReady : cardPlayNeuralReady;
  if (!ready) {
    return { phase: 'shadow', confidence: 0 };
  }
  return { phase: 'neural', confidence: 0.85 };
}

export async function trainAfterRound(): Promise<void> {
  if (isTraining || !modelsReady) {
    return;
  }

  const allSamples = await fetchAllSamples();
  const bidSamples = allSamples.filter(s => s.type === 'bid');
  const playSamples = allSamples.filter(s => s.type === 'play');

  if (bidSamples.length < MIN_SAMPLES_TO_TRAIN && playSamples.length < MIN_SAMPLES_TO_TRAIN) {
    return;
  }

  isTraining = true;
  trainingProgress = 0;
  notifyStatus('training', 0);

  await tf.nextFrame();

  try {
    if (bidSamples.length >= MIN_SAMPLES_TO_TRAIN && biddingModel) {
      const bidFeatures = bidSamples.map(s => s.features);
      const bidLabels = bidSamples.map(s => s.labels);
      const bidWeights = bidSamples.map(s => s.isHuman ? 1.0 : (0.1 + 0.9 * Math.max(0, s.reward ?? 0)));

      const xTensor = tf.tensor2d(bidFeatures);
      const yTensor = tf.tensor2d(bidLabels);
      const wTensor = tf.tensor1d(bidWeights);

      const splitIdx = Math.floor(xTensor.shape[0] * 0.8);
      const xTrain = xTensor.slice([0, 0], [splitIdx, -1]);
      const yTrain = yTensor.slice([0, 0], [splitIdx, -1]);
      const wTrain = wTensor.slice([0], [splitIdx]);
      const xVal = xTensor.slice([splitIdx, 0]);
      const yVal = yTensor.slice([splitIdx, 0]);

      await biddingModel.fit(xTrain, yTrain, {
        epochs: TRAINING_EPOCHS,
        batchSize: BATCH_SIZE,
        validationData: [xVal, yVal],
        sampleWeight: wTrain,
        shuffle: true,
        callbacks: {
          onEpochEnd: async (epoch) => {
            trainingProgress = Math.round(((epoch + 1) / (TRAINING_EPOCHS * 2)) * 100);
            notifyStatus('training', trainingProgress);
            await tf.nextFrame();
          },
        },
      });

      tf.dispose([xTensor, yTensor, xTrain, yTrain, xVal, yVal, wTensor]);
      await saveBiddingModel(biddingModel);
    }

    await tf.nextFrame();

    if (playSamples.length >= MIN_SAMPLES_TO_TRAIN && cardPlayModel) {
      const playFeatures = playSamples.map(s => s.features);
      const playLabels = playSamples.map(s => s.labels);
      const playWeights = playSamples.map(s => s.isHuman ? 1.0 : (0.1 + 0.9 * Math.max(0, s.reward ?? 0)));

      const xTensor = tf.tensor2d(playFeatures);
      const yTensor = tf.tensor2d(playLabels);
      const wTensor = tf.tensor1d(playWeights);

      const splitIdx = Math.floor(xTensor.shape[0] * 0.8);
      const xTrain = xTensor.slice([0, 0], [splitIdx, -1]);
      const yTrain = yTensor.slice([0, 0], [splitIdx, -1]);
      const wTrain = wTensor.slice([0], [splitIdx]);
      const xVal = xTensor.slice([splitIdx, 0]);
      const yVal = yTensor.slice([splitIdx, 0]);

      await cardPlayModel.fit(xTrain, yTrain, {
        epochs: TRAINING_EPOCHS,
        batchSize: BATCH_SIZE,
        validationData: [xVal, yVal],
        sampleWeight: wTrain,
        shuffle: true,
        callbacks: {
          onEpochEnd: async (epoch) => {
            trainingProgress = 50 + Math.round(((epoch + 1) / (TRAINING_EPOCHS * 2)) * 100);
            notifyStatus('training', trainingProgress);
            await tf.nextFrame();
          },
        },
      });

      tf.dispose([xTensor, yTensor, xTrain, yTrain, xVal, yVal, wTensor]);
      await saveCardPlayModel(cardPlayModel);
    }

    if (bidSamples.length >= MIN_SAMPLES_TO_TRAIN) {
      biddingNeuralReady = true;
    }
    if (playSamples.length >= MIN_SAMPLES_TO_TRAIN) {
      cardPlayNeuralReady = true;
    }

    saveModelMeta({
      version: 1,
      lastTrained: Date.now(),
      totalTrainingSamples: bidSamples.length + playSamples.length,
    });

    trainingProgress = 100;
    notifyStatus(anyNeuralReady() ? 'ready' : 'idle', 100);

  } catch (e) {
    console.warn('Training failed:', e);
    notifyStatus(anyNeuralReady() ? 'ready' : 'idle');
  } finally {
    isTraining = false;
  }
}
