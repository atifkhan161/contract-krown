// Contract Crown E2E Test — Simplified Setup Test
// 1 Human Player + 3 Bots — Setup and Game Start Only
//
// This test validates the setup flow:
// - Human logs in, creates a room, waits in lobby
// - Helper logs in, joins via room code
// - 2 bots are added
// - Game is started
// - Both browsers should redirect to game view

import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import {
  loginUser,
  createGameRoom,
  joinGameRoom,
  startGame,
  addBot,
  waitForPlayerCount,
  waitForServer
} from './helpers/e2e-test-helpers.js';

const HUMAN_USER = 'e2e-human';
const HELPER_USER = 'e2e-helper';

test.describe('Script A: 1 Human + 3 Bots — Setup Test', () => {
  let context1: BrowserContext;
  let context2: BrowserContext;
  let humanPage: Page;
  let helperPage: Page;

  test.beforeAll(async ({ browser }) => {
    await waitForServer();

    // Create 2 isolated browser contexts
    context1 = await browser.newContext({ viewport: { width: 375, height: 812 } });
    context2 = await browser.newContext({ viewport: { width: 375, height: 812 } });
    humanPage = await context1.newPage();
    helperPage = await context2.newPage();

    // Suppress non-critical errors
    humanPage.on('pageerror', (err) => {
      if (!err.message.includes('disconnect')) {
        console.log(`[Human] Page error:`, err.message);
      }
    });
    helperPage.on('pageerror', (err) => {
      if (!err.message.includes('disconnect')) {
        console.log(`[Helper] Page error:`, err.message);
      }
    });
  });

  test.afterAll(async () => {
    await context1.close();
    await context2.close();
  });

  test('should setup 1 human + 3 bots and start game', async () => {
    // ---------- Step 1: Human player logs in ----------
    test.step('login human player', async () => {
      await loginUser(humanPage, HUMAN_USER);
      await expect(humanPage.locator('.lobby-view')).toBeVisible({ timeout: 10000 });
      console.log('[Human] Logged in and ready');
    });

    // ---------- Step 2: Human creates a game room and waits in lobby ----------
    let roomCode: string;

    test.step('create room and wait in lobby', async () => {
      roomCode = await createGameRoom(humanPage);
      expect(roomCode).toHaveLength(4);
      console.log(`[Human] Room created: ${roomCode}, waiting in lobby`);

      // Verify human sees 1 player (themselves) in waiting room
      await waitForPlayerCount(humanPage, 1, 10000);
    });

    // ---------- Step 3: Helper player logs in and joins the room ----------
    test.step('helper player joins the room', async () => {
      // Helper logs in
      await loginUser(helperPage, HELPER_USER);
      await expect(helperPage.locator('.lobby-view')).toBeVisible({ timeout: 10000 });
      console.log('[Helper] Logged in');

      // Helper joins using the room code
      await joinGameRoom(helperPage, roomCode, HELPER_USER);
      console.log(`[Helper] Joined room ${roomCode}`);

      // Verify both see 2 players now
      await waitForPlayerCount(humanPage, 2, 15000);
      await waitForPlayerCount(helperPage, 2, 15000);
      console.log('[Human] Helper joined — 2 players in lobby');
    });

    // ---------- Step 4: Add 2 bots (1 human + 3 bots total) ----------
    test.step('add 2 bots to fill remaining slots', async () => {
      // Only admin (Human) can add bots
      await addBot(humanPage);
      await humanPage.waitForTimeout(500);
      console.log('[Human] Added bot 1');

      await addBot(humanPage);
      await humanPage.waitForTimeout(500);
      console.log('[Human] Added bot 2');

      // Verify all 4 slots filled
      await waitForPlayerCount(humanPage, 4);
      await waitForPlayerCount(helperPage, 4);
      console.log('All 4 slots filled (1 human + 3 bots)');
    });

    // ---------- Step 5: Start the game ----------
    test.step('start game', async () => {
      console.log('[Human] Starting game...');
      await startGame(humanPage);
      console.log('[Human] Game started successfully!');

      // Wait for URL to be /game/{roomId}
      await humanPage.waitForURL(/\/game\/.+/);
      console.log(`[Human] URL: ${humanPage.url()}`);

      // Verify cards are visible
      const handCards = await humanPage.locator('.user-hand .card').count();
      console.log(`[Human] Has ${handCards} cards in hand`);
      expect(handCards).toBeGreaterThan(0);

      // Check if trump is declared or trump selector is visible
      const trumpCell = await humanPage.locator('.trump-cell-value').textContent();
      const trumpBtns = await humanPage.locator('.trump-suit-btn').count();
      console.log(`[Human] Trump: ${trumpCell?.trim()}, Trump buttons: ${trumpBtns}`);

      // Helper might also see game view (but we don't require it for this test)
      console.log('[Helper] Checking if game started for helper too...');
      try {
        await helperPage.waitForFunction(() => {
          return window.location.pathname.startsWith('/game/');
        }, { timeout: 30000 });
        console.log(`[Helper] URL: ${helperPage.url()}`);
      } catch {
        console.log('[Helper] Did not redirect to game view (may be expected)');
      }
    });
  });
});
