import * as tf from '@tensorflow/tfjs';

interface SerializedModel {
  topology: string;
  weights: string;
  weightShapes: { shape: number[]; dtype: string }[];
}

function floatsToBase64(floats: Float32Array): string {
  const bytes = new Uint8Array(floats.buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToFloats(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

export interface TrainingSample {
  id: string;
  type: 'bid' | 'play';
  features: number[];
  labels: number[];
  timestamp: number;
  gameRound: number;
  isHuman: boolean;
  playerIndex?: number;
  reward?: number;
  trickIndex?: number;
  tricksWonBefore?: number;
  handCardIds?: string[];
  trickCardIds?: string[];
}

export async function saveBiddingModel(model: tf.LayersModel): Promise<void> {
  await saveModelToServer('bidding', model);
}

export async function loadBiddingModel(): Promise<tf.LayersModel | null> {
  return loadModelFromServer('bidding', {
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });
}

export async function saveCardPlayModel(model: tf.LayersModel): Promise<void> {
  await saveModelToServer('cardplay', model);
}

export async function loadCardPlayModel(): Promise<tf.LayersModel | null> {
  return loadModelFromServer('cardplay', {
    optimizer: tf.train.adam(0.0005),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });
}

async function saveModelToServer(name: string, model: tf.LayersModel): Promise<void> {
  try {
    const weights = model.getWeights();
    const arrays = weights.map(w => w.dataSync());
    const totalSize = arrays.reduce((sum, a) => sum + a.length, 0);
    const merged = new Float32Array(totalSize);
    let offset = 0;
    for (const arr of arrays) {
      merged.set(arr, offset);
      offset += arr.length;
    }

    const payload: SerializedModel = {
      topology: model.toJSON() as string,
      weights: floatsToBase64(merged),
      weightShapes: weights.map(w => ({ shape: w.shape, dtype: w.dtype })),
    };

    weights.forEach(w => w.dispose());

    await fetch('/api/models/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('Failed to save model:', e);
  }
}

async function loadModelFromServer(
  name: string,
  compileArgs: { optimizer: tf.Optimizer; loss: string; metrics: string[] },
): Promise<tf.LayersModel | null> {
  try {
    const res = await fetch('/api/models/' + name);
    if (!res.ok) return null;

    const data: SerializedModel = await res.json();
    const topologyObj = typeof data.topology === 'string' ? JSON.parse(data.topology) : data.topology;
    const model = (await tf.models.modelFromJSON(topologyObj)) as tf.LayersModel;

    const floats = base64ToFloats(data.weights);
    let offset = 0;
    const weightTensors = data.weightShapes.map(({ shape, dtype }) => {
      const size = shape.reduce((a, b) => a * b, 1);
      const slice = floats.slice(offset, offset + size);
      const tensor = tf.tensor(Array.from(slice), shape, dtype as tf.DataType);
      offset += size;
      return tensor;
    });

    model.setWeights(weightTensors);
    weightTensors.forEach(t => t.dispose());
    model.compile(compileArgs);

    return model;
  } catch {
    return null;
  }
}

// --- Per-sample API ---

export async function submitSamples(samples: TrainingSample[]): Promise<void> {
  if (samples.length === 0) return;
  try {
    await fetch('/api/training-samples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ samples }),
    });
  } catch {
    // server down
  }
}

export async function fetchAllSamples(): Promise<TrainingSample[]> {
  try {
    const res = await fetch('/api/training-samples');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.samples || []).map((s: Record<string, unknown>) => ({
      ...s,
      features: s.features as number[],
      labels: s.labels as number[],
      handCardIds: s.handCardIds as string[] | undefined,
      trickCardIds: s.trickCardIds as string[] | undefined,
    })) as TrainingSample[];
  } catch {
    return [];
  }
}

export async function fetchSampleStats(): Promise<{ bid: number; play: number }> {
  try {
    const res = await fetch('/api/training-stats');
    if (!res.ok) return { bid: 0, play: 0 };
    return await res.json();
  } catch {
    return { bid: 0, play: 0 };
  }
}

export async function resetAllSamples(): Promise<void> {
  try {
    await fetch('/api/training-samples', { method: 'DELETE' });
  } catch {
    // server down
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
