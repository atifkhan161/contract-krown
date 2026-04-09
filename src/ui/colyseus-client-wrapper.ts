// Contract Crown Colyseus Client Wrapper
// Manages WebSocket connection, room lifecycle, and state synchronization

import { Client, Room } from '@colyseus/sdk';
import type { Card, Suit } from '../engine/types.js';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface OnlineGameCallbacks {
  onStateChange: (state: any) => void;
  onError: (code: number, message: string) => void;
  onLeave: (code: number) => void;
  onGameStarted?: (data: { roomId: string; roomCode: string }) => void;
}

export class ColyseusClientWrapper {
  private client: Client | null = null;
  private room: Room | null = null;
  private callbacks: OnlineGameCallbacks;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectionToken: string | null = null;

  constructor(callbacks: OnlineGameCallbacks) {
    this.callbacks = callbacks;
  }

  get state(): ConnectionState {
    return this.connectionState;
  }

  get currentRoom(): Room | null {
    return this.room;
  }

  get roomId(): string | null {
    return this.room?.roomId ?? null;
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  get reconnectionTokenValue(): string | null {
    return this.reconnectionToken;
  }

  async connect(serverUrl: string): Promise<void> {
    if (this.connectionState === 'connected') return;

    this.connectionState = 'connecting';
    console.log('[ColyseusClient] =========================================');
    console.log('[ColyseusClient] connect() START');
    console.log('[ColyseusClient] serverUrl:', serverUrl);
    console.log('[ColyseusClient] serverUrl includes port:', serverUrl.includes(':') && !serverUrl.startsWith('wss:'));
    console.log('[ColyseusClient] =========================================');
    
    this.client = new Client(serverUrl);
    
    // Simple - Colyseus SDK handles connection internally
    console.log('[ColyseusClient] Client created with URL:', serverUrl);
    this.connectionState = 'connected';
    console.log('[ColyseusClient] connect() END - connectionState:', this.connectionState);
  }

  async createRoom(roomName: string = 'crown', options: any = {}): Promise<string> {
    if (!this.client) {
      console.error('[ColyseusClient] createRoom FAILED: Not connected');
      throw new Error('Not connected. Call connect() first.');
    }

    console.log('[ColyseusClient] =========================================');
    console.log('[ColyseusClient] createRoom START');
    console.log('[ColyseusClient] roomName:', roomName);
    console.log('[ColyseusClient] options:', JSON.stringify(options));
    console.log('[ColyseusClient] connectionState:', this.connectionState);
    console.log('[ColyseusClient] serverUrl:', (this.client as any).url || 'unknown');
    console.log('[ColyseusClient] =========================================');
    
    try {
      console.log('[ColyseusClient] Calling client.create()...');
      this.room = await this.client.create(roomName, options);
      
      if (!this.room) {
        console.error('[ColyseusClient] createRoom: room is null after creation!');
        throw new Error('Room creation returned null');
      }
      
      console.log('[ColyseusClient] =========================================');
      console.log('[ColyseusClient] createRoom SUCCESS');
      console.log('[ColyseusClient] roomId:', this.room.roomId);
      console.log('[ColyseusClient] sessionId:', this.room.sessionId);
      console.log('[ColyseusClient] reconnectionToken:', this.room.reconnectionToken ? 'present' : 'null');
      console.log('[ColyseusClient] =========================================');
      
      this.reconnectionToken = this.room.reconnectionToken;
      this.setupRoomListeners();
      console.log('[ColyseusClient] Room listeners set up');
      console.log('[ColyseusClient] createRoom END - returning roomId:', this.room.roomId);

      return this.room.roomId;
    } catch (err: any) {
      console.error('[ColyseusClient] =========================================');
      console.error('[ColyseusClient] createRoom FAILED');
      console.error('[ColyseusClient] Error:', err.message || err);
      console.error('[ColyseusClient] Error code:', err.code || 'unknown');
      console.error('[ColyseusClient] Error name:', err.name || 'unknown');
      console.error('[ColyseusClient] Stack:', err.stack || 'no stack');
      console.error('[ColyseusClient] =========================================');
      throw err;
    }
  }

  async joinRoom(roomId: string, _roomName: string = 'crown', options: any = {}): Promise<void> {
    if (!this.client) {
      console.error('[ColyseusClient] joinRoom FAILED: Not connected');
      throw new Error('Not connected. Call connect() first.');
    }

    console.log('[ColyseusClient] =========================================');
    console.log('[ColyseusClient] joinRoom START');
    console.log('[ColyseusClient] roomId:', roomId);
    console.log('[ColyseusClient] options:', JSON.stringify(options));
    console.log('[ColyseusClient] connectionState:', this.connectionState);
    console.log('[ColyseusClient] =========================================');
    
    try {
      console.log('[ColyseusClient] Calling client.joinById()...');
      this.room = await this.client.joinById(roomId, options);
      
      console.log('[ColyseusClient] =========================================');
      console.log('[ColyseusClient] joinRoom SUCCESS');
      console.log('[ColyseusClient] roomId:', this.room.roomId);
      console.log('[ColyseusClient] sessionId:', this.room.sessionId);
      console.log('[ColyseusClient] =========================================');
      
      this.reconnectionToken = this.room.reconnectionToken;
      this.setupRoomListeners();
      console.log('[ColyseusClient] Room listeners set up');
      console.log('[ColyseusClient] joinRoom END');
    } catch (err: any) {
      console.error('[ColyseusClient] =========================================');
      console.error('[ColyseusClient] joinRoom FAILED');
      console.error('[ColyseusClient] Error:', err.message || err);
      console.error('[ColyseusClient] Error code:', err.code || 'unknown');
      console.error('[ColyseusClient] =========================================');
      throw err;
    }
  }

  async joinOrCreate(roomName: string = 'crown', options: any = {}): Promise<string> {
    if (!this.client) throw new Error('Not connected. Call connect() first.');

    this.room = await this.client.joinOrCreate(roomName, options);
    this.reconnectionToken = this.room.reconnectionToken;

    this.setupRoomListeners();

    return this.room.roomId;
  }

  async reconnect(): Promise<void> {
    if (!this.client || !this.reconnectionToken) {
      throw new Error('No reconnection token available.');
    }

    this.connectionState = 'reconnecting';
    this.room = await this.client.reconnect(this.reconnectionToken);
    this.setupRoomListeners();
    this.reconnectionToken = this.room.reconnectionToken;
    this.connectionState = 'connected';
  }

  sendDeclareTrump(suit: Suit): void {
    if (!this.room) throw new Error('Not in a room.');
    this.room.send('declare_trump', { suit });
  }

  sendPlayCard(card: Card): void {
    if (!this.room) throw new Error('Not in a room.');
    this.room.send('play_card', { card });
  }

  sendReady(): void {
    if (!this.room) throw new Error('Not in a room.');
    this.room.send('ready', {});
  }

  sendShuffleTeams(): void {
    if (!this.room) throw new Error('Not in a room.');
    this.room.send('shuffle_teams', {});
  }

  sendAddBot(): void {
    if (!this.room) throw new Error('Not in a room.');
    this.room.send('add_bot', {});
  }

  sendStartGame(): void {
    if (!this.room) throw new Error('Not in a room.');
    this.room.send('start_game', {});
  }

  onServerMessage(type: string, handler: (data: any) => void): void {
    if (!this.room) throw new Error('Not in a room.');
    this.room.onMessage(type, handler);
  }

  async leave(consented: boolean = true): Promise<void> {
    if (!this.room) return;
    await this.room.leave(consented);
  }

  disconnect(): void {
    if (this.room) {
      this.room.removeAllListeners();
      this.room = null;
    }
    this.client = null;
    this.reconnectionToken = null;
    this.connectionState = 'disconnected';
  }

  private setupRoomListeners(): void {
    if (!this.room) {
      console.error('[ColyseusClient] setupRoomListeners: room is null!');
      return;
    }

    console.log('[ColyseusClient] =========================================');
    console.log('[ColyseusClient] setupRoomListeners START, roomId:', this.room.roomId);
    console.log('[ColyseusClient] =========================================');

    // State change listener
    this.room.onStateChange((state) => {
      console.log('[ColyseusClient] onStateChange fired, roomCode:', state?.roomCode, 'phase:', state?.phase);
      this.callbacks.onStateChange(state);
    });

    // Message listener
    this.room.onMessage('game_started', (data) => {
      console.log('[ColyseusClient] onMessage(game_started):', JSON.stringify(data));
      if (this.callbacks.onGameStarted) {
        this.callbacks.onGameStarted(data);
      }
    });

    // Error listener
    this.room.onError((code, message) => {
      console.error('[ColyseusClient] =========================================');
      console.error('[ColyseusClient] onError fired');
      console.error('[ColyseusClient] Error code:', code);
      console.error('[ColyseusClient] Error message:', message);
      console.error('[ColyseusClient] =========================================');
      this.callbacks.onError(code ?? 0, message ?? 'Unknown error');
    });

    // Leave listener
    this.room.onLeave((code, reason) => {
      console.log('[ColyseusClient] =========================================');
      console.log('[ColyseusClient] onLeave fired');
      console.log('[ColyseusClient] Leave code:', code);
      console.log('[ColyseusClient] Leave reason:', reason);
      console.log('[ColyseusClient] connectionState set to: disconnected');
      console.log('[ColyseusClient] =========================================');
      this.connectionState = 'disconnected';
      this.callbacks.onLeave(code);
    });

    console.log('[ColyseusClient] setupRoomListeners END - all listeners registered');
  }
}
