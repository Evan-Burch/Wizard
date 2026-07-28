import { GameState, Card, Suit } from '../types';
import { calculateInitialScores, reevaluateScores, wouldWinCard, AIContext } from './ai';
import { canPlayCard } from './wizard';
import { TrainingSample } from './ai-tf/storage';

export function classifyHand(hand: Card[], trumpSuit: Suit | null, cardsPlayed: Card[]): {
  winners: string[]; losers: string[]; neutral: string[]; scores: Map<string, number>;
} {
  if (hand.length === 0) return { winners: [], losers: [], neutral: [], scores: new Map() };

  const initialScores = calculateInitialScores(hand, trumpSuit);
  const scores = reevaluateScores(initialScores, hand, cardsPlayed, trumpSuit);

  const winners: string[] = [];
  const losers: string[] = [];
  const neutral: string[] = [];

  for (const card of hand) {
    const score = scores.get(card.id) ?? 0.5;
    if (score > 0.6) winners.push(card.id);
    else if (score < 0.2) losers.push(card.id);
    else neutral.push(card.id);
  }

  return { winners, losers, neutral, scores };
}

export function evaluatePosition(
  bid: number,
  tricksWon: number,
  tricksPlayed: number,
  cardsPerPlayer: number,
  hand: Card[],
  trumpSuit: Suit | null,
  cardsPlayedSoFar: Card[],
  _playerIndex: number,
  _allBids: (number | null)[],
  _allTricksWon: number[],
): number {
  const needed = bid - tricksWon;
  const remainingTricks = cardsPerPlayer - tricksPlayed;

  if (remainingTricks === 0) {
    return needed === 0 ? 1.0 : -1.0;
  }

  const { winners, losers } = classifyHand(hand, trumpSuit, cardsPlayedSoFar);
  const winningCount = winners.length;
  const losingCount = losers.length;

  if (needed <= 0) {
    if (losingCount >= remainingTricks) return 1.0;
    if (losingCount >= remainingTricks - 1) return 0.7;
    return Math.max(0, losingCount / remainingTricks);
  }

  if (needed > remainingTricks) {
    const maxPossible = Math.min(tricksWon + winningCount, bid);
    return 0.3 + 0.4 * ((maxPossible - tricksWon) / needed);
  }

  const enoughWinners = winningCount >= needed;
  const enoughLosers = losingCount >= (remainingTricks - needed);

  if (enoughWinners && enoughLosers) return 0.9;
  if (enoughWinners) return 0.5 + 0.2 * (winningCount / needed);
  if (enoughLosers) return 0.4 + 0.2 * (losingCount / (remainingTricks - needed));

  return 0.2 + 0.3 * ((winningCount + losingCount) / remainingTricks);
}

function isForcedPlay(hand: Card[], leadSuit: Suit | null, trumpSuit: Suit | null): boolean {
  let legalCount = 0;
  for (const card of hand) {
    if (canPlayCard(card, hand, leadSuit, trumpSuit)) legalCount++;
  }
  return legalCount <= 1;
}

export function computePlayRewardDirect(
  bid: number,
  tricksWonBefore: number,
  trickIndex: number,
  cardsPerPlayer: number,
  hand: Card[],
  chosenCard: Card,
  otherTrickCards: Card[],
  leadSuit: Suit | null,
  trumpSuit: Suit | null,
  allBids: (number | null)[],
  allTricksWon: number[],
  playerIndex: number,
  cardsPlayedSoFar: Card[],
): number {
  // Forced play = neutral
  if (isForcedPlay(hand, leadSuit, trumpSuit)) return 0;

  const beforeEval = evaluatePosition(
    bid, tricksWonBefore, trickIndex, cardsPerPlayer,
    hand, trumpSuit, cardsPlayedSoFar, playerIndex, allBids, allTricksWon,
  );

  // Check if chosen card would win the trick
  const trickCardsNow = [
    ...otherTrickCards.map(c => ({ playerId: -1, card: c })),
    { playerId: playerIndex, card: chosenCard },
  ];
  const trickNow = { cards: trickCardsNow, leadSuit, winnerId: null };
  const ctx: AIContext = {
    playerIndex, hand, bid, tricksWon: tricksWonBefore,
    allBids, allTricksWon, trumpSuit, cardsPlayed: cardsPlayedSoFar,
    tricksPlayed: trickIndex, cardsPerPlayer, position: 'bottom',
  };
  const winnerNow = wouldWinCard(chosenCard, trickNow, ctx);
  const needed = bid - tricksWonBefore;

  // Already matched or overbidding + playing a winner = bad
  if (needed <= 0 && winnerNow) return -1.0;

  // After: card removed from hand, trick played
  const afterHand = hand.filter(c => c.id !== chosenCard.id);
  const afterCardsPlayed = [...cardsPlayedSoFar, chosenCard, ...otherTrickCards];
  const afterTricksWon = winnerNow ? tricksWonBefore + 1 : tricksWonBefore;

  const afterEval = evaluatePosition(
    bid, afterTricksWon, trickIndex + 1, cardsPerPlayer,
    afterHand, trumpSuit, afterCardsPlayed, playerIndex, allBids, allTricksWon,
  );

  return afterEval - beforeEval;
}

export function computeBidReward(bid: number, tricksWon: number, cardsPerPlayer: number): number {
  if (bid === tricksWon) {
    return 0.7 + 0.3 * (bid / cardsPerPlayer);
  }
  const diff = Math.abs(bid - tricksWon);
  return -0.3 - 0.7 * (diff / cardsPerPlayer);
}

function collectAllCardsForRound(state: GameState): Card[] {
  const cards: Card[] = [];
  for (const p of state.players) {
    for (const trick of p.tricks) {
      cards.push(...trick);
    }
  }
  if (state.flippedCard) cards.push(state.flippedCard);
  return cards;
}

export function assignRoundRewards(state: GameState, samples: TrainingSample[]): void {
  const { cardsPerPlayer, players, trumpSuit } = state;
  const allBids = players.map(p => p.bid);
  const allTricksWon = players.map(p => p.tricksWon);

  const playSamples = samples.filter(s => s.type === 'play' && s.gameRound === state.round);
  const bidSamples = samples.filter(s => s.type === 'bid' && s.gameRound === state.round);

  // Collect all cards that were in play this round
  const allRoundCards = collectAllCardsForRound(state);

  // Process play samples (both human and AI)
  for (const sample of playSamples) {
    if (sample.gameRound !== state.round) continue;
    if (sample.trickIndex === undefined || sample.handCardIds === undefined || sample.trickCardIds === undefined) continue;

    const pid = sample.playerIndex ?? 0;
    const player = players[pid];
    const trickIdx = sample.trickIndex;
    const tricksWonBefore = sample.tricksWonBefore ?? 0;

    // Reconstruct hand at play time
    const hand = sample.handCardIds.map((id: string) => allRoundCards.find(c => c.id === id)).filter(Boolean) as Card[];
    if (hand.length === 0) continue;

    // Other cards in trick at play time
    const otherTrickCards = sample.trickCardIds.map((id: string) => allRoundCards.find(c => c.id === id)).filter(Boolean) as Card[];

    // Cards played before this trick
    const cardsPlayedBeforeTrick: Card[] = [];
    for (const p of players) {
      for (const trick of p.tricks) {
        cardsPlayedBeforeTrick.push(...trick);
      }
    }

    // Determine chosen card from labels
    const chosenCardIdx = sample.labels.indexOf(1);
    if (chosenCardIdx < 0 || chosenCardIdx >= hand.length) continue;
    const chosenCard = hand[chosenCardIdx];

    // Determine lead suit from other cards (first card was lead)
    const leadSuit = otherTrickCards.length > 0 ? otherTrickCards[0].suit : chosenCard.suit;

    const priorCardsPlayed = trickIdx === 0 ? [] : cardsPlayedBeforeTrick;

    const reward = computePlayRewardDirect(
      player.bid ?? 0,
      tricksWonBefore,
      trickIdx,
      cardsPerPlayer,
      hand,
      chosenCard,
      otherTrickCards,
      leadSuit,
      trumpSuit,
      allBids,
      allTricksWon,
      pid,
      priorCardsPlayed,
    );

    sample.reward = reward;
  }

  // Assign bid rewards (both human and AI)
  for (const sample of bidSamples) {
    if (sample.gameRound !== state.round) continue;

    const pid = sample.playerIndex ?? 0;
    const player = players[pid];

    // Bid reward: how close was the bid to actual tricks won
    const bidNormalized = sample.labels[0] ?? 0;
    const bid = Math.round(bidNormalized * cardsPerPlayer);
    const tricksWon = player.tricksWon;
    sample.reward = computeBidReward(bid, tricksWon, cardsPerPlayer);
  }
}
