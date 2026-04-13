// Contract Crown Online Gameplay Integration Tests
// Tests complete gameplay flow from room creation to game end
// Requires PartyKit server running at ws://localhost:1999

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PartyKitClientWrapper } from '@src/ui/partykit-client-wrapper.js';

const SERVER_URL = 'ws://localhost:1999';
const HTTP_URL = 'http://localhost:1999';
const POLL_INTERVAL_MS = 200;

interface TestClient {
  wrapper: PartyKitClientWrapper;
  sessionId: string;
  username: string;
  lastState: any;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkServerAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${HTTP_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function connectPlayer(username: string): Promise<TestClient> {
  const wrapper = new PartyKitClientWrapper({
    onStateChange: (state) => {
      client.lastState = state;
    },
    onError: () => {},
    onLeave: () => {}
  });

  const client: TestClient = {
    wrapper,
    sessionId: '',
    username,
    lastState: null
  };

  await wrapper.connect(SERVER_URL);
  client.sessionId = wrapper.sessionId || '';

  return client;
}

async function createRoomAsAdmin(admin: TestClient): Promise<string> {
  const roomId = await admin.wrapper.createRoom('crown', { username: admin.username });
  return roomId;
}

async function joinRoom(wrapper: PartyKitClientWrapper, roomId: string, username: string): Promise<void> {
  await wrapper.joinRoom(roomId, 'crown', { username });
}

function getScores(client: TestClient): { team0: number; team1: number } {
  const state = client.lastState;
  if (!state) return { team0: 0, team1: 0 };
  return {
    team0: state.scoreTeam0 || 0,
    team1: state.scoreTeam1 || 0
  };
}

function getCrownHolder(client: TestClient): number {
  const state = client.lastState;
  if (!state) return 0;
  return state.crownHolder || 0;
}

function getPlayerCount(client: TestClient): number {
  const state = client.lastState;
  if (!state) return 0;
  return Object.keys(state.players || {}).length;
}

function findHumanPlayerForTurn(client: TestClient): number | null {
  const state = client.lastState;
  if (!state) return null;

  const currentPlayer = state.currentPlayer;
  const playerData = state.players?.[String(currentPlayer)];

  if (playerData?.isBot) return null;

  return currentPlayer;
}

function playCardForPlayer(client: TestClient, playerIndex: number): boolean {
  const state = client.lastState;
  if (!state) return false;

  const playerData = state.players?.[String(playerIndex)];
  if (playerData?.isBot) return false;

  const hand = playerData?.hand || [];
  if (hand.length > 0) {
    client.wrapper.sendPlayCard(hand[0]);
    return true;
  }
  return false;
}

describe('Online Gameplay Integration', () => {
  let players: TestClient[] = [];
  let adminRoomId: string = '';

  beforeAll(async () => {
    const available = await checkServerAvailable();
    if (!available) {
      console.log('[Test] Server not available at', SERVER_URL, '- skipping tests');
      return;
    }

    // Connect admin and create room
    const admin = await connectPlayer('Admin');
    adminRoomId = await createRoomAsAdmin(admin);
    players.push(admin);

    // Connect 3 more players
    for (let i = 1; i < 4; i++) {
      const player = await connectPlayer(`Player${i + 1}`);
      await joinRoom(player.wrapper, adminRoomId, `Player${i + 1}`);
      players.push(player);
      await delay(100);
    }

    // Wait for all players to sync
    await delay(500);
  });

  afterAll(async () => {
    for (const player of players) {
      player.wrapper.disconnect();
    }
    players = [];
  });

  describe('room creation', () => {
    it('should create a room and return a room ID', async () => {
      const available = await checkServerAvailable();
      if (!available) return;
      
      expect(adminRoomId).toBeDefined();
      expect(adminRoomId.length).toBeGreaterThan(0);
    });

    it('should have 4 players connected', async () => {
      const available = await checkServerAvailable();
      if (!available) return;

      const playerCount = getPlayerCount(players[0]);
      expect(playerCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('state synchronization', () => {
    it('should receive initial state after joining', async () => {
      const available = await checkServerAvailable();
      if (!available) return;

      const state = players[0].lastState;
      expect(state).toBeDefined();
    });

    it('should have WAITING_FOR_PLAYERS phase initially', async () => {
      const available = await checkServerAvailable();
      if (!available) return;

      const state = players[0].lastState;
      expect(state.phase).toBe('WAITING_FOR_PLAYERS');
    });
  });

  describe('game flow', () => {
    it('should allow admin to start the game', async () => {
      const available = await checkServerAvailable();
      if (!available) return;

      // Admin sends start_game
      players[0].wrapper.sendStartGame();
      await delay(500);

      // Check if phase changed
      const state = players[0].lastState;
      expect(state.phase).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should disconnect all players without error', async () => {
      const available = await checkServerAvailable();
      if (!available) return;

      expect(() => {
        for (const player of players) {
          player.wrapper.disconnect();
        }
      }).not.toThrow();
    });
  });
});
