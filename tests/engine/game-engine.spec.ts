// Contract Crown Game Engine Property Tests
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { createDeck, shuffle, createInitialState, createPlayers, dealInitial, dealFinal, validateDeal, checkForExtremeHand, validateAndDeal } from '@src/engine/index.js';
import type { Card } from '@src/engine/index.js';

// Feature: contract-crown-game, Property 1: Deck Composition
describe('Property 1: Deck Composition', () => {
  it('deck contains exactly 32 cards with correct distribution', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const deck = createDeck();

        // Verify total count
        expect(deck.length).toBe(32);

        // Verify suit distribution
        const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
        suits.forEach(suit => {
          const suitCards = deck.filter(c => c.suit === suit);
          expect(suitCards.length).toBe(8);
        });

        // Verify rank distribution
        const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        ranks.forEach(rank => {
          const rankCards = deck.filter(c => c.rank === rank);
          expect(rankCards.length).toBe(4);
        });
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 2: Shuffle Preservation
describe('Property 2: Shuffle Preservation', () => {
  it('shuffling preserves all cards while producing different ordering', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const originalDeck = createDeck();
        const shuffledDeck = shuffle(originalDeck);

        // Verify same number of cards
        expect(shuffledDeck.length).toBe(originalDeck.length);

        // Verify all cards are preserved (no additions or removals)
        const originalSet = new Set(originalDeck.map(c => `${c.suit}-${c.rank}`));
        const shuffledSet = new Set(shuffledDeck.map(c => `${c.suit}-${c.rank}`));
        expect(originalSet).toEqual(shuffledSet);

        // Verify ordering is different (with high probability)
        const isDifferent = originalDeck.some((card, index) => !shuffledDeck[index] || card.suit !== shuffledDeck[index].suit || card.rank !== shuffledDeck[index].rank);
        expect(isDifferent).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 3: Initial Deal Distribution
describe('Property 3: Initial Deal Distribution', () => {
  it('each player has exactly 4 cards after initial deal', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const state = createInitialState();
        dealInitial(state);

        // Verify each player has exactly 4 cards
        state.players.forEach(player => {
          expect(player.hand.length).toBe(4);
        });

        // Verify total cards accounted for
        const totalCards = state.players.reduce((sum, p) => sum + p.hand.length, 0) + state.deck.length;
        expect(totalCards).toBe(32);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 4: Final Deal Distribution
describe('Property 4: Final Deal Distribution', () => {
  it('each player has exactly 8 cards after final deal', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const state = createInitialState();
        dealInitial(state);
        dealFinal(state);

        // Verify each player has exactly 8 cards
        state.players.forEach(player => {
          expect(player.hand.length).toBe(8);
        });

        // Verify deck is empty
        expect(state.deck.length).toBe(0);

        // Verify total cards accounted for
        const totalCards = state.players.reduce((sum, p) => sum + p.hand.length, 0);
        expect(totalCards).toBe(32);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 4.1: Re-Deal on Extreme Hand Condition
describe('Property 4.1: Re-Deal on Extreme Hand Condition', () => {
  it('validateDeal returns false when player has 3+ Aces or 3+ Sevens', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const state = createInitialState();
        state.players = createPlayers();

        // Create a hand with 3 Aces
        const extremeHand: Card[] = [
          { suit: 'HEARTS', rank: 'A' },
          { suit: 'DIAMONDS', rank: 'A' },
          { suit: 'CLUBS', rank: 'A' },
          { suit: 'SPADES', rank: '7' },
          { suit: 'HEARTS', rank: '7' },
          { suit: 'DIAMONDS', rank: '7' },
          { suit: 'CLUBS', rank: 'K' },
          { suit: 'SPADES', rank: 'Q' }
        ];

        state.players[0].hand = extremeHand;

        // Check for extreme hand
        expect(checkForExtremeHand(state)).toBe(true);

        // Validate deal should fail
        expect(validateDeal(state)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('validateAndDeal re-deals until valid hand is achieved', () => {
    // This test verifies the re-deal loop works
    // Note: This test may take multiple runs to pass due to randomness
    // We run it multiple times to increase confidence
    for (let i = 0; i < 10; i++) {
      const state = createInitialState();
      validateAndDeal(state);

      // Verify all players have 8 cards
      state.players.forEach(player => {
        expect(player.hand.length).toBe(8);
      });

      // Verify no extreme hands
      expect(checkForExtremeHand(state)).toBe(false);
    }
  });
});

// Feature: contract-crown-game, Property 5: Crown Holder Identification
describe('Property 5: Crown Holder Identification', () => {
  it('crown holder is a valid player index after initial dealing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // dealer position
        (dealer: number) => {
          const state = createInitialState();
          state.dealer = dealer;
          dealInitial(state);

          // Crown holder must be a valid player index (0-3)
          expect(state.crownHolder).toBeGreaterThanOrEqual(0);
          expect(state.crownHolder).toBeLessThanOrEqual(3);

          // Crown holder should be player left of dealer
          expect(state.crownHolder).toBe((dealer + 1) % 4);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('crown holder is different from dealer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // dealer position
        (dealer: number) => {
          const state = createInitialState();
          state.dealer = dealer;
          dealInitial(state);

          // Crown holder should never be the dealer
          expect(state.crownHolder).not.toBe(dealer);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('crown holder rotates through all players as dealer changes', () => {
    const crownHolders = new Set<number>();

    for (let dealer = 0; dealer < 4; dealer++) {
      const state = createInitialState();
      state.dealer = dealer;
      dealInitial(state);
      crownHolders.add(state.crownHolder);
    }

    // All 4 players should have been crown holder at some point
    expect(crownHolders.size).toBe(4);
  });
});

// Unit tests for specific examples
describe('Unit Tests', () => {
  it('creates players with correct team assignments', () => {
    const players = createPlayers();

    expect(players[0].team).toBe(0);
    expect(players[1].team).toBe(1);
    expect(players[2].team).toBe(0);
    expect(players[3].team).toBe(1);
  });

  it('sets crown holder to player left of dealer', () => {
    const state = createInitialState();
    state.dealer = 0;
    dealInitial(state);

    expect(state.crownHolder).toBe(1);
  });

  it('sets crown holder when dealer is player 3', () => {
    const state = createInitialState();
    state.dealer = 3;
    dealInitial(state);

    expect(state.crownHolder).toBe(0);
  });

  it('detects extreme hand with 3 Sevens', () => {
    const state = createInitialState();
    state.players = createPlayers();

    const extremeHand: Card[] = [
      { suit: 'HEARTS', rank: '7' },
      { suit: 'DIAMONDS', rank: '7' },
      { suit: 'CLUBS', rank: '7' },
      { suit: 'SPADES', rank: 'A' },
      { suit: 'HEARTS', rank: 'K' },
      { suit: 'DIAMONDS', rank: 'Q' },
      { suit: 'CLUBS', rank: 'J' },
      { suit: 'SPADES', rank: '10' }
    ];

    state.players[2].hand = extremeHand;

    expect(checkForExtremeHand(state)).toBe(true);
    expect(validateDeal(state)).toBe(false);
  });

  it('allows valid deal with 2 Aces and 2 Sevens', () => {
    const state = createInitialState();
    state.players = createPlayers();

    const validHand: Card[] = [
      { suit: 'HEARTS', rank: 'A' },
      { suit: 'DIAMONDS', rank: 'A' },
      { suit: 'CLUBS', rank: '7' },
      { suit: 'SPADES', rank: '7' },
      { suit: 'HEARTS', rank: 'K' },
      { suit: 'DIAMONDS', rank: 'Q' },
      { suit: 'CLUBS', rank: 'J' },
      { suit: 'SPADES', rank: '10' }
    ];

    state.players[0].hand = validHand;

    expect(checkForExtremeHand(state)).toBe(false);
    expect(validateDeal(state)).toBe(true);
  });
});
