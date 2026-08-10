import { Card, Suit, Trick } from '../../types';
import { getRankValue } from '../../engine/deck';

const SUIT_INDEX: Record<Suit, number> = {
  hearts: 0, spades: 13, diamonds: 26, clubs: 39,
};

export function cardToIndex(card: Card): number {
  if (card.special === 'wizard') return 52 + parseInt(card.id.split('-')[1]);
  if (card.special === 'jester') return 56 + parseInt(card.id.split('-')[1]);
  return SUIT_INDEX[card.suit!] + (getRankValue(card.rank!) - 2);
}

export function encodeCards(cards: Card[]): number[] {
  const vec = new Array(60).fill(0);
  for (const card of cards) {
    vec[cardToIndex(card)] = 1;
  }
  return vec;
}

export const BID_INPUT_SIZE = 86;
export const PLAY_INPUT_SIZE = 132;

export function encodeBiddingInput(
  hand: Card[],
  trumpSuit: Suit | null,
  cardsPlayed: Card[],
  cardsPerPlayer: number,
  tricksPlayed: number,
  allBids: (number | null)[],
  playerIndex: number,
): number[] {
  const features: number[] = [];

  features.push(...encodeCards(hand));

  features.push(trumpSuit === 'hearts' ? 1 : 0);
  features.push(trumpSuit === 'diamonds' ? 1 : 0);
  features.push(trumpSuit === 'clubs' ? 1 : 0);
  features.push(trumpSuit === 'spades' ? 1 : 0);
  features.push(trumpSuit === null ? 1 : 0);

  const playedBySuit: Record<string, number> = { hearts: 0, spades: 0, diamonds: 0, clubs: 0 };
  let wizardsPlayed = 0;
  let jestersPlayed = 0;
  for (const c of cardsPlayed) {
    if (c.special === 'wizard') wizardsPlayed++;
    else if (c.special === 'jester') jestersPlayed++;
    else playedBySuit[c.suit!] = (playedBySuit[c.suit!] || 0) + 1;
  }
  features.push(playedBySuit['hearts'] / 15);
  features.push(playedBySuit['spades'] / 15);
  features.push(playedBySuit['diamonds'] / 15);
  features.push(playedBySuit['clubs'] / 15);
  features.push(wizardsPlayed / 4);
  features.push(jestersPlayed / 4);
  features.push(cardsPlayed.length / 60);

  const suitCounts: Record<string, number> = { hearts: 0, spades: 0, diamonds: 0, clubs: 0 };
  let wizardsInHand = 0;
  let jestersInHand = 0;
  for (const c of hand) {
    if (c.special === 'wizard') wizardsInHand++;
    else if (c.special === 'jester') jestersInHand++;
    else suitCounts[c.suit!] = (suitCounts[c.suit!] || 0) + 1;
  }
  features.push(suitCounts['hearts'] / 15);
  features.push(suitCounts['spades'] / 15);
  features.push(suitCounts['diamonds'] / 15);
  features.push(suitCounts['clubs'] / 15);

  features.push(wizardsInHand / 4);
  features.push(jestersInHand / 4);
  const highCards = hand.filter(c =>
    !c.special && c.rank && getRankValue(c.rank) >= 11
  ).length;
  features.push(highCards / Math.max(hand.length, 1));
  const trumpCards = hand.filter(c =>
    !c.special && c.suit === trumpSuit
  ).length;
  features.push(trumpCards / Math.max(hand.length, 1));

  features.push(tricksPlayed / Math.max(cardsPerPlayer, 1));
  features.push(hand.length / Math.max(cardsPerPlayer, 1));

  for (let i = 0; i < 4; i++) {
    if (i === playerIndex) continue;
    features.push((allBids[i] ?? 0) / Math.max(cardsPerPlayer, 1));
  }

  const totalBid = allBids.reduce<number>((sum, b) => sum + (b ?? 0), 0);
  features.push(totalBid / Math.max(4 * cardsPerPlayer, 1));

  while (features.length < BID_INPUT_SIZE) {
    features.push(0);
  }

  return features.slice(0, BID_INPUT_SIZE);
}

export function encodePlayInput(
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
): number[] {
  const features: number[] = [];

  features.push(...encodeCards(hand));

  features.push(...encodeCards(trick.cards.map(tc => tc.card)));

  features.push(trick.leadSuit === 'hearts' ? 1 : 0);
  features.push(trick.leadSuit === 'diamonds' ? 1 : 0);
  features.push(trick.leadSuit === 'clubs' ? 1 : 0);
  features.push(trick.leadSuit === 'spades' ? 1 : 0);
  features.push(trick.leadSuit === null ? 1 : 0);
  features.push(trick.cards.length / 4);
  features.push(trick.cards.some(tc =>
    tc.card.suit === trumpSuit && !tc.card.special
  ) ? 1 : 0);
  features.push(trick.cards.some(tc =>
    tc.card.special === 'wizard'
  ) ? 1 : 0);
  features.push(trumpSuit === 'hearts' ? 1 : 0);
  features.push(trumpSuit === 'diamonds' ? 1 : 0);
  features.push(trumpSuit === 'clubs' ? 1 : 0);
  features.push(trumpSuit === 'spades' ? 1 : 0);
  features.push(trumpSuit === null ? 1 : 0);

  const playedBySuit: Record<string, number> = { hearts: 0, spades: 0, diamonds: 0, clubs: 0 };
  let wizardsPlayed = 0;
  let jestersPlayed = 0;
  for (const c of cardsPlayed) {
    if (c.special === 'wizard') wizardsPlayed++;
    else if (c.special === 'jester') jestersPlayed++;
    else playedBySuit[c.suit!] = (playedBySuit[c.suit!] || 0) + 1;
  }
  features.push((playedBySuit['hearts'] || 0) / 15);
  features.push((playedBySuit['spades'] || 0) / 15);
  features.push((playedBySuit['diamonds'] || 0) / 15);
  features.push((playedBySuit['clubs'] || 0) / 15);
  features.push(wizardsPlayed / 4);
  features.push(jestersPlayed / 4);
  features.push(cardsPlayed.length / 60);

  features.push(tricksWon / Math.max(cardsPerPlayer, 1));
  features.push(bid / Math.max(cardsPerPlayer, 1));
  features.push(tricksPlayed / Math.max(cardsPerPlayer, 1));
  features.push(hand.length / Math.max(cardsPerPlayer, 1));
  features.push((bid - tricksWon) / Math.max(cardsPerPlayer, 1));
  features.push(Math.max(0, tricksWon - bid) / Math.max(cardsPerPlayer, 1));

  for (let i = 0; i < 4; i++) {
    if (i === playerIndex) continue;
    features.push((allBids[i] ?? 0) / Math.max(cardsPerPlayer, 1));
    features.push(allTricksWon[i] / Math.max(cardsPerPlayer, 1));
  }

  while (features.length < PLAY_INPUT_SIZE) {
    features.push(0);
  }

  return features.slice(0, PLAY_INPUT_SIZE);
}
