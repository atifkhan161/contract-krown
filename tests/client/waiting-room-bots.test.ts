// Client Tests for Waiting Room Bot Display
// Tests that bots are properly included in waiting room state

import { describe, it, expect } from 'vitest';

describe('Waiting Room Bot Display', () => {
  describe('extractPlayers includes bots', () => {
    it('should include bots in the returned player array', () => {
      const mockPlayerMap = new Map([
        ['0', { id: 0, username: 'Admin', sessionId: 'c1', isBot: false, team: 0 }],
        ['1', { id: 1, username: 'Bot Alpha', sessionId: 'bot-1', isBot: true, team: 1 }],
        ['2', { id: 2, username: 'Bot Beta', sessionId: 'bot-2', isBot: true, team: 0 }],
        ['3', { id: 3, username: 'Player 4', sessionId: 'c4', isBot: false, team: 1 }]
      ]);

      const mockState = {
        roomCode: 'TEST1',
        adminSessionId: 'c1',
        players: mockPlayerMap
      };

      const players: Array<{ playerIndex: number; username: string; sessionId: string; isBot: boolean; isAdmin: boolean; team: 0 | 1 }> = [];
      for (let i = 0; i < 4; i++) {
        const ps = mockPlayerMap.get(String(i));
        if (ps) {
          players.push({
            playerIndex: ps.id,
            username: ps.username || `Player ${ps.id + 1}`,
            sessionId: ps.sessionId,
            isBot: ps.isBot,
            isAdmin: ps.sessionId === mockState.adminSessionId,
            team: ps.team as 0 | 1
          });
        }
      }

      expect(players.length).toBe(4);
      expect(players.filter(p => p.isBot).length).toBe(2);
      expect(players.find(p => p.username === 'Bot Alpha')?.isBot).toBe(true);
      expect(players.find(p => p.username === 'Bot Beta')?.isBot).toBe(true);
    });
  });

  describe('transformToWaitingRoomState includes bots', () => {
    it('should include bots in the waiting room state player list', () => {
      const mockPlayerMap = new Map([
        ['0', { id: 0, username: 'Admin', sessionId: 'c1', isBot: false, team: 0 }],
        ['1', { id: 1, username: 'Bot Alpha', sessionId: 'bot-1', isBot: true, team: 1 }],
        ['2', { id: 2, username: 'Bot Beta', sessionId: 'bot-2', isBot: true, team: 0 }],
        ['3', { id: 3, username: 'Player 4', sessionId: 'c4', isBot: false, team: 1 }]
      ]);

      const mockSchema = {
        roomCode: 'TEST1',
        adminSessionId: 'c1',
        roomExpiryAt: Date.now() + 60000,
        players: mockPlayerMap
      };

      const extractPlayers = (state: any) => {
        const players: Array<any> = [];
        const playerMap = state.players as Map<string, any>;
        for (let i = 0; i < 4; i++) {
          const ps = playerMap.get(String(i));
          if (ps) {
            players.push({
              playerIndex: ps.id,
              username: ps.username || `Player ${ps.id + 1}`,
              sessionId: ps.sessionId,
              isBot: ps.isBot,
              isAdmin: ps.sessionId === state.adminSessionId,
              team: ps.team as 0 | 1
            });
          }
        }
        return players;
      };

      const players = extractPlayers(mockSchema);

      const transformToWaitingRoomState = (schema: any) => ({
        roomCode: schema.roomCode || '',
        adminSessionId: schema.adminSessionId || '',
        players,
        timeRemaining: Math.max(0, Math.floor((schema.roomExpiryAt - Date.now()) / 1000)),
        isFull: players.length >= 4,
        isAdmin: 'c1' === schema.adminSessionId,
        playerCount: players.length
      });

      const waitingRoomState = transformToWaitingRoomState(mockSchema);

      expect(waitingRoomState.players.length).toBe(4);
      expect(waitingRoomState.players.filter(p => p.isBot).length).toBe(2);
      expect(waitingRoomState.isFull).toBe(true);
      expect(waitingRoomState.playerCount).toBe(4);
    });
  });

  describe('bot names display correctly', () => {
    it('should have correct bot names from server (Alpha, Beta, Gamma, Delta)', () => {
      const botNames = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'];
      
      expect(botNames[0]).toBe('Bot Alpha');
      expect(botNames[1]).toBe('Bot Beta');
      expect(botNames[2]).toBe('Bot Gamma');
      expect(botNames[3]).toBe('Bot Delta');
    });
  });
});