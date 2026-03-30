import type { Suit, Rank, Card } from '../engine/types.js';

export interface GameState {
  trumpSuit: Suit;
  currentTrick: { playerIndex: number; card: Card }[];
  leadSuit: Suit | null;
  myIndex: number;
  partnerIndex: number;
  isDeclaringTeam: boolean;
  tricksWonByTeam: number;
}

/**
 * Smart Heuristic Bot for Contract Crown
 */
export class SmartBot {
  
  public static getBestMove(hand: Card[], state: GameState): Card {
    const legalMoves = this.getLegalMoves(hand, state.leadSuit);
    
    // 1. If I only have one card, play it.
    if (legalMoves.length === 1) return legalMoves[0];

    const currentWinner = this.getCurrentlyWinningCard(state);

    // 2. PARTNER IS WINNING: Don't waste power.
    if (currentWinner && currentWinner.playerIndex === state.partnerIndex) {
      // Partner has it. Play the LOWEST legal card to save high cards for later.
      return this.sortCardsByValue(legalMoves)[0];
    }

    // 3. I AM STARTING THE TRICK: Play strategically.
    if (state.currentTrick.length === 0) {
      return this.getBestLead(legalMoves, state);
    }

    // 4. TRY TO WIN: Find cards that beat the current winner.
    const winningCards = legalMoves.filter(card => 
      this.isCardBetter(card, currentWinner!.card, state.trumpSuit, state.leadSuit!)
    );

    if (winningCards.length > 0) {
      // We can win. If we are the declaring team and close to 5 tricks, play the LOWEST winning card.
      // (Minimal effort to win the trick).
      return this.sortCardsByValue(winningCards)[0];
    }

    // 5. CANNOT WIN: Play the absolute lowest card to "slough" (throw away).
    return this.sortCardsByValue(legalMoves)[0];
  }

  private static getLegalMoves(hand: Card[], leadSuit: Suit | null): Card[] {
    if (!leadSuit) return hand;
    const followSuitCards = hand.filter(c => c.suit === leadSuit);
    return followSuitCards.length > 0 ? followSuitCards : hand;
  }

  private static getBestLead(hand: Card[], state: GameState): Card {
    const sorted = this.sortCardsByValue(hand);
    // If we have an Ace (Value 14) of a non-trump suit, lead it. It's a safe win.
    const strongLead = sorted.find(c => c.value === 14 && c.suit !== state.trumpSuit);
    if (strongLead) return strongLead;

    // Otherwise, lead a medium card or low trump.
    return sorted[Math.floor(sorted.length / 2)];
  }

  private static isCardBetter(candidate: Card, best: Card, trump: Suit, lead: Suit): boolean {
    if (candidate.suit === trump && best.suit !== trump) return true;
    if (candidate.suit !== trump && best.suit === trump) return false;
    if (candidate.suit === best.suit) return candidate.value > best.value;
    // If suits are different and neither is trump, the one matching lead suit wins (usually candidate won't be different suit if following lead)
    return false;
  }

  private static getCurrentlyWinningCard(state: GameState) {
    if (state.currentTrick.length === 0) return null;
    let winner = state.currentTrick[0];
    for (let i = 1; i < state.currentTrick.length; i++) {
      if (this.isCardBetter(state.currentTrick[i].card, winner.card, state.trumpSuit, state.leadSuit!)) {
        winner = state.currentTrick[i];
      }
    }
    return winner;
  }

  private static sortCardsByValue(cards: Card[]): Card[] {
    return [...cards].sort((a, b) => a.value - b.value);
  }
}