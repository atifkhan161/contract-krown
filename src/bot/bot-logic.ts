// Contract Crown Smart Bot with Team Memory
// Uses shared team memory for intelligent, human-like card play decisions

import type { Suit, Card, Rank } from '../engine/types.js';
import { TeamMemory } from './team-memory.js';

export interface BotGameState {
  trumpSuit: Suit;
  currentTrick: { playerIndex: number; card: Card }[];
  leadSuit: Suit | null;
  myIndex: number;
  partnerIndex: number;
  isDeclaringTeam: boolean;
  tricksWonByTeam: number;
  tricksRemaining: number;
}

const HONOR_RANKS: Rank[] = ['A', 'K', 'Q', 'J'];

export class SmartBot {
  
  public static getBestMove(hand: Card[], state: BotGameState, memory: TeamMemory): Card {
    const legalMoves = this.getLegalMoves(hand, state.leadSuit);
    
    if (legalMoves.length === 1) return legalMoves[0];

    if (state.currentTrick.length === 0) {
      return this.getBestLeadWithMemory(legalMoves, state, memory);
    }

    if (state.leadSuit && !hand.some(c => c.suit === state.leadSuit)) {
      return this.decideWhenVoid(legalMoves, state, memory);
    }

    const currentWinner = this.getCurrentlyWinningCard(state);

    if (currentWinner && currentWinner.playerIndex === state.partnerIndex) {
      return this.sortCardsByValue(legalMoves)[0];
    }

    const winningCards = legalMoves.filter(card => 
      this.isCardBetter(card, currentWinner!.card, state.trumpSuit, state.leadSuit!)
    );

    if (winningCards.length > 0) {
      if (state.tricksWonByTeam >= 5 && state.isDeclaringTeam) {
        return this.sortCardsByValue(legalMoves)[0];
      }
      return this.sortCardsByValue(winningCards)[0];
    }

    return this.sortCardsByValue(legalMoves)[0];
  }

  private static getLegalMoves(hand: Card[], leadSuit: Suit | null): Card[] {
    if (!leadSuit) return hand;
    const followSuitCards = hand.filter(c => c.suit === leadSuit);
    return followSuitCards.length > 0 ? followSuitCards : hand;
  }

  private static getBestLeadWithMemory(hand: Card[], state: BotGameState, memory: TeamMemory): Card {
    const sorted = this.sortCardsByValue(hand);
    
    if (this.isEndgame(state)) {
      return this.getEndgameLead(sorted, state, memory);
    }

    const finesseCard = this.attemptFinesse(hand, state, memory);
    if (finesseCard) return finesseCard;

    const partnerStrongSuits = memory.getPartnerStrongSuits();
    for (const suit of partnerStrongSuits) {
      const suitCards = sorted.filter(c => c.suit === suit);
      if (suitCards.length > 0) {
        return suitCards[suitCards.length - 1];
      }
    }

    const nonTrumpAces = sorted.filter(c => c.value === 14 && c.suit !== state.trumpSuit);
    if (nonTrumpAces.length > 0) {
      const ace = nonTrumpAces[0];
      const unaccounted = memory.getUnaccountedHighCards();
      const higherUnaccounted = unaccounted.filter(c => c.suit === ace.suit && c.value > ace.value);
      if (higherUnaccounted.length === 0) {
        return ace;
      }
    }

    const nonTrumpCards = sorted.filter(c => c.suit !== state.trumpSuit);
    if (nonTrumpCards.length > 0) {
      return nonTrumpCards[Math.floor(nonTrumpCards.length / 2)];
    }

    return sorted[0];
  }

  private static attemptFinesse(hand: Card[], state: BotGameState, memory: TeamMemory): Card | null {
    if (state.currentTrick.length > 0) return null;
    
    for (const suit of ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'] as Suit[]) {
      const suitCards = hand.filter(c => c.suit === suit);
      if (suitCards.length >= 2) {
        const sorted = this.sortCardsByValue(suitCards);
        const highest = sorted[sorted.length - 1];
        const secondHighest = sorted[sorted.length - 2];
        
        if (highest.value >= 13 && secondHighest.value >= 11) {
          if (memory.shouldFinessePartner(suit)) {
            return secondHighest;
          }
        }
        
        const remaining = memory.getRemainingCards();
        const unaccountedHigher = remaining.filter(c => 
          c.suit === suit && c.value > secondHighest.value
        );
        
        if (unaccountedHigher.length === 0 && highest.value >= 13) {
          return secondHighest;
        }
      }
    }
    
    return null;
  }

  private static decideWhenVoid(legalMoves: Card[], state: BotGameState, memory: TeamMemory): Card {
    const trumpsInHand = legalMoves.filter(c => c.suit === state.trumpSuit);
    const nonTrumps = legalMoves.filter(c => c.suit !== state.trumpSuit);
    
    if (trumpsInHand.length === 0) {
      return this.sortCardsByValue(legalMoves)[0];
    }

    const trumpRemaining = memory.getTrumpRemaining();
    const currentWinner = this.getCurrentlyWinningCard(state);
    
    if (currentWinner) {
      const winnerIsPartner = currentWinner.playerIndex === state.partnerIndex;
      if (winnerIsPartner) {
        if (nonTrumps.length > 0) {
          return this.sortCardsByValue(nonTrumps)[0];
        }
        return this.sortCardsByValue(legalMoves)[0];
      }

      const canWinWithTrump = trumpsInHand.filter(t => 
        this.isCardBetter(t, currentWinner.card, state.trumpSuit, state.leadSuit!)
      );
      if (canWinWithTrump.length > 0) {
        if (state.tricksWonByTeam >= 5 && state.isDeclaringTeam) {
          if (nonTrumps.length > 0) {
            return this.sortCardsByValue(nonTrumps)[0];
          }
          return this.sortCardsByValue(legalMoves)[0];
        }
        if (trumpRemaining <= 2) {
          if (nonTrumps.length > 0) {
            return this.sortCardsByValue(nonTrumps)[0];
          }
          return this.sortCardsByValue(legalMoves)[0];
        }
        return this.sortCardsByValue(canWinWithTrump)[0];
      }
      if (nonTrumps.length > 0) {
        return this.sortCardsByValue(nonTrumps)[0];
      }
      return this.sortCardsByValue(legalMoves)[0];
    }

    if (nonTrumps.length > 0) {
      return this.sortCardsByValue(nonTrumps)[0];
    }

    return this.sortCardsByValue(trumpsInHand)[0];
  }

  private static getEndgameLead(sorted: Card[], state: BotGameState, memory: TeamMemory): Card {
    const endplayCard = this.executeTrumpEndplay(sorted, state, memory);
    if (endplayCard) return endplayCard;

    const remaining = memory.getRemainingCards();
    
    for (const card of sorted) {
      const higherInSuit = remaining.filter(c => 
        c.suit === card.suit && c.value > card.value && c.suit !== state.trumpSuit
      );
      if (higherInSuit.length === 0 && card.suit !== state.trumpSuit) {
        return card;
      }
    }

    const nonTrumpCards = sorted.filter(c => c.suit !== state.trumpSuit);
    if (nonTrumpCards.length > 0) {
      return nonTrumpCards[nonTrumpCards.length - 1];
    }

    return sorted[0];
  }

  private static executeTrumpEndplay(legalMoves: Card[], state: BotGameState, _memory: TeamMemory): Card | null {
    if (state.tricksRemaining > 2) return null;
    if (state.tricksWonByTeam < 4) return null;

    const trumps = legalMoves.filter(c => c.suit === state.trumpSuit);
    if (trumps.length === 0) return null;

    const currentWinner = this.getCurrentlyWinningCard(state);
    if (currentWinner && currentWinner.playerIndex !== state.partnerIndex) {
      return this.sortCardsByValue(trumps)[0];
    }

    return null;
  }

  private static isEndgame(state: BotGameState): boolean {
    return state.tricksRemaining <= 3;
  }

  private static isCardBetter(candidate: Card, best: Card, trump: Suit, _lead: Suit): boolean {
    if (candidate.suit === trump && best.suit !== trump) return true;
    if (candidate.suit !== trump && best.suit === trump) return false;
    if (candidate.suit === best.suit) return candidate.value > best.value;
    return false;
  }

  private static getCurrentlyWinningCard(state: BotGameState) {
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

  private static sortCardsByValueDesc(cards: Card[]): Card[] {
    return [...cards].sort((a, b) => b.value - a.value);
  }

  private static isWinning(state: BotGameState): boolean {
    const currentWinner = this.getCurrentlyWinningCard(state);
    if (!currentWinner) return false;
    return currentWinner.playerIndex === state.myIndex || currentWinner.playerIndex === state.partnerIndex;
  }

  public static shouldDuck(hand: Card[], state: BotGameState, _memory: TeamMemory): Card | null {
    if (state.currentTrick.length === 0) return null;
    if (state.tricksWonByTeam >= 3) return null;
    
    const currentWinner = this.getCurrentlyWinningCard(state);
    if (!currentWinner) return null;
    if (currentWinner.playerIndex === state.partnerIndex) {
      if (!this.isWinning(state)) {
        const highCards = this.sortCardsByValueDesc(hand).slice(0, 2);
        if (highCards.length > 0) return highCards[0];
      }
    }
    return null;
  }

  public static coverPartnerHonors(legalMoves: Card[], state: BotGameState): Card | null {
    if (state.currentTrick.length === 0) return null;
    
    const leadEntry = state.currentTrick[0];
    if (!leadEntry) return null;
    
    if (leadEntry.playerIndex !== state.partnerIndex) return null;
    
    const leadCard = leadEntry.card;
    if (!HONOR_RANKS.includes(leadCard.rank)) return null;
    
    const coverCard = legalMoves.find(c => 
      c.suit === leadCard.suit && c.value > leadCard.value
    );
    
    if (coverCard) return coverCard;
    
    return null;
  }

  public static avoidSqueeze(legalMoves: Card[], state: BotGameState, memory: TeamMemory): Card | null {
    if (state.tricksRemaining > 2) return null;
    if (state.tricksWonByTeam >= 5) return null;
    
    const suitStrength = memory.getSuitStrength(state.trumpSuit);
    if (suitStrength.opponentControl && suitStrength.highCardsRemaining <= 2) {
      const trumps = legalMoves.filter(c => c.suit === state.trumpSuit);
      if (trumps.length > 0) {
        return this.sortCardsByValueDesc(trumps)[0];
      }
    }
    
    return null;
  }
}
