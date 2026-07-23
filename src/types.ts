export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type SpecialType = 'wizard' | 'jester';

export interface Card {
  id: string;
  suit: Suit | null;
  rank: Rank | null;
  special: SpecialType | null;
}

export type PlayerPosition = 'bottom' | 'right' | 'top' | 'left';

export interface Player {
  id: number;
  name: string;
  position: PlayerPosition;
  hand: Card[];
  tricks: Card[][];
  bid: number | null;
  tricksWon: number;
  score: number;
  isHuman: boolean;
}

export interface RoundScore {
  bid: number;
  taken: number;
  score: number;
}

export type GamePhase =
  | 'waiting'
  | 'dealing'
  | 'trump-select'
  | 'bidding'
  | 'playing'
  | 'trick-resolve'
  | 'trick-pause'
  | 'scoring'
  | 'game-over';

export interface Trick {
  cards: { playerId: number; card: Card }[];
  leadSuit: Suit | null;
  winnerId: number | null;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  round: number;
  cardsPerPlayer: number;
  dealerIndex: number;
  currentPlayerIndex: number;
  trumpSuit: Suit | null;
  flippedCard: Card | null;
  currentTrick: Trick;
  tricksPlayed: number;
  trickJustResolved: boolean;
  trickWinners: number[];
  scoreHistory: RoundScore[][];
  message: string;
}
