import * as tf from '@tensorflow/tfjs';
import { Card, Trick } from '../../types';
import { canPlayCard } from '../wizard';
import { encodePlayInput } from './features';
import { getCardPlayModel, getIsTraining, getModelsReady } from './pipeline';
import { selectCard as ruleBasedSelect, AIContext } from '../ai';

export function predictCard(hand: Card[], trick: Trick, ctx: AIContext): Card {
  const model = getCardPlayModel();
  if (!model || !getModelsReady() || getIsTraining()) {
    return ruleBasedSelect(hand, trick, ctx);
  }

  const features = encodePlayInput(
    hand, trick, ctx.trumpSuit, ctx.cardsPlayed, ctx.tricksPlayed,
    ctx.cardsPerPlayer, ctx.bid, ctx.tricksWon, ctx.allBids,
    ctx.allTricksWon, ctx.playerIndex
  );

  const inputTensor = tf.tensor2d([features]);
  const prediction = model.predict(inputTensor) as tf.Tensor;
  const scores = Array.from(prediction.dataSync());

  tf.dispose([inputTensor, prediction]);

  let bestCard = hand[0];
  let bestScore = -1;

  for (let i = 0; i < Math.min(hand.length, 15); i++) {
    const card = hand[i];
    if (!canPlayCard(card, hand, trick.leadSuit, ctx.trumpSuit)) continue;
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      bestCard = card;
    }
  }

  return bestCard;
}

export function predictCardConfidence(hand: Card[], trick: Trick, ctx: AIContext): number {
  const model = getCardPlayModel();
  if (!model || !getModelsReady() || getIsTraining()) {
    return 0;
  }

  const features = encodePlayInput(
    hand, trick, ctx.trumpSuit, ctx.cardsPlayed, ctx.tricksPlayed,
    ctx.cardsPerPlayer, ctx.bid, ctx.tricksWon, ctx.allBids,
    ctx.allTricksWon, ctx.playerIndex
  );

  const inputTensor = tf.tensor2d([features]);
  const prediction = model.predict(inputTensor) as tf.Tensor;
  const scores = Array.from(prediction.dataSync());
  tf.dispose([inputTensor, prediction]);

  let maxScore = 0;
  for (let i = 0; i < Math.min(hand.length, 15); i++) {
    const card = hand[i];
    if (!canPlayCard(card, hand, trick.leadSuit, ctx.trumpSuit)) continue;
    if (scores[i] > maxScore) maxScore = scores[i];
  }

  return maxScore;
}
