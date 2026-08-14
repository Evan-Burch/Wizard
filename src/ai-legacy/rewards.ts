import { GameState, Card, Suit } from '../types';
import { calculateInitialScores, reevaluateScores, wouldWinCard, AIContext } from '../engine/ai';
import { canPlayCard } from '../engine/wizard';
import { getRankValue } from '../engine/deck';
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

function determineTrickWinnerCard(
  trickCards: Card[],
  trumpSuit: Suit | null,
): Card | null {
  if (trickCards.length === 0) return null;

  const wizardIdx = trickCards.findIndex(c => c.special === 'wizard');
  if (wizardIdx >= 0) return trickCards[wizardIdx];

  let winner: Card | null = null;

  for (const card of trickCards) {
    if (card.special === 'jester') continue;
    if (winner === null) { winner = card; continue; }

    if (trumpSuit !== null && card.suit === trumpSuit && winner.suit !== trumpSuit) {
      winner = card; continue;
    }

    if (card.suit === winner.suit && getRankValue(card.rank!) > getRankValue(winner.rank!)) {
      winner = card;
    }
  }

  return winner;
}

function getLeadSuitFromTrick(trickCards: Card[]): Suit | null {
  for (const card of trickCards) {
    if (card.special === 'wizard' || card.special === 'jester') continue;
    return card.suit;
  }
  return null;
}

export function computePlayRewardFull(
  bid: number,
  tricksWonBefore: number,
  trickIndex: number,
  cardsPerPlayer: number,
  hand: Card[],
  targetCard: Card,
  completedTrick: Card[],
  trumpSuit: Suit | null,
  allBids: (number | null)[],
  allTricksWon: number[],
  playerIndex: number,
  cardsPlayedBeforeTrick: Card[],
): number {
  const leadSuit = getLeadSuitFromTrick(completedTrick);
  if (isForcedPlay(hand, leadSuit, trumpSuit)) return 0;

  const beforeEval = evaluatePosition(
    bid, tricksWonBefore, trickIndex, cardsPerPlayer,
    hand, trumpSuit, cardsPlayedBeforeTrick, playerIndex, allBids, allTricksWon,
  );

  const cardWon = determineTrickWinnerCard(completedTrick, trumpSuit)?.id === targetCard.id;
  const needed = bid - tricksWonBefore;

  if (needed <= 0 && cardWon) return -1.0;

  const afterHand = hand.filter(c => c.id !== targetCard.id);
  const afterCardsPlayed = [...cardsPlayedBeforeTrick, ...completedTrick];
  const afterTricksWon = cardWon ? tricksWonBefore + 1 : tricksWonBefore;

  const afterEval = evaluatePosition(
    bid, afterTricksWon, trickIndex + 1, cardsPerPlayer,
    afterHand, trumpSuit, afterCardsPlayed, playerIndex, allBids, allTricksWon,
  );

  return afterEval - beforeEval;
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

function findCompletedTrick(trickIndex: number, state: GameState): Card[] | null {
  if (trickIndex < 0 || trickIndex >= state.trickWinners.length) return null;
  const winnerId = state.trickWinners[trickIndex];
  if (winnerId < 0) return null;
  const player = state.players[winnerId];
  let tricksWonBy = 0;
  for (let i = 0; i <= trickIndex; i++) {
    if (state.trickWinners[i] === winnerId) tricksWonBy++;
  }
  return player.tricks[tricksWonBy - 1]?.cards ?? null;
}

function collectAllCardsForRound(state: GameState): Card[] {
  const cards: Card[] = [];
  for (const p of state.players) {
    for (const trick of p.tricks) {
      cards.push(...trick.cards);
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

  const allRoundCards = collectAllCardsForRound(state);

  // Process play samples using full completed trick
  for (const sample of playSamples) {
    if (sample.gameRound !== state.round) continue;
    if (sample.trickIndex === undefined || sample.handCardIds === undefined || sample.trickCardIds === undefined) continue;

    const pid = sample.playerIndex ?? 0;
    const player = players[pid];
    const trickIdx = sample.trickIndex;

    const completedTrick = findCompletedTrick(trickIdx, state);
    if (!completedTrick) continue;

    const hand = sample.handCardIds.map((id: string) => allRoundCards.find(c => c.id === id)).filter(Boolean) as Card[];
    if (hand.length === 0) continue;

    const chosenCardIdx = sample.labels.indexOf(1);
    if (chosenCardIdx < 0 || chosenCardIdx >= hand.length) continue;
    const chosenCard = hand[chosenCardIdx];

    const tricksWonBefore = sample.tricksWonBefore ?? 0;

    const cardsPlayedBeforeTrick: Card[] = [];
    for (let t = 0; t < trickIdx; t++) {
      const tTrick = findCompletedTrick(t, state);
      if (tTrick) cardsPlayedBeforeTrick.push(...tTrick);
    }

    const reward = computePlayRewardFull(
      player.bid ?? 0,
      tricksWonBefore,
      trickIdx,
      cardsPerPlayer,
      hand,
      chosenCard,
      completedTrick,
      trumpSuit,
      allBids,
      allTricksWon,
      pid,
      cardsPlayedBeforeTrick,
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
