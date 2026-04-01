// Contract Crown Bot Manager
// Manages bot players and AI decisions using SmartBot with team-shared memory

import type { Card, Suit, GameState, Trick } from '../engine/types.js';
import { canPlayCard } from '../engine/index.js';
import { SmartBot } from './bot-logic.js';
import { TeamMemory } from './team-memory.js';

export class BotManager {
  private teamMemories: Map<number, TeamMemory> = new Map();

  constructor() {
    this.teamMemories.set(0, new TeamMemory());
    this.teamMemories.set(1, new TeamMemory());
  }

  getTeamMemory(teamId: number): TeamMemory {
    return this.teamMemories.get(teamId)!;
  }

  selectTrumpSuit(hand: Card[]): Suit {
    const suitCounts: Record<Suit, number> = {
      'HEARTS': 0,
      'DIAMONDS': 0,
      'CLUBS': 0,
      'SPADES': 0
    };

    const suitValues: Record<Suit, number> = {
      'HEARTS': 0,
      'DIAMONDS': 0,
      'CLUBS': 0,
      'SPADES': 0
    };

    for (const card of hand) {
      suitCounts[card.suit]++;
      suitValues[card.suit] += card.value;
    }

    let maxCount = 0;
    let bestSuit: Suit = 'HEARTS';
    let bestValue = 0;
    
    for (const [suit, count] of Object.entries(suitCounts)) {
      const s = suit as Suit;
      if (count > maxCount || (count === maxCount && suitValues[s] > bestValue)) {
        maxCount = count;
        bestValue = suitValues[s];
        bestSuit = s;
      }
    }

    return bestSuit;
  }

  selectCard(state: GameState, playerIndex: number): Card {
    const player = state.players[playerIndex];
    const hand = player.hand;

    const playableCards = hand.filter(card => canPlayCard(state, playerIndex, card));

    if (playableCards.length === 0) {
      throw new Error('No playable cards available');
    }

    const leadSuit = state.currentTrick.cards.length > 0 
      ? state.currentTrick.cards[0].card.suit 
      : null;

    const teamId = player.team;
    const memory = this.getTeamMemory(teamId);
    memory.trumpSuit = state.trumpSuit;

    const totalTricks = 8;
    const tricksRemaining = totalTricks - state.completedTricks.length;

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
      tricksWonByTeam: state.tricksWonByTeam,
      tricksRemaining
    };

    return SmartBot.getBestMove(playableCards, smartBotState, memory);
  }

  recordTrickResult(trick: Trick, winner: number, players: { id: number; team: number }[]): void {
    const winnerTeam = players.find(p => p.id === winner)?.team ?? 0;
    const trickNumber = trick.cards.length > 0 ? 1 : 1;

    for (let teamId = 0; teamId < 2; teamId++) {
      const memory = this.getTeamMemory(teamId);

      for (const entry of trick.cards) {
        const playerTeam = players.find(p => p.id === entry.player)?.team ?? 0;
        if (playerTeam === teamId) {
          memory.recordOurPlay(entry.player, entry.card, trickNumber, entry.player === winner);
        }
      }

      if (winnerTeam === teamId) {
        memory.recordTrickWeWon({
          trickNumber,
          winner,
          allCards: trick.cards.map(pc => ({ player: pc.player, card: pc.card })),
          ledSuit: trick.cards[0].card.suit
        });
      }
    }
  }

  resetMemories(): void {
    for (const memory of this.teamMemories.values()) {
      memory.reset();
    }
  }

  getDecisionDelay(): number {
    return 500 + Math.random() * 1000;
  }

  evaluateHand(hand: Card[], trumpSuit: Suit | null): number {
    let score = 0;
    
    for (const card of hand) {
      score += card.value - 6;
      if (card.suit === trumpSuit) {
        score += 2;
      }
    }

    return score;
  }
}
