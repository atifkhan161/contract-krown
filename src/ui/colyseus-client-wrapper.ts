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
    console.log('[ColyseusClient] Creating Client with URL:', serverUrl);
    
    this.client = new Client(serverUrl);
    
    // Simple - Colyseus SDK handles connection internally
    console.log('[ColyseusClient] Client created');
    this.connectionState = 'connected';
  }

  async createRoom(roomName: string = 'crown', options: any = {}): Promise<string> {
    if (!this.client) throw new Error('Not connected. Call connect() first.');

    console.log('[ColyseusClient] Creating room:', roomName, 'options:', JSON.stringify(options));
    
    this.room = await this.client.create(roomName, options);
    this.reconnectionToken = this.room.reconnectionToken;
    console.log('[ColyseusClient] Room created, roomId:', this.room.roomId, 'sessionId:', this.room.sessionId);

    this.setupRoomListeners();

    return this.room.roomId;
  }

  async joinRoom(roomId: string, _roomName: string = 'crown', options: any = {}): Promise<void> {
    if (!this.client) throw new Error('Not connected. Call connect() first.');

    console.log('[ColyseusClient] Joining room:', roomId, 'options:', JSON.stringify(options));
    
    this.room = await this.client.joinById(roomId, options);
    this.reconnectionToken = this.room.reconnectionToken;
    console.log('[ColyseusClient] Joined room, sessionId:', this.room.sessionId);

    this.setupRoomListeners();
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
    if (!this.room) return;

    console.log('[ColyseusClient] setupRoomListeners called, roomId:', this.room.roomId);

    this.room.onStateChange((state) => {
      console.log('[ColyseusClient] onStateChange fired');
      console.log('[ColyseusClient] state.roomCode:', state.roomCode);
      console.log('[ColyseusClient] state.phase:', state.phase);
      this.callbacks.onStateChange(state);
    });

    this.room.onMessage('game_started', (data) => {
      console.log('[ColyseusClient] game_started message received:', data);
      if (this.callbacks.onGameStarted) {
        this.callbacks.onGameStarted(data);
      }
    });

    this.room.onError((code, message) => {
      console.error('[ColyseusClient] onError:', code, message);
      this.callbacks.onError(code ?? 0, message ?? 'Unknown error');
    });

    this.room.onLeave((code, _reason) => {
      console.log('[ColyseusClient] onLeave, code:', code);
      this.connectionState = 'disconnected';
      this.callbacks.onLeave(code);
    });
  }
}
