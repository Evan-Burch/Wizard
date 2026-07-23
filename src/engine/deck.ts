import { Card, Suit, Rank } from '../types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const RANK_ORDER: Record<Rank, number> = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8,
  '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};

export function getRankValue(rank: Rank): number {
  return RANK_ORDER[rank];
}

export function createDeck(): Card[] {
  const cards: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
        special: null,
      });
    }
  }

  for (let i = 0; i < 4; i++) {
    cards.push({
      id: `wizard-${i}`,
      suit: null,
      rank: null,
      special: 'wizard',
    });
  }

  for (let i = 0; i < 4; i++) {
    cards.push({
      id: `jester-${i}`,
      suit: null,
      rank: null,
      special: 'jester',
    });
  }

  return cards;
}

export function shuffle(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function deal(deck: Card[], cardsPerPlayer: number, playerCount: number): { hands: Card[][]; remaining: Card[] } {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  const totalCardsNeeded = cardsPerPlayer * playerCount;

  for (let i = 0; i < totalCardsNeeded; i++) {
    hands[i % playerCount].push(deck[i]);
  }

  return {
    hands,
    remaining: deck.slice(totalCardsNeeded),
  };
}

export function sortHand(hand: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = { 'hearts': 0, 'spades': 1, 'diamonds': 2, 'clubs': 3 };

  return [...hand].sort((a, b) => {
    if (a.special === 'wizard') return -1;
    if (b.special === 'wizard') return 1;
    if (a.special === 'jester') return 1;
    if (b.special === 'jester') return -1;

    if (a.suit !== b.suit) return suitOrder[a.suit!] - suitOrder[b.suit!];
    return getRankValue(a.rank!) - getRankValue(b.rank!);
  });
}
