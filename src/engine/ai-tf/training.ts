import { Card, Suit, Trick } from '../../types';
import { encodeBiddingInput, encodePlayInput } from './features';
import { TrainingDataStore, loadTrainingData, saveTrainingData, pruneIfNeeded } from './storage';

let trainingStore: TrainingDataStore = { bidSamples: [], playSamples: [], totalGamesPlayed: 0 };

export async function initTrainingStore(): Promise<void> {
  trainingStore = await loadTrainingData();
}

export function getTrainingStore(): TrainingDataStore {
  return trainingStore;
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
): void {
  const features = encodeBiddingInput(
    hand, trumpSuit, cardsPlayed, cardsPerPlayer, tricksPlayed, allBids, playerIndex
  );

  const label = [actualBid / Math.max(cardsPerPlayer, 1)];

  trainingStore.bidSamples.push({
    type: 'bid',
    features,
    labels: label,
    timestamp: Date.now(),
    gameRound: round,
  });

  pruneIfNeeded(trainingStore);

  if (trainingStore.bidSamples.length % 50 === 0) {
    saveTrainingData(trainingStore);
  }
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

  trainingStore.playSamples.push({
    type: 'play',
    features,
    labels,
    timestamp: Date.now(),
    gameRound: round,
  });

  pruneIfNeeded(trainingStore);

  if (trainingStore.playSamples.length % 100 === 0) {
    saveTrainingData(trainingStore);
  }
}

export function flushTrainingData(): void {
  saveTrainingData(trainingStore);
}

export function incrementGamesPlayed(): void {
  trainingStore.totalGamesPlayed++;
  saveTrainingData(trainingStore);
}
