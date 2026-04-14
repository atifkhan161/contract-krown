// Contract Crown E2E Test Helpers
// Common operations: login, room creation, waiting room, game start

import type { Page, BrowserContext } from '@playwright/test';
import { expect } from '@playwright/test';

// ---------- Authentication ----------

/**
 * Logs in a user by setting mock session in localStorage.
 * Bypasses Supabase auth for E2E test independence.
 */
export async function loginUser(page: Page, username: string): Promise<void> {
  // Navigate to root first to let app initialize
  await page.goto('/');
  
  // Wait for app to initialize
  await page.waitForTimeout(500);

  // Generate mock session (bypasses Supabase auth)
  const mockSession = {
    userId: generateMockUserId(),
    username: username,
    token: 'mock-token-' + Date.now(),
    refreshToken: 'mock-refresh-' + Date.now(),
    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
  };

  // Set session in localStorage
  await page.evaluate((session) => {
    localStorage.setItem('contract_crown_session', JSON.stringify(session));
  }, mockSession);

  // Navigate to lobby - router will check auth and allow since session is set
  await page.goto('/lobby');

  // Wait for lobby to be visible - try multiple selectors
  try {
    await page.locator('.lobby-view').waitFor({ state: 'visible', timeout: 10000 });
  } catch {
    // Try alternate - wait for any lobby element
    await page.locator('#create-game-btn, .lobby-header, [class*="lobby"]').first().waitFor({ state: 'visible', timeout: 10000 });
  }
}

/**
 * Generates a mock UUID for test user
 */
function generateMockUserId(): string {
  return 'test-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
}

/**
 * Checks if the user is already logged in (has session in localStorage).
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const session = await page.evaluate(() => {
    try {
      const data = localStorage.getItem('contract_crown_session');
      if (!data) return null;
      const parsed = JSON.parse(data);
      return Date.now() < parsed.expiresAt ? parsed : null;
    } catch {
      return null;
    }
  });
  return session !== null;
}

// ---------- Lobby & Room Creation ----------

/**
 * Creates a new game room from the lobby.
 * Returns the room code (4-char code displayed in waiting room).
 */
export async function createGameRoom(page: Page): Promise<string> {
  // Wait for lobby to be visible
  await page.locator('#create-game-btn').waitFor({ state: 'visible', timeout: 10000 });

  // Click "Create Game"
  await page.locator('#create-game-btn').click();

  // Should redirect to /waiting/new
  await page.waitForURL(/\/waiting\/new/, { timeout: 10000 });

  // Wait for the room code to appear
  await page.locator('#wr-room-code').waitFor({ state: 'visible', timeout: 15000 });

  // Read the room code
  const roomCode = await page.locator('#wr-room-code').textContent();
  return roomCode?.trim() || '';
}

/**
 * Joins a game room using the room code.
 * For PartyKit, navigates directly to /waiting/{roomCode} since room codes are used as room IDs.
 */
export async function joinGameRoom(page: Page, roomCode: string, username: string): Promise<void> {
  // First ensure logged in
  if (!(await isLoggedIn(page))) {
    await loginUser(page, username);
  }

  // For PartyKit, the room code IS the room identifier
  // Navigate directly to the waiting room
  console.log(`  Joining room code "${roomCode}"`);

  // Navigate to the waiting room
  await page.goto(`/waiting/${roomCode}`);

  // Wait for the waiting room to load
  await page.locator('#wr-room-code').waitFor({ state: 'visible', timeout: 15000 });
}

// ---------- Waiting Room ----------

/**
 * Adds a bot to the current waiting room (admin only).
 * Clicks the "Add Bot" button.
 */
export async function addBot(page: Page): Promise<void> {
  await page.locator('#wr-add-bot-btn').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#wr-add-bot-btn').click();

  // Wait for player count to update by checking the displayed count
  await page.waitForFunction(() => {
    const el = document.querySelector('#wr-player-count');
    if (!el) return false;
    const match = el.textContent?.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) > 0 : false;
  }, { timeout: 5000 });
}

/**
 * Starts the game from the waiting room (admin only).
 * Clicks the "Start Game" button and waits for the game view to render with cards.
 * Uses a long timeout to handle PartyKit WebSocket state sync in headless mode.
 */
export async function startGame(page: Page): Promise<void> {
  await page.locator('#wr-start-btn').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#wr-start-btn').click();

  // Wait for the game view to appear — use a very long timeout for WebSocket sync
  await page.waitForFunction(() => {
    // Check if trump selector is visible (user is crown holder and game started)
    const trumpBtns = document.querySelectorAll('.trump-suit-btn');
    if (trumpBtns.length > 0) return 'trump_selector';

    // Check if user has cards in hand (game synced)
    const handCards = document.querySelectorAll('.user-hand .card');
    if (handCards.length > 0) return 'cards_dealt';

    // Check if trump is declared (game started even if cards not rendered yet)
    const trumpCell = document.querySelector('.trump-cell-value');
    if (trumpCell && trumpCell.textContent?.trim() !== '--') return 'trump_declared';

    // Check if the URL has changed to /game/ (router redirect happened)
    if (window.location.pathname.startsWith('/game/')) return 'redirected';

    // Check if the page title changed from "Waiting Room" to "Game"
    const title = document.querySelector('.game-header-title, [class*="game"] h1, h1');
    if (title && title.textContent?.trim() === 'Game') return 'title_changed';

    return false;
  }, { timeout: 120000 });
}

/**
 * Gets the current player count in the waiting room.
 */
export async function getWaitingRoomPlayerCount(page: Page): Promise<number> {
  const text = await page.locator('#wr-player-count').textContent();
  const match = text?.trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Waits until the waiting room has the expected number of players.
 */
export async function waitForPlayerCount(page: Page, expected: number, timeout = 15000): Promise<void> {
  await page.waitForFunction(
    ({ expected }) => {
      const el = document.querySelector('#wr-player-count');
      if (!el) return false;
      const match = el.textContent?.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) === expected : false;
    },
    { expected },
    { timeout }
  );
}

// ---------- Game Play Helpers ----------

/**
 * Waits for the user's turn during trick play.
 * Checks that: user is active, has cards in hand, and trump is declared.
 */
export async function waitForUserTurn(page: Page, timeout = 60000): Promise<void> {
  await page.waitForFunction(() => {
    // User must be active
    const userActive = document.querySelector('.user-display .player-info.active');
    if (!userActive) return false;

    // User must have cards in hand
    const handCards = document.querySelectorAll('.user-hand .card');
    if (handCards.length === 0) return false;

    // Trump must be declared (visible in top-left)
    const trumpCell = document.querySelector('.trump-cell-value');
    if (!trumpCell || trumpCell.textContent?.trim() === '--') return false;

    return true;
  }, { timeout });
}

/**
 * Waits for the trump selector to appear (user is Crown Holder).
 */
export async function waitForTrumpSelector(page: Page, timeout = 15000): Promise<void> {
  await page.locator('.trump-suit-btn').first().waitFor({ state: 'visible', timeout });
}

/**
 * Waits for the round-end modal to appear.
 */
export async function waitForRoundEndModal(page: Page, timeout = 15000): Promise<void> {
  await page.locator('.round-end-modal, [class*="round-end"]').first().waitFor({ state: 'visible', timeout });
}

/**
 * Clicks "Continue" on the round-end modal to proceed to next round.
 */
export async function dismissRoundEndModal(page: Page): Promise<void> {
  // The round end modal typically auto-dismisses or has a continue button
  // Wait a moment for it to appear, then wait for it to disappear
  await page.waitForTimeout(2000);

  // Try to find and click continue button, or just wait for modal to close
  const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Next")');
  if (await continueBtn.count() > 0) {
    await continueBtn.click();
  }

  // Wait for modal to disappear
  await page.locator('.round-end-modal, [class*="round-end"]').first().waitFor({ state: 'hidden', timeout: 5000 });
}

/**
 * Waits for the victory modal to appear (game complete).
 */
export async function waitForVictoryModal(page: Page, timeout = 15000): Promise<void> {
  await page.locator('.victory-modal, [class*="victory"]').first().waitFor({ state: 'visible', timeout });
}

/**
 * Gets the current trick count (X/8).
 */
export async function getTrickCount(page: Page): Promise<number> {
  const text = await page.locator('.trick-count-value').textContent();
  const match = text?.trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Gets team scores from the game view.
 */
export async function getScores(page: Page): Promise<[number, number]> {
  const scores = await page.locator('.team-score-mini').all();
  if (scores.length < 2) return [0, 0];
  const s0 = parseInt((await scores[0].textContent())?.trim() || '0', 10);
  const s1 = parseInt((await scores[1].textContent())?.trim() || '0', 10);
  return [s0, s1];
}

// ---------- Server Management ----------

/**
 * Waits for the game server to be healthy.
 * Polls the /health endpoint.
 */
export async function waitForServer(timeout = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch('http://localhost:1999/health');
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become healthy within ${timeout}ms`);
}
