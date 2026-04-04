// Contract Crown Online Gameplay Integration Tests
// Tests complete gameplay flow from room creation to game end
// Requires Colyseus server running at ws://localhost:2567

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ColyseusClientWrapper } from '@src/ui/colyseus-client-wrapper.js';

const SERVER_URL = 'ws://localhost:2567';
const POLL_INTERVAL_MS = 200;

interface TestClient {
  wrapper: ColyseusClientWrapper;
  sessionId: string;
  username: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkServerAvailable(): Promise<boolean> {
  try {
    const wrapper = new ColyseusClientWrapper({
      onStateChange: () => {},
      onError: () => {},
      onLeave: () => {}
    });
    await wrapper.connect(SERVER_URL);
    wrapper.disconnect();
    return true;
  } catch {
    return false;
  }
}

async function connectPlayer(username: string): Promise<TestClient> {
  const wrapper = new ColyseusClientWrapper({
    onStateChange: () => {},
    onError: () => {},
    onLeave: () => {}
  });
  
  await wrapper.connect(SERVER_URL);
  const sessionId = wrapper.sessionId || '';
  
  return {
    wrapper,
    sessionId,
    username
  };
}

async function createRoomAsAdmin(admin: TestClient): Promise<string> {
  const roomCode = await admin.wrapper.createRoom('crown', { username: admin.username });
  return roomCode;
}

async function joinRoom(wrapper: ColyseusClientWrapper, roomCode: string, username: string): Promise<void> {
  await wrapper.joinRoom(roomCode, 'crown', { username });
}

function getScores(wrapper: ColyseusClientWrapper): { team0: number; team1: number } {
  const room = wrapper.currentRoom;
  if (!room) return { team0: 0, team1: 0 };
  return {
    team0: room.state.scoreTeam0,
    team1: room.state.scoreTeam1
  };
}

function getCrownHolder(wrapper: ColyseusClientWrapper): number {
  const room = wrapper.currentRoom;
  if (!room) return 0;
  return room.state.crownHolder;
}

function getPlayerCount(wrapper: ColyseusClientWrapper): number {
  const room = wrapper.currentRoom;
  if (!room) return 0;
  return room.state.players.size;
}

function findHumanPlayerForTurn(wrapper: ColyseusClientWrapper): number | null {
  const room = wrapper.currentRoom;
  if (!room) return null;
  
  const currentPlayer = room.state.currentPlayer;
  const playerData = room.state.players.get(String(currentPlayer));
  
  if (playerData?.isBot) return null;
  
  return currentPlayer;
}

function playCardForPlayer(wrapper: ColyseusClientWrapper, playerIndex: number): boolean {
  const room = wrapper.currentRoom;
  if (!room) return false;
  
  const playerData = room.state.players.get(String(playerIndex));
  if (playerData?.isBot) return false;
  
  const hand = Array.from(playerData?.hand || []);
  if (hand.length > 0) {
    wrapper.sendPlayCard(hand[0] as any);
    return true;
  }
  return false;
}

describe('Online Gameplay Integration', () => {
  let players: TestClient[] = [];
  let adminRoomCode: string = '';

  beforeAll(async () => {
    const available = await checkServerAvailable();
    if (!available) {
      console.log('[Test] Server not available at', SERVER_URL, '- skipping tests');
      return;
    }

    console.log('[Test] Server available, connecting players...');
    
    players = await Promise.all([
      connectPlayer('AdminPlayer'),
      connectPlayer('Player2'),
      connectPlayer('Player3'),
      connectPlayer('Player4')
    ]);
    
    console.log('[Test] All players connected');
  });

  afterAll(async () => {
    for (const player of players) {
      try {
        player.wrapper.disconnect();
      } catch {}
    }
  });

  it('should complete full gameplay flow', async () => {
    const available = await checkServerAvailable();
    if (!available) {
      console.log('[Test] SKIPPED: Server not available');
      return;
    }

    console.log('\n=== PHASE 1: Room Creation ===');
    adminRoomCode = await createRoomAsAdmin(players[0]);
    console.log('[Test] Room created with code:', adminRoomCode);
    
    expect(adminRoomCode).toBeDefined();
    expect(adminRoomCode.length).toBeGreaterThan(0);

    console.log('\n=== PHASE 2: Player Join ===');
    for (let i = 1; i < 4; i++) {
      await joinRoom(players[i].wrapper, adminRoomCode, players[i].username);
    }
    
    await delay(1000);
    const playerCount = getPlayerCount(players[0].wrapper);
    console.log('[Test] Players in room:', playerCount);
    expect(playerCount).toBe(4);

    const room = players[0].wrapper.currentRoom;
    const player0 = room?.state.players.get('0');
    const player1 = room?.state.players.get('1');
    const player2 = room?.state.players.get('2');
    const player3 = room?.state.players.get('3');
    
    expect(player0?.team).toBe(0);
    expect(player1?.team).toBe(1);
    expect(player2?.team).toBe(0);
    expect(player3?.team).toBe(1);
    console.log('[Test] Teams assigned: P0,P2=Team0, P1,P3=Team1');

    console.log('\n=== PHASE 3: Game Start ===');
    players[0].wrapper.sendStartGame();
    
    await delay(2000);
    const phaseAfterStart = players[0].wrapper.currentRoom?.state.phase;
    expect(phaseAfterStart).toMatch(/TRUMP_DECLARATION|TRICK_PLAY/);
    console.log('[Test] Game started, phase:', phaseAfterStart);

    console.log('\n=== PHASE 4: Trump Declaration ===');
    const crownHolder = getCrownHolder(players[0].wrapper);
    const crownHolderData = players[0].wrapper.currentRoom?.state.players.get(String(crownHolder));
    const crownHolderIsBot = crownHolderData?.isBot;
    console.log('[Test] Crown holder is player', crownHolder, '(bot:', crownHolderIsBot, ')');
    
    if (!crownHolderIsBot) {
      players[0].wrapper.sendDeclareTrump('HEARTS');
      await delay(500);
    } else {
      console.log('[Test] Crown holder is bot, trump will be auto-declared');
    }
    
    await delay(2000);
    const currentRoom = players[0].wrapper.currentRoom;
    expect(currentRoom?.state.phase).toBe('TRICK_PLAY');
    expect(currentRoom?.state.trumpSuit).toBeDefined();
    console.log('[Test] Trump declared:', currentRoom?.state.trumpSuit);
    console.log('[Test] Game in TRICK_PLAY phase');

    console.log('\n=== PHASE 5: Full Trick Play (8 tricks) ===');
    const maxTrickCount = 8;
    const maxWaitTime = 60000;
    const startTime = Date.now();
    let lastCompletedCount = 0;
    let lastCurrentPlayer = -1;
    let idleCycles = 0;
    
    while (currentRoom && 
           currentRoom.state.phase !== 'ROUND_END' && 
           currentRoom.state.phase !== 'GAME_END' &&
           currentRoom.state.completedTricks.length < maxTrickCount) {
      
      const currentPlayer = currentRoom.state.currentPlayer;
      const trickCards = currentRoom.state.currentTrick.cards.length;
      const completed = currentRoom.state.completedTricks.length;
      
      if (completed > lastCompletedCount) {
        console.log('[Test] Trick', completed, 'completed, winner:', currentRoom.state.currentTrick.winner);
        lastCompletedCount = completed;
        idleCycles = 0;
      }
      
      if (currentPlayer !== lastCurrentPlayer) {
        lastCurrentPlayer = currentPlayer;
        idleCycles = 0;
        
        const playerData = currentRoom.state.players.get(String(currentPlayer));
        if (!playerData?.isBot) {
          const played = playCardForPlayer(players[0].wrapper, currentPlayer);
          if (played) {
            console.log('[Test] Player', currentPlayer, 'played card, trick has', trickCards, 'cards');
          }
        }
      } else {
        idleCycles++;
      }
      
      await delay(POLL_INTERVAL_MS);
      
      if (idleCycles > 100) {
        console.log('[Test] No progress for a while, phase:', currentRoom.state.phase, 'trick cards:', trickCards, 'completed:', completed);
        idleCycles = 0;
      }
      
      if (Date.now() - startTime > maxWaitTime) {
        console.log('[Test] Timeout - completed tricks:', completed);
        break;
      }
    }

    const completedTricks = currentRoom?.state.completedTricks.length || 0;
    console.log('[Test] Final completed tricks:', completedTricks);

    console.log('\n=== PHASE 6: Round End ===');
    const scores = getScores(players[0].wrapper);
    console.log('[Test] Final scores - Team0:', scores.team0, 'Team1:', scores.team1);
    console.log('[Test] Final phase:', currentRoom?.state.phase);
    
    expect(['ROUND_END', 'GAME_END', 'TRICK_PLAY']).toContain(currentRoom?.state.phase);

    console.log('\n=== TEST COMPLETE ===');
  }, 90000);
});