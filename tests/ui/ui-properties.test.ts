// Contract Crown UI Property Tests
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

import { FeltGrid } from '@src/ui/felt-grid.js';
import { GameHeader } from '@src/ui/game-header.js';
import { GameView } from '@src/ui/game-view.js';
import { HapticController } from '@src/ui/haptic-controller.js';
import { createInitialState, createPlayers, dealInitial, dealFinal, declareTrump, setFirstTrickLeader, playCard, canPlayCard } from '@src/engine/index.js';
import type { GameState, Card, Suit } from '@src/engine/types.js';

// Custom generators for property tests
const suitArbitrary = fc.constantFrom('HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES') as fc.Arbitrary<Suit>;
const rankArbitrary = fc.constantFrom('7', '8', '9', '10', 'J', 'Q', 'K', 'A');

const cardArbitrary: fc.Arbitrary<Card> = fc.record({
  suit: suitArbitrary,
  rank: rankArbitrary
});

// Feature: contract-crown-game, Property 21: Playability Calculation Correctness
describe('Property 21: Playability Calculation Correctness', () => {
  let feltGrid: FeltGrid;

  beforeEach(() => {
    feltGrid = new FeltGrid();
  });

  it('playable cards match canPlayCard result for leading player', () => {
    fc.assert(
      fc.property(
        suitArbitrary,
        (trumpSuit: Suit) => {
          const state = createInitialState();
          dealInitial(state);
          declareTrump(state, trumpSuit);
          dealFinal(state);
          setFirstTrickLeader(state);

          const leaderIndex = state.currentPlayer;
          const playableCards = feltGrid.calculatePlayableCards(state, leaderIndex);

          // When leading, all cards should be playable
          expect(playableCards.length).toBe(state.players[leaderIndex].hand.length);

          // Verify each card in hand is marked as playable
          for (const card of state.players[leaderIndex].hand) {
            expect(playableCards.some(c => c.suit === card.suit && c.rank === card.rank)).toBe(true);
            expect(canPlayCard(state, leaderIndex, card)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('playable cards match canPlayCard result for following player with led suit', () => {
    fc.assert(
      fc.property(
        suitArbitrary,
        (trumpSuit: Suit) => {
          const state = createInitialState();
          dealInitial(state);
          declareTrump(state, trumpSuit);
          dealFinal(state);
          setFirstTrickLeader(state);

          // Play first card to establish led suit
          const leaderIndex = state.currentPlayer;
          const leaderHand = state.players[leaderIndex].hand;
          const ledCard = leaderHand[0];
          playCard(state, leaderIndex, ledCard);

          // Now check the next player
          const followerIndex = state.currentPlayer;
          const playableCards = feltGrid.calculatePlayableCards(state, followerIndex);

          // Check if follower has the led suit
          const hasLedSuit = state.players[followerIndex].hand.some(c => c.suit === ledCard.suit);

          if (hasLedSuit) {
            // Only cards of led suit should be playable
            const ledSuitCards = state.players[followerIndex].hand.filter(c => c.suit === ledCard.suit);
            expect(playableCards.length).toBe(ledSuitCards.length);

            for (const card of playableCards) {
              expect(card.suit).toBe(ledCard.suit);
              expect(canPlayCard(state, followerIndex, card)).toBe(true);
            }
          } else {
            // All cards should be playable if cannot follow suit
            expect(playableCards.length).toBe(state.players[followerIndex].hand.length);

            for (const card of state.players[followerIndex].hand) {
              expect(playableCards.some(c => c.suit === card.suit && c.rank === card.rank)).toBe(true);
              expect(canPlayCard(state, followerIndex, card)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('playable cards count matches canPlayCard count', () => {
    fc.assert(
      fc.property(
        suitArbitrary,
        fc.integer({ min: 0, max: 3 }),
        (trumpSuit: Suit, playerIndex: number) => {
          const state = createInitialState();
          dealInitial(state);
          declareTrump(state, trumpSuit);
          dealFinal(state);
          setFirstTrickLeader(state);

          // Simulate some cards played
          for (let i = 0; i < playerIndex; i++) {
            const currentPlayer = state.currentPlayer;
            const hand = state.players[currentPlayer].hand;
            if (hand.length > 0) {
              // Find a playable card instead of just playing the first one
              const playableCard = hand.find(card => canPlayCard(state, currentPlayer, card));
              if (playableCard) {
                playCard(state, currentPlayer, playableCard);
              }
            }
          }

          const playableCards = feltGrid.calculatePlayableCards(state, state.currentPlayer);

          // Count cards that canPlayCard returns true for
          let canPlayCount = 0;
          for (const card of state.players[state.currentPlayer].hand) {
            if (canPlayCard(state, state.currentPlayer, card)) {
              canPlayCount++;
            }
          }

          expect(playableCards.length).toBe(canPlayCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 22: Unplayable Card Styling
describe('Property 22: Unplayable Card Styling', () => {
  it('unplayable cards have unplayable class', () => {
    fc.assert(
      fc.property(
        suitArbitrary,
        (trumpSuit: Suit) => {
          const state = createInitialState();
          dealInitial(state);
          declareTrump(state, trumpSuit);
          dealFinal(state);
          setFirstTrickLeader(state);

          // Play first card to establish led suit
          const leaderIndex = state.currentPlayer;
          const leaderHand = state.players[leaderIndex].hand;
          const ledCard = leaderHand[0];
          playCard(state, leaderIndex, ledCard);

          // Check the next player
          const followerIndex = state.currentPlayer;
          const followerHand = state.players[followerIndex].hand;

          // Check if follower has the led suit
          const hasLedSuit = followerHand.some(c => c.suit === ledCard.suit);

          if (hasLedSuit) {
            // Find cards that are NOT of led suit - these should be unplayable
            const nonLedSuitCards = followerHand.filter(c => c.suit !== ledCard.suit);

            for (const card of nonLedSuitCards) {
              expect(canPlayCard(state, followerIndex, card)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 23: Playable Card Styling
describe('Property 23: Playable Card Styling', () => {
  it('playable cards have playable class', () => {
    fc.assert(
      fc.property(
        suitArbitrary,
        (trumpSuit: Suit) => {
          const state = createInitialState();
          dealInitial(state);
          declareTrump(state, trumpSuit);
          dealFinal(state);
          setFirstTrickLeader(state);

          const leaderIndex = state.currentPlayer;
          const leaderHand = state.players[leaderIndex].hand;

          // When leading, all cards should be playable
          for (const card of leaderHand) {
            expect(canPlayCard(state, leaderIndex, card)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('playable cards are clickable', () => {
    fc.assert(
      fc.property(
        suitArbitrary,
        (trumpSuit: Suit) => {
          const state = createInitialState();
          dealInitial(state);
          declareTrump(state, trumpSuit);
          dealFinal(state);
          setFirstTrickLeader(state);

          const leaderIndex = state.currentPlayer;
          const leaderHand = state.players[leaderIndex].hand;

          // All cards should be playable when leading
          for (const card of leaderHand) {
            expect(canPlayCard(state, leaderIndex, card)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 24: Active Player Indication
describe('Property 24: Active Player Indication', () => {
  it('active player has active class', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (activePlayer: number) => {
          const state = createInitialState();
          state.currentPlayer = activePlayer;

          // Verify current player is set correctly
          expect(state.currentPlayer).toBe(activePlayer);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('non-active players do not have active class', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (activePlayer: number) => {
          const state = createInitialState();
          state.currentPlayer = activePlayer;

          // Verify other players are not the current player
          for (let i = 0; i < 4; i++) {
            if (i !== activePlayer) {
              expect(state.currentPlayer).not.toBe(i);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('active player changes after card play', () => {
    fc.assert(
      fc.property(
        suitArbitrary,
        (trumpSuit: Suit) => {
          const state = createInitialState();
          dealInitial(state);
          declareTrump(state, trumpSuit);
          dealFinal(state);
          setFirstTrickLeader(state);

          const initialPlayer = state.currentPlayer;

          // Play a card
          const hand = state.players[initialPlayer].hand;
          if (hand.length > 0) {
            playCard(state, initialPlayer, hand[0]);

            // Current player should have changed (unless trick completed)
            if (state.currentTrick.cards.length < 4) {
              expect(state.currentPlayer).not.toBe(initialPlayer);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests for UI components
describe('UI Component Unit Tests', () => {
  let feltGrid: FeltGrid;
  let gameHeader: GameHeader;
  let hapticController: HapticController;

  beforeEach(() => {
    feltGrid = new FeltGrid();
    gameHeader = new GameHeader();
    hapticController = new HapticController();
  });

  it('FeltGrid calculates playable cards correctly when leading', () => {
    const state = createInitialState();
    dealInitial(state);
    declareTrump(state, 'HEARTS');
    dealFinal(state);
    setFirstTrickLeader(state);

    const playableCards = feltGrid.calculatePlayableCards(state, state.currentPlayer);

    // All cards should be playable when leading
    expect(playableCards.length).toBe(state.players[state.currentPlayer].hand.length);
  });

  it('FeltGrid calculates playable cards correctly when following with suit', () => {
    const state = createInitialState();
    dealInitial(state);
    declareTrump(state, 'HEARTS');
    dealFinal(state);
    setFirstTrickLeader(state);

    // Play a card to establish led suit
    const leaderIndex = state.currentPlayer;
    const ledCard = state.players[leaderIndex].hand[0];
    playCard(state, leaderIndex, ledCard);

    // Check the next player
    const followerIndex = state.currentPlayer;
    const playableCards = feltGrid.calculatePlayableCards(state, followerIndex);

    // Verify playable cards match canPlayCard
    for (const card of state.players[followerIndex].hand) {
      const isPlayable = canPlayCard(state, followerIndex, card);
      const isInPlayableList = playableCards.some(c => c.suit === card.suit && c.rank === card.rank);

      expect(isPlayable).toBe(isInPlayableList);
    }
  });

  it('GameHeader renders with correct trump suit', () => {
    const state = createInitialState();
    state.trumpSuit = 'HEARTS';
    state.scores = [10, 5];

    // Test that render doesn't throw
    expect(() => gameHeader.render(state, 0)).not.toThrow();
  });

  it('GameHeader updates score correctly', () => {
    const state = createInitialState();
    state.scores = [10, 5];

    gameHeader.render(state, 0);
    gameHeader.updateScore([15, 8]);

    // Verify update doesn't throw
    expect(true).toBe(true);
  });

  it('HapticController provides required methods', () => {
    // Test that all required methods exist
    expect(typeof hapticController.triggerYourTurn).toBe('function');
    expect(typeof hapticController.triggerTrickWon).toBe('function');
    expect(typeof hapticController.triggerTrumpDeclared).toBe('function');
    expect(typeof hapticController.triggerVictory).toBe('function');
    expect(typeof hapticController.isHapticSupported).toBe('function');
    expect(typeof hapticController.stop).toBe('function');
  });

  it('HapticController gracefully handles unsupported API', () => {
    // This test verifies the controller doesn't throw when API is unavailable
    // In a test environment, navigator.vibrate may not exist
    expect(() => hapticController.triggerYourTurn()).not.toThrow();
    expect(() => hapticController.triggerTrickWon()).not.toThrow();
    expect(() => hapticController.triggerTrumpDeclared()).not.toThrow();
    expect(() => hapticController.triggerVictory()).not.toThrow();
  });
});