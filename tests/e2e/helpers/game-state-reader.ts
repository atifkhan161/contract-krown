// Contract Crown E2E Test Helpers
// Reads game state from the DOM for use in automated tests

import type { Page } from '@playwright/test';
import type { Card, Suit, Rank, GameState, Trick, PlayedCard, Player } from '@src/engine/types.js';

// ---------- Simple DOM-based state reading ----------

/**
 * Reads the user's hand cards from the DOM.
 * Returns array of { suit, rank, value }.
 */
export async function readUserHand(page: Page): Promise<Card[]> {
  const cards = await page.locator('.user-hand .card').all();
  const result: Card[] = [];
  for (const card of cards) {
    const suit = (await card.getAttribute('data-suit')) as Suit;
    const rank = (await card.getAttribute('data-rank')) as Rank;
    if (suit && rank) {
      result.push({ suit, rank, value: cardValue(rank) });
    }
  }
  return result;
}

/**
 * Reads the playable cards from the DOM (cards with .playable class).
 */
export async function readPlayableCards(page: Page): Promise<Card[]> {
  const cards = await page.locator('.user-hand .card.playable').all();
  const result: Card[] = [];
  for (const card of cards) {
    const suit = (await card.getAttribute('data-suit')) as Suit;
    const rank = (await card.getAttribute('data-rank')) as Rank;
    if (suit && rank) {
      result.push({ suit, rank, value: cardValue(rank) });
    }
  }
  return result;
}

/**
 * Reads the trump suit from the DOM (top-left cell).
 * Returns null if trump is not yet declared ("--").
 */
export async function readTrumpSuit(page: Page): Promise<Suit | null> {
  const trumpValue = await page.locator('.trump-cell-value').textContent();
  if (!trumpValue || trumpValue.trim() === '--') return null;

  const symbols: Record<string, Suit> = {
    '♥': 'HEARTS',
    '♦': 'DIAMONDS',
    '♣': 'CLUBS',
    '♠': 'SPADES'
  };
  return symbols[trumpValue.trim()] || null;
}

/**
 * Reads the current trick cards from the trick area.
 */
export async function readCurrentTrick(page: Page): Promise<PlayedCard[]> {
  const slots = await page.locator('.trick-area .trick-card-slot').all();
  const result: PlayedCard[] = [];
  const positionMap: Record<string, number> = {
    'position-bottom': 0,
    'position-left': 1,
    'position-top': 2,
    'position-right': 3
  };

  for (const slot of slots) {
    const card = slot.locator('.card');
    const suit = (await card.getAttribute('data-suit')) as Suit;
    const rank = (await card.getAttribute('data-rank')) as Rank;
    const positionClass = (await slot.getAttribute('class'))?.split(' ').find(c => c.startsWith('position-')) || 'position-bottom';

    if (suit && rank) {
      result.push({
        card: { suit, rank, value: cardValue(rank) },
        player: positionMap[positionClass] ?? 0
      });
    }
  }
  return result;
}

/**
 * Reads the completed trick count from the DOM.
 */
export async function readCompletedTricks(page: Page): Promise<number> {
  const trickText = await page.locator('.trick-count-value').textContent();
  if (!trickText) return 0;
  const match = trickText.trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Reads team scores from the DOM.
 */
export async function readScores(page: Page): Promise<[number, number]> {
  const scores = await page.locator('.team-score-mini').all();
  if (scores.length < 2) return [0, 0];
  const s0 = parseInt((await scores[0].textContent())?.trim() || '0', 10);
  const s1 = parseInt((await scores[1].textContent())?.trim() || '0', 10);
  return [s0, s1];
}

/**
 * Reads current round trick counts per team.
 */
export async function readRoundTricks(page: Page): Promise<[number, number]> {
  const rows = await page.locator('.round-score-row').all();
  if (rows.length < 2) return [0, 0];
  const t0 = parseInt((await rows[0].locator('.round-score').textContent())?.trim() || '0', 10);
  const t1 = parseInt((await rows[1].locator('.round-score').textContent())?.trim() || '0', 10);
  return [t0, t1];
}

/**
 * Checks if it's the user's turn by looking for the active ring on the user display.
 */
export async function isUserTurn(page: Page): Promise<boolean> {
  const userActive = await page.locator('.user-display .player-info.active').count();
  return userActive > 0;
}

/**
 * Checks if the trump selector is visible (user is Crown Holder).
 */
export async function isTrumpSelectorVisible(page: Page): Promise<boolean> {
  return await page.locator('.trump-suit-btn').first().isVisible().catch(() => false);
}

/**
 * Checks if the round-end modal is visible.
 */
export async function isRoundEndModalVisible(page: Page): Promise<boolean> {
  return await page.locator('.round-end-modal').isVisible().catch(() => false);
}

/**
 * Checks if the victory modal is visible.
 */
export async function isVictoryModalVisible(page: Page): Promise<boolean> {
  return await page.locator('.victory-modal').isVisible().catch(() => false);
}

/**
 * Builds a minimal GameState from DOM state.
 * Only includes what the SmartBot needs for decision-making.
 * Note: opponent hands are NOT visible — filled with empty arrays.
 */
export async function buildGameStateFromDOM(page: Page): Promise<GameState> {
  const hand = await readUserHand(page);
  const trumpSuit = await readTrumpSuit(page);
  const currentTrickCards = await readCurrentTrick(page);
  const completedTricks = await readCompletedTricks(page);
  const scores = await readScores(page);

  // Determine current player: if user has active ring, it's player 0 (in rotated view)
  const userIsActive = await isUserTurn(page);
  const currentPlayer = userIsActive ? 0 : -1; // -1 means "not user's turn"

  const leadPlayer = currentTrickCards.length > 0 ? currentTrickCards[0].player : 0;

  const state: GameState = {
    deck: [],
    players: [
      { id: 0, hand, team: 0, isBot: false },        // User (view position 0)
      { id: 1, hand: [], team: 1, isBot: true },     // Left opponent
      { id: 2, hand: [], team: 0, isBot: true },     // Partner
      { id: 3, hand: [], team: 1, isBot: true }      // Right opponent
    ],
    currentTrick: {
      leadPlayer,
      cards: currentTrickCards,
      winner: null
    },
    completedTricks: [] as Trick[],
    trumpSuit,
    crownHolder: 0, // In rotated view, crown holder is relative
    trumpDeclarer: trumpSuit ? 0 : null,
    dealer: 0,
    phase: trumpSuit ? 'TRICK_PLAY' : 'TRUMP_DECLARATION',
    scores,
    currentPlayer,
    partnerIndex: 2,
    isDeclaringTeam: true,
    tricksWonByTeam: 0
  };

  // Build completed tricks array (just need count for tricksRemaining calculation)
  for (let i = 0; i < completedTricks; i++) {
    state.completedTricks.push({
      leadPlayer: 0,
      cards: [],
      winner: null
    } as Trick);
  }

  return state;
}

// ---------- Utilities ----------

const rankValues: Record<string, number> = {
  '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export function cardValue(rank: string): number {
  return rankValues[rank] ?? 7;
}

export function rankFromValue(value: number): Rank {
  const reverse: Record<number, Rank> = {
    7: '7', 8: '8', 9: '9', 10: '10',
    11: 'J', 12: 'Q', 13: 'K', 14: 'A'
  };
  return reverse[value] ?? '7';
}
