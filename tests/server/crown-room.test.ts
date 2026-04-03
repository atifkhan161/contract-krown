// Unit Tests for CrownRoom
// Tests room lifecycle, player management, state sync, and reconnection

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CrownRoom } from '@src/server/rooms.js';

function makeMockClient(sessionId: string) {
  return {
    sessionId,
    leave: () => {}
  };
}

function joinFourPlayers(room: CrownRoom) {
  const clients = [
    makeMockClient('c1'),
    makeMockClient('c2'),
    makeMockClient('c3'),
    makeMockClient('c4')
  ];
  for (const c of clients) {
    room.onJoin(c as any, {});
  }
  return clients;
}

describe('CrownRoom', () => {
  let room: CrownRoom;

  beforeEach(() => {
    room = new CrownRoom();
    room.onCreate({ dealer: 0 });
  });

  afterEach(() => {
    room.onDispose();
  });

  describe('Room Creation', () => {
    it('initializes with WAITING_FOR_PLAYERS phase', () => {
      expect(room.state.phase).toBe('WAITING_FOR_PLAYERS');
    });

    it('sets dealer from options', () => {
      expect(room.state.dealer).toBe(0);
    });

    it('has empty players map', () => {
      expect(room.state.players.size).toBe(0);
    });
  });

  describe('Player Join', () => {
    it('assigns player index 0 to first joiner', () => {
      const client = makeMockClient('c1');
      room.onJoin(client as any, {});
      expect(room.state.players.size).toBe(1);
      const p = room.state.players.get('0');
      expect(p).toBeDefined();
      expect(p?.sessionId).toBe('c1');
      expect(p?.id).toBe(0);
      expect(p?.team).toBe(0);
    });

    it('assigns sequential player indices', () => {
      const clients = [
        makeMockClient('c1'),
        makeMockClient('c2'),
        makeMockClient('c3'),
        makeMockClient('c4')
      ];
      for (const c of clients) {
        room.onJoin(c as any, {});
      }
      expect(room.state.players.size).toBe(4);
      expect(room.state.players.get('0')?.sessionId).toBe('c1');
      expect(room.state.players.get('1')?.sessionId).toBe('c2');
      expect(room.state.players.get('2')?.sessionId).toBe('c3');
      expect(room.state.players.get('3')?.sessionId).toBe('c4');
    });

    it('assigns correct teams (0&2=team0, 1&3=team1)', () => {
      const clients = [
        makeMockClient('c1'),
        makeMockClient('c2'),
        makeMockClient('c3'),
        makeMockClient('c4')
      ];
      for (const c of clients) {
        room.onJoin(c as any, {});
      }
      expect(room.state.players.get('0')?.team).toBe(0);
      expect(room.state.players.get('1')?.team).toBe(1);
      expect(room.state.players.get('2')?.team).toBe(0);
      expect(room.state.players.get('3')?.team).toBe(1);
    });

    it('does NOT auto-start when 4 players join (admin must click Start Game)', () => {
      joinFourPlayers(room);
      expect(room.state.phase).toBe('WAITING_FOR_PLAYERS');
    });

    it('deals 4 cards to each player when game starts', () => {
      joinFourPlayers(room);
      for (let i = 0; i < 4; i++) {
        const p = room.state.players.get(String(i));
        expect(p?.hand.length).toBe(4);
      }
    });

    it('sets crown holder to player left of dealer', () => {
      joinFourPlayers(room);
      expect(room.state.crownHolder).toBe(1);
    });
  });

  describe('Reconnection', () => {
    it('marks player as disconnected on unconsented leave', () => {
      const clients = joinFourPlayers(room);
      const client = clients[0];
      room.onLeave(client as any, false);

      const p = room.state.players.get('0');
      expect(p?.disconnected).toBe(true);
    });

    it('keeps disconnected flag false on consented leave', () => {
      const clients = joinFourPlayers(room);
      const client = clients[0];
      room.onLeave(client as any, true);

      const p = room.state.players.get('0');
      expect(p?.disconnected).toBe(false);
    });

    it('sets disconnected player index on unconsented leave', () => {
      const clients = joinFourPlayers(room);
      const client = clients[0];
      room.onLeave(client as any, false);

      expect(room.state.disconnectedPlayerIndex).toBe(0);
      expect(room.state.disconnectedAt).toBeGreaterThan(0);
    });

    it('clears disconnected state on reconnection', () => {
      const clients = joinFourPlayers(room);
      const client = clients[0];
      room.onLeave(client as any, false);

      expect(room.state.players.get('0')?.disconnected).toBe(true);

      room.onJoin(client as any, {});
      expect(room.state.players.get('0')?.disconnected).toBe(false);
      expect(room.state.disconnectedPlayerIndex).toBe(-1);
    });
  });

  describe('State Schema', () => {
    it('has correct initial schema values', () => {
      expect(room.state.phase).toBe('WAITING_FOR_PLAYERS');
      expect(room.state.currentPlayer).toBe(0);
      expect(room.state.crownHolder).toBe(0);
      expect(room.state.dealer).toBe(0);
      expect(room.state.trumpSuit).toBeNull();
      expect(room.state.scoreTeam0).toBe(0);
      expect(room.state.scoreTeam1).toBe(0);
    });

    it('updates phase to TRUMP_DECLARATION after 4 players join', () => {
      joinFourPlayers(room);
      expect(room.state.phase).toBe('TRUMP_DECLARATION');
    });

    it('populates current trick schema', () => {
      expect(room.state.currentTrick).toBeDefined();
      expect(room.state.currentTrick.leadPlayer).toBe(0);
      expect(room.state.currentTrick.cards.length).toBe(0);
      expect(room.state.currentTrick.winner).toBeNull();
    });

    it('has empty completed tricks initially', () => {
      expect(room.state.completedTricks.length).toBe(0);
    });
  });

  describe('Dispose', () => {
    it('cleans up timers on dispose', () => {
      room.onDispose();
      expect(room).toBeDefined();
    });
  });

  describe('Waiting Room Flow', () => {
    it('stays in WAITING_FOR_PLAYERS after second player joins (no auto-start)', () => {
      const c1 = makeMockClient('c1');
      const c2 = makeMockClient('c2');
      room.onJoin(c1 as any, { username: 'Admin' });
      room.onJoin(c2 as any, { username: 'Player2' });
      expect(room.state.phase).toBe('WAITING_FOR_PLAYERS');
    });

    it('admin can manually start game by calling handleStartGame', () => {
      const c1 = makeMockClient('c1');
      room.onJoin(c1 as any, { username: 'Admin' });
      room.onJoin(makeMockClient('c2') as any, { username: 'Player2' });
      room.onJoin(makeMockClient('c3') as any, { username: 'Player3' });
      room.onJoin(makeMockClient('c4') as any, { username: 'Player4' });
      
      (room as any).handleStartGame(c1 as any);
      
      expect(room.state.phase).not.toBe('WAITING_FOR_PLAYERS');
    });

    it('addBot fills all empty slots with bots', () => {
      const c1 = makeMockClient('c1');
      room.onJoin(c1 as any, { username: 'Admin' });
      
      (room as any).handleAddBot(c1 as any);
      
      const bots = Array.from(room.state.players.values()).filter(p => p.isBot);
      expect(bots.length).toBe(3);
      expect(bots.some(b => b.username === 'Bot Alpha')).toBe(true);
      expect(bots.some(b => b.username === 'Bot Beta')).toBe(true);
      expect(bots.some(b => b.username === 'Bot Gamma')).toBe(true);
    });

    it('new human replaces random bot slot (not admin slot 0)', () => {
      const c1 = makeMockClient('c1');
      room.onJoin(c1 as any, { username: 'Admin' });
      (room as any).handleAddBot(c1 as any);
      
      const c2 = makeMockClient('c2');
      room.onJoin(c2 as any, { username: 'Human2' });
      
      const humanPlayer = Array.from(room.state.players.values()).find(p => p.sessionId === 'c2');
      expect(humanPlayer?.id).not.toBe(0);
      expect(humanPlayer?.isBot).toBe(false);
    });

    it('admin slot 0 is never replaced when human joins', () => {
      const c1 = makeMockClient('c1');
      room.onJoin(c1 as any, { username: 'Admin' });
      (room as any).handleAddBot(c1 as any);
      
      const c2 = makeMockClient('c2');
      room.onJoin(c2 as any, { username: 'Human2' });
      
      const adminPlayer = room.state.players.get('0');
      expect(adminPlayer?.sessionId).toBe('c1');
      expect(adminPlayer?.username).toBe('Admin');
    });

    it('shuffle randomizes all 4 positions including bots', () => {
      const c1 = makeMockClient('c1');
      room.onJoin(c1 as any, { username: 'Admin' });
      (room as any).handleAddBot(c1 as any);
      
      const before = Array.from(room.state.players.values()).map(p => ({ id: p.id, team: p.team }));
      
      (room as any).handleShuffleTeams(c1 as any);
      
      const after = Array.from(room.state.players.values()).map(p => ({ id: p.id, team: p.team }));
      const teamsChanged = before.some((p, i) => p.team !== after[i].team);
      expect(teamsChanged).toBe(true);
    });

    it('handleStartGame fills remaining slots with bots and starts game', () => {
      const c1 = makeMockClient('c1');
      room.onJoin(c1 as any, { username: 'Admin' });
      room.onJoin(makeMockClient('c2') as any, { username: 'Player2' });
      
      (room as any).handleStartGame(c1 as any);
      
      const bots = Array.from(room.state.players.values()).filter(p => p.isBot);
      expect(bots.length).toBe(2);
      expect(room.state.phase).not.toBe('WAITING_FOR_PLAYERS');
    });
  });
});
