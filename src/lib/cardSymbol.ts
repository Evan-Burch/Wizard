import { Card, Suit } from '../types';

const SUIT_PREFIX: Record<Suit, string> = {
  hearts: 'h',
  diamonds: 'd',
  clubs: 'c',
  spades: 's',
};

const RANK_NUM: Record<string, number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
};

export function cardSymbolId(card: Card): string | null {
  if (card.special || card.suit === null || card.rank === null) return null;
  const num = RANK_NUM[card.rank];
  if (num === undefined) return null;
  return `${SUIT_PREFIX[card.suit]}${num}`;
}
