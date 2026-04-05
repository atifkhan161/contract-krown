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

  test.beforeAll(async () => {
    await waitForServer();
    resetBotMemories();
  });

  test.afterEach(async ({ browser }) => {
    // Clean up all contexts
    for (const ctx of contexts) {
      await ctx.close();
    }
    contexts = [];
    pages = [];
  });

  test('should complete a full game to 52 points with 4 human players', async ({ browser }) => {
    // ---------- Step 1: Create 4 isolated browser contexts ----------
    test.step('create 4 isolated browser contexts', async () => {
      // Each context is like a separate incognito window — isolated localStorage, cookies, sessions
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
          // Ignore expected errors during test setup
          if (!err.message.includes('disconnect')) {
            console.log(`[P${i + 1}] Page error:`, err.message);
          }
        });
      }
    });

    // ---------- Step 2: Login all 4 users ----------
    test.step('login all 4 users', async () => {
      for (let i = 0; i < 4; i++) {
        await loginUser(pages[i], TEST_USERS[i]);
        await expect(pages[i].locator('.lobby-view')).toBeVisible({ timeout: 10000 });
        console.log(`[P${i + 1}] Logged in as ${TEST_USERS[i]}`);
      }
    });

    // ---------- Step 3: Player 1 creates a room ----------
    let roomCode: string;

    test.step('player 1 creates room', async () => {
      roomCode = await createGameRoom(pages[0]);
      expect(roomCode).toHaveLength(4);
      console.log(`Room created: ${roomCode}`);
    });

    // ---------- Step 4: Players 2-4 join the room ----------
    test.step('players 2-4 join room', async () => {
      for (let i = 1; i < 4; i++) {
        await joinGameRoom(pages[i], roomCode!, TEST_USERS[i]);
        console.log(`[P${i + 1}] Joined room ${roomCode}`);
      }

      // Verify all 4 players are in the waiting room
      for (let i = 0; i < 4; i++) {
        await waitForPlayerCount(pages[i], 4, 15000);
      }
    });

    // ---------- Step 5: Player 1 (admin) starts the game ----------
    test.step('player 1 starts game', async () => {
      await startGame(pages[0]);

      // All players should be redirected to the game view
      for (let i = 0; i < 4; i++) {
        await pages[i].waitForURL(/\/game\/.+/, { timeout: 15000 });
        await expect(pages[i].locator('.felt-grid')).toBeVisible({ timeout: 15000 });
      }
      console.log('All 4 players connected to game room');
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
          break;
        }
      }

      // Wait for trump declaration to process
      await Promise.all(pages.map(p => p.waitForTimeout(1500)));

      // ----- Trick Play Phase (8 tricks) -----
      for (let trick = 1; trick <= 8; trick++) {
        console.log(`  Trick ${trick}/8`);

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

          // Wait for the play to register on server
          await Promise.all(pages.map(p => p.waitForTimeout(500)));
        }

        // Wait for trick resolution (server resolves, bots may need time)
        await Promise.all(pages.map(p => p.waitForTimeout(2000)));
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
    test.step('verify game reached 52 points on all clients', async () => {
      // All 4 clients should have consistent scores
      const allScores = await Promise.all(pages.map(p => getScores(p)));

      for (let i = 0; i < 4; i++) {
        console.log(`[P${i + 1}] Final scores — Team 0: ${allScores[i][0]}, Team 1: ${allScores[i][1]}`);
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
    test.step('victory modal appears on all clients', async () => {
      for (let i = 0; i < 4; i++) {
        const victoryVisible = await pages[i].locator('.victory-modal, [class*="victory"]')
          .first().isVisible({ timeout: 10000 }).catch(() => false);

        const scores = await getScores(pages[i]);
        if (Math.max(scores[0], scores[1]) >= 52) {
          expect(victoryVisible).toBe(true);
        }
        console.log(`[P${i + 1}] Victory modal visible: ${victoryVisible}`);
      }
    });
  });
});
