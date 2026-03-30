// Fourth Card Visibility Test
// Verifies that the 4th card in a trick is visible in the trick area

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { GameView } from '../../src/ui/game-view.js';
import type { GameState, Card, PlayedCard } from '../../src/engine/types.js';

// Set up jsdom for this test file
const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>`, {
  url: 'http://localhost',
  pretendToBeVisual: true
});

(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).HTMLDivElement = dom.window.HTMLDivElement;
(global as any).navigator = dom.window.navigator;

// Helper function to create a card with value
function createCard(suit: string, rank: string, value: number): Card {
  return { suit: suit as any, rank: rank as any, value };
}

describe('Fourth Card Visibility', () => {
  let gameView: GameView;
  let container: HTMLElement;

  beforeEach(() => {
    // Create a DOM container for the game view
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
    
    gameView = new GameView();
    
    // Append game view container to DOM
    const gameViewContainer = gameView.getContainer();
    if (gameViewContainer) {
      container.appendChild(gameViewContainer);
    }
  });

  afterEach(() => {
    // Clean up
    gameView.destroy();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Property 31: Fourth Card Display', () => {
    it('should display all 4 cards when current trick has 4 cards', () => {
      const state: GameState = {
        deck: [],
        players: [
          { id: 0, hand: [], team: 0, isBot: false },
          { id: 1, hand: [], team: 1, isBot: true },
          { id: 2, hand: [], team: 0, isBot: true },
          { id: 3, hand: [], team: 1, isBot: true }
        ],
        currentTrick: {
          leadPlayer: 0,
          cards: [
            { card: createCard('HEARTS', 'A', 14), player: 0 },
            { card: createCard('HEARTS', 'K', 13), player: 1 },
            { card: createCard('HEARTS', 'Q', 12), player: 2 },
            { card: createCard('HEARTS', 'J', 11), player: 3 }
          ] as PlayedCard[],
          winner: null
        },
        completedTricks: [],
        trumpSuit: 'SPADES',
        crownHolder: 0,
        dealer: 3,
        phase: 'TRICK_PLAY',
        scores: [0, 0],
        partnerIndex: 2,
        isDeclaringTeam: false,
        tricksWonByTeam: 0,
        currentPlayer: 0
      };

      // Render the view
      gameView.render(state, 0);

      // Check that trick display buffer has 4 cards
      const trickCards = document.querySelectorAll('.trick-area .trick-card-slot');
      expect(trickCards.length).toBe(4);
    });

    it('should display 4th card from completed trick when current trick is empty', () => {
      // This is the critical test case - after 4th card is played, 
      // currentTrick.cards becomes empty but completedTricks has the trick
      const state: GameState = {
        deck: [],
        players: [
          { id: 0, hand: [], team: 0, isBot: false },
          { id: 1, hand: [], team: 1, isBot: true },
          { id: 2, hand: [], team: 0, isBot: true },
          { id: 3, hand: [], team: 1, isBot: true }
        ],
        currentTrick: {
          leadPlayer: 0,
          cards: [], // EMPTY - trick was just resolved
          winner: null
        },
        completedTricks: [
          {
            leadPlayer: 0,
            cards: [
              { card: createCard('HEARTS', 'A', 14), player: 0 },
              { card: createCard('HEARTS', 'K', 13), player: 1 },
              { card: createCard('HEARTS', 'Q', 12), player: 2 },
              { card: createCard('HEARTS', 'J', 11), player: 3 } // 4th card
            ] as PlayedCard[],
            winner: 0
          }
        ],
        trumpSuit: 'SPADES',
        crownHolder: 0,
        dealer: 3,
        phase: 'TRICK_PLAY',
        scores: [0, 0],
        partnerIndex: 2,
        isDeclaringTeam: false,
        tricksWonByTeam: 0,
        currentPlayer: 0
      };

      // Render the view
      gameView.render(state, 0);

      // Check that trick display buffer has 4 cards from completed trick
      const trickCards = document.querySelectorAll('.trick-area .trick-card-slot');
      expect(trickCards.length).toBe(4);
      
      // Verify the 4th card (player 3's card) is present
      const playerLabels = document.querySelectorAll('.card-player-label');
      const labels = Array.from(playerLabels).map(el => el.textContent);
      expect(labels).toContain('Right'); // Player 3 is "Right"
    });

    it('should display correct player labels for each card position', () => {
      const state: GameState = {
        deck: [],
        players: [
          { id: 0, hand: [], team: 0, isBot: false },
          { id: 1, hand: [], team: 1, isBot: true },
          { id: 2, hand: [], team: 0, isBot: true },
          { id: 3, hand: [], team: 1, isBot: true }
        ],
        currentTrick: {
          leadPlayer: 0,
          cards: [
            { card: createCard('HEARTS', 'A', 14), player: 0 },
            { card: createCard('DIAMONDS', 'K', 13), player: 1 },
            { card: createCard('CLUBS', 'Q', 12), player: 2 },
            { card: createCard('SPADES', 'J', 11), player: 3 }
          ] as PlayedCard[],
          winner: null
        },
        completedTricks: [],
        trumpSuit: 'SPADES',
        crownHolder: 0,
        dealer: 3,
        phase: 'TRICK_PLAY',
        scores: [0, 0],
        partnerIndex: 2,
        isDeclaringTeam: false,
        tricksWonByTeam: 0,
        currentPlayer: 0
      };

      gameView.render(state, 0);

      // Check all 4 positions have correct labels
      const bottomLabel = document.querySelector('.trick-card-slot.position-bottom .card-player-label');
      const leftLabel = document.querySelector('.trick-card-slot.position-left .card-player-label');
      const topLabel = document.querySelector('.trick-card-slot.position-top .card-player-label');
      const rightLabel = document.querySelector('.trick-card-slot.position-right .card-player-label');

      expect(bottomLabel?.textContent).toBe('You');
      expect(leftLabel?.textContent).toBe('Left');
      expect(topLabel?.textContent).toBe('Partner');
      expect(rightLabel?.textContent).toBe('Right');
    });

    it('should highlight winner card label when trick has a winner', () => {
      const state: GameState = {
        deck: [],
        players: [
          { id: 0, hand: [], team: 0, isBot: false },
          { id: 1, hand: [], team: 1, isBot: true },
          { id: 2, hand: [], team: 0, isBot: true },
          { id: 3, hand: [], team: 1, isBot: true }
        ],
        currentTrick: {
          leadPlayer: 0,
          cards: [
            { card: createCard('HEARTS', 'A', 14), player: 0 },
            { card: createCard('HEARTS', 'K', 13), player: 1 },
            { card: createCard('HEARTS', 'Q', 12), player: 2 },
            { card: createCard('HEARTS', 'J', 11), player: 3 }
          ] as PlayedCard[],
          winner: 0 // Player 0 (You) won
        },
        completedTricks: [],
        trumpSuit: 'SPADES',
        crownHolder: 0,
        dealer: 3,
        phase: 'TRICK_PLAY',
        scores: [0, 0],
        partnerIndex: 2,
        isDeclaringTeam: false,
        tricksWonByTeam: 0,
        currentPlayer: 0
      };

      gameView.render(state, 0);

      // Check that winner label has 'winner' class
      const winnerLabel = document.querySelector('.trick-card-slot.position-bottom .card-player-label');
      expect(winnerLabel?.classList.contains('winner')).toBe(true);
      
      // Check that non-winners don't have 'winner' class
      const nonWinnerLabel = document.querySelector('.trick-card-slot.position-left .card-player-label');
      expect(nonWinnerLabel?.classList.contains('winner')).toBe(false);
    });
  });
});
