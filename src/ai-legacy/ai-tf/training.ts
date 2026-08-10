import { Card, Suit, Trick } from '../../types';
import { encodeBiddingInput, encodePlayInput } from './features';
import { TrainingSample, submitSamples } from './storage';

let roundBuffer: TrainingSample[] = [];

export function clearRoundBuffer(): void {
  roundBuffer = [];
}

export function getRoundBuffer(): TrainingSample[] {
  return roundBuffer;
}

function trimTo(v: number): number {
  return Math.max(0, Math.min(v, 1));
}

export function recordBidSample(
  hand: Card[],
  trumpSuit: Suit | null,
  cardsPlayed: Card[],
  cardsPerPlayer: number,
  tricksPlayed: number,
  allBids: (number | null)[],
  playerIndex: number,
  actualBid: number,
  round: number,
  isHuman: boolean,
): void {
  const features = encodeBiddingInput(
    hand, trumpSuit, cardsPlayed, cardsPerPlayer, tricksPlayed, allBids, playerIndex
  );

  const label = [trimTo(actualBid / Math.max(cardsPerPlayer, 1))];

  roundBuffer.push({
    id: crypto.randomUUID(),
    type: 'bid',
    features,
    labels: label,
    timestamp: Date.now(),
    gameRound: round,
    isHuman,
    playerIndex,
  });
}

export function recordPlaySample(
  hand: Card[],
  trick: Trick,
  trumpSuit: Suit | null,
  cardsPlayed: Card[],
  tricksPlayed: number,
  cardsPerPlayer: number,
  bid: number,
  tricksWon: number,
  allBids: (number | null)[],
  allTricksWon: number[],
  playerIndex: number,
  chosenCard: Card,
  round: number,
  isHuman: boolean,
  trickIndex?: number,
): void {
  const features = encodePlayInput(
    hand, trick, trumpSuit, cardsPlayed, tricksPlayed, cardsPerPlayer,
    bid, tricksWon, allBids, allTricksWon, playerIndex
  );

  const labels = new Array(15).fill(0);
  for (let i = 0; i < Math.min(hand.length, 15); i++) {
    if (hand[i].id === chosenCard.id) {
      labels[i] = 1.0;
      break;
    }
  }

  roundBuffer.push({
    id: crypto.randomUUID(),
    type: 'play',
    features,
    labels,
    timestamp: Date.now(),
    gameRound: round,
    isHuman,
    playerIndex,
    trickIndex,
    tricksWonBefore: tricksWon,
    handCardIds: hand.map(c => c.id),
    trickCardIds: trick.cards.map(tc => tc.card.id),
  });
}

export async function flushRoundSamples(): Promise<void> {
  if (roundBuffer.length === 0) return;
  await submitSamples(roundBuffer);
  roundBuffer = [];
}
