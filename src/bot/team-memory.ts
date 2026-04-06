// Contract Crown Team Memory System
// Shared memory for bots on the same team - tracks plays, won tricks, and deduces remaining cards

import type { Card, Suit, Rank } from '../engine/types.js';

export interface TeamMemoryRecord {
  player: number;
  card: Card;
  trickNumber: number;
  didWeWin: boolean;
}

export interface TeamWonTrickRecord {
  trickNumber: number;
  winner: number;
  allCards: { player: number; card: Card }[];
  ledSuit: Suit;
}

export interface PlayerPlayRecord {
  player: number;
  cards: Card[];
  tricksWon: number;
  lastTrickPlayed: number;
}

export interface SuitInfo {
  suit: Suit;
  count: number;
  highCards: number;
  hasTrump: boolean;
}

const ALL_RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const ALL_SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
const HIGH_RANKS: Rank[] = ['A', 'K', 'Q'];
const HONOR_RANKS: Rank[] = ['A', 'K', 'Q', 'J'];

function createFullDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      const values: Record<Rank, number> = { '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
      cards.push({ suit, rank, value: values[rank] });
    }
  }
  return cards;
}

function cardKey(card: Card): string {
  return `${card.suit}-${card.rank}`;
}

export class TeamMemory {
  public ourPlays: TeamMemoryRecord[] = [];
  public tricksWeWon: TeamWonTrickRecord[] = [];
  public knownCards: Set<string> = new Set();
  public opponentVoids: { player: number; suit: Suit }[] = [];
  public trumpSuit: Suit | null = null;

  private playerRecords: Map<number, PlayerPlayRecord> = new Map();
  private suitPlays: Map<Suit, Map<number, number>> = new Map();
  private leadPlays: { player: number; card: Card; suit: Suit }[] = [];

  constructor() {
    for (let i = 0; i < 4; i++) {
      this.playerRecords.set(i, {
        player: i,
        cards: [],
        tricksWon: 0,
        lastTrickPlayed: 0
      });
    }
    for (const suit of ALL_SUITS) {
      this.suitPlays.set(suit, new Map());
      for (let i = 0; i < 4; i++) {
        this.suitPlays.get(suit)!.set(i, 0);
      }
    }
  }

  recordOurPlay(player: number, card: Card, trickNumber: number, didWeWin: boolean): void {
    this.ourPlays.push({ player, card, trickNumber, didWeWin });
    this.knownCards.add(cardKey(card));

    const record = this.playerRecords.get(player);
    if (record) {
      record.cards.push(card);
      record.lastTrickPlayed = trickNumber;
      if (didWeWin) record.tricksWon++;
    }

    const suitPlays = this.suitPlays.get(card.suit);
    if (suitPlays) {
      suitPlays.set(player, (suitPlays.get(player) || 0) + 1);
    }
  }

  recordTrickWeWon(trick: TeamWonTrickRecord): void {
    this.tricksWeWon.push(trick);
    for (const entry of trick.allCards) {
      this.knownCards.add(cardKey(entry.card));
    }

    if (trick.allCards.length > 0) {
      const leadCard = trick.allCards[0].card;
      this.leadPlays.push({
        player: trick.allCards[0].player,
        card: leadCard,
        suit: leadCard.suit
      });
    }

    for (const entry of trick.allCards) {
      if (entry.player !== trick.winner) {
        const playerTeam = this.getPlayerTeamFromTrick(entry.player, trick);
        const winnerTeam = this.getPlayerTeamFromTrick(trick.winner, trick);
        if (playerTeam !== winnerTeam) {
          if (entry.card.suit !== trick.ledSuit) {
            const alreadyRecorded = this.opponentVoids.some(
              v => v.player === entry.player && v.suit === trick.ledSuit
            );
            if (!alreadyRecorded) {
              this.opponentVoids.push({ player: entry.player, suit: trick.ledSuit });
            }
          }
        }
      }
    }
  }

  private getPlayerTeamFromTrick(playerIndex: number, trick: TeamWonTrickRecord): number {
    const allPlayers = new Set(trick.allCards.map(c => c.player));
    const players = Array.from(allPlayers).sort();
    if (players.length < 4) return 0;
    const team0 = new Set([players[0], players[2]]);
    return team0.has(playerIndex) ? 0 : 1;
  }

  recalculateRemaining(): Card[] {
    const fullDeck = createFullDeck();
    return fullDeck.filter(c => !this.knownCards.has(cardKey(c)));
  }

  getRemainingCards(): Card[] {
    return this.recalculateRemaining();
  }

  isOpponentVoid(player: number, suit: Suit): boolean {
    return this.opponentVoids.some(v => v.player === player && v.suit === suit);
  }

  getUnaccountedHighCards(): Card[] {
    const remaining = this.getRemainingCards();
    return remaining.filter(c => HIGH_RANKS.includes(c.rank));
  }

  getTrumpRemaining(): number {
    if (!this.trumpSuit) return 0;
    return this.getRemainingCards().filter(c => c.suit === this.trumpSuit).length;
  }

  getPlayerRecord(player: number): PlayerPlayRecord | undefined {
    return this.playerRecords.get(player);
  }

  getPlayerSuitCount(player: number, suit: Suit): number {
    return this.suitPlays.get(suit)?.get(player) || 0;
  }

  getPlayerEstimatedHandSize(player: number): number {
    const record = this.playerRecords.get(player);
    if (!record) return 0;
    const playedCards = record.cards.length;
    return Math.max(0, 8 - playedCards);
  }

  getSuitPlayedByPlayer(player: number, suit: Suit): number {
    return this.getPlayerSuitCount(player, suit);
  }

  getPartnerStrongSuits(): Suit[] {
    const suitWins: Record<string, number> = {};
    for (const trick of this.tricksWeWon) {
      for (const entry of trick.allCards) {
        if (entry.player % 2 === 0) {
          const key = entry.card.suit;
          suitWins[key] = (suitWins[key] || 0) + 1;
        }
      }
    }
    return Object.entries(suitWins)
      .filter(([, count]) => count >= 2)
      .map(([suit]) => suit as Suit);
  }

  getOpponentWeakSuits(player: number): Suit[] {
    const weakSuits: Suit[] = [];
    for (const suit of ALL_SUITS) {
      const count = this.getPlayerSuitCount(player, suit);
      if (count <= 1) {
        weakSuits.push(suit);
      }
    }
    return weakSuits;
  }

  hasPlayerLedSuit(player: number, suit: Suit): boolean {
    return this.leadPlays.some(l => l.player === player && l.suit === suit);
  }

  getPlayerLeadSuits(player: number): Suit[] {
    const leads = this.leadPlays.filter(l => l.player === player);
    return [...new Set(leads.map(l => l.suit))];
  }

  getSuitStrength(suit: Suit): { ourControl: boolean; opponentControl: boolean; remaining: number; highCardsRemaining: number } {
    const remaining = this.getRemainingCards().filter(c => c.suit === suit);
    const highCardsRemaining = remaining.filter(c => HONOR_RANKS.includes(c.rank)).length;
    
    const ourPlaysInSuit = this.ourPlays.filter(p => p.card.suit === suit);
    const opponentPlays = Array.from(this.playerRecords.values())
      .flatMap(r => r.cards.filter(c => c.suit === suit));

    const ourHighPlays = ourPlaysInSuit.filter(p => HIGH_RANKS.includes(p.card.rank));
    const opponentHighPlays = opponentPlays.filter(c => HIGH_RANKS.includes(c.rank));

    return {
      ourControl: ourHighPlays.length > opponentHighPlays.length,
      opponentControl: opponentHighPlays.length > ourHighPlays.length,
      remaining: remaining.length,
      highCardsRemaining
    };
  }

  shouldFinessePartner(leadSuit: Suit): boolean {
    const partnerLeads = this.leadPlays.filter(l => l.player % 2 === 0 && l.suit === leadSuit);
    if (partnerLeads.length === 0) return false;
    
    const lastLead = partnerLeads[partnerLeads.length - 1];
    return lastLead && lastLead.card.value >= 12;
  }

  isEndgame(): boolean {
    const totalTricksPlayed = this.ourPlays.length / 4;
    return totalTricksPlayed >= 5;
  }

  reset(): void {
    this.ourPlays = [];
    this.tricksWeWon = [];
    this.knownCards = new Set();
    this.opponentVoids = [];
    this.trumpSuit = null;
    this.leadPlays = [];

    for (let i = 0; i < 4; i++) {
      this.playerRecords.set(i, {
        player: i,
        cards: [],
        tricksWon: 0,
        lastTrickPlayed: 0
      });
    }
    for (const suit of ALL_SUITS) {
      for (let i = 0; i < 4; i++) {
        this.suitPlays.get(suit)?.set(i, 0);
      }
    }
  }
}
