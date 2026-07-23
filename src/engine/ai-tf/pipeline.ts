import * as tf from '@tensorflow/tfjs';
import { buildBiddingModel, buildCardPlayModel } from './models';
import { saveBiddingModel, loadBiddingModel, saveCardPlayModel, loadCardPlayModel, saveModelMeta } from './storage';
import { getTrainingStore, flushTrainingData, initTrainingStore } from './training';

const MIN_SAMPLES_TO_TRAIN = 200;
const TRAINING_EPOCHS = 10;
const BATCH_SIZE = 32;

let biddingModel: tf.LayersModel | null = null;
let cardPlayModel: tf.LayersModel | null = null;
let isTraining = false;
let trainingProgress = 0;
let shadowMode = true;
let modelsReady = false;

export type AIPhase = 'neural' | 'rule-based' | 'shadow';

export function getBiddingModel(): tf.LayersModel | null { return biddingModel; }
export function getCardPlayModel(): tf.LayersModel | null { return cardPlayModel; }
export function getIsTraining(): boolean { return isTraining; }
export function getTrainingProgress(): number { return trainingProgress; }
export function getShadowMode(): boolean { return shadowMode; }
export function getModelsReady(): boolean { return modelsReady; }

export type TrainingStatus = 'idle' | 'loading' | 'training' | 'ready';

let trainingStatusCallback: ((status: TrainingStatus, progress: number) => void) | null = null;

export function onTrainingStatusChange(cb: (status: TrainingStatus, progress: number) => void): void {
  trainingStatusCallback = cb;
}

function notifyStatus(status: TrainingStatus, progress: number = 0): void {
  trainingStatusCallback?.(status, progress);
}

export async function initializeModels(): Promise<void> {
  notifyStatus('loading');

  try {
    await initTrainingStore();
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

    const store = getTrainingStore();
    if (store.totalGamesPlayed >= 10 && store.bidSamples.length >= MIN_SAMPLES_TO_TRAIN) {
      shadowMode = false;
    }

    notifyStatus(shadowMode ? 'idle' : 'ready');
  } catch (e) {
    console.warn('Failed to initialize TF models:', e);
    modelsReady = false;
    notifyStatus('idle');
  }
}

export function determineAIPhase(_playerIndex: number): { phase: AIPhase; confidence: number } {
  if (!modelsReady || isTraining) {
    return { phase: 'rule-based', confidence: 1.0 };
  }
  if (shadowMode) {
    return { phase: 'shadow', confidence: 0 };
  }
  return { phase: 'neural', confidence: 0.85 };
}

export async function trainAfterRound(): Promise<void> {
  if (isTraining || !modelsReady) return;

  const store = getTrainingStore();
  if (store.bidSamples.length < MIN_SAMPLES_TO_TRAIN && store.playSamples.length < MIN_SAMPLES_TO_TRAIN) {
    return;
  }

  isTraining = true;
  trainingProgress = 0;
  notifyStatus('training', 0);

  await tf.nextFrame();

  try {
    if (store.bidSamples.length >= MIN_SAMPLES_TO_TRAIN && biddingModel) {
      const bidFeatures = store.bidSamples.map(s => s.features);
      const bidLabels = store.bidSamples.map(s => s.labels);

      const xTensor = tf.tensor2d(bidFeatures);
      const yTensor = tf.tensor2d(bidLabels);

      const splitIdx = Math.floor(xTensor.shape[0] * 0.8);
      const xTrain = xTensor.slice([0, 0], [splitIdx, -1]);
      const yTrain = yTensor.slice([0, 0], [splitIdx, -1]);
      const xVal = xTensor.slice([splitIdx, 0]);
      const yVal = yTensor.slice([splitIdx, 0]);

      await biddingModel.fit(xTrain, yTrain, {
        epochs: TRAINING_EPOCHS,
        batchSize: BATCH_SIZE,
        validationData: [xVal, yVal],
        shuffle: true,
        callbacks: {
          onEpochEnd: async (epoch) => {
            trainingProgress = Math.round(((epoch + 1) / (TRAINING_EPOCHS * 2)) * 100);
            notifyStatus('training', trainingProgress);
            await tf.nextFrame();
          },
        },
      });

      tf.dispose([xTensor, yTensor, xTrain, yTrain, xVal, yVal]);
      await saveBiddingModel(biddingModel);
    }

    await tf.nextFrame();

    if (store.playSamples.length >= MIN_SAMPLES_TO_TRAIN && cardPlayModel) {
      const playFeatures = store.playSamples.map(s => s.features);
      const playLabels = store.playSamples.map(s => s.labels);

      const xTensor = tf.tensor2d(playFeatures);
      const yTensor = tf.tensor2d(playLabels);

      const splitIdx = Math.floor(xTensor.shape[0] * 0.8);
      const xTrain = xTensor.slice([0, 0], [splitIdx, -1]);
      const yTrain = yTensor.slice([0, 0], [splitIdx, -1]);
      const xVal = xTensor.slice([splitIdx, 0]);
      const yVal = yTensor.slice([splitIdx, 0]);

      await cardPlayModel.fit(xTrain, yTrain, {
        epochs: TRAINING_EPOCHS,
        batchSize: BATCH_SIZE,
        validationData: [xVal, yVal],
        shuffle: true,
        callbacks: {
          onEpochEnd: async (epoch) => {
            trainingProgress = 50 + Math.round(((epoch + 1) / (TRAINING_EPOCHS * 2)) * 100);
            notifyStatus('training', trainingProgress);
            await tf.nextFrame();
          },
        },
      });

      tf.dispose([xTensor, yTensor, xTrain, yTrain, xVal, yVal]);
      await saveCardPlayModel(cardPlayModel);
    }

    store.totalGamesPlayed++;

    if (store.totalGamesPlayed >= 10 && store.bidSamples.length >= MIN_SAMPLES_TO_TRAIN) {
      shadowMode = false;
    }

    saveModelMeta({
      version: 1,
      lastTrained: Date.now(),
      totalTrainingSamples: store.bidSamples.length + store.playSamples.length,
    });

    flushTrainingData();
    trainingProgress = 100;
    notifyStatus(shadowMode ? 'idle' : 'ready', 100);

  } catch (e) {
    console.warn('Training failed:', e);
    notifyStatus(shadowMode ? 'idle' : 'ready');
  } finally {
    isTraining = false;
  }
}
