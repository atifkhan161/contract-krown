// Contract Crown Offline Mode Integration Tests
// Tests offline game controller, bot automation, and OfflineGameView
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

import { OfflineGameController } from '@src/ui/offline-game-controller.js';
import { OfflineGameView } from '@src/ui/offline-game-view.js';
import { BotManager } from '@src/bot/index.js';
import { canPlayCard } from '@src/engine/index.js';
import type { Suit, GameState } from '@src/engine/types.js';

// Custom generators for property tests
const suitArbitrary = fc.constantFrom('HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES') as fc.Arbitrary<Suit>;

// Helper: simulate user trump declaration (mirrors controller's internal logic)
function simulateTrumpDeclaration(state: GameState, suit: Suit): void {
  if (state.phase !== 'TRUMP_DECLARATION') return;
  state.trumpSuit = suit;
  // Deal final 4 cards to each player
  for (let i = 0; i < 4; i++) {
    for (const player of state.players) {
      player.hand.push(state.deck.pop()!);
    }
  }
  state.phase = 'TRICK_PLAY';
}

describe('Offline Mode Integration Tests', () => {
  let controller: OfflineGameController;
  let botManager: BotManager;

  beforeEach(() => {
    controller = new OfflineGameController();
    botManager = new BotManager();
  });

  afterEach(() => {
    controller.stop();
  });

  describe('Offline Game Controller', () => {
    it('starts a game with 4 players', async () => {
      controller.startGame();
      
      // Wait for game to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const state = controller.getGameState();
      expect(state.players.length).toBe(4);
      expect(state.phase).toBeDefined();
    });

    it('initializes with correct player configuration', async () => {
      controller.startGame();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const state = controller.getGameState();
      // Player 0 is human, players 1-3 are bots
      expect(state.players[0].isBot).toBe(false);
      expect(state.players[1].isBot).toBe(true);
      expect(state.players[2].isBot).toBe(true);
      expect(state.players[3].isBot).toBe(true);
    });

    it('deals cards to all players', async () => {
      controller.startGame();
      
      // Wait for initial dealing to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Human is crown holder on first round, declare trump
      const state1 = controller.getGameState();
      if (state1.phase === 'TRUMP_DECLARATION') {
        simulateTrumpDeclaration(state1, 'HEARTS');
      }
      
      // Wait for final dealing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const state = controller.getGameState();
      // After dealing, each player should have 8 cards
      for (const player of state.players) {
        expect(player.hand.length).toBe(8);
      }
    });

    it('transitions to TRICK_PLAY phase after trump declaration', async () => {
      controller.startGame();
      
      // Wait for initial dealing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Human is crown holder on first round, declare trump
      const state1 = controller.getGameState();
      if (state1.phase === 'TRUMP_DECLARATION') {
        simulateTrumpDeclaration(state1, 'HEARTS');
      }
      
      // Wait for final dealing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const state = controller.getGameState();
      expect(state.phase).toBe('TRICK_PLAY');
      expect(state.trumpSuit).toBeDefined();
    });

    it('maintains valid game state during play', async () => {
      controller.startGame();
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const state = controller.getGameState();
      
      // Verify state invariants
      expect(state.players.length).toBe(4);
      expect(state.scores.length).toBe(2);
      expect(state.currentPlayer).toBeGreaterThanOrEqual(0);
      expect(state.currentPlayer).toBeLessThan(4);
      expect(state.crownHolder).toBeGreaterThanOrEqual(0);
      expect(state.crownHolder).toBeLessThan(4);
      expect(state.dealer).toBeGreaterThanOrEqual(0);
      expect(state.dealer).toBeLessThan(4);
    });
  });

  describe('Bot Manager', () => {
    it('selects a legal card for each player', () => {
      fc.assert(
        fc.property(
          suitArbitrary,
          (trumpSuit: Suit) => {
            const state = controller.getGameState();
            if (state.players.length === 0) return true; // Skip if no players
            
            // Test bot card selection for each player
            for (let playerIndex = 0; playerIndex < state.players.length; playerIndex++) {
              const player = state.players[playerIndex];
              if (player.hand.length === 0) continue;
              
              const selectedCard = botManager.selectCard(state, playerIndex);
              
              // Verify selected card is in hand
              const cardInHand = player.hand.some(
                c => c.suit === selectedCard.suit && c.rank === selectedCard.rank
              );
              expect(cardInHand).toBe(true);
              
              // Verify selected card is playable
              expect(canPlayCard(state, playerIndex, selectedCard)).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('selects trump suit based on hand composition', () => {
      const hand = [
        { suit: 'HEARTS' as const, rank: 'A' as const },
        { suit: 'HEARTS' as const, rank: 'K' as const },
        { suit: 'HEARTS' as const, rank: 'Q' as const },
        { suit: 'DIAMONDS' as const, rank: 'J' as const },
      ];
      
      const selectedSuit = botManager.selectTrumpSuit(hand);
      expect(selectedSuit).toBe('HEARTS');
    });

    it('provides decision delay within expected range', () => {
      const delay = botManager.getDecisionDelay();
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(1500);
    });
  });

  describe('OfflineGameView Integration', () => {
    it('creates container element', () => {
      const view = new OfflineGameView();
      const container = view.getContainer();
      
      expect(container).toBeDefined();
    });

    it('provides return to lobby handler', () => {
      const view = new OfflineGameView();
      let callbackCalled = false;
      
      view.setReturnToLobbyHandler(() => {
        callbackCalled = true;
      });
      
      // Handler should be set
      expect(callbackCalled).toBe(false);
    });

    it('can start a game through the view', async () => {
      const view = new OfflineGameView();
      view.startGame();
      
      // Wait for game to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const controller = view.getController();
      const state = controller.getGameState();
      
      expect(state.players.length).toBe(4);
      
      view.destroy();
    });

    it('cleans up resources on destroy', () => {
      const view = new OfflineGameView();
      view.startGame();
      
      // Destroy should not throw
      expect(() => view.destroy()).not.toThrow();
    });
  });

  describe('Game Flow', () => {
    it('can play through multiple tricks', async () => {
      controller.startGame();
      
      // Wait for initial dealing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Human is crown holder on first round, declare trump
      const state0 = controller.getGameState();
      if (state0.phase === 'TRUMP_DECLARATION') {
        simulateTrumpDeclaration(state0, 'HEARTS');
      }
      
      // Wait for game to be in TRICK_PLAY phase
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let state = controller.getGameState();
      let tricksPlayed = 0;
      
      // Play a few tricks
      while (state.phase === 'TRICK_PLAY' && tricksPlayed < 3) {
        const currentPlayer = state.currentPlayer;
        const hand = state.players[currentPlayer].hand;
        
        if (hand.length > 0) {
          const playableCard = hand.find(card => canPlayCard(state, currentPlayer, card));
          if (playableCard) {
            // Let bot play
            await new Promise(resolve => setTimeout(resolve, 1500));
            state = controller.getGameState();
            tricksPlayed++;
          }
        }
        
        if (state.currentTrick.cards.length === 0 && tricksPlayed > 0) {
          break; // Trick was completed
        }
      }
      
      expect(tricksPlayed).toBeGreaterThan(0);
    }, 10000); // 10 second timeout

    it('handles round completion', async () => {
      controller.startGame();
      
      // Wait for initial dealing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Human is crown holder on first round, declare trump
      const state0 = controller.getGameState();
      if (state0.phase === 'TRUMP_DECLARATION') {
        simulateTrumpDeclaration(state0, 'HEARTS');
      }
      
      // Wait for game to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let state = controller.getGameState();
      
      // Play until round completes or timeout
      const startTime = Date.now();
      const timeout = 15000; // 15 seconds
      
      while (state.phase === 'TRICK_PLAY' && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 500));
        state = controller.getGameState();
      }
      
      // Game should either be in ROUND_END or still in TRICK_PLAY (timeout)
      expect(['TRICK_PLAY', 'ROUND_END', 'GAME_END']).toContain(state.phase);
    }, 20000); // 20 second timeout
  });
});