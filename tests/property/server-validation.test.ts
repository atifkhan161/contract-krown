// Property Tests for Server Action Validation
// Feature: contract-crown-game, Property 26: Server Action Validation
// Validates: Requirements 11.2

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  dealInitial, dealFinal, declareTrump,
  canPlayCard, playCard, createInitialState, setFirstTrickLeader
} from '@src/engine/index.js';
import type { Card, Suit } from '@src/engine/types.js';

const ALL_SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];

describe('Property 26: Server Action Validation', () => {
  it('rejects trump declaration by non-crown-holder', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_SUITS),
        (suit: Suit) => {
          const state = createInitialState();
          state.dealer = 0;
          dealInitial(state);
          // Change currentPlayer to someone other than crownHolder
          state.currentPlayer = (state.crownHolder + 1) % 4;
          expect(() => declareTrump(state, suit)).toThrow();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects trump declaration in wrong phase', () => {
    const state = createInitialState();
    state.dealer = 0;
    dealInitial(state);
    state.phase = 'TRICK_PLAY';
    expect(() => declareTrump(state, 'HEARTS')).toThrow();

    const state2 = createInitialState();
    state2.dealer = 0;
    state2.phase = 'DEALING_INITIAL';
    expect(() => declareTrump(state2, 'HEARTS')).toThrow();

    const state3 = createInitialState();
    state3.dealer = 0;
    dealInitial(state3);
    declareTrump(state3, 'HEARTS');
    dealFinal(state3);
    setFirstTrickLeader(state3);
    state3.phase = 'TRICK_PLAY';
    expect(() => declareTrump(state3, 'SPADES')).toThrow();
  });

  it('rejects playing card out of turn', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        (actualPlayer: number, wrongPlayer: number) => {
          fc.pre(actualPlayer !== wrongPlayer);
          const state = createInitialState();
          state.dealer = 0;
          dealInitial(state);
          declareTrump(state, 'HEARTS');
          dealFinal(state);
          setFirstTrickLeader(state);
          state.phase = 'TRICK_PLAY';
          state.currentPlayer = actualPlayer;
          const card = state.players[wrongPlayer].hand[0];
          expect(() => playCard(state, wrongPlayer, card)).toThrow();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects playing card not in hand', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (dealer: number) => {
          const state = createInitialState();
          state.dealer = dealer;
          dealInitial(state);
          declareTrump(state, 'HEARTS');
          dealFinal(state);
          setFirstTrickLeader(state);
          state.phase = 'TRICK_PLAY';

          const currentPlayer = state.currentPlayer;
          const hand = state.players[currentPlayer].hand;
          // Create a card that is definitely NOT in this player's hand
          const allHandKeys = new Set(hand.map(c => `${c.suit}-${c.rank}`));
          const allCards: Card[] = [];
          for (const suit of ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'] as Suit[]) {
            for (const rank of ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const) {
              const values: Record<string, number> = { '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
              allCards.push({ suit, rank, value: values[rank] });
            }
          }
          const notInHand = allCards.find(c => !allHandKeys.has(`${c.suit}-${c.rank}`));
          if (!notInHand) return true; // skip if all cards somehow in hand

          expect(() => playCard(state, currentPlayer, notInHand)).toThrow();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects playing card that violates suit following', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_SUITS),
        (ledSuit: Suit) => {
          const state = createInitialState();
          state.dealer = 0;
          dealInitial(state);
          declareTrump(state, ledSuit);
          dealFinal(state);
          setFirstTrickLeader(state);
          state.phase = 'TRICK_PLAY';

          const leader = state.currentPlayer;
          const ledCard = state.players[leader].hand.find(c => c.suit === ledSuit);
          fc.pre(ledCard !== undefined);
          playCard(state, leader, ledCard!);

          const follower = state.currentPlayer;
          const hasLedSuit = state.players[follower].hand.some(c => c.suit === ledSuit);
          fc.pre(hasLedSuit);

          const wrongCard = state.players[follower].hand.find(c => c.suit !== ledSuit);
          fc.pre(wrongCard !== undefined);
          expect(() => playCard(state, follower, wrongCard!)).toThrow();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects card play outside TRICK_PLAY phase', () => {
    const state = createInitialState();
    state.dealer = 0;
    dealInitial(state);
    state.phase = 'TRUMP_DECLARATION';
    const card = state.players[state.currentPlayer].hand[0];
    expect(() => playCard(state, state.currentPlayer, card)).toThrow();
  });

  it('accepts valid trump declaration by crown holder', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_SUITS),
        (suit: Suit) => {
          const state = createInitialState();
          state.dealer = 0;
          dealInitial(state);
          declareTrump(state, suit);
          expect(state.trumpSuit).toBe(suit);
          expect(state.phase).toBe('DEALING_FINAL');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts valid card play in turn', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (dealer: number) => {
          const state = createInitialState();
          state.dealer = dealer;
          dealInitial(state);
          declareTrump(state, 'HEARTS');
          dealFinal(state);
          setFirstTrickLeader(state);
          state.phase = 'TRICK_PLAY';

          const leader = state.currentPlayer;
          const card = state.players[leader].hand[0];
          playCard(state, leader, card);
          expect(state.currentTrick.cards.length).toBe(1);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validates full trick play sequence without errors', () => {
    const state = createInitialState();
    state.dealer = 0;
    dealInitial(state);
    declareTrump(state, 'HEARTS');
    dealFinal(state);
    setFirstTrickLeader(state);
    state.phase = 'TRICK_PLAY';

    for (let trick = 0; trick < 8; trick++) {
      for (let cardIdx = 0; cardIdx < 4; cardIdx++) {
        const player = state.currentPlayer;
        const playableCards = state.players[player].hand.filter(c =>
          canPlayCard(state, player, c)
        );
        expect(playableCards.length).toBeGreaterThan(0);
        playCard(state, player, playableCards[0]);
      }
      // After 8th trick, phase is ROUND_END and currentTrick still has cards
      if (trick < 7) {
        expect(state.currentTrick.cards.length).toBe(0);
      }
      expect(state.completedTricks.length).toBe(trick + 1);
    }

    expect(state.phase).toBe('ROUND_END');
    expect(state.completedTricks.length).toBe(8);
  });
});
