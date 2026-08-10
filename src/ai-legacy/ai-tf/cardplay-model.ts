import * as tf from '@tensorflow/tfjs';
import { Card, Trick } from '../../types';
import { canPlayCard, compactCardDisplay } from '../../engine/wizard';
import { encodePlayInput } from './features';
import { getCardPlayModel, getIsTraining, getModelsReady } from './pipeline';
import { selectCard as ruleBasedSelect, AIContext } from '../../engine/ai';

export function getCardPlayTopChoices(
  hand: Card[], trick: Trick, ctx: AIContext, n: number = 3
): { card: Card; score: number }[] | null {
  const model = getCardPlayModel();
  if (!model || !getModelsReady() || getIsTraining()) {
    return null;
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

  const legalScores: { card: Card; score: number }[] = [];

  for (let i = 0; i < Math.min(hand.length, 15); i++) {
    const card = hand[i];
    if (!canPlayCard(card, hand, trick.leadSuit, ctx.trumpSuit)) continue;
    legalScores.push({ card, score: scores[i] });
  }

  legalScores.sort((a, b) => b.score - a.score);
  return legalScores.slice(0, n);
}

export function predictCard(hand: Card[], trick: Trick, ctx: AIContext): Card {
  const top3 = getCardPlayTopChoices(hand, trick, ctx, 3);
  if (!top3 || top3.length === 0) {
    return ruleBasedSelect(hand, trick, ctx);
  }

  const handStr = hand.map(c => compactCardDisplay(c)).join(',');
  const topStr = top3.map(t => `${compactCardDisplay(t.card)}(${t.score.toFixed(3)})`).join(', ');
  console.log(
    `[Play NN] P${ctx.playerIndex} hand:[${handStr}] lead=${trick.leadSuit ?? 'none'} trump=${ctx.trumpSuit ?? 'none'} ` +
    `trick=${trick.cards.map(tc => compactCardDisplay(tc.card)).join(',')} => ` +
    `top3: [${topStr}] chose=${compactCardDisplay(top3[0].card)} (${top3[0].score.toFixed(3)})`
  );

  return top3[0].card;
}

export function predictCardConfidence(hand: Card[], trick: Trick, ctx: AIContext): number {
  const top = getCardPlayTopChoices(hand, trick, ctx, 1);
  if (!top || top.length === 0) return 0;
  return top[0].score;
}
