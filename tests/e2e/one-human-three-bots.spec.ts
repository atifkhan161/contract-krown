// Contract Crown E2E Test — Script A (Revised)
// 2 Human Players + 2 Server Bots — Full Game to 52 Points
//
// This test automates a complete online multiplayer game where:
// - Two isolated browser contexts (like 2 incognito windows)
// - Player 1 (human) logs in, creates a room, waits in lobby
// - Player 2 (human) logs in, joins via room code to fill a slot
// - 2 bots are added to fill remaining slots (2 humans + 2 bots total)
// - Both human players use SmartBot logic to auto-play cards
// - The server runs the bot AI for the other 2 players
// - The game plays until a team reaches 52 points
// - Human-like delays between actions for visible, natural flow

import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import {
  loginUser,
  createGameRoom,
  joinGameRoom,
  startGame,
  addBot,
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

const PLAYER1_USER = 'e2e-human-1';
const PLAYER2_USER = 'e2e-human-2';
const MAX_ROUNDS = 20; // Safety limit

// NOTE: Both players actively play cards using SmartBot logic.
// Bots fill the remaining 2 slots (server-side AI).

test.describe('Script A: 2 Humans + 2 Bots — Full Game', () => {
  let context1: BrowserContext;
  let context2: BrowserContext;
  let player1Page: Page; // Player 1 (admin, creates room, plays game)
  let player2Page: Page; // Player 2 (joins room, plays game)

  test.beforeAll(async ({ browser }) => {
    console.log('[beforeAll] Starting...');
    await waitForServer();
    resetBotMemories();
    console.log('[beforeAll] Server ready, creating contexts...');

    // Create 2 isolated browser contexts with different themes
    // Player 1 gets a blue theme, Player 2 gets a green/teal theme
    context1 = await browser.newContext({
      viewport: { width: 430, height: 932 },
      colorScheme: 'dark'
    });
    context2 = await browser.newContext({
      viewport: { width: 430, height: 932 },
      colorScheme: 'light'
    });
    player1Page = await context1.newPage();
    player2Page = await context2.newPage();

    // Inject different CSS themes per browser context
    await player1Page.addInitScript(() => {
      // Set CSS custom properties on documentElement (always available)
      document.documentElement.style.setProperty('--theme-accent', '#3b82f6');
      document.documentElement.style.setProperty('--theme-label', 'P1 (Blue/Dark)');
      // Add class to html element (always available)
      document.documentElement.classList.add('theme-player-1');
    });
    await player2Page.addInitScript(() => {
      document.documentElement.style.setProperty('--theme-accent', '#10b981');
      document.documentElement.style.setProperty('--theme-label', 'P2 (Green/Light)');
      document.documentElement.classList.add('theme-player-2');
    });

    console.log('[beforeAll] Contexts and pages created with distinct themes');

    // Suppress non-critical errors
    player1Page.on('pageerror', (err) => {
      if (!err.message.includes('disconnect')) {
        console.log(`[P1] Page error:`, err.message);
      }
    });
    player2Page.on('pageerror', (err) => {
      if (!err.message.includes('disconnect')) {
        console.log(`[P2] Page error:`, err.message);
      }
    });
    console.log('[beforeAll] Done');
  });

  test.afterAll(async () => {
    await context1.close();
    await context2.close();
  });

  test('should complete a full game to 52 points with 2 humans and 2 bots', async () => {
    console.log('[TEST] Test body started');

    // ---------- Step 1: Player 1 logs in ----------
    console.log('[TEST] About to run step: login player 1');
    await test.step('login player 1', async () => {
      console.log('[TEST] Inside login player 1 step');
      await loginUser(player1Page, PLAYER1_USER);
      await expect(player1Page.locator('.lobby-view')).toBeVisible({ timeout: 10000 });
      console.log('[P1] Logged in and ready');
      // Delay for visibility
      await player1Page.waitForTimeout(2000);
    });
    console.log('[TEST] Finished step: login player 1');

    // ---------- Step 2: Player 1 creates a game room and waits in lobby ----------
    let roomCode: string;

    await test.step('create room and wait in lobby', async () => {
      roomCode = await createGameRoom(player1Page);
      expect(roomCode).toHaveLength(4);
      console.log(`[P1] Room created: ${roomCode}, waiting in lobby`);

      // Verify player 1 sees 1 player (themselves) in waiting room
      await waitForPlayerCount(player1Page, 1, 10000);
      // Delay so viewer can see the empty waiting room
      await player1Page.waitForTimeout(3000);
    });

    // ---------- Step 3: Player 2 logs in and joins the room ----------
    await test.step('player 2 joins the room', async () => {
      // Player 2 logs in
      await loginUser(player2Page, PLAYER2_USER);
      await expect(player2Page.locator('.lobby-view')).toBeVisible({ timeout: 10000 });
      console.log('[P2] Logged in');
      // Delay so viewer can see P2 in lobby
      await player2Page.waitForTimeout(2000);

      // Player 2 joins using the room code
      await joinGameRoom(player2Page, roomCode, PLAYER2_USER);
      console.log(`[P2] Joined room ${roomCode}`);
      // Delay so viewer can see P2 entering the waiting room
      await player2Page.waitForTimeout(3000);

      // Wait for Player 1 to see Player 2 join (2 humans in lobby)
      await waitForPlayerCount(player1Page, 2, 15000);
      await waitForPlayerCount(player2Page, 2, 15000);
      console.log('[P1] Player 2 joined — 2 players in lobby');

      // Verify both humans are visible by checking player names in the waiting room
      const p1PlayerNames = await player1Page.locator('.player-name').allTextContents();
      const p2PlayerNames = await player2Page.locator('.player-name').allTextContents();
      console.log(`[P1] Sees players: ${p1PlayerNames.join(', ')}`);
      console.log(`[P2] Sees players: ${p2PlayerNames.join(', ')}`);

      // Confirm both players see each other
      expect(p1PlayerNames.length).toBeGreaterThanOrEqual(2);
      expect(p2PlayerNames.length).toBeGreaterThanOrEqual(2);

      // Add delay so the viewer can see the lobby with 2 humans
      await player1Page.waitForTimeout(3000);
      await player2Page.waitForTimeout(3000);
    });

    // ---------- Step 4: Add 2 bots (single click adds 2 bots) ----------
    await test.step('add 2 bots to fill remaining slots', async () => {
      // Wait for the Add Bot button to be visible (not disabled)
      const addBotBtn = player1Page.locator('#wr-add-bot-btn');

      // Wait longer for the button to render and become enabled
      await addBotBtn.waitFor({ state: 'visible', timeout: 10000 });
      const isDisabled = await addBotBtn.isDisabled();
      console.log(`[P1] Add Bot button visible, disabled: ${isDisabled}`);

      if (isDisabled) {
        console.log('[P1] Add Bot button is disabled — room may be full');
        const playerCount = await player1Page.locator('#wr-player-count').textContent();
        console.log(`[P1] Player count: ${playerCount}`);
      } else {
        // Only admin (Player 1) can add bots
        // Single click adds 2 bots
        await addBotBtn.click();
        console.log('[P1] Clicked Add Bot — adding 2 bots');

        // Wait for player count to update to 4
        await player1Page.waitForTimeout(2000);
        const newCount = await player1Page.locator('#wr-player-count').textContent();
        console.log(`[P1] After add bot: ${newCount}`);
      }

      // Wait for both players to see 4 players
      await waitForPlayerCount(player1Page, 4, 15000);
      await waitForPlayerCount(player2Page, 4, 15000);

      // Verify all 4 player names visible
      const p1Names = await player1Page.locator('.player-name').allTextContents();
      const p2Names = await player2Page.locator('.player-name').allTextContents();
      console.log(`[P1] All players: ${p1Names.join(', ')}`);
      console.log(`[P2] All players: ${p2Names.join(', ')}`);

      // Add delay so the viewer can see the full lobby with 4 players
      await player1Page.waitForTimeout(3000);
      await player2Page.waitForTimeout(3000);
    });

    // ---------- Step 5: Start the game ----------
    await test.step('start game', async () => {
      // Get pre-start state for debugging
      const preStartUrl = player1Page.url();
      console.log(`[P1] Pre-start URL: ${preStartUrl}`);

      // Click Start Game button manually with detailed logging
      const startBtn = player1Page.locator('#wr-start-btn');
      const startVisible = await startBtn.isVisible({ timeout: 10000 }).catch(() => false);
      console.log(`[P1] Start button visible: ${startVisible}`);

      if (!startVisible) {
        throw new Error('Start game button not visible');
      }

      await startBtn.click();
      console.log('[P1] Clicked Start Game button');

      // Give server time to process and broadcast game_started
      await player1Page.waitForTimeout(3000);

      // Check what happened after click
      const postStartUrl = player1Page.url();
      console.log(`[P1] Post-start URL: ${postStartUrl}`);

      // Check if URL changed to /game/
      if (postStartUrl.includes('/game/')) {
        console.log('[P1] URL changed to /game/');
      } else {
        console.log('[P1] URL still shows waiting room');
        // Check if we're still in waiting room
        const stillInWaitingRoom = await player1Page.locator('#wr-room-code').isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[P1] Still in waiting room: ${stillInWaitingRoom}`);
      }

      // Wait for game view with extended polling
      let gameViewReady = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        const result = await player1Page.evaluate(() => {
          const trumpBtns = document.querySelectorAll('.trump-suit-btn');
          if (trumpBtns.length > 0) return { signal: 'trump_selector', count: trumpBtns.length };

          const handCards = document.querySelectorAll('.user-hand .card');
          if (handCards.length > 0) return { signal: 'cards_dealt', count: handCards.length };

          const trumpCell = document.querySelector('.trump-cell-value');
          if (trumpCell && trumpCell.textContent?.trim() !== '--') return { signal: 'trump_declared', value: trumpCell.textContent };

          const url = window.location.pathname;
          if (url.startsWith('/game/')) return { signal: 'redirected', url };

          const title = document.querySelector('.game-header-title');
          if (title) return { signal: 'title_found', text: title.textContent };

          // Check what's in the DOM
          const views = document.querySelectorAll('.waiting-room-view, .game-view, .online-game-container');
          const viewClasses = Array.from(document.querySelectorAll('.app-content > *')).map(el => el.className);
          return { signal: 'none', url: window.location.pathname, views: viewClasses };
        });

        console.log(`[P1] Game state check ${attempt + 1}:`, JSON.stringify(result));
        if (result.signal !== 'none') {
          gameViewReady = true;
          break;
        }
        await player1Page.waitForTimeout(2000);
      }

      if (!gameViewReady) {
        console.log('[P1] Game view never rendered!');
        console.log('[P1] Current URL:', player1Page.url());
        // Dump full DOM body classes for debugging
        const bodyClasses = await player1Page.evaluate(() => document.body.className);
        console.log('[P1] Body classes:', bodyClasses);
        throw new Error('Game view did not render after Start Game click');
      }

      console.log('[P1] Game view rendered successfully');

      // Verify player 1 can see their cards
      const p1HandCards = await player1Page.locator('.user-hand .card').count();
      console.log(`[P1] Has ${p1HandCards} cards in hand`);
      if (p1HandCards === 0) {
        console.log('[P1] WARNING: No cards visible after game start!');
      }

      // Player 2 should also see the game view
      try {
        await player2Page.waitForFunction(() => {
          const handCards = document.querySelectorAll('.user-hand .card');
          if (handCards.length > 0) return true;
          const trumpBtns = document.querySelectorAll('.trump-suit-btn');
          if (trumpBtns.length > 0) return true;
          const trumpCell = document.querySelector('.trump-cell-value');
          if (trumpCell && trumpCell.textContent?.trim() !== '--') return true;
          return window.location.pathname.startsWith('/game/');
        }, { timeout: 90000 });
        console.log('[P2] Game view rendered');
      } catch (error) {
        console.log('[P2] Game view did not render — checking URL');
        console.log('[P2] URL:', player2Page.url());
      }
    });

    // ---------- Step 6: Play complete rounds until a team reaches 52 ----------
    let roundNumber = 0;

    while (roundNumber < MAX_ROUNDS) {
      roundNumber++;
      console.log(`\n=== Round ${roundNumber} ===`);

      // ----- Trump Declaration Phase -----
      // Poll until trump selector appears for one of the human players,
      // or trump is already declared (bot declared, or carry-over from previous round)
      console.log(`  Waiting for trump declaration...`);
      let trumpDeclared = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        // Check if trump is already declared (skip selector)
        const trumpAlreadyDeclared = await player1Page.evaluate(() => {
          const trumpCell = document.querySelector('.trump-cell-value');
          return trumpCell && trumpCell.textContent?.trim() !== '--';
        });
        if (trumpAlreadyDeclared) {
          const currentTrump = await readTrumpSuit(player1Page);
          console.log(`  Trump already declared: ${currentTrump}`);
          trumpDeclared = true;
          break;
        }

        // Check if either human player has the trump selector
        for (const [label, page] of [['P1', player1Page], ['P2', player2Page]] as const) {
          const trumpVisible = await page.locator('.trump-suit-btn').first()
            .isVisible({ timeout: 1000 }).catch(() => false);

          if (trumpVisible) {
            const hand = await readUserHand(page);
            const trumpSuit = pickBestTrumpSuit(hand);
            console.log(`  [${label}] Declaring trump: ${trumpSuit}`);
            await clickTrumpSuit(page, trumpSuit);
            trumpDeclared = true;
            break;
          }
        }
        if (trumpDeclared) break;

        // Check if round-end modal is still showing (wait for it to dismiss)
        const roundEndVisible = await player1Page.locator('.round-end-modal, .round-end-content')
          .first().isVisible({ timeout: 500 }).catch(() => false);
        if (roundEndVisible) {
          console.log(`  Round-end modal still visible, waiting...`);
          await player1Page.waitForTimeout(1000);
          continue;
        }

        await player1Page.waitForTimeout(500);
      }

      if (!trumpDeclared) {
        console.log(`  WARNING: Trump was not declared after 30s — proceeding anyway`);
      }

      // Wait for trump declaration to fully process
      await player1Page.waitForTimeout(2000);
      const trumpSuit = await readTrumpSuit(player1Page);
      console.log(`  Trump suit confirmed: ${trumpSuit || 'none'}`);

      // ----- Trick Play Phase (8 tricks) -----
      for (let trick = 1; trick <= 8; trick++) {
        const currentTricks = await getTrickCount(player1Page);
        console.log(`  Trick ${trick}/8 (completed so far: ${currentTricks})`);

        // Wait for all 4 cards to be played in this trick
        // Both humans play when it's their turn; bots play server-side
        let trickCardsPlayed = 0;
        while (trickCardsPlayed < 4) {
          // Check Player 1's turn
          let p1Turn = await isUserTurn(player1Page);
          if (p1Turn) {
            const playableCards = await readPlayableCards(player1Page);
            if (playableCards.length > 0) {
              const trumpSuit = await readTrumpSuit(player1Page);
              console.log(`    [P1] Turn — playable: ${playableCards.length}, trump: ${trumpSuit || 'none'}`);

              const card = await pickBestCard(player1Page);
              if (card) {
                await clickCard(player1Page, card);
                console.log(`    [P1] Played: ${card.rank} of ${card.suit}`);
                trickCardsPlayed++;
                await player1Page.waitForTimeout(1500); // Human-like delay
                continue;
              }
            }
          }

          // Check Player 2's turn
          let p2Turn = await isUserTurn(player2Page);
          if (p2Turn) {
            const playableCards = await readPlayableCards(player2Page);
            if (playableCards.length > 0) {
              const trumpSuit = await readTrumpSuit(player2Page);
              console.log(`    [P2] Turn — playable: ${playableCards.length}, trump: ${trumpSuit || 'none'}`);

              const card = await pickBestCard(player2Page);
              if (card) {
                await clickCard(player2Page, card);
                console.log(`    [P2] Played: ${card.rank} of ${card.suit}`);
                trickCardsPlayed++;
                await player2Page.waitForTimeout(1500); // Human-like delay
                continue;
              }
            }
          }

          // Neither human's turn — bots are playing (server-side)
          // Wait briefly and check trick card count
          await player1Page.waitForTimeout(500);
          const trickCards = await player1Page.locator('.trick-area .trick-card-slot').count();
          if (trickCards > trickCardsPlayed) {
            console.log(`    Trick cards visible: ${trickCards} (human played: ${trickCardsPlayed})`);
            trickCardsPlayed = trickCards;
          }
          if (trickCardsPlayed >= 4) break;
        }

        console.log(`    Trick ${trick} complete — ${trickCardsPlayed} cards played`);

        // Wait for trick resolution (trick count increases)
        await player1Page.waitForFunction(
          ({ initialTricks }) => {
            const el = document.querySelector('.trick-count-value');
            if (!el) return false;
            const match = el.textContent?.match(/^(\d+)/);
            return match ? parseInt(match[1], 10) > initialTricks : false;
          },
          { initialTricks: currentTricks },
          { timeout: 30000 }
        ).catch(() => {
          console.log(`    Trick ${trick} resolution timed out`);
        });
      }

      // ----- Round End: Wait for round-end modal and dismiss -----
      console.log(`  Waiting for round-end modal...`);
      try {
        await player1Page.locator('.round-end-modal, .round-end-content').first()
          .waitFor({ state: 'visible', timeout: 15000 });
        console.log(`  Round-end modal appeared`);

        // Delay so viewer can see the round-end modal
        await player1Page.waitForTimeout(2000);

        // Dismiss the round-end modal
        const continueBtn = player1Page.locator('.round-end-continue-btn');
        if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await continueBtn.click();
          console.log(`  Dismissed round-end modal`);
          await player1Page.waitForTimeout(2000);
        }
      } catch {
        console.log(`  Round-end modal did not appear (may have transitioned already)`);
      }

      // Check if page is still available before round-end checks
      try {
        await player1Page.locator('.trick-count-value').waitFor({ state: 'attached', timeout: 5000 });
      } catch {
        console.log('  [P1] Page no longer available - game may have ended');
        break;
      }

      // ----- Round End -----
      const scores = await getScores(player1Page);
      console.log(`  Round ${roundNumber} complete — Scores: Team 0: ${scores[0]}, Team 1: ${scores[1]}`);

      // Check if game is over
      if (scores[0] >= 52 || scores[1] >= 52) {
        console.log(`  Game over! Team ${scores[0] >= 52 ? 0 : 1} wins with ${Math.max(scores[0], scores[1])} points`);
        break;
      }

      // Wait for transition to next round
      await player1Page.waitForTimeout(2000);

      // Check if victory modal appeared
      const victoryVisible = await player1Page.locator('.victory-modal, [class*="victory"]')
        .first().isVisible({ timeout: 2000 }).catch(() => false);
      if (victoryVisible) {
        console.log('  Victory modal appeared!');
        break;
      }
    }

    // ---------- Step 7: Verify game completion ----------
    await test.step('verify game reached 52 points on both browsers', async () => {
      const p1Scores = await getScores(player1Page);
      const p2Scores = await getScores(player2Page);

      console.log(`[P1] Final scores — Team 0: ${p1Scores[0]}, Team 1: ${p1Scores[1]}`);
      console.log(`[P2] Final scores — Team 0: ${p2Scores[0]}, Team 1: ${p2Scores[1]}`);

      const p1MaxScore = Math.max(p1Scores[0], p1Scores[1]);
      const p2MaxScore = Math.max(p2Scores[0], p2Scores[1]);

      expect(p1MaxScore).toBeGreaterThanOrEqual(52);
      expect(p2MaxScore).toBeGreaterThanOrEqual(52);
      expect(roundNumber).toBeLessThanOrEqual(MAX_ROUNDS);
      expect(roundNumber).toBeGreaterThan(0);

      // Both clients should agree on scores
      expect(p1Scores[0]).toBe(p2Scores[0]);
      expect(p1Scores[1]).toBe(p2Scores[1]);

      console.log(`  Game completed in ${roundNumber} rounds!`);
    });

    // ---------- Step 8: Victory modal on both browsers ----------
    await test.step('victory modal appears on both browsers', async () => {
      for (const [label, page] of [['P1', player1Page], ['P2', player2Page]] as const) {
        const victoryVisible = await page.locator('.victory-modal, [class*="victory"]')
          .first().isVisible({ timeout: 10000 }).catch(() => false);
        console.log(`[${label}] Victory modal visible: ${victoryVisible}`);
        expect(victoryVisible).toBe(true);
      }
    });
  });
});
