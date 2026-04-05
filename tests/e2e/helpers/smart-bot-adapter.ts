// Contract Crown SmartBot Adapter for E2E Tests
// Bridges Playwright DOM state → BotManager decision → DOM action

import type { Page } from '@playwright/test';
import { BotManager } from '@src/bot/bot-manager.js';
import type { Card, Suit, GameState } from '@src/engine/types.js';
import { buildGameStateFromDOM, readPlayableCards, readTrumpSuit } from './game-state-reader.js';

// The BotManager is shared across the test to accumulate team memory
const botManager = new BotManager();

/**
 * Uses the SmartBot to pick the best card from the playable cards.
 * Reads game state from DOM, constructs a GameState, and delegates to BotManager.
 */
export async function pickBestCard(page: Page): Promise<Card | null> {
  const playableCards = await readPlayableCards(page);
  if (playableCards.length === 0) return null;

  // If only one card is playable, no strategy needed
  if (playableCards.length === 1) return playableCards[0];

  // Build partial game state from DOM
  const state = await buildGameStateFromDOM(page);

  // If trump is declared, use SmartBot
  if (state.trumpSuit && state.currentTrick.cards.length >= 0) {
    try {
      // Use player index 0 (user is always at view position 0)
      state.players[0].hand = playableCards; // Only playable cards matter for decision
      const card = botManager.selectCard(state, 0);
      return card;
    } catch {
      // If SmartBot fails (e.g., incomplete state), fall back to simple strategy
      return pickCardSimple(playableCards, state);
    }
  }

  // No trump yet — this shouldn't happen in TRICK_PLAY phase
  // Fall back to simple strategy
  return pickCardSimple(playableCards, state);
}

/**
 * Uses the SmartBot trump selection strategy: pick the suit with most cards + highest value.
 */
export function pickBestTrumpSuit(hand: Card[]): Suit {
  return botManager.selectTrumpSuit(hand);
}

/**
 * Clicks the trump suit button in the trump selector modal.
 */
export async function clickTrumpSuit(page: Page, suit: Suit): Promise<void> {
  const suitSymbols: Record<Suit, string> = {
    'HEARTS': '♥',
    'DIAMONDS': '♦',
    'CLUBS': '♣',
    'SPADES': '♠'
  };

  // Wait for the trump selector to appear
  await page.locator(`.trump-suit-btn[data-suit="${suit}"]`).waitFor({ state: 'visible', timeout: 5000 });

  // Click the suit button
  await page.locator(`.trump-suit-btn[data-suit="${suit}"]`).click();
}

/**
 * Clicks a playable card in the user's hand.
 * Matches by suit and rank data attributes.
 */
export async function clickCard(page: Page, card: Card): Promise<void> {
  // Wait a moment for the DOM to settle after previous trick
  await page.waitForTimeout(300);

  // Wait for the specific card to be playable and visible
  const selector = `.user-hand .card.playable[data-suit="${card.suit}"][data-rank="${card.rank}"]`;
  await page.locator(selector).waitFor({ state: 'visible', timeout: 8000 });

  // Click the card
  await page.locator(selector).click();
}

/**
 * Simple card selection fallback when SmartBot can't make a decision.
 * Strategy: play highest value card when leading, follow suit and try to win when following.
 */
function pickCardSimple(playableCards: Card[], state: GameState): Card {
  const leadSuit = state.currentTrick.cards.length > 0
    ? state.currentTrick.cards[0].card.suit
    : null;

  if (!leadSuit) {
    // Leading: play highest card
    return playableCards.reduce((best, card) => card.value > best.value ? card : best);
  }

  // Following: try to beat current highest if possible
  const sameSuit = playableCards.filter(c => c.suit === leadSuit);
  if (sameSuit.length > 0) {
    // Check if we're currently winning
    const highestInSuit = Math.max(...sameSuit.map(c => c.value));
    const currentHighest = Math.max(
      ...state.currentTrick.cards
        .filter(pc => pc.card.suit === leadSuit)
        .map(pc => pc.card.value),
      0
    );

    if (highestInSuit > currentHighest) {
      // We can win — play the lowest card that wins
      return sameSuit
        .filter(c => c.value > currentHighest)
        .reduce((best, card) => card.value < best.value ? card : best);
    }

    // Can't win — discard lowest
    return sameSuit.reduce((best, card) => card.value < best.value ? card : best, sameSuit[0]);
  }

  // Void in lead suit: play trump if we can win, otherwise discard lowest
  const trumpCards = playableCards.filter(c => c.suit === state.trumpSuit);
  if (trumpCards.length > 0) {
    // Check if anyone else played trump
    const opponentTrumps = state.currentTrick.cards
      .filter(pc => pc.card.suit === state.trumpSuit)
      .map(pc => pc.card.value);

    if (opponentTrumps.length === 0) {
      // No trump played yet — play lowest trump (save high ones)
      return trumpCards.reduce((best, card) => card.value < best.value ? card : best);
    }

    const highestOpponentTrump = Math.max(...opponentTrumps);
    const winningTrumps = trumpCards.filter(c => c.value > highestOpponentTrump);
    if (winningTrumps.length > 0) {
      // Play lowest trump that still wins
      return winningTrumps.reduce((best, card) => card.value < best.value ? card : best);
    }

    // Can't beat opponent's trump — discard lowest non-trump
    const nonTrump = playableCards.filter(c => c.suit !== state.trumpSuit);
    if (nonTrump.length > 0) {
      return nonTrump.reduce((best, card) => card.value < best.value ? card : best);
    }
  }

  // Default: play lowest card
  return playableCards.reduce((best, card) => card.value < best.value ? card : best);
}

/**
 * Resets the BotManager team memories (call at start of each test).
 */
export function resetBotMemories(): void {
  botManager.resetMemories();
}

/**
 * Records a trick result in the BotManager's team memories.
 * Called after each trick to maintain bot memory across the game.
 */
export function recordTrickResultForBot(state: GameState, winner: number): void {
  if (state.currentTrick.cards.length === 0) return;

  const trick = {
    leadPlayer: state.currentTrick.leadPlayer,
    cards: state.currentTrick.cards,
    winner
  };

  const players = state.players.map((p, i) => ({ id: i, team: p.team }));
  botManager.recordTrickResult(trick, winner, players);
}
