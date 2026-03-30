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
            state.partnerIndex = 2;
            state.isDeclaringTeam = true;
            state.tricksWonByTeam = 0;

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
        { suit: 'HEARTS', rank: 'A', value: 14 },
        { suit: 'HEARTS', rank: 'K', value: 13 },
        { suit: 'HEARTS', rank: 'Q', value: 12 },
        { suit: 'DIAMONDS', rank: 'J', value: 11 },
        { suit: 'CLUBS', rank: '10', value: 10 },
        { suit: 'SPADES', rank: '9', value: 9 },
        { suit: 'SPADES', rank: '8', value: 8 },
        { suit: 'SPADES', rank: '7', value: 7 }
      ];

      const selectedSuit = botManager.selectTrumpSuit(hand);
      
      // Hearts has 3 cards, Spades has 3 cards - should pick one of them
      expect(['HEARTS', 'SPADES']).toContain(selectedSuit);
    });

    it('handles hand with equal distribution', () => {
      const hand: Card[] = [
        { suit: 'HEARTS', rank: 'A', value: 14 },
        { suit: 'HEARTS', rank: 'K', value: 13 },
        { suit: 'DIAMONDS', rank: 'Q', value: 12 },
        { suit: 'DIAMONDS', rank: 'J', value: 11 },
        { suit: 'CLUBS', rank: '10', value: 10 },
        { suit: 'CLUBS', rank: '9', value: 9 },
        { suit: 'SPADES', rank: '8', value: 8 },
        { suit: 'SPADES', rank: '7', value: 7 }
      ];

      const selectedSuit = botManager.selectTrumpSuit(hand);
      
      // All suits have 2 cards - should pick any valid suit
      expect(['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES']).toContain(selectedSuit);
    });
  });

  describe('SmartBot Integration', () => {
    it('plays Ace of non-trump suit when leading', () => {
      const state = createInitialState();
      state.players = createPlayers();
      state.players[0].hand = [
        { suit: 'HEARTS', rank: 'A', value: 14 },
        { suit: 'HEARTS', rank: 'K', value: 13 },
        { suit: 'DIAMONDS', rank: 'Q', value: 12 },
        { suit: 'CLUBS', rank: 'J', value: 11 }
      ];
      state.trumpSuit = 'SPADES';
      state.phase = 'TRICK_PLAY';
      state.currentTrick = { leadPlayer: 0, cards: [], winner: null };
      state.currentPlayer = 0;
      state.partnerIndex = 2;
      state.isDeclaringTeam = true;
      state.tricksWonByTeam = 0;

      const selectedCard = botManager.selectCard(state, 0);

      // SmartBot should lead with Ace of Hearts (safe win)
      expect(selectedCard.suit).toBe('HEARTS');
      expect(selectedCard.rank).toBe('A');
    });

    it('plays lowest card when partner is winning', () => {
      const state = createInitialState();
      state.players = createPlayers();
      state.players[0].hand = [
        { suit: 'HEARTS', rank: 'A', value: 14 },
        { suit: 'HEARTS', rank: 'K', value: 13 },
        { suit: 'DIAMONDS', rank: 'Q', value: 12 }
      ];
      state.trumpSuit = 'SPADES';
      state.phase = 'TRICK_PLAY';
      state.currentTrick = {
        leadPlayer: 0,
        cards: [
          { card: { suit: 'HEARTS', rank: '7', value: 7 }, player: 1 },
          { card: { suit: 'HEARTS', rank: '8', value: 8 }, player: 2 },
          { card: { suit: 'HEARTS', rank: '9', value: 9 }, player: 3 }
        ],
        winner: null
      };
      state.currentPlayer = 0;
      state.partnerIndex = 2; // Player 2 is partner
      state.isDeclaringTeam = true;
      state.tricksWonByTeam = 0;

      const selectedCard = botManager.selectCard(state, 0);

      // Partner (player 2) is winning, so play lowest card to save high cards
      // Must follow suit (Hearts), so play King of Hearts (lowest Hearts card)
      expect(selectedCard.suit).toBe('HEARTS');
      expect(selectedCard.rank).toBe('K');
    });

    it('plays lowest winning card when can win trick', () => {
      const state = createInitialState();
      state.players = createPlayers();
      state.players[0].hand = [
        { suit: 'HEARTS', rank: 'A', value: 14 },
        { suit: 'HEARTS', rank: 'K', value: 13 },
        { suit: 'HEARTS', rank: 'Q', value: 12 }
      ];
      state.trumpSuit = 'HEARTS';
      state.phase = 'TRICK_PLAY';
      state.currentTrick = {
        leadPlayer: 0,
        cards: [
          { card: { suit: 'HEARTS', rank: '7', value: 7 }, player: 1 },
          { card: { suit: 'HEARTS', rank: '8', value: 8 }, player: 2 },
          { card: { suit: 'HEARTS', rank: '9', value: 9 }, player: 3 }
        ],
        winner: null
      };
      state.currentPlayer = 0;
      state.partnerIndex = 2;
      state.isDeclaringTeam = true;
      state.tricksWonByTeam = 0;

      const selectedCard = botManager.selectCard(state, 0);

      // Can win with any trump, so play lowest winning card (Queen)
      expect(selectedCard.suit).toBe('HEARTS');
      expect(selectedCard.rank).toBe('Q');
    });

    it('plays lowest card when cannot win trick', () => {
      const state = createInitialState();
      state.players = createPlayers();
      state.players[0].hand = [
        { suit: 'DIAMONDS', rank: '7', value: 7 },
        { suit: 'CLUBS', rank: '8', value: 8 },
        { suit: 'SPADES', rank: '9', value: 9 }
      ];
      state.trumpSuit = 'HEARTS';
      state.phase = 'TRICK_PLAY';
      state.currentTrick = {
        leadPlayer: 0,
        cards: [
          { card: { suit: 'DIAMONDS', rank: 'A', value: 14 }, player: 1 },
          { card: { suit: 'DIAMONDS', rank: 'K', value: 13 }, player: 2 },
          { card: { suit: 'DIAMONDS', rank: 'Q', value: 12 }, player: 3 }
        ],
        winner: null
      };
      state.currentPlayer = 0;
      state.partnerIndex = 2;
      state.isDeclaringTeam = true;
      state.tricksWonByTeam = 0;

      const selectedCard = botManager.selectCard(state, 0);

      // Cannot win trick, so play lowest card (7 of Diamonds)
      expect(selectedCard.suit).toBe('DIAMONDS');
      expect(selectedCard.rank).toBe('7');
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
    it('calculates hand strength correctly with new value system', () => {
      const hand: Card[] = [
        { suit: 'HEARTS', rank: 'A', value: 14 },
        { suit: 'HEARTS', rank: 'K', value: 13 },
        { suit: 'DIAMONDS', rank: '7', value: 7 }
      ];

      const score = botManager.evaluateHand(hand, 'HEARTS');

      // A = 8, K = 7, 7 = 1, plus 2 trump bonus for A and K
      // Expected: 8 + 7 + 1 + 2 + 2 = 20
      expect(score).toBe(20);
    });

    it('handles no trump cards with new value system', () => {
      const hand: Card[] = [
        { suit: 'HEARTS', rank: 'A', value: 14 },
        { suit: 'DIAMONDS', rank: 'K', value: 13 }
      ];

      const score = botManager.evaluateHand(hand, 'SPADES');

      // A = 8, K = 7, no trump bonus
      // Expected: 8 + 7 = 15
      expect(score).toBe(15);
    });
  });
});
