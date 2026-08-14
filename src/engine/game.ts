import { GameState, Card, Trick, Suit } from '../types';
import { createDeck, shuffle, deal, sortHand } from './deck';
import { determineTrickWinner } from './wizard';
import { calculateScore } from './scoring';
import { AIContext, calculateBid, selectCard } from './ai';

const PLAYER_NAMES = ['You', 'Mike', 'Lisa', 'Bill', 'Sarah', 'Alex'];
const PLAYER_POSITIONS = ['bottom', 'right', 'top', 'left'] as const;

export function maxRounds(playerCount: number): number {
  return Math.floor(60 / playerCount);
}

function seatPosition(i: number, playerCount: number): string {
  if (playerCount === 4) return PLAYER_POSITIONS[i];
  return `seat-${i}`;
}

export function createInitialState(playerCount = 4): GameState {
  const dealerIndex = Math.floor(Math.random() * playerCount);
  return {
    phase: 'waiting',
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: i,
      name: PLAYER_NAMES[i % PLAYER_NAMES.length],
      position: seatPosition(i, playerCount),
      hand: [],
      tricks: [],
      bid: null,
      tricksWon: 0,
      score: 0,
      isHuman: i === 0,
    })),
    playerCount,
    round: 0,
    cardsPerPlayer: 0,
    dealerIndex,
    currentPlayerIndex: 0,
    trumpSuit: null,
    flippedCard: null,
    currentTrick: { cards: [], leadSuit: null, winnerId: null },
    tricksPlayed: 0,
    trickJustResolved: false,
    trickWinners: [],
    scoreHistory: Array.from({ length: playerCount }, () => []),
    message: 'Click Deal to start the game.',
  };
}

export function startRound(state: GameState): GameState {
  const playerCount = state.players.length;
  const round = state.round + 1;
  const cardsPerPlayer = round;
  const dealerIndex = (state.dealerIndex + playerCount - 1) % playerCount;
  const deck = shuffle(createDeck());
  const { hands, remaining } = deal(deck, cardsPerPlayer, playerCount);

  const players = state.players.map((p, i) => ({
    ...p,
    hand: sortHand(hands[i]),
    tricks: [],
    bid: null,
    tricksWon: 0,
  }));

  let trumpSuit: Suit | null = null;
  let phase: GameState['phase'] = 'bidding';
  let flippedCard: Card | null = null;

  if (cardsPerPlayer === maxRounds(playerCount)) {
    phase = 'bidding';
    trumpSuit = null;
  } else {
    flippedCard = remaining[0];
    if (flippedCard.special === 'wizard') {
      trumpSuit = null;
      phase = 'trump-select';
    } else if (flippedCard.special === 'jester') {
      trumpSuit = null;
      phase = 'bidding';
    } else {
      trumpSuit = flippedCard.suit!;
      phase = 'bidding';
    }
  }

  const firstPlayerIndex = (dealerIndex + playerCount - 1) % playerCount;

  const trumpNames: Record<string, string> = {
    hearts: '\u2665 Hearts', diamonds: '\u2666 Diamonds',
    clubs: '\u2663 Clubs', spades: '\u2660 Spades',
  };

  let message: string;
  if (phase === 'trump-select') {
    const dealerName = PLAYER_NAMES[dealerIndex];
    const hasSuits = players[dealerIndex].hand.some(c => c.suit !== null && !c.special);
    if (hasSuits) {
      message = `A Wizard was flipped! ${dealerName} (dealer), pick a trump suit.`;
    } else {
      message = `A Wizard was flipped! ${dealerName} (dealer), pick your favorite suit (you have no suit cards).`;
    }
  } else if (trumpSuit) {
    message = `Trump is ${trumpNames[trumpSuit]}. Place your bids!`;
  } else {
    message = 'No trump this round. Place your bids!';
  }

  return {
    ...state,
    phase,
    players,
    round,
    cardsPerPlayer,
    dealerIndex,
    currentPlayerIndex: phase === 'trump-select' ? dealerIndex : firstPlayerIndex,
    trumpSuit,
    flippedCard,
    currentTrick: { cards: [], leadSuit: null, winnerId: null },
    tricksPlayed: 0,
    trickWinners: [],
    message,
  };
}

export function handleSelectTrump(state: GameState, suit: Suit): GameState {
  const playerCount = state.players.length;
  const firstPlayerIndex = (state.dealerIndex + playerCount - 1) % playerCount;
  const trumpNames: Record<string, string> = {
    hearts: '\u2665 Hearts', diamonds: '\u2666 Diamonds',
    clubs: '\u2663 Clubs', spades: '\u2660 Spades',
  };
  return {
    ...state,
    phase: 'bidding',
    trumpSuit: suit,
    currentPlayerIndex: firstPlayerIndex,
    message: `Trump is ${trumpNames[suit]}. Place your bids!`,
  };
}

export function handleBid(state: GameState, bid: number): GameState {
  const playerCount = state.players.length;
  const players = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, bid } : p
  );

  const nextIndex = (state.currentPlayerIndex + playerCount - 1) % playerCount;
  const allBidded = players.every(p => p.bid !== null);

  if (allBidded) {
    return {
      ...state,
      players,
      phase: 'playing',
      currentPlayerIndex: (state.dealerIndex + playerCount - 1) % playerCount,
      message: `Bids: ${players.map(p => `${p.name}: ${p.bid}`).join(', ')}. Play a card!`,
    };
  }

  const nextPlayer = players[nextIndex];
  return {
    ...state,
    players,
    currentPlayerIndex: nextIndex,
    message: nextPlayer.isHuman ? 'Your turn to bid!' : `${nextPlayer.name} is bidding...`,
  };
}

export function handlePlayCard(state: GameState, card: Card): GameState {
  const playerCount = state.players.length;
  const player = state.players[state.currentPlayerIndex];
  const newHand = player.hand.filter(c => c.id !== card.id);

  const newLeadSuit = (() => {
    if (state.currentTrick.cards.length === 0) {
      return (card.special === 'wizard' || card.special === 'jester') ? null : card.suit;
    }
    if (state.currentTrick.leadSuit === null && state.currentTrick.cards.length === 1 && state.currentTrick.cards[0].card.special === 'jester' && !card.special && card.suit) {
      return card.suit;
    }
    return state.currentTrick.leadSuit;
  })();

  const trick: Trick = {
    ...state.currentTrick,
    cards: [...state.currentTrick.cards, { playerId: player.id, card }],
    leadSuit: newLeadSuit,
  };

  const players = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: newHand } : p
  );

  if (trick.cards.length === playerCount) {
    return {
      ...state,
      players,
      currentTrick: trick,
      phase: 'trick-pause',
      trickJustResolved: false,
      message: '',
    };
  }

  const nextIndex = (state.currentPlayerIndex + playerCount - 1) % playerCount;

  return {
    ...state,
    players,
    currentTrick: trick,
    currentPlayerIndex: nextIndex,
    trickJustResolved: false,
    message: state.players[nextIndex].isHuman ? 'Your turn!' : `${state.players[nextIndex].name} is thinking...`,
  };
}

export function handleTrickPause(state: GameState): GameState {
  const winnerId = determineTrickWinner(state.currentTrick, state.trumpSuit);

  const wonCards = state.currentTrick.cards.map(tc => tc.card);
  const winnerIndex = state.currentTrick.cards.findIndex(tc => tc.playerId === winnerId);

  const players = state.players.map((p) => {
    if (winnerId === null) return p;
    return {
      ...p,
      tricksWon: p.id === winnerId ? p.tricksWon + 1 : p.tricksWon,
      tricks:
        p.id === winnerId && winnerIndex >= 0
          ? [...p.tricks, { cards: wonCards, winnerIndex }]
          : p.tricks,
    };
  });

  const tricksPlayed = state.tricksPlayed + 1;
  const handSize = state.cardsPerPlayer;

  if (tricksPlayed >= handSize) {
    return handleEndOfRound({ ...state, players, currentTrick: { cards: [], leadSuit: null, winnerId: null }, tricksPlayed });
  }

  return {
    ...state,
    players,
    phase: 'playing',
    currentPlayerIndex: winnerId ?? 0,
    currentTrick: { cards: [], leadSuit: null, winnerId: null },
    tricksPlayed,
    trickJustResolved: true,
    trickWinners: [...state.trickWinners, winnerId ?? -1],
    message: winnerId !== null
      ? `${state.players[winnerId].name} won the trick!`
      : '',
  };
}

function handleEndOfRound(state: GameState): GameState {
  const newScoreHistory = state.scoreHistory.map(h => [...h]);

  const players = state.players.map((p, i) => {
    const bid = p.bid ?? 0;
    const taken = p.tricksWon;
    const roundScore = calculateScore(bid, taken);
    newScoreHistory[i].push({ bid, taken, score: roundScore });
    return {
      ...p,
      score: p.score + roundScore,
    };
  });

  const gameOver = state.round >= maxRounds(state.players.length);

  return {
    ...state,
    players,
    scoreHistory: newScoreHistory,
    phase: gameOver ? 'game-over' : 'scoring',
    message: gameOver ? 'Game Over!' : 'Round complete!',
  };
}

export function handleContinueRound(state: GameState): GameState {
  if (state.round >= maxRounds(state.players.length)) {
    return { ...state, phase: 'game-over' };
  }
  return startRound(state);
}

export function buildAIContext(state: GameState, playerIndex: number): AIContext {
  const player = state.players[playerIndex];

  const cardsPlayed: Card[] = [];
  for (const p of state.players) {
    for (const trick of p.tricks) {
      cardsPlayed.push(...trick.cards);
    }
  }
  for (const { card } of state.currentTrick.cards) {
    cardsPlayed.push(card);
  }

  return {
    playerIndex,
    hand: player.hand,
    bid: player.bid ?? 0,
    tricksWon: player.tricksWon,
    allBids: state.players.map(p => p.bid),
    allTricksWon: state.players.map(p => p.tricksWon),
    trumpSuit: state.trumpSuit,
    cardsPlayed,
    tricksPlayed: state.tricksPlayed,
    cardsPerPlayer: state.cardsPerPlayer,
    position: player.position,
  };
}

export function handleAIPlayer(state: GameState): GameState {
  if (state.phase === 'trump-select') {
    const player = state.players[state.currentPlayerIndex];
    const suitsInHand = new Set<Suit>(
      player.hand.filter(c => c.suit !== null && !c.special).map(c => c.suit as Suit)
    );
    const allSuits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const suit = suitsInHand.size > 0
      ? Array.from(suitsInHand)[Math.floor(Math.random() * suitsInHand.size)]
      : allSuits[Math.floor(Math.random() * 4)];
    return handleSelectTrump(state, suit);
  }

  if (state.phase === 'bidding') {
    const player = state.players[state.currentPlayerIndex];
    const ctx = buildAIContext(state, state.currentPlayerIndex);
    const bid = calculateBid(player.hand, ctx);
    return handleBid(state, bid);
  }

  if (state.phase === 'playing') {
    const player = state.players[state.currentPlayerIndex];
    const ctx = buildAIContext(state, state.currentPlayerIndex);
    const card = selectCard(player.hand, state.currentTrick, ctx);
    return handlePlayCard(state, card);
  }

  return state;
}

export function collectAllCardsPlayed(state: GameState): Card[] {
  const cardsPlayed: Card[] = [];
  for (const p of state.players) {
    for (const trick of p.tricks) {
      cardsPlayed.push(...trick.cards);
    }
  }
  for (const { card } of state.currentTrick.cards) {
    cardsPlayed.push(card);
  }
  return cardsPlayed;
}
