import { Card, Suit, Trick } from '../types';
import { canPlayCard, determineTrickWinner } from './wizard';
import { getRankValue } from './deck';

export interface AIContext {
  playerIndex: number;
  hand: Card[];
  bid: number;
  tricksWon: number;
  allBids: (number | null)[];
  allTricksWon: number[];
  trumpSuit: Suit | null;
  cardsPlayed: Card[];
  tricksPlayed: number;
  cardsPerPlayer: number;
  position: 'bottom' | 'right' | 'top' | 'left';
}

export interface CardScore {
  cardId: string;
  score: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function calculateInitialScores(hand: Card[], trumpSuit: Suit | null): Map<string, number> {
  const scores = new Map<string, number>();

  const trumpCards = hand.filter(c => c.suit === trumpSuit && !c.special);
  const hasWizard = hand.some(c => c.special === 'wizard');
  const hasJester = hand.some(c => c.special === 'jester');
  const hasLowTrump = trumpCards.some(c => {
    const rank = c.rank ? getRankValue(c.rank) : 0;
    return rank <= 7;
  });

  const suitCounts: Record<string, number> = {};
  for (const card of hand) {
    if (card.suit && !card.special) {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }
  }
  const hasVoid = Object.keys(suitCounts).length < 4;

  for (const card of hand) {
    if (card.special === 'wizard') {
      scores.set(card.id, 1.0);
      continue;
    }
    if (card.special === 'jester') {
      scores.set(card.id, 0.0);
      continue;
    }

    if (card.suit === trumpSuit) {
      const rankVal = getRankValue(card.rank!);
      if (rankVal >= 11) {
        scores.set(card.id, 1.0);
      } else if (rankVal >= 8) {
        let score = 0.5;
        if (hasLowTrump) score += 0.2;
        if (hasVoid) score += 0.1;
        if (hasWizard || hasJester) score += 0.1;
        scores.set(card.id, clamp(score, 0.0, 1.0));
      } else {
        scores.set(card.id, 0.3);
      }
      continue;
    }

    const rankVal = getRankValue(card.rank!);
    const suitCards = hand.filter(c => c.suit === card.suit && !c.special);
    const higherInHand = suitCards.filter(c => getRankValue(c.rank!) > rankVal);

    if (rankVal === 14) {
      scores.set(card.id, 0.8);
    } else if (rankVal === 13) {
      scores.set(card.id, higherInHand.length > 0 ? 0.7 : 0.5);
    } else if (rankVal === 12) {
      scores.set(card.id, higherInHand.length > 0 ? 0.6 : 0.4);
    } else if (rankVal === 11) {
      scores.set(card.id, higherInHand.length > 0 ? 0.5 : 0.3);
    } else {
      scores.set(card.id, 0.2);
    }
  }

  return scores;
}

function reevaluateScores(
  initialScores: Map<string, number>,
  hand: Card[],
  cardsPlayed: Card[],
  trumpSuit: Suit | null
): Map<string, number> {
  const currentScores = new Map(initialScores);

  const trumpsPlayed = cardsPlayed.filter(c => c.suit === trumpSuit && !c.special);
  const trumpsInHand = hand.filter(c => c.suit === trumpSuit && !c.special);

  for (const card of hand) {
    if (card.special || card.suit === trumpSuit) continue;

    const rankVal = getRankValue(card.rank!);
    const sameSuitPlayed = cardsPlayed.filter(c => c.suit === card.suit && !c.special);
    const higherPlayed = sameSuitPlayed.filter(c => getRankValue(c.rank!) > rankVal);
    const lowerPlayed = sameSuitPlayed.filter(c => getRankValue(c.rank!) < rankVal);

    const baseScore = initialScores.get(card.id) ?? 0.2;
    let adjustment = 0;

    adjustment += higherPlayed.length * 0.1;
    adjustment -= lowerPlayed.length * 0.02;

    if (trumpsPlayed.length > 0 && trumpsInHand.length === 0) {
      adjustment -= 0.1;
    }

    currentScores.set(card.id, clamp(baseScore + adjustment, 0.0, 1.0));
  }

  for (const card of hand) {
    if (card.special || card.suit !== trumpSuit) continue;

    const rankVal = getRankValue(card.rank!);
    const higherTrumpsPlayed = trumpsPlayed.filter(c => getRankValue(c.rank!) > rankVal);
    const lowerTrumpsPlayed = trumpsPlayed.filter(c => getRankValue(c.rank!) < rankVal);

    const baseScore = initialScores.get(card.id) ?? 0.3;
    let adjustment = 0;

    adjustment += higherTrumpsPlayed.length * 0.15;
    adjustment -= lowerTrumpsPlayed.length * 0.03;

    currentScores.set(card.id, clamp(baseScore + adjustment, 0.0, 1.0));
  }

  return currentScores;
}

function wouldWinCard(card: Card, trick: Trick, ctx: AIContext): boolean {
  if (trick.cards.length === 0) return true;
  if (card.special === 'wizard') {
    const wizardAlreadyPlayed = trick.cards.some(c => c.card.special === 'wizard');
    return !wizardAlreadyPlayed;
  }

  const fakeTrick: Trick = {
    ...trick,
    cards: [...trick.cards, { playerId: ctx.playerIndex, card }],
  };
  const winnerId = determineTrickWinner(fakeTrick, ctx.trumpSuit);
  return winnerId === ctx.playerIndex;
}

function getCardScore(cardId: string, scores: Map<string, number>): number {
  return scores.get(cardId) ?? 0.0;
}

export function calculateBid(hand: Card[], ctx: AIContext): number {
  const initialScores = calculateInitialScores(hand, ctx.trumpSuit);
  const currentScores = reevaluateScores(initialScores, hand, ctx.cardsPlayed, ctx.trumpSuit);

  let total = 0;
  for (const card of hand) {
    total += getCardScore(card.id, currentScores);
  }

  const bid = Math.round(total);
  return Math.max(0, Math.min(bid, hand.length));
}

export function selectCard(hand: Card[], trick: Trick, ctx: AIContext): Card {
  const validCards = hand.filter(c => canPlayCard(c, hand, trick.leadSuit, ctx.trumpSuit));

  if (validCards.length === 1) return validCards[0];

  const initialScores = calculateInitialScores(hand, ctx.trumpSuit);
  const currentScores = reevaluateScores(initialScores, hand, ctx.cardsPlayed, ctx.trumpSuit);

  const needsMoreTricks = ctx.tricksWon < ctx.bid;
  const hasWonEnough = ctx.tricksWon >= ctx.bid;
  const tricksLeft = ctx.cardsPerPlayer - ctx.tricksPlayed;
  const isLastTrick = tricksLeft <= 1;
  const isEndgame = tricksLeft <= 3;
  const tricksStillNeeded = ctx.bid - ctx.tricksWon;

  const opponentBids = ctx.allBids.filter((b, i) => i !== ctx.playerIndex && b !== null) as number[];
  const opponentsNeedTricks = opponentBids.some((b) => {
    const oppIdx = ctx.allBids.indexOf(b);
    return oppIdx !== -1 && oppIdx !== ctx.playerIndex && ctx.allTricksWon[oppIdx] < b;
  });

  if (trick.cards.length === 0) {
    return selectLeadCard(validCards, currentScores, ctx, needsMoreTricks, hasWonEnough, isEndgame, tricksStillNeeded, opponentsNeedTricks);
  }

  return selectFollowCard(validCards, trick, currentScores, ctx, needsMoreTricks, hasWonEnough, isEndgame, isLastTrick, tricksStillNeeded, opponentsNeedTricks);
}

function selectLeadCard(
  cards: Card[],
  scores: Map<string, number>,
  ctx: AIContext,
  needsMoreTricks: boolean,
  hasWonEnough: boolean,
  isEndgame: boolean,
  tricksStillNeeded: number,
  _opponentsNeedTricks: boolean
): Card {
  const jesters = cards.filter(c => c.special === 'jester');
  if (hasWonEnough && jesters.length > 0) return jesters[0];

  if (hasWonEnough && !needsMoreTricks) {
    const scored = cards
      .filter(c => !c.special)
      .map(c => ({ card: c, score: getCardScore(c.id, scores) }));
    scored.sort((a, b) => a.score - b.score);
    if (scored.length > 0) return scored[0].card;
  }

  if (needsMoreTricks) {
    const longSuits: Record<string, number> = {};
    for (const c of cards) {
      if (c.suit && !c.special) {
        longSuits[c.suit] = (longSuits[c.suit] || 0) + 1;
      }
    }
    const suitEntries = Object.entries(longSuits).sort((a, b) => b[1] - a[1]);

    for (const [suit, _count] of suitEntries) {
      if (suit === ctx.trumpSuit) continue;
      const suitCards = cards.filter(c => c.suit === suit && !c.special);
      if (suitCards.length === 0) continue;

      const scored = suitCards.map(c => ({ card: c, score: getCardScore(c.id, scores) }));
      scored.sort((a, b) => b.score - a.score);
      if (scored.length > 0 && scored[0].score >= 0.6) {
        return scored[0].card;
      }
    }

    const trumpCards = cards.filter(c => c.suit === ctx.trumpSuit && !c.special);
    if (trumpCards.length > 0 && tricksStillNeeded > 0) {
      const scored = trumpCards.map(c => ({ card: c, score: getCardScore(c.id, scores) }));
      scored.sort((a, b) => b.score - a.score);
      if (scored[0].score >= 0.9) {
        return scored[0].card;
      }
    }

    const wizards = cards.filter(c => c.special === 'wizard');
    if (wizards.length > 0 && (isEndgame || cards.length <= 2)) {
      return wizards[0];
    }

    for (const [suit, _count] of suitEntries) {
      if (suit === ctx.trumpSuit) continue;
      const suitCards = cards.filter(c => c.suit === suit && !c.special);
      if (suitCards.length > 0) {
        const scored = suitCards.map(c => ({ card: c, score: getCardScore(c.id, scores) }));
        scored.sort((a, b) => a.score - b.score);
        return scored[0].card;
      }
    }
  }

  const nonSpecial = cards.filter(c => !c.special);
  if (nonSpecial.length > 0) {
    const scored = nonSpecial.map(c => ({ card: c, score: getCardScore(c.id, scores) }));
    scored.sort((a, b) => a.score - b.score);
    return scored[0].card;
  }

  return cards[0];
}

function selectFollowCard(
  cards: Card[],
  trick: Trick,
  scores: Map<string, number>,
  ctx: AIContext,
  needsMoreTricks: boolean,
  hasWonEnough: boolean,
  isEndgame: boolean,
  isLastTrick: boolean,
  _tricksStillNeeded: number,
  _opponentsNeedTricks: boolean
): Card {
  const leadSuit = trick.leadSuit;
  const trumpSuit = ctx.trumpSuit;

  const canWinWith = cards.filter(c => wouldWinCard(c, trick, ctx));
  const mustFollowSuit = leadSuit !== null && cards.some(c => c.suit === leadSuit && !c.special);
  const trumpCards = cards.filter(c => c.suit === trumpSuit && !c.special);
  const jesters = cards.filter(c => c.special === 'jester');

  const trickHasTrump = trick.cards.some(c => c.card.suit === trumpSuit);
  const currentWinner = trick.cards.length > 0 ? trick.cards[trick.cards.length - 1] : null;

  if (hasWonEnough) {
    const loserCards = cards.filter(c => {
      if (c.special === 'wizard') return false;
      if (c.special === 'jester') return true;
      if (mustFollowSuit && c.suit === leadSuit) {
        return currentWinner ? getCardScore(c.id, scores) < getCardScore(currentWinner.card.id, scores) : true;
      }
      if (!mustFollowSuit) return true;
      return false;
    });

    if (loserCards.length > 0) {
      const scored = loserCards.map(c => ({ card: c, score: getCardScore(c.id, scores) }));
      scored.sort((a, b) => a.score - b.score);
      return scored[0].card;
    }

    const lowestScored = cards
      .filter(c => !c.special || c.special === 'jester')
      .map(c => ({ card: c, score: getCardScore(c.id, scores) }));
    lowestScored.sort((a, b) => a.score - b.score);
    if (lowestScored.length > 0) return lowestScored[0].card;
    return cards[0];
  }

  if (needsMoreTricks) {
    if (canWinWith.length > 0) {
      const winningNonSpecial = canWinWith.filter(c => !c.special);
      if (winningNonSpecial.length > 0) {
        const scored = winningNonSpecial.map(c => ({ card: c, score: getCardScore(c.id, scores) }));
        scored.sort((a, b) => {
          const aCost = a.score > 0.9 ? 50 + a.score * 10 : a.score;
          const bCost = b.score > 0.9 ? 50 + b.score * 10 : b.score;
          return aCost - bCost;
        });
        return scored[0].card;
      }

      const winningWizards = canWinWith.filter(c => c.special === 'wizard');
      if (winningWizards.length > 0) {
        if (isEndgame || isLastTrick || canWinWith.length === cards.length) {
          return winningWizards[0];
        }
      }
    }

    if (trumpCards.length > 0 && !trickHasTrump) {
      const leadSuitRemaining = leadSuit ? getCardsRemainingInSuit(leadSuit, ctx) : 0;
      const noCardsInSuit = leadSuitRemaining === 0;
      if (noCardsInSuit || isEndgame) {
        const scored = trumpCards.map(c => ({ card: c, score: getCardScore(c.id, scores) }));
        scored.sort((a, b) => a.score - b.score);
        return scored[0].card;
      }
    }

    if (jesters.length > 0 && !mustFollowSuit) {
      return jesters[0];
    }
  }

  const allScored = cards.map(c => ({ card: c, score: getCardScore(c.id, scores) }));
  allScored.sort((a, b) => a.score - b.score);
  return allScored[0].card;
}

function getCardsRemainingInSuit(suit: Suit, ctx: AIContext): number {
  const totalInDeck = suit === ctx.trumpSuit ? 14 : 13;
  const played = ctx.cardsPlayed.filter(c => c.suit === suit && !c.special).length;
  const inHand = ctx.hand.filter(c => c.suit === suit && !c.special).length;
  return totalInDeck - played - inHand;
}
