import * as tf from '@tensorflow/tfjs';
import { Card } from '../../types';
import { encodeBiddingInput } from './features';
import { getBiddingModel, getIsTraining, getModelsReady } from './pipeline';
import { calculateBid as ruleBasedBid, AIContext } from '../ai';

export function predictBid(hand: Card[], ctx: AIContext): number {
  const model = getBiddingModel();
  if (!model || !getModelsReady() || getIsTraining()) {
    return ruleBasedBid(hand, ctx);
  }

  const features = encodeBiddingInput(
    hand, ctx.trumpSuit, ctx.cardsPlayed, ctx.cardsPerPlayer,
    ctx.tricksPlayed, ctx.allBids, ctx.playerIndex
  );

  const inputTensor = tf.tensor2d([features]);
  const prediction = model.predict(inputTensor) as tf.Tensor;
  const rawValue = prediction.dataSync()[0];

  tf.dispose([inputTensor, prediction]);

  const bid = Math.round(rawValue * ctx.cardsPerPlayer);
  return Math.max(0, Math.min(bid, ctx.cardsPerPlayer));
}

export function predictBidConfidence(_hand: Card[], _ctx: AIContext): number {
  const model = getBiddingModel();
  if (!model || !getModelsReady() || getIsTraining()) {
    return 0;
  }
  return 0.85;
}
