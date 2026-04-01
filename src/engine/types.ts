// Contract Crown Game Engine Types

// Card representation
export type Suit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // 7=7, 8=8, 9=9, 10=10, J=11, Q=12, K=13, A=14
}

// Player representation
export interface Player {
  id: number;
  hand: Card[];
  team: 0 | 1; // Team 0: players 0&2, Team 1: players 1&3
  isBot: boolean;
}

// Trick representation
export interface Trick {
  leadPlayer: number;
  cards: PlayedCard[];
  winner: number | null;
}

export interface PlayedCard {
  card: Card;
  player: number;
}

// Game state representation
export type GamePhase = 
  | 'DEALING_INITIAL'
  | 'TRUMP_DECLARATION'
  | 'DEALING_FINAL'
  | 'TRICK_PLAY'
  | 'ROUND_END'
  | 'GAME_END';

export interface GameState {
  deck: Card[];
  players: Player[];
  currentTrick: Trick;
  completedTricks: Trick[];
  trumpSuit: Suit | null;
  crownHolder: number; // player index
  trumpDeclarer: number | null; // player who declared trump
  dealer: number; // player index
  phase: GamePhase;
  scores: [number, number]; // [team0, team1]
  currentPlayer: number;
  // Bot-specific properties for SmartBot integration
  partnerIndex: number;
  isDeclaringTeam: boolean;
  tricksWonByTeam: number;
}
