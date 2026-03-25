// Contract Crown Game Engine Property Tests
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { createDeck, shuffle, createInitialState, createPlayers, dealInitial, dealFinal, validateDeal, checkForExtremeHand, validateAndDeal, declareTrump, setFirstTrickLeader, advanceTurn, canPlayCard, playCard, resolveTrick, countTricksByTeam, updateCrown, rotateDeal, calculateScore, isGameComplete, startNewRound } from '@src/engine/index.js';
import type { Card, Suit, GameState } from '@src/engine/index.js';

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

// Feature: contract-crown-game, Property 6: Trump Declaration
describe('Property 6: Trump Declaration', () => {
  it('trump suit is updated when crown holder declares trump', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'), // suit to declare
        (suit: Suit) => {
          const state = createInitialState();
          dealInitial(state);

          // Verify we're in TRUMP_DECLARATION phase
          expect(state.phase).toBe('TRUMP_DECLARATION');

          // Verify trump is not set yet
          expect(state.trumpSuit).toBeNull();

          // Crown holder declares trump
          declareTrump(state, suit);

          // Verify trump suit is now set to the declared suit
          expect(state.trumpSuit).toBe(suit);

          // Verify phase moved to DEALING_FINAL
          expect(state.phase).toBe('DEALING_FINAL');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('only crown holder can declare trump', () => {
    const state = createInitialState();
    dealInitial(state);

    // Try to have a non-crown holder declare trump
    const nonCrownHolder = (state.crownHolder + 1) % 4;
    state.currentPlayer = nonCrownHolder;

    expect(() => {
      declareTrump(state, 'HEARTS');
    }).toThrow('Only the crown holder can declare trump');
  });

  it('trump can only be declared during TRUMP_DECLARATION phase', () => {
    const state = createInitialState();
    dealInitial(state);

    // Move to a different phase
    state.phase = 'TRICK_PLAY';

    expect(() => {
      declareTrump(state, 'HEARTS');
    }).toThrow('Trump can only be declared during the trump declaration phase');
  });

  it('rejects invalid suit', () => {
    const state = createInitialState();
    dealInitial(state);

    expect(() => {
      declareTrump(state, 'INVALID' as Suit);
    }).toThrow('Invalid suit selected');
  });
});

// Feature: contract-crown-game, Property 7: First Trick Leader
describe('Property 7: First Trick Leader', () => {
  it('first trick leader is player left of dealer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // dealer position
        (dealer: number) => {
          const state = createInitialState();
          state.dealer = dealer;
          dealInitial(state);
          declareTrump(state, 'HEARTS');
          dealFinal(state);
          setFirstTrickLeader(state);

          // First trick leader should be player left of dealer
          expect(state.currentTrick.leadPlayer).toBe((dealer + 1) % 4);
          expect(state.currentPlayer).toBe((dealer + 1) % 4);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 8: Turn Order Progression
describe('Property 8: Turn Order Progression', () => {
  it('current player advances clockwise after each card play', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // starting player
        (startingPlayer: number) => {
          const state = createInitialState();
          state.currentPlayer = startingPlayer;

          // Advance turn 4 times (full rotation)
          advanceTurn(state);
          expect(state.currentPlayer).toBe((startingPlayer + 1) % 4);
          
          advanceTurn(state);
          expect(state.currentPlayer).toBe((startingPlayer + 2) % 4);
          
          advanceTurn(state);
          expect(state.currentPlayer).toBe((startingPlayer + 3) % 4);
          
          advanceTurn(state);
          expect(state.currentPlayer).toBe(startingPlayer); // Full circle
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 9: Lead Player Freedom
describe('Property 9: Lead Player Freedom', () => {
  it('all cards are playable when leading a trick', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'), // trump suit
        (trumpSuit: Suit) => {
          const state = createInitialState();
          dealInitial(state);
          declareTrump(state, trumpSuit);
          dealFinal(state);
          setFirstTrickLeader(state);

          // Get the leader's hand
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

// Feature: contract-crown-game, Property 10: Suit Following Requirement
describe('Property 10: Suit Following Requirement', () => {
  it('must follow led suit if player has cards of that suit', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'), // trump suit
        (trumpSuit: Suit) => {
          const state = createInitialState();
          dealInitial(state);
          declareTrump(state, trumpSuit);
          dealFinal(state);
          setFirstTrickLeader(state);

          // Simulate a card being played
          const leaderIndex = state.currentPlayer;
          const leaderHand = state.players[leaderIndex].hand;
          const ledCard = leaderHand[0];
          
          // Play the card
          playCard(state, leaderIndex, ledCard);
          
          // Now check the next player
          const nextPlayerIndex = state.currentPlayer;
          const nextPlayerHand = state.players[nextPlayerIndex].hand;
          
          // Check if next player has the led suit
          const hasLedSuit = nextPlayerHand.some(c => c.suit === ledCard.suit);
          
          if (hasLedSuit) {
            // Only cards of led suit should be playable
            for (const card of nextPlayerHand) {
              if (card.suit === ledCard.suit) {
                expect(canPlayCard(state, nextPlayerIndex, card)).toBe(true);
              } else {
                expect(canPlayCard(state, nextPlayerIndex, card)).toBe(false);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 11: No Suit Following Freedom
describe('Property 11: No Suit Following Freedom', () => {
  it('all cards are playable if player cannot follow suit', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'), // trump suit
        (trumpSuit: Suit) => {
          const state = createInitialState();
          dealInitial(state);
          declareTrump(state, trumpSuit);
          dealFinal(state);
          setFirstTrickLeader(state);

          // Simulate a card being played
          const leaderIndex = state.currentPlayer;
          const leaderHand = state.players[leaderIndex].hand;
          const ledCard = leaderHand[0];
          
          // Play the card
          playCard(state, leaderIndex, ledCard);
          
          // Now check the next player
          const nextPlayerIndex = state.currentPlayer;
          const nextPlayerHand = state.players[nextPlayerIndex].hand;
          
          // Check if next player has the led suit
          const hasLedSuit = nextPlayerHand.some(c => c.suit === ledCard.suit);
          
          if (!hasLedSuit) {
            // All cards should be playable if cannot follow suit
            for (const card of nextPlayerHand) {
              expect(canPlayCard(state, nextPlayerIndex, card)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 12: Trick Resolution Correctness
describe('Property 12: Trick Resolution Correctness', () => {
  it('highest trump wins if any trump played', () => {
    const trumpSuit: Suit = 'HEARTS';
    
    // Create a trick with trump cards
    const trick = {
      leadPlayer: 0,
      cards: [
        { card: { suit: 'DIAMONDS' as Suit, rank: 'A' as const }, player: 0 },
        { card: { suit: 'HEARTS' as Suit, rank: '7' as const }, player: 1 },
        { card: { suit: 'CLUBS' as Suit, rank: 'K' as const }, player: 2 },
        { card: { suit: 'HEARTS' as Suit, rank: '10' as const }, player: 3 }
      ],
      winner: null
    };

    const winner = resolveTrick(trick, trumpSuit);
    
    // Player 3 played highest trump (10 of Hearts), should win
    expect(winner).toBe(3);
  });

  it('highest led suit wins if no trump played', () => {
    const trumpSuit: Suit = 'SPADES';
    
    // Create a trick with no trump cards
    const trick = {
      leadPlayer: 0,
      cards: [
        { card: { suit: 'HEARTS' as Suit, rank: 'A' as const }, player: 0 },
        { card: { suit: 'HEARTS' as Suit, rank: '7' as const }, player: 1 },
        { card: { suit: 'CLUBS' as Suit, rank: 'K' as const }, player: 2 },
        { card: { suit: 'HEARTS' as Suit, rank: '10' as const }, player: 3 }
      ],
      winner: null
    };

    const winner = resolveTrick(trick, trumpSuit);
    
    // Player 0 played highest led suit (Ace of Hearts), should win
    expect(winner).toBe(0);
  });
});

// Feature: contract-crown-game, Property 13: Trick Winner Leads Next
describe('Property 13: Trick Winner Leads Next', () => {
  it('trick winner becomes lead player for next trick', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'), // trump suit
        (trumpSuit: Suit) => {
          const state = createInitialState();
          dealInitial(state);
          declareTrump(state, trumpSuit);
          dealFinal(state);
          setFirstTrickLeader(state);

          // Play 4 cards to complete a trick
          for (let i = 0; i < 4; i++) {
            const currentPlayer = state.currentPlayer;
            const hand = state.players[currentPlayer].hand;
            const playableCards = hand.filter(c => canPlayCard(state, currentPlayer, c));
            playCard(state, currentPlayer, playableCards[0]);
          }

          // The winner of the completed trick should be the lead for the next trick
          const completedTrick = state.completedTricks[state.completedTricks.length - 1];
          expect(completedTrick.winner).toBe(state.currentTrick.leadPlayer);
          expect(completedTrick.winner).toBe(state.currentPlayer);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 14: Crown Retention on Success
describe('Property 14: Crown Retention on Success', () => {
  it('crown holder stays the same when declaring team wins 5+ tricks', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // crown holder
        fc.integer({ min: 5, max: 8 }), // declaring team tricks (5-8)
        (crownHolder: number, declaringTricks: number) => {
          const state = createInitialState();
          state.crownHolder = crownHolder;
          state.players = createPlayers();
          
          // Create completed tricks where declaring team wins the specified number
          const declaringTeam = state.players[crownHolder].team;
          const challengingTeam = declaringTeam === 0 ? 1 : 0;
          
          // Add tricks for declaring team
          for (let i = 0; i < declaringTricks; i++) {
            const winner = declaringTeam === 0 ? (i % 2 === 0 ? 0 : 2) : (i % 2 === 0 ? 1 : 3);
            state.completedTricks.push({
              leadPlayer: 0,
              cards: [],
              winner
            });
          }
          
          // Add remaining tricks for challenging team
          const remainingTricks = 8 - declaringTricks;
          for (let i = 0; i < remainingTricks; i++) {
            const winner = challengingTeam === 0 ? (i % 2 === 0 ? 0 : 2) : (i % 2 === 0 ? 1 : 3);
            state.completedTricks.push({
              leadPlayer: 0,
              cards: [],
              winner
            });
          }
          
          const originalCrownHolder = state.crownHolder;
          updateCrown(state);
          
          // Crown holder should stay the same when declaring team wins 5+ tricks
          expect(state.crownHolder).toBe(originalCrownHolder);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 15: Crown Rotation on Failure
describe('Property 15: Crown Rotation on Failure', () => {
  it('crown rotates clockwise when declaring team wins fewer than 5 tricks', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // crown holder
        fc.integer({ min: 0, max: 4 }), // declaring team tricks (0-4)
        (crownHolder: number, declaringTricks: number) => {
          const state = createInitialState();
          state.crownHolder = crownHolder;
          state.players = createPlayers();
          
          // Create completed tricks where declaring team wins the specified number
          const declaringTeam = state.players[crownHolder].team;
          const challengingTeam = declaringTeam === 0 ? 1 : 0;
          
          // Add tricks for declaring team
          for (let i = 0; i < declaringTricks; i++) {
            const winner = declaringTeam === 0 ? (i % 2 === 0 ? 0 : 2) : (i % 2 === 0 ? 1 : 3);
            state.completedTricks.push({
              leadPlayer: 0,
              cards: [],
              winner
            });
          }
          
          // Add remaining tricks for challenging team
          const remainingTricks = 8 - declaringTricks;
          for (let i = 0; i < remainingTricks; i++) {
            const winner = challengingTeam === 0 ? (i % 2 === 0 ? 0 : 2) : (i % 2 === 0 ? 1 : 3);
            state.completedTricks.push({
              leadPlayer: 0,
              cards: [],
              winner
            });
          }
          
          const originalCrownHolder = state.crownHolder;
          updateCrown(state);
          
          // Crown should rotate clockwise when declaring team wins fewer than 5 tricks
          expect(state.crownHolder).toBe((originalCrownHolder + 1) % 4);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 16: Dealer Rotation
describe('Property 16: Dealer Rotation', () => {
  it('dealer rotates clockwise after each round', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // current dealer
        (dealer: number) => {
          const state = createInitialState();
          state.dealer = dealer;
          
          const originalDealer = state.dealer;
          rotateDeal(state);
          
          // Dealer should rotate clockwise
          expect(state.dealer).toBe((originalDealer + 1) % 4);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 17: Declaring Team Success Scoring
describe('Property 17: Declaring Team Success Scoring', () => {
  it('declaring team gets T points when winning T tricks (T >= 5)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // crown holder
        fc.integer({ min: 5, max: 8 }), // declaring team tricks (5-8)
        (crownHolder: number, declaringTricks: number) => {
          const state = createInitialState();
          state.crownHolder = crownHolder;
          state.players = createPlayers();
          state.scores = [0, 0];
          
          // Create completed tricks where declaring team wins the specified number
          const declaringTeam = state.players[crownHolder].team;
          const challengingTeam = declaringTeam === 0 ? 1 : 0;
          
          // Add tricks for declaring team
          for (let i = 0; i < declaringTricks; i++) {
            const winner = declaringTeam === 0 ? (i % 2 === 0 ? 0 : 2) : (i % 2 === 0 ? 1 : 3);
            state.completedTricks.push({
              leadPlayer: 0,
              cards: [],
              winner
            });
          }
          
          // Add remaining tricks for challenging team
          const remainingTricks = 8 - declaringTricks;
          for (let i = 0; i < remainingTricks; i++) {
            const winner = challengingTeam === 0 ? (i % 2 === 0 ? 0 : 2) : (i % 2 === 0 ? 1 : 3);
            state.completedTricks.push({
              leadPlayer: 0,
              cards: [],
              winner
            });
          }
          
          calculateScore(state);
          
          // Declaring team should get exactly T points
          expect(state.scores[declaringTeam]).toBe(declaringTricks);
          expect(state.scores[challengingTeam]).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 18: Challenging Team Success Scoring
describe('Property 18: Challenging Team Success Scoring', () => {
  it('challenging team gets their trick count when declaring team wins fewer than 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }), // crown holder
        fc.integer({ min: 0, max: 4 }), // declaring team tricks (0-4)
        (crownHolder: number, declaringTricks: number) => {
          const state = createInitialState();
          state.crownHolder = crownHolder;
          state.players = createPlayers();
          state.scores = [0, 0];
          
          // Create completed tricks where declaring team wins the specified number
          const declaringTeam = state.players[crownHolder].team;
          const challengingTeam = declaringTeam === 0 ? 1 : 0;
          
          // Add tricks for declaring team
          for (let i = 0; i < declaringTricks; i++) {
            const winner = declaringTeam === 0 ? (i % 2 === 0 ? 0 : 2) : (i % 2 === 0 ? 1 : 3);
            state.completedTricks.push({
              leadPlayer: 0,
              cards: [],
              winner
            });
          }
          
          // Add remaining tricks for challenging team
          const challengingTricks = 8 - declaringTricks;
          for (let i = 0; i < challengingTricks; i++) {
            const winner = challengingTeam === 0 ? (i % 2 === 0 ? 0 : 2) : (i % 2 === 0 ? 1 : 3);
            state.completedTricks.push({
              leadPlayer: 0,
              cards: [],
              winner
            });
          }
          
          calculateScore(state);
          
          // Challenging team should get their trick count
          expect(state.scores[challengingTeam]).toBe(challengingTricks);
          expect(state.scores[declaringTeam]).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 19: Score Accumulation
describe('Property 19: Score Accumulation', () => {
  it('scores accumulate across multiple rounds', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 5, max: 8 }), { minLength: 1, maxLength: 3 }), // declaring team tricks per round
        (roundsTricks: number[]) => {
          const state = createInitialState();
          state.players = createPlayers();
          state.scores = [0, 0];
          
          let expectedTeam0Score = 0;
          let expectedTeam1Score = 0;
          
          for (const declaringTricks of roundsTricks) {
            state.crownHolder = 0; // Team 0 always declares for simplicity
            state.completedTricks = [];
            
            // Add tricks for declaring team (team 0)
            for (let i = 0; i < declaringTricks; i++) {
              state.completedTricks.push({
                leadPlayer: 0,
                cards: [],
                winner: i % 2 === 0 ? 0 : 2
              });
            }
            
            // Add remaining tricks for challenging team (team 1)
            const remainingTricks = 8 - declaringTricks;
            for (let i = 0; i < remainingTricks; i++) {
              state.completedTricks.push({
                leadPlayer: 0,
                cards: [],
                winner: i % 2 === 0 ? 1 : 3
              });
            }
            
            calculateScore(state);
            expectedTeam0Score += declaringTricks;
          }
          
          // Scores should accumulate correctly
          expect(state.scores[0]).toBe(expectedTeam0Score);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: contract-crown-game, Property 20: Game Completion
describe('Property 20: Game Completion', () => {
  it('game ends when either team reaches 52 points', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 52, max: 100 }), // team 0 score
        fc.integer({ min: 0, max: 51 }), // team 1 score
        (team0Score: number, team1Score: number) => {
          const state = createInitialState();
          state.scores = [team0Score, team1Score];
          
          // Game should be complete when either team reaches 52 points
          expect(isGameComplete(state)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('game continues when both teams have fewer than 52 points', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 51 }), // team 0 score
        fc.integer({ min: 0, max: 51 }), // team 1 score
        (team0Score: number, team1Score: number) => {
          const state = createInitialState();
          state.scores = [team0Score, team1Score];
          
          // Game should continue when both teams have fewer than 52 points
          expect(isGameComplete(state)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
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
