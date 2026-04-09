// Contract Crown PartyKit Client Wrapper
// Manages WebSocket connection, room lifecycle, and state synchronization

import PartySocket from "partysocket";
import type { Card, Suit } from "../engine/types.js";

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface OnlineGameCallbacks {
  onStateChange: (state: any) => void;
  onError: (code: number, message: string) => void;
  onLeave: (code: number) => void;
  onGameStarted?: (data: { roomId: string; roomCode: string }) => void;
}

export class PartyKitClientWrapper {
  private _socket: PartySocket | null = null;
  private _callbacks: OnlineGameCallbacks;
  private _connectionState: ConnectionState = 'disconnected';
  private _roomId: string | null = null;
  private _sessionId: string | null = null;
  private _serverUrl: string = '';

  constructor(callbacks: OnlineGameCallbacks) {
    this._callbacks = callbacks;
  }

  get state(): ConnectionState {
    return this._connectionState;
  }

  get currentRoom(): { roomId: string } | null {
    return this._roomId ? { roomId: this._roomId } : null;
  }

  get roomId(): string | null {
    return this._roomId;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  get reconnectionTokenValue(): string | null {
    return this._roomId;
  }

  async connect(serverUrl: string): Promise<void> {
    if (this._connectionState === 'connected') return;

    this._connectionState = 'connecting';
    this._serverUrl = serverUrl;
    console.log('[PartyKitClient] connect() START, serverUrl:', serverUrl);
    this._connectionState = 'connected';
    console.log('[PartyKitClient] connect() END');
  }

  async createRoom(_roomName: string = 'crown', options: any = {}): Promise<string> {
    console.log('[PartyKitClient] createRoom START, options:', options);

    const roomId = this.generateRoomId();
    this._roomId = roomId;

    this._socket = new PartySocket({
      host: this._serverUrl,
      room: roomId,
      query: {
        username: options.username || 'Player'
      }
    });

    this.setupSocketListeners();
    
    console.log('[PartyKitClient] createRoom END, roomId:', roomId);
    return roomId;
  }

  async joinRoom(roomId: string, _roomName: string = 'crown', options: any = {}): Promise<void> {
    console.log('[PartyKitClient] joinRoom START, roomId:', roomId);

    this._roomId = roomId;

    this._socket = new PartySocket({
      host: this._serverUrl,
      room: roomId,
      query: {
        username: options.username || 'Player'
      }
    });

    this.setupSocketListeners();

    console.log('[PartyKitClient] joinRoom END');
  }

  async joinOrCreate(_roomName: string = 'crown', options: any = {}): Promise<string> {
    console.log('[PartyKitClient] joinOrCreate START');
    const roomId = await this.createRoom('crown', options);
    console.log('[PartyKitClient] joinOrCreate END, roomId:', roomId);
    return roomId;
  }

  async reconnect(): Promise<void> {
    if (!this._roomId || !this._serverUrl) {
      throw new Error('No room or server available for reconnection.');
    }

    this._connectionState = 'reconnecting';
    console.log('[PartyKitClient] reconnecting to room:', this._roomId);

    this._socket = new PartySocket({
      host: this._serverUrl,
      room: this._roomId
    });

    this.setupSocketListeners();
    this._connectionState = 'connected';
  }

  sendDeclareTrump(suit: Suit): void {
    if (!this._socket) throw new Error('Not connected.');
    this._socket.send(JSON.stringify({
      type: 'declare_trump',
      suit
    }));
  }

  sendPlayCard(card: Card): void {
    if (!this._socket) throw new Error('Not connected.');
    this._socket.send(JSON.stringify({
      type: 'play_card',
      card
    }));
  }

  sendReady(): void {
    if (!this._socket) throw new Error('Not connected.');
    this._socket.send(JSON.stringify({
      type: 'ready'
    }));
  }

  sendShuffleTeams(): void {
    if (!this._socket) throw new Error('Not connected.');
    this._socket.send(JSON.stringify({
      type: 'shuffle_teams'
    }));
  }

  sendAddBot(): void {
    if (!this._socket) throw new Error('Not connected.');
    this._socket.send(JSON.stringify({
      type: 'add_bot'
    }));
  }

  sendStartGame(): void {
    if (!this._socket) throw new Error('Not connected.');
    this._socket.send(JSON.stringify({
      type: 'start_game'
    }));
  }

  onServerMessage(_type: string, _handler: (data: any) => void): void {
    // Message handlers are set up in setupSocketListeners
    // This method is kept for API compatibility
  }

  async leave(_consented: boolean = true): Promise<void> {
    if (this._socket) {
      this._socket.close();
      this._socket = null;
    }
    this._roomId = null;
    this._sessionId = null;
    this._connectionState = 'disconnected';
  }

  disconnect(): void {
    if (this._socket) {
      this._socket.close();
      this._socket = null;
    }
    this._roomId = null;
    this._sessionId = null;
    this._connectionState = 'disconnected';
  }

  private setupSocketListeners(): void {
    if (!this._socket) return;

    console.log('[PartyKitClient] setupSocketListeners START');

    this._socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[PartyKitClient] Received message type:', data.type);

        switch (data.type) {
          case 'welcome':
            this._sessionId = data.sessionId;
            console.log('[PartyKitClient] Received welcome, sessionId:', this._sessionId);
            break;

          case 'state_update':
            console.log('[PartyKitClient] state_update, phase:', data.state?.phase);
            this._callbacks.onStateChange(data.state);
            break;

          case 'game_started':
            console.log('[PartyKitClient] game_started:', data);
            if (this._callbacks.onGameStarted) {
              this._callbacks.onGameStarted(data);
            }
            break;

          case 'player_disconnected':
            console.log('[PartyKitClient] player_disconnected:', data);
            break;

          case 'player_replaced_by_bot':
            console.log('[PartyKitClient] player_replaced_by_bot:', data);
            break;

          case 'room_expiry_warning':
            console.log('[PartyKitClient] room_expiry_warning:', data);
            break;

          case 'error':
            console.log('[PartyKitClient] error:', data.message);
            this._callbacks.onError(0, data.message);
            break;
        }
      } catch (err) {
        console.error('[PartyKitClient] Error parsing message:', err);
      }
    });

    this._socket.addEventListener('open', () => {
      console.log('[PartyKitClient] Socket opened');
      this._connectionState = 'connected';
    });

    this._socket.addEventListener('close', (event) => {
      console.log('[PartyKitClient] Socket closed, code:', event.code);
      this._connectionState = 'disconnected';
      this._callbacks.onLeave(event.code);
    });

    this._socket.addEventListener('error', (event) => {
      console.error('[PartyKitClient] Socket error:', event);
      this._callbacks.onError(0, 'Connection error');
    });

    console.log('[PartyKitClient] setupSocketListeners END');
  }

  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}