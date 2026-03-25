// Contract Crown Bot Manager
// Manages bot players and AI decisions

import type { Card, Suit, GameState } from '../engine/types.js';
import { canPlayCard } from '../engine/index.js';

// Rank values for comparison (higher = stronger)
const RANK_VALUES: Record<string, number> = {
  '7': 0,
  '8': 1,
  '9': 2,
  '10': 3,
  'J': 4,
  'Q': 5,
  'K': 6,
  'A': 7
};

export class BotManager {
  /**
   * Selects the trump suit based on the initial hand
   * Strategy: Choose the suit with the most cards
   */
  selectTrumpSuit(hand: Card[]): Suit {
    const suitCounts: Record<Suit, number> = {
      'HEARTS': 0,
      'DIAMONDS': 0,
      'CLUBS': 0,
      'SPADES': 0
    };

    // Count cards in each suit
    for (const card of hand) {
      suitCounts[card.suit]++;
    }

    // Find suit with most cards
    let maxCount = 0;
    let bestSuit: Suit = 'HEARTS';
    
    for (const [suit, count] of Object.entries(suitCounts)) {
      if (count > maxCount) {
        maxCount = count;
        bestSuit = suit as Suit;
      }
    }

    return bestSuit;
  }

  /**
   * Selects a legal card to play based on basic strategy
   * Strategy:
   * - If leading: Play highest non-trump card, or lowest trump if only trumps remain
   * - If following: Play lowest card that follows suit, or lowest trump if cannot follow, or lowest card if no trumps
   */
  selectCard(state: GameState, playerIndex: number): Card {
    const player = state.players[playerIndex];
    const hand = player.hand;
    const trumpSuit = state.trumpSuit;
    const currentTrick = state.currentTrick;

    // Get playable cards
    const playableCards = hand.filter(card => canPlayCard(state, playerIndex, card));

    if (playableCards.length === 0) {
      throw new Error('No playable cards available');
    }

    // If leading (trick is empty)
    if (currentTrick.cards.length === 0) {
      return this.selectLeadCard(playableCards, trumpSuit);
    }

    // If following
    return this.selectFollowCard(playableCards, trumpSuit, currentTrick.cards[0].card.suit);
  }

  /**
   * Selects a card when leading
   * Strategy: Play highest non-trump card, or lowest trump if only trumps remain
   */
  private selectLeadCard(playableCards: Card[], trumpSuit: Suit | null): Card {
    // Separate trump and non-trump cards
    const nonTrumpCards = playableCards.filter(card => card.suit !== trumpSuit);
    
    if (nonTrumpCards.length > 0) {
      // Play highest non-trump card
      return this.getHighestCard(nonTrumpCards);
    }

    // Only trump cards remain - play lowest trump
    return this.getLowestCard(playableCards);
  }

  /**
   * Selects a card when following
   * Strategy: Play lowest card that follows suit, or lowest trump if cannot follow, or lowest card if no trumps
   */
  private selectFollowCard(playableCards: Card[], trumpSuit: Suit | null, ledSuit: Suit): Card {
    // Try to follow suit with lowest card
    const followingCards = playableCards.filter(card => card.suit === ledSuit);
    
    if (followingCards.length > 0) {
      return this.getLowestCard(followingCards);
    }

    // Cannot follow suit - try to play lowest trump
    const trumpCards = playableCards.filter(card => card.suit === trumpSuit);
    
    if (trumpCards.length > 0) {
      return this.getLowestCard(trumpCards);
    }

    // No trumps - play lowest card
    return this.getLowestCard(playableCards);
  }

  /**
   * Gets the card with the highest rank
   */
  private getHighestCard(cards: Card[]): Card {
    return cards.reduce((highest, card) => 
      RANK_VALUES[card.rank] > RANK_VALUES[highest.rank] ? card : highest
    );
  }

  /**
   * Gets the card with the lowest rank
   */
  private getLowestCard(cards: Card[]): Card {
    return cards.reduce((lowest, card) => 
      RANK_VALUES[card.rank] < RANK_VALUES[lowest.rank] ? card : lowest
    );
  }

  /**
   * Returns a random delay between 500-1500ms for human-like behavior
   */
  getDecisionDelay(): number {
    return 500 + Math.random() * 1000;
  }

  /**
   * Evaluates a hand's strength based on high cards and trump potential
   */
  evaluateHand(hand: Card[], trumpSuit: Suit | null): number {
    let score = 0;
    
    for (const card of hand) {
      // High cards are worth more
      score += RANK_VALUES[card.rank];
      
      // Trump cards are worth bonus
      if (card.suit === trumpSuit) {
        score += 2;
      }
    }

    return score;
  }
}
