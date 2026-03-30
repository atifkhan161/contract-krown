// Contract Crown Bot Manager
// Manages bot players and AI decisions using SmartBot

import type { Card, Suit, GameState } from '../engine/types.js';
import { canPlayCard } from '../engine/index.js';
import { SmartBot } from './bot-logic.js';

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
   * Selects a card to play using SmartBot's advanced strategy
   * - Partner-aware decision making
   * - Smart leading with Aces
   * - Win-or-slough strategy
   */
  selectCard(state: GameState, playerIndex: number): Card {
    const player = state.players[playerIndex];
    const hand = player.hand;

    // Get playable cards using engine's validation
    const playableCards = hand.filter(card => canPlayCard(state, playerIndex, card));

    if (playableCards.length === 0) {
      throw new Error('No playable cards available');
    }

    // Build SmartBot-compatible GameState
    const leadSuit = state.currentTrick.cards.length > 0 
      ? state.currentTrick.cards[0].card.suit 
      : null;

    const smartBotState: Parameters<typeof SmartBot.getBestMove>[1] = {
      trumpSuit: state.trumpSuit!,
      currentTrick: state.currentTrick.cards.map(pc => ({
        playerIndex: pc.player,
        card: pc.card
      })),
      leadSuit,
      myIndex: playerIndex,
      partnerIndex: state.partnerIndex,
      isDeclaringTeam: state.isDeclaringTeam,
      tricksWonByTeam: state.tricksWonByTeam
    };

    // Use SmartBot to select the best move
    return SmartBot.getBestMove(playableCards, smartBotState);
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
      // High cards are worth more (using card.value)
      score += card.value - 6; // Normalize: 7=1, 8=2, ..., A=8
      
      // Trump cards are worth bonus
      if (card.suit === trumpSuit) {
        score += 2;
      }
    }

    return score;
  }
}