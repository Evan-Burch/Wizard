import * as tf from '@tensorflow/tfjs';
import { BID_INPUT_SIZE, PLAY_INPUT_SIZE } from './features';

export function buildBiddingModel(): tf.LayersModel {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [BID_INPUT_SIZE],
        units: 64,
        activation: 'relu',
        kernelInitializer: 'glorotNormal',
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 32, activation: 'relu' }),
      tf.layers.dense({ units: 16, activation: 'relu' }),
      tf.layers.dense({ units: 1, activation: 'linear' }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });

  return model;
}

export function buildCardPlayModel(): tf.LayersModel {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [PLAY_INPUT_SIZE],
        units: 128,
        activation: 'relu',
        kernelInitializer: 'glorotNormal',
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 64, activation: 'relu' }),
      tf.layers.dense({ units: 32, activation: 'relu' }),
      tf.layers.dense({ units: 15, activation: 'sigmoid' }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.0005),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
}
