// Property Tests for Team Memory System
// Tests Properties 37-42, 48, 49 from design.md

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TeamMemory } from '@src/bot/team-memory.js';
import type { Card, Suit, Rank } from '@src/engine/types.js';

const ALL_SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
const ALL_RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const HIGH_RANKS: Rank[] = ['A', 'K', 'Q'];

function createCard(suit: Suit, rank: Rank): Card {
  const values: Record<Rank, number> = { '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  return { suit, rank, value: values[rank] };
}

const cardArbitrary = fc.record({
  suit: fc.constantFrom(...ALL_SUITS),
  rank: fc.constantFrom(...ALL_RANKS)
}).map((r: { suit: Suit; rank: Rank }) => createCard(r.suit, r.rank));

describe('Team Memory Property Tests', () => {
  // Property 37: Team Memory Tracks All Team Plays
  it('Property 37: records all team plays regardless of trick outcome', () => {
    fc.assert(
      fc.property(
        fc.array(cardArbitrary, { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 8 }),
        fc.boolean(),
        (cards: Card[], player: number, trickNumber: number, didWeWin: boolean) => {
          const memory = new TeamMemory();
          for (const card of cards) {
            memory.recordOurPlay(player, card, trickNumber, didWeWin);
          }
          expect(memory.ourPlays.length).toBe(cards.length);
          for (const card of cards) {
            const found = memory.ourPlays.some(
              p => p.card.suit === card.suit && p.card.rank === card.rank && p.player === player
            );
            expect(found).toBe(true);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 38: Team Memory Records Complete Won Tricks
  it('Property 38: records all 4 cards when team wins a trick', () => {
    fc.assert(
      fc.property(
        fc.array(cardArbitrary, { minLength: 4, maxLength: 4 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 8 }),
        fc.constantFrom(...ALL_SUITS),
        (cards: Card[], winner: number, trickNumber: number, ledSuit: Suit) => {
          const memory = new TeamMemory();
          const trick = {
            trickNumber,
            winner,
            allCards: cards.map((card: Card, i: number) => ({ player: i, card })),
            ledSuit
          };
          memory.recordTrickWeWon(trick);
          expect(memory.tricksWeWon.length).toBe(1);
          expect(memory.tricksWeWon[0].allCards.length).toBe(4);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 39: Remaining Cards Perfect Calculation
  it('Property 39: remaining cards equals 32 minus known cards', () => {
    fc.assert(
      fc.property(
        fc.array(cardArbitrary, { minLength: 1, maxLength: 16 }),
        (knownCards: Card[]) => {
          const memory = new TeamMemory();
          const uniqueCards: Card[] = [];
          const seen = new Set<string>();
          for (const card of knownCards) {
            const key = `${card.suit}-${card.rank}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueCards.push(card);
              memory.recordOurPlay(0, card, 1, true);
            }
          }
          const remaining = memory.getRemainingCards();
          expect(remaining.length).toBe(32 - uniqueCards.length);
          for (const card of remaining) {
            const key = `${card.suit}-${card.rank}`;
            expect(seen.has(key)).toBe(false);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 40: High Card Tracking Accuracy
  it('Property 40: tracks unaccounted A, K, Q correctly', () => {
    fc.assert(
      fc.property(
        fc.array(cardArbitrary, { minLength: 0, maxLength: 12 }),
        (playedCards: Card[]) => {
          const memory = new TeamMemory();
          const highCardsPlayed = new Set<string>();
          const seen = new Set<string>();
          for (const card of playedCards) {
            const key = `${card.suit}-${card.rank}`;
            if (!seen.has(key)) {
              seen.add(key);
              memory.recordOurPlay(0, card, 1, true);
              if (HIGH_RANKS.includes(card.rank)) {
                highCardsPlayed.add(key);
              }
            }
          }
          const unaccounted = memory.getUnaccountedHighCards();
          const totalHighCards = ALL_SUITS.length * HIGH_RANKS.length;
          expect(unaccounted.length).toBe(totalHighCards - highCardsPlayed.size);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 41: Opponent Void Detection
  it('Property 41: detects opponent voids from won tricks', () => {
    const memory = new TeamMemory();
    const trick = {
      trickNumber: 1,
      winner: 0,
      allCards: [
        { player: 0, card: createCard('HEARTS', 'A') },
        { player: 1, card: createCard('SPADES', 'K') },
        { player: 2, card: createCard('HEARTS', 'K') },
        { player: 3, card: createCard('CLUBS', 'Q') }
      ],
      ledSuit: 'HEARTS' as Suit
    };
    memory.recordTrickWeWon(trick);
    expect(memory.isOpponentVoid(1, 'HEARTS')).toBe(true);
    expect(memory.isOpponentVoid(3, 'HEARTS')).toBe(true);
    expect(memory.isOpponentVoid(2, 'HEARTS')).toBe(false);
  });

  // Property 42: Trump Count Accuracy
  it('Property 42: calculates remaining trumps correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }),
        fc.constantFrom(...ALL_SUITS),
        (trumpsSeen: number, trumpSuit: Suit) => {
          const memory = new TeamMemory();
          memory.trumpSuit = trumpSuit;
          const seen = new Set<string>();
          let count = 0;
          while (count < trumpsSeen) {
            for (const rank of ALL_RANKS) {
              if (count >= trumpsSeen) break;
              const card = createCard(trumpSuit, rank);
              const key = `${card.suit}-${card.rank}`;
              if (!seen.has(key)) {
                seen.add(key);
                memory.recordOurPlay(0, card, count + 1, true);
                count++;
              }
            }
          }
          expect(memory.getTrumpRemaining()).toBe(8 - trumpsSeen);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 48: Memory Reset Per Round
  it('Property 48: reset clears all memory', () => {
    fc.assert(
      fc.property(
        fc.array(cardArbitrary, { minLength: 1, maxLength: 8 }),
        (cards: Card[]) => {
          const memory = new TeamMemory();
          memory.trumpSuit = 'HEARTS';
          for (const card of cards) {
            memory.recordOurPlay(0, card, 1, true);
          }
          memory.reset();
          expect(memory.ourPlays.length).toBe(0);
          expect(memory.tricksWeWon.length).toBe(0);
          expect(memory.knownCards.size).toBe(0);
          expect(memory.opponentVoids.length).toBe(0);
          expect(memory.trumpSuit).toBeNull();
          expect(memory.getRemainingCards().length).toBe(32);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 49: Shared Team Memory
  it('Property 49: same memory instance shared by team bots', () => {
    const memory = new TeamMemory();
    memory.recordOurPlay(0, createCard('HEARTS', 'A'), 1, true);
    memory.recordOurPlay(2, createCard('HEARTS', 'K'), 1, true);
    expect(memory.ourPlays.length).toBe(2);
    expect(memory.ourPlays.some(p => p.player === 0)).toBe(true);
    expect(memory.ourPlays.some(p => p.player === 2)).toBe(true);
  });
});
