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

const ALL_RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const ALL_SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
const HIGH_RANKS: Rank[] = ['A', 'K', 'Q'];

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

  recordOurPlay(player: number, card: Card, trickNumber: number, didWeWin: boolean): void {
    this.ourPlays.push({ player, card, trickNumber, didWeWin });
    this.knownCards.add(cardKey(card));
  }

  recordTrickWeWon(trick: TeamWonTrickRecord): void {
    this.tricksWeWon.push(trick);
    for (const entry of trick.allCards) {
      this.knownCards.add(cardKey(entry.card));
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

  reset(): void {
    this.ourPlays = [];
    this.tricksWeWon = [];
    this.knownCards = new Set();
    this.opponentVoids = [];
    this.trumpSuit = null;
  }
}
