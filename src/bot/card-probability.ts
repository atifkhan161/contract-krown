// Contract Crown Card Probability Module
// Handles card counting, probability calculations, and opponent hand estimation

import type { Card, Suit, Rank } from '../engine/types.js';

const ALL_RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const ALL_SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];

interface CardCount {
  suit: Suit;
  count: number;
}

export interface PlayerEstimate {
  playerIndex: number;
  estimatedTotalCards: number;
  suitCounts: CardCount[];
  hasTrump: boolean | null;
  strength: 'weak' | 'medium' | 'strong' | null;
}

interface WinProbability {
  card: Card;
  winChance: number;
  expectedTricks: number;
}

export class CardProbability {
  private knownCards: Set<string> = new Set();
  private playerPlays: Map<number, Card[]> = new Map();
  private playerTricksWon: Map<number, Card[]> = new Map();
  private trumpSuit: Suit | null = null;

  static readonly CARD_QUALITY: Record<Rank, number> = {
    '7': 1, '8': 1, '9': 1, '10': 2, 'J': 3, 'Q': 4, 'K': 5, 'A': 6
  };

  static readonly TRUMP_BONUS = 3;
  static readonly PARTNER_BONUS = 1;

  constructor() {
    for (let i = 0; i < 4; i++) {
      this.playerPlays.set(i, []);
      this.playerTricksWon.set(i, []);
    }
  }

  private cardKey(card: Card): string {
    return `${card.suit}-${card.rank}`;
  }

  setTrumpSuit(suit: Suit): void {
    this.trumpSuit = suit;
  }

  recordPlay(playerIndex: number, card: Card): void {
    this.knownCards.add(this.cardKey(card));
    const plays = this.playerPlays.get(playerIndex) || [];
    plays.push(card);
    this.playerPlays.set(playerIndex, plays);
  }

  recordTrickWin(playerIndex: number, cards: Card[]): void {
    const wins = this.playerTricksWon.get(playerIndex) || [];
    wins.push(...cards);
    this.playerTricksWon.set(playerIndex, wins);
    for (const card of cards) {
      this.knownCards.add(this.cardKey(card));
    }
  }

  getUnaccountedCards(): Card[] {
    const fullDeck: Card[] = [];
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        fullDeck.push({ suit, rank, value: this.rankValue(rank) });
      }
    }
    return fullDeck.filter(c => !this.knownCards.has(this.cardKey(c)));
  }

  private rankValue(rank: Rank): number {
    const values: Record<Rank, number> = { '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return values[rank];
  }

  getUnaccountedBySuit(suit: Suit): Card[] {
    return this.getUnaccountedCards().filter(c => c.suit === suit);
  }

  getUnaccountedTrumpCount(): number {
    if (!this.trumpSuit) return 0;
    return this.getUnaccountedBySuit(this.trumpSuit).length;
  }

  estimatePlayerHand(playerIndex: number): PlayerEstimate {
    const allPlays = Array.from(this.playerPlays.values()).flat();
    const myPlays = this.playerPlays.get(playerIndex) || [];
    
    const suitCounts: CardCount[] = ALL_SUITS.map(suit => {
      const playedInSuit = allPlays.filter(c => c.suit === suit).length;
      const myPlayedInSuit = myPlays.filter(c => c.suit === suit).length;
      const unaccountedInSuit = 8 - playedInSuit;
      const estimatedInHand = Math.max(0, unaccountedInSuit - (3 - myPlayedInSuit));
      return { suit, count: estimatedInHand };
    });

    const unaccounted = this.getUnaccountedCards();
    const myUnaccounted = unaccounted.length / 4;
    const hasTrump = this.trumpSuit 
      ? myPlays.some(c => c.suit === this.trumpSuit) || null
      : null;

    let strength: 'weak' | 'medium' | 'strong' | null = null;
    if (myPlays.length > 0) {
      const totalQuality = myPlays.reduce((sum, c) => sum + CardProbability.CARD_QUALITY[c.rank], 0);
      if (totalQuality >= 15) strength = 'strong';
      else if (totalQuality >= 8) strength = 'medium';
      else strength = 'weak';
    }

    return {
      playerIndex,
      estimatedTotalCards: Math.round(myUnaccounted),
      suitCounts,
      hasTrump,
      strength
    };
  }

  isOpponentVoid(playerIndex: number, suit: Suit): boolean {
    const playedCards = Array.from(this.playerPlays.values()).flat();
    const myPlays = this.playerPlays.get(playerIndex) || [];
    
    const opponentPlays = playedCards.filter(c => !myPlays.includes(c));
    const playedInSuit = opponentPlays.filter(c => c.suit === suit).length;
    
    return playedInSuit >= 3 && !myPlays.some(c => c.suit === suit);
  }

  calculateWinProbability(
    card: Card,
    hand: Card[],
    currentTrick: { card: Card; player: number }[],
    leadSuit: Suit | null,
    trumpSuit: Suit
  ): number {
    if (currentTrick.length === 0) {
      return this.calculateLeadWinProbability(card, hand, trumpSuit);
    }

    const leadCard = currentTrick[0].card;
    let currentBest = leadCard;
    const leadSuitValue = leadSuit || 'HEARTS';

    for (let i = 1; i < currentTrick.length; i++) {
      const tc = currentTrick[i].card;
      if (this.isCardBetter(tc, currentBest, trumpSuit, leadSuitValue)) {
        currentBest = tc;
      }
    }

    if (this.isCardBetter(card, currentBest, trumpSuit, leadSuitValue)) {
      return 0.85;
    }

    if (card.suit === leadSuit && currentBest.suit !== leadSuit) {
      return 0.90;
    }

    const unaccounted = this.getUnaccountedCards();
    const opponentHighCards = unaccounted.filter(c => 
      c.suit === leadCard.suit && c.value > currentBest.value
    );

    if (opponentHighCards.length > 0) {
      return 0.3;
    }

    return 0.1;
  }

  private calculateLeadWinProbability(card: Card, _hand: Card[], trumpSuit: Suit): number {
    if (card.suit === trumpSuit) {
      const unaccountedTrump = this.getUnaccountedTrumpCount();
      if (unaccountedTrump <= 2) return 0.8;
      return 0.6;
    }

    const quality = CardProbability.CARD_QUALITY[card.rank];
    if (quality >= 5) return 0.7;
    if (quality >= 3) return 0.4;
    
    const sameSuitUnaccounted = this.getUnaccountedBySuit(card.suit);
    if (sameSuitUnaccounted.some(c => c.value > card.value)) {
      return 0.2;
    }

    return 0.5;
  }

  private isCardBetter(candidate: Card, best: Card, trump: Suit, _lead: Suit): boolean {
    if (candidate.suit === trump && best.suit !== trump) return true;
    if (candidate.suit !== trump && best.suit === trump) return false;
    if (candidate.suit === best.suit) return candidate.value > best.value;
    return false;
  }

  calculateWinProbabilities(
    legalMoves: Card[],
    hand: Card[],
    currentTrick: { card: Card; player: number }[],
    leadSuit: Suit | null,
    trumpSuit: Suit
  ): WinProbability[] {
    return legalMoves.map(card => ({
      card,
      winChance: this.calculateWinProbability(card, hand, currentTrick, leadSuit, trumpSuit),
      expectedTricks: 0
    })).sort((a, b) => b.winChance - a.winChance);
  }

  reset(): void {
    this.knownCards.clear();
    for (let i = 0; i < 4; i++) {
      this.playerPlays.set(i, []);
      this.playerTricksWon.set(i, []);
    }
    this.trumpSuit = null;
  }

  clone(): CardProbability {
    const copy = new CardProbability();
    copy.knownCards = new Set(this.knownCards);
    copy.trumpSuit = this.trumpSuit;
    for (let i = 0; i < 4; i++) {
      copy.playerPlays.set(i, [...(this.playerPlays.get(i) || [])]);
      copy.playerTricksWon.set(i, [...(this.playerTricksWon.get(i) || [])]);
    }
    return copy;
  }
}
