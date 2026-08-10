import * as tf from '@tensorflow/tfjs';
import { Card } from '../../types';
import { encodeBiddingInput } from './features';
import { getBiddingModel, getIsTraining, getModelsReady } from './pipeline';
import { calculateBid as ruleBasedBid, AIContext } from '../../engine/ai';

export function predictBid(hand: Card[], ctx: AIContext): number {
  const model = getBiddingModel();
  if (!model || !getModelsReady() || getIsTraining()) {
    const fallback = ruleBasedBid(hand, ctx);
    return fallback;
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
  const clamped = Math.max(0, Math.min(bid, ctx.cardsPerPlayer));

  const handStr = hand.map(c => `${c.rank ?? ''}${c.suit ?? ''}${c.special ?? ''}`).join(',');
  console.log(
    `[Bid NN] P${ctx.playerIndex} hand:[${handStr}] trump=${ctx.trumpSuit ?? 'none'} ` +
    `cardsPerPlayer=${ctx.cardsPerPlayer} => raw=${rawValue.toFixed(3)} bid=${clamped}`
  );

  return clamped;
}

export function predictBidConfidence(_hand: Card[], _ctx: AIContext): number {
  const model = getBiddingModel();
  if (!model || !getModelsReady() || getIsTraining()) {
    return 0;
  }
  return 0.85;
}
