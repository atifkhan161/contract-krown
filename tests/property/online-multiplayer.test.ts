// Property Tests for Online Multiplayer Player-Specific Views
// Tests Property 50 and 51 from design.md

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Online Multiplayer Property Tests', () => {
  // Property 50: Player Index Mapping Correctness
  describe('Property 50: Player Index Mapping', () => {
    function getViewPosition(serverPlayerIndex: number, userServerPlayerIndex: number): number {
      return (serverPlayerIndex - userServerPlayerIndex + 4) % 4;
    }

    function getServerIndex(viewPosition: number, userServerPlayerIndex: number): number {
      return (viewPosition + userServerPlayerIndex) % 4;
    }

    it('getViewPosition followed by getServerIndex returns original serverPlayerIndex', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          fc.integer({ min: 0, max: 3 }),
          (serverPlayerIndex: number, userServerPlayerIndex: number) => {
            const viewPos = getViewPosition(serverPlayerIndex, userServerPlayerIndex);
            const result = getServerIndex(viewPos, userServerPlayerIndex);
            expect(result).toBe(serverPlayerIndex);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('user always maps to view position 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          (userServerPlayerIndex: number) => {
            const viewPos = getViewPosition(userServerPlayerIndex, userServerPlayerIndex);
            expect(viewPos).toBe(0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('partner (user + 2) always maps to view position 2', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          (userServerPlayerIndex: number) => {
            const partnerIndex = (userServerPlayerIndex + 2) % 4;
            const viewPos = getViewPosition(partnerIndex, userServerPlayerIndex);
            expect(viewPos).toBe(2);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('left opponent (user + 1) always maps to view position 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          (userServerPlayerIndex: number) => {
            const leftIndex = (userServerPlayerIndex + 1) % 4;
            const viewPos = getViewPosition(leftIndex, userServerPlayerIndex);
            expect(viewPos).toBe(1);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('right opponent (user + 3) always maps to view position 3', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }),
          (userServerPlayerIndex: number) => {
            const rightIndex = (userServerPlayerIndex + 3) % 4;
            const viewPos = getViewPosition(rightIndex, userServerPlayerIndex);
            expect(viewPos).toBe(3);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 51: Unique Card Dealing in Online Mode
  describe('Property 51: Unique Card Dealing', () => {
    interface Card {
      suit: string;
      rank: string;
    }

    interface PlayerHand {
      playerIndex: number;
      cards: Card[];
    }

    function hasUniqueCards(players: PlayerHand[]): boolean {
      const allCards: string[] = [];
      for (const player of players) {
        for (const card of player.cards) {
          const cardKey = `${card.suit}-${card.rank}`;
          if (allCards.includes(cardKey)) {
            return false;
          }
          allCards.push(cardKey);
        }
      }
      return true;
    }

    function getUnionCardCount(players: PlayerHand[]): number {
      const uniqueCards = new Set<string>();
      for (const player of players) {
        for (const card of player.cards) {
          uniqueCards.add(`${card.suit}-${card.rank}`);
        }
      }
      return uniqueCards.size;
    }

    function generateUniqueHands(numPlayers: number, cardsPerPlayer: number): Card[][] {
      const allCards: Card[] = [];
      const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'] as const;
      const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
      
      for (const suit of suits) {
        for (const rank of ranks) {
          allCards.push({ suit, rank });
        }
      }
      
      const shuffled = [...allCards].sort(() => Math.random() - 0.5);
      const hands: Card[][] = [];
      
      for (let i = 0; i < numPlayers; i++) {
        const start = i * cardsPerPlayer;
        const end = start + cardsPerPlayer;
        hands.push(shuffled.slice(start, end));
      }
      
      return hands;
    }

    it('no two players have identical hands', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 4 }),
          fc.integer({ min: 1, max: 8 }),
          (numPlayers: number, cardsPerPlayer: number) => {
            const hands = generateUniqueHands(numPlayers, cardsPerPlayer);
            const players = hands.map((cards, i) => ({ playerIndex: i, cards }));
            const unique = hasUniqueCards(players);
            expect(unique).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('union of all player hands equals total dealt cards', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 4 }),
          fc.integer({ min: 1, max: 8 }),
          (numPlayers: number, cardsPerPlayer: number) => {
            const hands = generateUniqueHands(numPlayers, cardsPerPlayer);
            const totalDealt = hands.reduce((sum, hand) => sum + hand.length, 0);
            const players = hands.map((cards, i) => ({ playerIndex: i, cards }));
            const unionCount = getUnionCardCount(players);
            expect(unionCount).toBe(totalDealt);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
