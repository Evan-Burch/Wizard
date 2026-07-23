import * as tf from '@tensorflow/tfjs';

const BIDDING_MODEL_URL = 'indexeddb://wizard-bidding-v1';
const CARDPLAY_MODEL_URL = 'indexeddb://wizard-cardplay-v1';

export async function saveBiddingModel(model: tf.LayersModel): Promise<void> {
  await model.save(BIDDING_MODEL_URL);
}

export async function loadBiddingModel(): Promise<tf.LayersModel | null> {
  try {
    const model = await tf.loadLayersModel(BIDDING_MODEL_URL);
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae'],
    });
    return model;
  } catch {
    return null;
  }
}

export async function saveCardPlayModel(model: tf.LayersModel): Promise<void> {
  await model.save(CARDPLAY_MODEL_URL);
}

export async function loadCardPlayModel(): Promise<tf.LayersModel | null> {
  try {
    const model = await tf.loadLayersModel(CARDPLAY_MODEL_URL);
    model.compile({
      optimizer: tf.train.adam(0.0005),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });
    return model;
  } catch {
    return null;
  }
}

export interface TrainingSample {
  type: 'bid' | 'play';
  features: number[];
  labels: number[];
  timestamp: number;
  gameRound: number;
}

export interface TrainingDataStore {
  bidSamples: TrainingSample[];
  playSamples: TrainingSample[];
  totalGamesPlayed: number;
}

const MAX_BID_SAMPLES = 2000;
const MAX_PLAY_SAMPLES = 5000;

function getEmptyStore(): TrainingDataStore {
  return { bidSamples: [], playSamples: [], totalGamesPlayed: 0 };
}

export async function saveTrainingData(data: TrainingDataStore): Promise<void> {
  try {
    await fetch('/api/training-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // server down — data lost for this save
  }
}

export async function loadTrainingData(): Promise<TrainingDataStore> {
  try {
    const res = await fetch('/api/training-data');
    if (!res.ok) return getEmptyStore();
    return (await res.json()) as TrainingDataStore;
  } catch {
    return getEmptyStore();
  }
}

export function pruneIfNeeded(data: TrainingDataStore): void {
  if (data.bidSamples.length > MAX_BID_SAMPLES) {
    data.bidSamples = data.bidSamples.slice(-MAX_BID_SAMPLES);
  }
  if (data.playSamples.length > MAX_PLAY_SAMPLES) {
    data.playSamples = data.playSamples.slice(-MAX_PLAY_SAMPLES);
  }
}

export interface ModelMeta {
  version: number;
  lastTrained: number;
  totalTrainingSamples: number;
}

const META_KEY = 'wizard-ai-meta';

export function saveModelMeta(meta: ModelMeta): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function loadModelMeta(): ModelMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
