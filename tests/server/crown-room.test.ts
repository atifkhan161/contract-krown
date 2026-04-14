// Unit Tests for CrownRoom (PartyKit version)
// Tests room lifecycle, player management, state sync, and reconnection

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CrownRoom from '@src/server/crown-room.js';
import * as Party from 'partykit/server';

// Mock Party.Room for testing
function createMockRoom(roomId: string = 'test-room'): Party.Room {
  const connections = new Map<string, any>();
  const listeners = new Map<string, Function>();

  return {
    id: roomId,
    context: {},
    getConnection: (id: string) => connections.get(id) || null,
    getConnections: () => Array.from(connections.values()),
    broadcast: (data: string, exclude?: string[]) => {
      const excludeSet = new Set(exclude || []);
      for (const [id, conn] of connections) {
        if (!excludeSet.has(id) && conn.onmessage) {
          conn.onmessage({ data });
        }
      }
    },
    close: () => {
      for (const conn of connections.values()) {
        if (conn.onclose) conn.onclose();
      }
      connections.clear();
    }
  } as unknown as Party.Room;
}

function makeMockConnection(sessionId: string, username: string = 'TestPlayer') {
  let onCloseHandler: (() => void) | null = null;
  let onMessageHandler: ((event: { data: string }) => void) | null = null;

  return {
    id: sessionId,
    username,
    onclose: (fn: () => void) => { onCloseHandler = fn; },
    onmessage: (fn: (event: { data: string }) => void) => { onMessageHandler = fn; },
    send: (data: string) => { /* mock send */ },
    close: (code?: number, reason?: string) => {
      if (onCloseHandler) onCloseHandler();
    },
    triggerMessage: (data: string) => {
      if (onMessageHandler) onMessageHandler({ data });
    },
    triggerClose: () => {
      if (onCloseHandler) onCloseHandler();
    }
  };
}

async function joinFourPlayers(room: CrownRoom, mockRoom: Party.Room) {
  const connections = [
    makeMockConnection('c1', 'Player1'),
    makeMockConnection('c2', 'Player2'),
    makeMockConnection('c3', 'Player3'),
    makeMockConnection('c4', 'Player4')
  ];

  for (const conn of connections) {
    const mockCtx = {
      request: new Request(`http://localhost/?username=${conn.username}`)
    } as Party.ConnectionContext;
    await room.onConnect(conn as any, mockCtx);
  }

  return connections;
}

describe('CrownRoom (PartyKit)', () => {
  let room: CrownRoom;
  let mockRoom: Party.Room;

  beforeEach(() => {
    mockRoom = createMockRoom('test-room');
    room = new CrownRoom(mockRoom);
  });

  afterEach(async () => {
    // Cleanup
    try {
      (room as any).disconnect();
    } catch {
      // ignore
    }
  });

  describe('Room Creation', () => {
    it('initializes on first connect', async () => {
      const conn = makeMockConnection('c1', 'Admin');
      const mockCtx = {
        request: new Request('http://localhost/?username=Admin')
      } as Party.ConnectionContext;
      await room.onConnect(conn as any, mockCtx);

      // Room should be initialized
      expect(room).toBeDefined();
      expect((room as any).initialized).toBe(true);
    });
  });

  describe('Player Join', () => {
    it('assigns player index 0 to first joiner', async () => {
      const conn = makeMockConnection('c1', 'Admin');
      const mockCtx = {
        request: new Request('http://localhost/?username=Admin')
      } as Party.ConnectionContext;
      await room.onConnect(conn as any, mockCtx);

      // First player should be admin at index 0
      const playerState = (room as any).players[0];
      expect(playerState).toBeDefined();
      expect(playerState.sessionId).toBe('c1');
      expect(playerState.id).toBe(0);
      expect(playerState.team).toBe(0);
      expect(playerState.isBot).toBe(false);
    });

    it('assigns sequential player indices', async () => {
      await joinFourPlayers(room, mockRoom);

      expect((room as any).players[0].sessionId).toBe('c1');
      expect((room as any).players[1].sessionId).toBe('c2');
      expect((room as any).players[2].sessionId).toBe('c3');
      expect((room as any).players[3].sessionId).toBe('c4');
    });

    it('assigns correct teams (0&2=team0, 1&3=team1)', async () => {
      await joinFourPlayers(room, mockRoom);

      expect((room as any).players[0].team).toBe(0);
      expect((room as any).players[1].team).toBe(1);
      expect((room as any).players[2].team).toBe(0);
      expect((room as any).players[3].team).toBe(1);
    });
  });

  describe('State Schema', () => {
    it('has correct initial state after first player joins', async () => {
      const conn = makeMockConnection('c1', 'Admin');
      const mockCtx = {
        request: new Request('http://localhost/?username=Admin')
      } as Party.ConnectionContext;
      await room.onConnect(conn as any, mockCtx);

      expect((room as any).gameState.phase).toBe('WAITING_FOR_PLAYERS');
      expect((room as any).gameState.dealer).toBe(0);
    });
  });

  describe('Disconnect', () => {
    it('cleans up on disconnect', async () => {
      const conn = makeMockConnection('c1', 'Admin');
      const mockCtx = {
        request: new Request('http://localhost/?username=Admin')
      } as Party.ConnectionContext;
      await room.onConnect(conn as any, mockCtx);

      expect(() => {
        (room as any).disconnect();
      }).not.toThrow();
    });
  });
});
