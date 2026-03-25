// Contract Crown UI Types

import type { Card, Suit, GameState, Player } from '../engine/types.js';

// UI State
export interface UIState {
  gameState: GameState;
  selectedCard: Card | null;
  playableCards: Card[];
  animatingCards: AnimatingCard[];
  showTrumpSelector: boolean;
  showRoundEnd: boolean;
  showVictory: boolean;
  reDealing: boolean;
}

// Animation types
export interface AnimatingCard {
  card: Card;
  from: Position;
  to: Position;
  duration: number;
  startTime: number;
}

export interface Position {
  x: number;
  y: number;
}

// Player display positions
export type PlayerPosition = 'bottom' | 'left' | 'top' | 'right';

// Player display info
export interface PlayerDisplayInfo {
  player: Player;
  position: PlayerPosition;
  isActive: boolean;
  isCrownHolder: boolean;
  cardCount: number;
}

// Card display state
export interface CardDisplayState {
  card: Card;
  isPlayable: boolean;
  isSelected: boolean;
  isAnimating: boolean;
}

// Event handlers
export type CardTapHandler = (card: Card) => void;
export type TrumpSelectionHandler = (suit: Suit) => void;
export type ModalActionHandler = () => void;