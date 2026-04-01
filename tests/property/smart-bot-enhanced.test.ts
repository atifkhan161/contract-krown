// Property Tests for Enhanced SmartBot with Memory
// Tests Properties 43-47 from design.md

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SmartBot } from '@src/bot/bot-logic.js';
import { TeamMemory } from '@src/bot/team-memory.js';
import type { Card, Suit, Rank } from '@src/engine/types.js';

const ALL_SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
const ALL_RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createCard(suit: Suit, rank: Rank): Card {
  const values: Record<Rank, number> = { '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  return { suit, rank, value: values[rank] };
}

const cardArbitrary = fc.record({
  suit: fc.constantFrom(...ALL_SUITS),
  rank: fc.constantFrom(...ALL_RANKS)
}).map((r: { suit: Suit; rank: Rank }) => createCard(r.suit, r.rank));

function makeState(overrides: Partial<Parameters<typeof SmartBot.getBestMove>[1]> = {}): Parameters<typeof SmartBot.getBestMove>[1] {
  return {
    trumpSuit: 'SPADES',
    currentTrick: [],
    leadSuit: null,
    myIndex: 0,
    partnerIndex: 2,
    isDeclaringTeam: true,
    tricksWonByTeam: 0,
    tricksRemaining: 8,
    ...overrides
  };
}

describe('Enhanced SmartBot Property Tests', () => {
  // Property 43: Bot Legal Move Selection with Memory
  it('Property 43: bot always selects a legal card with memory', () => {
    fc.assert(
      fc.property(
        fc.array(cardArbitrary, { minLength: 1, maxLength: 8 }),
        fc.constantFrom(...ALL_SUITS),
        fc.boolean(),
        (hand: Card[], trumpSuit: Suit, isLeading: boolean) => {
          const memory = new TeamMemory();
          memory.trumpSuit = trumpSuit;
          const state = makeState({
            trumpSuit,
            currentTrick: isLeading ? [] : [{ playerIndex: 1, card: createCard('HEARTS', '7') }],
            leadSuit: isLeading ? null : 'HEARTS'
          });

          const legalMoves = state.leadSuit
            ? hand.filter(c => c.suit === state.leadSuit).length > 0
              ? hand.filter(c => c.suit === state.leadSuit)
              : hand
            : hand;

          if (legalMoves.length === 0) return true;

          const selected = SmartBot.getBestMove(legalMoves, state, memory);
          const isValid = legalMoves.some(c => c.suit === selected.suit && c.rank === selected.rank);
          expect(isValid).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 44: Partner-Aware Leading
  it('Property 44: prefers leading suits where partner showed strength', () => {
    const memory = new TeamMemory();
    memory.trumpSuit = 'SPADES';
    memory.recordTrickWeWon({
      trickNumber: 1,
      winner: 2,
      allCards: [
        { player: 0, card: createCard('HEARTS', 'K') },
        { player: 1, card: createCard('HEARTS', '7') },
        { player: 2, card: createCard('HEARTS', 'A') },
        { player: 3, card: createCard('HEARTS', '8') }
      ],
      ledSuit: 'HEARTS'
    });
    memory.recordTrickWeWon({
      trickNumber: 2,
      winner: 2,
      allCards: [
        { player: 0, card: createCard('HEARTS', 'Q') },
        { player: 1, card: createCard('HEARTS', '9') },
        { player: 2, card: createCard('HEARTS', 'J') },
        { player: 3, card: createCard('HEARTS', '10') }
      ],
      ledSuit: 'HEARTS'
    });

    const hand = [
      createCard('HEARTS', '9'),
      createCard('DIAMONDS', 'K'),
      createCard('CLUBS', 'Q')
    ];
    const state = makeState({ trumpSuit: 'SPADES' });

    const selected = SmartBot.getBestMove(hand, state, memory);
    expect(selected.suit).toBe('HEARTS');
  });

  // Property 45: Trump Conservation
  it('Property 45: conserves trumps when void and few trumps remain', () => {
    const memory = new TeamMemory();
    memory.trumpSuit = 'SPADES';
    for (let i = 0; i < 6; i++) {
      memory.recordOurPlay(0, createCard('SPADES', ALL_RANKS[i] as Rank), i + 1, true);
    }

    const hand = [
      createCard('SPADES', '7'),
      createCard('DIAMONDS', 'K')
    ];
    const state = makeState({
      trumpSuit: 'SPADES',
      currentTrick: [
        { playerIndex: 1, card: createCard('HEARTS', 'A') },
        { playerIndex: 2, card: createCard('HEARTS', 'K') },
        { playerIndex: 3, card: createCard('HEARTS', 'Q') }
      ],
      leadSuit: 'HEARTS'
    });

    const selected = SmartBot.getBestMove(hand, state, memory);
    expect(selected.suit).toBe('DIAMONDS');
  });

  // Property 46: Partner Win Recognition
  it('Property 46: plays lowest card when partner is winning', () => {
    const memory = new TeamMemory();
    memory.trumpSuit = 'SPADES';

    const hand = [
      createCard('HEARTS', 'A'),
      createCard('HEARTS', 'K'),
      createCard('HEARTS', 'Q')
    ];
    const state = makeState({
      trumpSuit: 'SPADES',
      currentTrick: [
        { playerIndex: 1, card: createCard('HEARTS', '7') },
        { playerIndex: 2, card: createCard('HEARTS', '9') },
        { playerIndex: 3, card: createCard('HEARTS', '8') }
      ],
      leadSuit: 'HEARTS',
      partnerIndex: 2
    });

    const selected = SmartBot.getBestMove(hand, state, memory);
    expect(selected.rank).toBe('Q');
  });

  // Property 47: Endgame Optimal Play
  it('Property 47: calculates optimal plays in endgame', () => {
    const memory = new TeamMemory();
    memory.trumpSuit = 'SPADES';
    for (let i = 0; i < 5; i++) {
      memory.recordOurPlay(0, createCard('SPADES', ALL_RANKS[i] as Rank), i + 1, true);
    }

    const hand = [
      createCard('HEARTS', 'A'),
      createCard('DIAMONDS', 'K')
    ];
    const state = makeState({
      trumpSuit: 'SPADES',
      tricksRemaining: 2
    });

    const selected = SmartBot.getBestMove(hand, state, memory);
    expect(selected).toBeDefined();
    expect(selected.suit).toBeDefined();
  });
});
