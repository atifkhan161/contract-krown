// Contract Crown Bot Manager Tests
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { BotManager } from '@src/bot/bot-manager.js';
import { createInitialState, createPlayers, dealInitial, declareTrump, dealFinal, setFirstTrickLeader, canPlayCard } from '@src/engine/index.js';
import type { Card, Suit, GameState } from '@src/engine/types.js';

// Generator for valid cards
const cardArbitrary = fc.record({
  suit: fc.constantFrom('HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'),
  rank: fc.constantFrom('7', '8', '9', '10', 'J', 'Q', 'K', 'A')
});

describe('BotManager', () => {
  const botManager = new BotManager();

  // Feature: contract-crown-game, Property 25: Bot Legal Move Selection
  describe('Property 25: Bot Legal Move Selection', () => {
    it('bot always selects a legal card to play', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'), // trump suit
          fc.array(cardArbitrary, { minLength: 1, maxLength: 8 }), // player hand
          (trumpSuit: Suit, hand: Card[]) => {
            const state = createInitialState();
            state.players = createPlayers();
            
            // Set up player 0's hand
            state.players[0].hand = hand;
            
            state.trumpSuit = trumpSuit;
            state.phase = 'TRICK_PLAY';
            state.currentTrick = { leadPlayer: 0, cards: [], winner: null };
            state.currentPlayer = 0;

            // Bot selects a card
            const selectedCard = botManager.selectCard(state, 0);

            // Verify the selected card is in the player's hand
            const cardInHand = state.players[0].hand.some(
              c => c.suit === selectedCard.suit && c.rank === selectedCard.rank
            );
            expect(cardInHand).toBe(true);

            // Verify the selected card is playable
            const isPlayable = canPlayCard(state, 0, selectedCard);
            expect(isPlayable).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('selectTrumpSuit', () => {
    it('selects suit with most cards', () => {
      const hand: Card[] = [
        { suit: 'HEARTS', rank: 'A' },
        { suit: 'HEARTS', rank: 'K' },
        { suit: 'HEARTS', rank: 'Q' },
        { suit: 'DIAMONDS', rank: 'J' },
        { suit: 'CLUBS', rank: '10' },
        { suit: 'SPADES', rank: '9' },
        { suit: 'SPADES', rank: '8' },
        { suit: 'SPADES', rank: '7' }
      ];

      const selectedSuit = botManager.selectTrumpSuit(hand);
      
      // Hearts has 3 cards, Spades has 3 cards - should pick one of them
      expect(['HEARTS', 'SPADES']).toContain(selectedSuit);
    });

    it('handles hand with equal distribution', () => {
      const hand: Card[] = [
        { suit: 'HEARTS', rank: 'A' },
        { suit: 'HEARTS', rank: 'K' },
        { suit: 'DIAMONDS', rank: 'Q' },
        { suit: 'DIAMONDS', rank: 'J' },
        { suit: 'CLUBS', rank: '10' },
        { suit: 'CLUBS', rank: '9' },
        { suit: 'SPADES', rank: '8' },
        { suit: 'SPADES', rank: '7' }
      ];

      const selectedSuit = botManager.selectTrumpSuit(hand);
      
      // All suits have 2 cards - should pick any valid suit
      expect(['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES']).toContain(selectedSuit);
    });
  });

  describe('selectCard', () => {
    it('selects highest non-trump card when leading', () => {
      const state = createInitialState();
      state.players = createPlayers();
      state.players[0].hand = [
        { suit: 'HEARTS', rank: 'A' },
        { suit: 'HEARTS', rank: 'K' },
        { suit: 'DIAMONDS', rank: 'Q' },
        { suit: 'CLUBS', rank: 'J' },
        { suit: 'SPADES', rank: '10' }
      ];
      state.trumpSuit = 'SPADES';
      state.phase = 'TRICK_PLAY';
      state.currentTrick = { leadPlayer: 0, cards: [], winner: null };
      state.currentPlayer = 0;

      const selectedCard = botManager.selectCard(state, 0);

      // Should select Ace of Hearts (highest non-trump)
      expect(selectedCard.suit).toBe('HEARTS');
      expect(selectedCard.rank).toBe('A');
    });

    it('selects lowest trump when only trumps available', () => {
      const state = createInitialState();
      state.players = createPlayers();
      state.players[0].hand = [
        { suit: 'HEARTS', rank: 'A' },
        { suit: 'HEARTS', rank: 'K' },
        { suit: 'HEARTS', rank: 'Q' }
      ];
      state.trumpSuit = 'HEARTS';
      state.phase = 'TRICK_PLAY';
      state.currentTrick = { leadPlayer: 0, cards: [], winner: null };
      state.currentPlayer = 0;

      const selectedCard = botManager.selectCard(state, 0);

      // Should select Queen of Hearts (lowest trump)
      expect(selectedCard.suit).toBe('HEARTS');
      expect(selectedCard.rank).toBe('Q');
    });

    it('follows suit when possible', () => {
      const state = createInitialState();
      state.players = createPlayers();
      state.players[0].hand = [
        { suit: 'HEARTS', rank: 'A' },
        { suit: 'HEARTS', rank: 'K' },
        { suit: 'DIAMONDS', rank: 'Q' },
        { suit: 'CLUBS', rank: 'J' }
      ];
      state.trumpSuit = 'SPADES';
      state.phase = 'TRICK_PLAY';
      state.currentTrick = {
        leadPlayer: 0,
        cards: [{ card: { suit: 'HEARTS', rank: '7' }, player: 1 }],
        winner: null
      };
      state.currentPlayer = 0;

      const selectedCard = botManager.selectCard(state, 0);

      // Should follow suit with lowest Hearts
      expect(selectedCard.suit).toBe('HEARTS');
      expect(selectedCard.rank).toBe('K');
    });

    it('plays trump when cannot follow suit', () => {
      const state = createInitialState();
      state.players = createPlayers();
      state.players[0].hand = [
        { suit: 'DIAMONDS', rank: 'A' },
        { suit: 'CLUBS', rank: 'K' },
        { suit: 'SPADES', rank: 'Q' }
      ];
      state.trumpSuit = 'SPADES';
      state.phase = 'TRICK_PLAY';
      state.currentTrick = {
        leadPlayer: 0,
        cards: [{ card: { suit: 'HEARTS', rank: '7' }, player: 1 }],
        winner: null
      };
      state.currentPlayer = 0;

      const selectedCard = botManager.selectCard(state, 0);

      // Should play trump (Spades)
      expect(selectedCard.suit).toBe('SPADES');
      expect(selectedCard.rank).toBe('Q');
    });

    it('plays lowest card when cannot follow and no trump', () => {
      const state = createInitialState();
      state.players = createPlayers();
      state.players[0].hand = [
        { suit: 'DIAMONDS', rank: 'A' },
        { suit: 'CLUBS', rank: 'K' },
        { suit: 'SPADES', rank: 'Q' }
      ];
      state.trumpSuit = 'HEARTS';
      state.phase = 'TRICK_PLAY';
      state.currentTrick = {
        leadPlayer: 0,
        cards: [{ card: { suit: 'HEARTS', rank: '7' }, player: 1 }],
        winner: null
      };
      state.currentPlayer = 0;

      const selectedCard = botManager.selectCard(state, 0);

      // Should play lowest card (Queen of Spades)
      expect(selectedCard.suit).toBe('SPADES');
      expect(selectedCard.rank).toBe('Q');
    });
  });

  describe('getDecisionDelay', () => {
    it('returns delay between 500-1500ms', () => {
      for (let i = 0; i < 100; i++) {
        const delay = botManager.getDecisionDelay();
        expect(delay).toBeGreaterThanOrEqual(500);
        expect(delay).toBeLessThanOrEqual(1500);
      }
    });
  });

  describe('evaluateHand', () => {
    it('calculates hand strength correctly', () => {
      const hand: Card[] = [
        { suit: 'HEARTS', rank: 'A' },
        { suit: 'HEARTS', rank: 'K' },
        { suit: 'DIAMONDS', rank: '7' }
      ];

      const score = botManager.evaluateHand(hand, 'HEARTS');

      // A = 7, K = 6, 7 = 0, plus 2 trump bonus for A and K
      // Expected: 7 + 6 + 0 + 2 + 2 = 17
      expect(score).toBe(17);
    });

    it('handles no trump cards', () => {
      const hand: Card[] = [
        { suit: 'HEARTS', rank: 'A' },
        { suit: 'DIAMONDS', rank: 'K' }
      ];

      const score = botManager.evaluateHand(hand, 'SPADES');

      // A = 7, K = 6, no trump bonus
      // Expected: 7 + 6 = 13
      expect(score).toBe(13);
    });
  });
});