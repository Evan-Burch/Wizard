import { Card, Suit, Trick } from '../types';
import { getRankValue } from './deck';

export function getCardDisplayValue(card: Card): string {
  if (card.special === 'wizard') return 'Wizard';
  if (card.special === 'jester') return 'Jester';
  return `${card.rank} of ${card.suit}`;
}

export function compactCardDisplay(card: Card): string {
  if (card.special === 'wizard') return 'W';
  if (card.special === 'jester') return 'J';
  return `${card.rank}${getSuitSymbol(card.suit!)}`;
}

export function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case 'hearts': return '\u2665';
    case 'diamonds': return '\u2666';
    case 'clubs': return '\u2663';
    case 'spades': return '\u2660';
  }
}

export function getSuitColor(suit: Suit): string {
  return suit === 'hearts' || suit === 'diamonds' ? '#d40000' : '#1a1a2e';
}

export function canPlayCard(card: Card, hand: Card[], leadSuit: Suit | null, _trumpSuit: Suit | null): boolean {
  if (card.special === 'wizard' || card.special === 'jester') return true;

  if (leadSuit === null) return true;

  if (card.suit === leadSuit) return true;

  const hasLeadSuit = hand.some(c => c.suit === leadSuit && !c.special);
  return !hasLeadSuit;
}

export function determineTrickWinner(trick: Trick, trumpSuit: Suit | null): number | null {
  if (trick.cards.length === 0) return null;

  let winnerIndex = -1;
  let winnerCard: Card | null = null;

  for (const { playerId, card } of trick.cards) {
    if (card.special === 'wizard') {
      return playerId;
    }
  }

  for (const { playerId, card } of trick.cards) {
    if (card.special === 'jester') continue;

    if (winnerCard === null) {
      winnerCard = card;
      winnerIndex = playerId;
      continue;
    }

    if (winnerCard.special === 'jester') {
      winnerCard = card;
      winnerIndex = playerId;
      continue;
    }

    if (trumpSuit !== null && card.suit === trumpSuit && winnerCard.suit !== trumpSuit) {
      winnerCard = card;
      winnerIndex = playerId;
      continue;
    }

    if (card.suit === winnerCard.suit) {
      if (getRankValue(card.rank!) > getRankValue(winnerCard.rank!)) {
        winnerCard = card;
        winnerIndex = playerId;
      }
    }
  }

  return winnerIndex;
}

export function isAllJesters(trick: Trick): boolean {
  return trick.cards.every(({ card }) => card.special === 'jester');
}
