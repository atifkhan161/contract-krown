// Contract Crown Bot Manager
// Manages bot players and AI decisions using SmartBot with team-shared memory

import type { Card, Suit, GameState, Trick, Rank } from '../engine/types.js';
import { canPlayCard } from '../engine/index.js';
import { SmartBot } from './bot-logic.js';
import { TeamMemory } from './team-memory.js';

const CARD_QUALITY_WEIGHTS: Record<Rank, number> = {
  'A': 6, 'K': 5, 'Q': 4, 'J': 3, '10': 2, '9': 1, '8': 1, '7': 1
};

interface SuitScore {
  suit: Suit;
  totalScore: number;
  cardCount: number;
  qualityScore: number;
  voidPotential: number;
  controlScore: number;
}

export class BotManager {
  private teamMemories: Map<number, TeamMemory> = new Map();

  constructor() {
    this.teamMemories.set(0, new TeamMemory());
    this.teamMemories.set(1, new TeamMemory());
  }

  getTeamMemory(teamId: number): TeamMemory {
    return this.teamMemories.get(teamId)!;
  }

  selectTrumpSuit(hand: Card[], _gameState?: GameState): Suit {
    const suitScores: SuitScore[] = [];
    
    const suits: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
    
    for (const suit of suits) {
      const suitCards = hand.filter(c => c.suit === suit);
      const cardCount = suitCards.length;
      
      let qualityScore = 0;
      let controlScore = 0;
      
      for (const card of suitCards) {
        qualityScore += CARD_QUALITY_WEIGHTS[card.rank];
        if (card.rank === 'A' || card.rank === 'K') {
          controlScore += 2;
        } else if (card.rank === 'Q' || card.rank === 'J') {
          controlScore += 1;
        }
      }

      let voidPotential = 0;
      if (cardCount >= 4) {
        voidPotential = 3;
      } else if (cardCount === 3) {
        voidPotential = 1;
      }

      const spreadPenalty = cardCount === 2 ? -2 : 0;
      
      const totalScore = qualityScore + voidPotential + controlScore + spreadPenalty;
      
      suitScores.push({
        suit,
        totalScore,
        cardCount,
        qualityScore,
        voidPotential,
        controlScore
      });
    }

    suitScores.sort((a, b) => b.totalScore - a.totalScore);
    
    const bestSuit = suitScores[0].suit;
    const bestScore = suitScores[0];
    const secondBest = suitScores[1];

    if (secondBest && 
        secondBest.cardCount === bestScore.cardCount && 
        secondBest.qualityScore >= bestScore.qualityScore - 2 &&
        bestScore.cardCount < 3) {
      return secondBest.suit;
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
