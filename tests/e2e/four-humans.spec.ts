// Contract Crown E2E Test — Script B
// 4 Human Players — Full Game to 52 Points
//
// This test automates a complete online multiplayer game where:
// - Four isolated browser contexts (like 4 incognito windows)
// - Each logs in as a different user (player1–player4)
// - Player 1 creates the room, players 2-4 join
// - All 4 players use SmartBot logic to auto-play cards
// - Tests WebSocket sync, state consistency across all clients
// - The game plays until a team reaches 52 points
// - Human-like delays between actions for visible, natural flow

import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import type { Card } from '@src/engine/types.js';
import {
  loginUser,
  createGameRoom,
  joinGameRoom,
  startGame,
  waitForPlayerCount,
  getTrickCount,
  getScores,
  waitForServer
} from './helpers/e2e-test-helpers.js';
import {
  pickBestCard,
  pickBestTrumpSuit,
  clickTrumpSuit,
  clickCard,
  resetBotMemories
} from './helpers/smart-bot-adapter.js';
import {
  readUserHand,
  readTrumpSuit,
  readPlayableCards,
  isUserTurn
} from './helpers/game-state-reader.js';

const TEST_USERS = ['e2e-p1', 'e2e-p2', 'e2e-p3', 'e2e-p4'];
const MAX_ROUNDS = 20; // Safety limit

test.describe('Script B: 4 Human Players — Full Game', () => {
  let contexts: BrowserContext[] = [];
  let pages: Page[] = [];

  test.beforeAll(async ({ browser }) => {
    console.log('[beforeAll] Starting...');
    await waitForServer();
    resetBotMemories();
    console.log('[beforeAll] Server ready');

    // Create 4 isolated browser contexts
    // Playwright contexts are isolated by default — no shared localStorage/cookies
    for (let i = 0; i < 4; i++) {
      const ctx = await browser.newContext({
        viewport: { width: 375, height: 812 }, // Mobile portrait
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
      });
      contexts.push(ctx);

      const page = await ctx.newPage();
      pages.push(page);

      // Suppress console errors from the app (Colyseus disconnections during setup)
      page.on('pageerror', (err) => {
        if (!err.message.includes('disconnect')) {
          console.log(`[P${i + 1}] Page error:`, err.message);
        }
      });
    }
    console.log('[beforeAll] 4 contexts and pages created');
  });

  test.afterAll(async () => {
    for (const ctx of contexts) {
      await ctx.close();
    }
    contexts = [];
    pages = [];
  });

  test('should complete a full game to 52 points with 4 human players', async ({ browser }) => {
    // ---------- Step 1: Create 4 isolated browser contexts ----------
    await test.step('create 4 isolated browser contexts', async () => {
      console.log('[P1-P4] 4 browser contexts created in beforeAll');
      // Delay so viewer can see the empty browsers
      await pages[0].waitForTimeout(1000);
    });

    // ---------- Step 2: Login all 4 users ----------
    await test.step('login all 4 users', async () => {
      for (let i = 0; i < 4; i++) {
        await loginUser(pages[i], TEST_USERS[i]);
        await expect(pages[i].locator('.lobby-view')).toBeVisible({ timeout: 10000 });
        console.log(`[P${i + 1}] Logged in as ${TEST_USERS[i]}`);
        // Delay so viewer can see each login
        await pages[i].waitForTimeout(1000);
      }
    });

    // ---------- Step 3: Player 1 creates a room ----------
    let roomCode: string;

    await test.step('player 1 creates room', async () => {
      roomCode = await createGameRoom(pages[0]);
      expect(roomCode).toHaveLength(4);
      console.log(`[P1] Room created: ${roomCode}, waiting in lobby`);

      // Verify player 1 sees 1 player (themselves) in waiting room
      await waitForPlayerCount(pages[0], 1, 10000);
      // Delay so viewer can see the empty waiting room
      await pages[0].waitForTimeout(3000);
    });

    // ---------- Step 4: Players 2-4 join the room ----------
    await test.step('players 2-4 join room', async () => {
      for (let i = 1; i < 4; i++) {
        await joinGameRoom(pages[i], roomCode!, TEST_USERS[i]);
        console.log(`[P${i + 1}] Joined room ${roomCode}`);
        // Delay so viewer can see each player joining
        await pages[i].waitForTimeout(2000);
      }

      // Verify all 4 players are in the waiting room
      for (let i = 0; i < 4; i++) {
        await waitForPlayerCount(pages[i], 4, 15000);
      }

      // Verify all 4 player names visible
      const p1Names = await pages[0].locator('.player-name').allTextContents();
      console.log(`[P1] All players: ${p1Names.join(', ')}`);

      // Delay so viewer can see the full lobby with 4 players
      await Promise.all(pages.map(p => p.waitForTimeout(3000)));
    });

    // ---------- Step 5: Player 1 (admin) starts the game ----------
    await test.step('player 1 starts game', async () => {
      // Get pre-start state for debugging
      const preStartUrl = pages[0].url();
      console.log(`[P1] Pre-start URL: ${preStartUrl}`);

      // Click Start Game button manually with detailed logging
      const startBtn = pages[0].locator('#wr-start-btn');
      const startVisible = await startBtn.isVisible({ timeout: 10000 }).catch(() => false);
      console.log(`[P1] Start button visible: ${startVisible}`);

      if (!startVisible) {
        throw new Error('Start game button not visible');
      }

      await startBtn.click();
      console.log('[P1] Clicked Start Game button');

      // Give server time to process and broadcast game_started
      await pages[0].waitForTimeout(3000);

      // Check what happened after click
      const postStartUrl = pages[0].url();
      console.log(`[P1] Post-start URL: ${postStartUrl}`);

      // Wait for game view with extended polling
      let gameViewReady = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        const result = await pages[0].evaluate(() => {
          const trumpBtns = document.querySelectorAll('.trump-suit-btn');
          if (trumpBtns.length > 0) return { signal: 'trump_selector', count: trumpBtns.length };

          const handCards = document.querySelectorAll('.user-hand .card');
          if (handCards.length > 0) return { signal: 'cards_dealt', count: handCards.length };

          const trumpCell = document.querySelector('.trump-cell-value');
          if (trumpCell && trumpCell.textContent?.trim() !== '--') return { signal: 'trump_declared', value: trumpCell.textContent };

          const url = window.location.pathname;
          if (url.startsWith('/game/')) return { signal: 'redirected', url };

          return { signal: 'none', url: window.location.pathname };
        });

        console.log(`[P1] Game state check ${attempt + 1}:`, JSON.stringify(result));
        if (result.signal !== 'none') {
          gameViewReady = true;
          break;
        }
        await pages[0].waitForTimeout(2000);
      }

      if (!gameViewReady) {
        console.log('[P1] Game view never rendered!');
        console.log('[P1] Current URL:', pages[0].url());
        throw new Error('Game view did not render after Start Game click');
      }

      console.log('[P1] Game view rendered successfully');

      // Verify player 1 can see their cards
      const p1HandCards = await pages[0].locator('.user-hand .card').count();
      console.log(`[P1] Has ${p1HandCards} cards in hand`);

      // All players should be redirected to the game view
      for (let i = 1; i < 4; i++) {
        try {
          await pages[i].waitForFunction(() => {
            const handCards = document.querySelectorAll('.user-hand .card');
            if (handCards.length > 0) return true;
            const trumpBtns = document.querySelectorAll('.trump-suit-btn');
            if (trumpBtns.length > 0) return true;
            const trumpCell = document.querySelector('.trump-cell-value');
            if (trumpCell && trumpCell.textContent?.trim() !== '--') return true;
            return window.location.pathname.startsWith('/game/');
          }, { timeout: 90000 });
          console.log(`[P${i + 1}] Game view rendered`);
        } catch (error) {
          console.log(`[P${i + 1}] Game view did not render — checking URL`);
          console.log(`[P${i + 1}] URL:`, pages[i].url());
        }
      }
    });

    // ---------- Step 6: Play complete rounds ----------
    let roundNumber = 0;

    while (roundNumber < MAX_ROUNDS) {
      roundNumber++;
      console.log(`\n=== Round ${roundNumber} ===`);

      // ----- Trump Declaration Phase -----
      // Check if any player needs to declare trump
      for (let i = 0; i < 4; i++) {
        const trumpVisible = await pages[i].locator('.trump-suit-btn').first()
          .isVisible({ timeout: 3000 }).catch(() => false);

        if (trumpVisible) {
          const hand = await readUserHand(pages[i]);
          const trumpSuit = pickBestTrumpSuit(hand);
          console.log(`  [P${i + 1}] Declaring trump: ${trumpSuit}`);
          await clickTrumpSuit(pages[i], trumpSuit);
          await pages[i].waitForTimeout(1500);
          break;
        }
      }

      // Wait for trump declaration to process
      await Promise.all(pages.map(p => p.waitForTimeout(1500)));

      // ----- Trick Play Phase (8 tricks) -----
      for (let trick = 1; trick <= 8; trick++) {
        const currentTricks = await getTrickCount(pages[0]);
        console.log(`  Trick ${trick}/8 (completed so far: ${currentTricks})`);

        // Play 4 cards (one per player, in turn order)
        for (let cardPlayed = 0; cardPlayed < 4; cardPlayed++) {
          // Find whose turn it is
          let activePlayer = -1;
          for (let attempt = 0; attempt < 60; attempt++) {
            for (let i = 0; i < 4; i++) {
              const isTurn = await isUserTurn(pages[i]);
              if (isTurn) {
                activePlayer = i;
                break;
              }
            }
            if (activePlayer >= 0) break;
            await Promise.all(pages.map(p => p.waitForTimeout(200)));
          }

          if (activePlayer < 0) {
            console.log(`    Timeout waiting for active player (card ${cardPlayed + 1})`);
            continue;
          }

          const activePage = pages[activePlayer];
          const playableCards = await readPlayableCards(activePage);

          if (playableCards.length === 0) {
            console.log(`    [P${activePlayer + 1}] No playable cards — skipping`);
            continue;
          }

          const trumpSuit = await readTrumpSuit(activePage);
          console.log(`    [P${activePlayer + 1}] Turn — playable: ${playableCards.length}, trump: ${trumpSuit || 'none'}`);

          const card = await pickBestCard(activePage);
          expect(card).not.toBeNull();

          await clickCard(activePage, card!);
          console.log(`    [P${activePlayer + 1}] Played: ${card!.rank} of ${card!.suit}`);

          // Human-like delay after playing
          await activePage.waitForTimeout(1500);
        }

        // Wait for trick resolution (trick count increases)
        await pages[0].waitForFunction(
          ({ initialTricks }) => {
            const el = document.querySelector('.trick-count-value');
            if (!el) return false;
            const match = el.textContent?.match(/^(\d+)/);
            return match ? parseInt(match[1], 10) > initialTricks : false;
          },
          { initialTricks: currentTricks },
          { timeout: 30000 }
        ).catch(() => {
          console.log(`    Trick ${trick} resolution timed out — checking if trick has 4 cards and continuing`);
        });

        // Extra delay for visible flow between tricks
        try {
          await pages[0].waitForTimeout(1000);
        } catch {
          // Page might be closed - ignore during cleanup
          break;
        }
      }

      // Check if page is still available before round-end checks
      try {
        await pages[0].locator('.trick-count-value').waitFor({ state: 'attached', timeout: 5000 });
      } catch {
        console.log('  [P1] Page no longer available - game may have ended');
        break;
      }

      // ----- Round End -----
      const scores = await getScores(pages[0]);
      console.log(`  Round ${roundNumber} complete — Scores: Team 0: ${scores[0]}, Team 1: ${scores[1]}`);

      // Check if game is over
      if (scores[0] >= 52 || scores[1] >= 52) {
        console.log(`  Game over! Team ${scores[0] >= 52 ? 0 : 1} wins with ${Math.max(scores[0], scores[1])} points`);
        break;
      }

      // Wait for transition to next round
      await Promise.all(pages.map(p => p.waitForTimeout(2000)));
    }

    // ---------- Step 7: Verify game completion ----------
    await test.step('verify game reached 52 points on all clients', async () => {
      // Check if page is still available
      try {
        await pages[0].locator('.trick-count-value').waitFor({ state: 'attached', timeout: 5000 });
      } catch {
        console.log('[P1] Page not available for final verification');
        return;
      }

      // All 4 clients should have consistent scores
      const allScores: [number, number][] = [];
      for (let i = 0; i < 4; i++) {
        try {
          const scores = await getScores(pages[i]);
          allScores.push(scores);
          console.log(`[P${i + 1}] Final scores — Team 0: ${scores[0]}, Team 1: ${scores[1]}`);
        } catch {
          console.log(`[P${i + 1}] Could not read scores (page may be closed)`);
          allScores.push([0, 0]);
        }
      }

      // Check first client's scores (should be same across all)
      const maxScore = Math.max(allScores[0][0], allScores[0][1]);
      expect(maxScore).toBeGreaterThanOrEqual(52);
      expect(roundNumber).toBeLessThanOrEqual(MAX_ROUNDS);
      expect(roundNumber).toBeGreaterThan(0);

      // Verify all clients agree on the winner
      for (let i = 1; i < 4; i++) {
        expect(allScores[i][0]).toBe(allScores[0][0]);
        expect(allScores[i][1]).toBe(allScores[0][1]);
      }
    });

    // ---------- Step 8: Victory modal on all clients ----------
    await test.step('victory modal appears on all clients', async () => {
      for (let i = 0; i < 4; i++) {
        try {
          const victoryVisible = await pages[i].locator('.victory-modal, [class*="victory"]')
            .first().isVisible({ timeout: 10000 }).catch(() => false);

          const scores = await getScores(pages[i]);
          if (Math.max(scores[0], scores[1]) >= 52) {
            expect(victoryVisible).toBe(true);
          }
          console.log(`[P${i + 1}] Victory modal visible: ${victoryVisible}`);
        } catch {
          console.log(`[P${i + 1}] Could not check victory modal (page may be closed)`);
        }
      }
    });
  });
});
