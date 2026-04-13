// Contract Crown PartyKit Client Wrapper
// Manages WebSocket connection, room lifecycle, and state synchronization
// Replaces ColyseusClientWrapper with native WebSocket + PartyKit protocol

import type { Card, Suit } from '../engine/types.js';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface OnlineGameCallbacks {
  onStateChange: (state: any) => void;
  onError: (code: number, message: string) => void;
  onLeave: (code: number) => void;
  onGameStarted?: (data: { roomId: string; roomCode: string }) => void;
}

export class PartyKitClientWrapper {
  private ws: WebSocket | null = null;
  private callbacks: OnlineGameCallbacks;
  private connectionState: ConnectionState = 'disconnected';
  private currentRoomId: string | null = null;
  private currentSessionId: string | null = null;
  private reconnectSessionId: string | null = null;
  private serverBaseUrl = '';

  constructor(callbacks: OnlineGameCallbacks) {
    this.callbacks = callbacks;
  }

  get state(): ConnectionState {
    return this.connectionState;
  }

  get roomId(): string | null {
    return this.currentRoomId;
  }

  get sessionId(): string | null {
    return this.currentSessionId;
  }

  get reconnectionTokenValue(): string | null {
    return this.reconnectSessionId;
  }

  // ============================================================
  // Connection Management
  // ============================================================

  async connect(serverUrl: string): Promise<void> {
    if (this.connectionState === 'connected') return;

    this.serverBaseUrl = serverUrl;
    this.connectionState = 'connecting';
    console.log('[PartyKitClient] connect() START, serverUrl:', serverUrl);

    // PartyKit uses HTTP for room creation, WebSocket for game connections
    // Store the base URL for later use
    this.connectionState = 'connected';
    console.log('[PartyKitClient] connect() END - connectionState:', this.connectionState);
  }

  async createRoom(_roomName: string = 'crown', options: any = {}): Promise<string> {
    if (!this.serverBaseUrl) {
      console.error('[PartyKitClient] createRoom FAILED: Not connected');
      throw new Error('Not connected. Call connect() first.');
    }

    console.log('[PartyKitClient] createRoom START, options:', JSON.stringify(options));

    // Call the HTTP API to create a room
    const httpUrl = this.serverBaseUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    const response = await fetch(`${httpUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create room');
    }

    const data = await response.json();
    const roomId = data.roomId;
    const roomCode = data.roomCode;

    console.log('[PartyKitClient] createRoom SUCCESS, roomId:', roomId, 'roomCode:', roomCode);

    // Now connect via WebSocket
    await this.connectWebSocket(roomId, options.username);

    this.currentRoomId = roomId;
    this.reconnectSessionId = this.currentSessionId;

    console.log('[PartyKitClient] createRoom END - returning roomId:', roomId);
    return roomId;
  }

  async joinRoom(roomId: string, _roomName: string = 'crown', options: any = {}): Promise<void> {
    if (!this.serverBaseUrl) {
      console.error('[PartyKitClient] joinRoom FAILED: Not connected');
      throw new Error('Not connected. Call connect() first.');
    }

    console.log('[PartyKitClient] joinRoom START, roomId:', roomId);

    // Connect via WebSocket
    await this.connectWebSocket(roomId, options.username);

    this.currentRoomId = roomId;
    this.reconnectSessionId = this.currentSessionId;

    console.log('[PartyKitClient] joinRoom END');
  }

  async joinOrCreate(roomName: string = 'crown', options: any = {}): Promise<string> {
    if (!this.serverBaseUrl) {
      throw new Error('Not connected. Call connect() first.');
    }

    // PartyKit doesn't have joinOrCreate - we create or join explicitly
    // Try to create first, if it fails (room exists), join instead
    try {
      return await this.createRoom(roomName, options);
    } catch {
      // Room might already exist by ID - but PartyKit uses unique IDs
      // For compatibility, create a new room
      return await this.createRoom(roomName, options);
    }
  }

  async reconnect(): Promise<void> {
    if (!this.reconnectSessionId || !this.currentRoomId) {
      throw new Error('No reconnection data available.');
    }

    this.connectionState = 'reconnecting';
    console.log('[PartyKitClient] Reconnecting with sessionId:', this.reconnectSessionId);

    await this.connectWebSocket(this.currentRoomId, undefined, this.reconnectSessionId);

    this.connectionState = 'connected';
    console.log('[PartyKitClient] Reconnection successful');
  }

  // ============================================================
  // WebSocket Connection
  // ============================================================

  private connectWebSocket(roomId: string, username?: string, reconnectSessionId?: string, roomCode?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.buildWebSocketUrl(roomId, username, reconnectSessionId, roomCode);
      console.log('[PartyKitClient] Connecting WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[PartyKitClient] WebSocket connected');
        // Use the connection URL's pathname as a unique identifier
        // The server will use connection.id as sessionId
        this.connectionState = 'connected';
        resolve();
      };

      this.ws.onmessage = (event) => {
        console.log('[PartyKitClient] onmessage received, data length:', event.data.length, 'type:', event.data.substring(0, 50));
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[PartyKitClient] WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (event) => {
        console.log('[PartyKitClient] WebSocket closed, code:', event.code);
        this.connectionState = 'disconnected';
        this.currentSessionId = null;

        if (event.code === 4001) {
          this.callbacks.onError(event.code, 'Room is full');
        }

        this.callbacks.onLeave(event.code);
      };
    });
  }

  private buildWebSocketUrl(roomId: string, username?: string, reconnectSessionId?: string, roomCode?: string): string {
    const baseUrl = this.serverBaseUrl
      .replace('http://', 'ws://')
      .replace('https://', 'wss://');

    const params = new URLSearchParams();
    if (username) params.set('username', username);
    if (reconnectSessionId) params.set('reconnectSessionId', reconnectSessionId);
    if (roomCode) params.set('roomCode', roomCode);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return `${baseUrl}/parties/crown/${roomId}${queryString}`;
  }

  // ============================================================
  // Message Handling
  // ============================================================

  private handleMessage(data: string) {
    let message: { type: string; data: any };
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }

    switch (message.type) {
      case 'connected':
        // Server assigns sessionId (same as PartyKit connection.id)
        this.currentSessionId = message.data.sessionId;
        console.log('[PartyKitClient] Connected with sessionId:', this.currentSessionId);
        break;
      case 'state':
        this.callbacks.onStateChange(message.data);
        break;
      case 'game_started':
        console.log('[PartyKitClient] game_started received:', message.data);
        this.callbacks.onGameStarted?.(message.data);
        break;
      case 'error':
        console.error('[PartyKitClient] Server error:', message.data);
        this.callbacks.onError(0, message.data.message || 'Unknown error');
        break;
      case 'player_disconnected':
      case 'player_replaced_by_bot':
        // Forward to state change callback for UI updates
        this.callbacks.onStateChange({ ...message.data, _eventType: message.type });
        break;
      case 'room_expiry_warning':
      case 'room_closed':
        // These are notifications, not full state — handle separately
        break;
      default:
        console.log('[PartyKitClient] Unknown message type:', message.type);
    }
  }

  // ============================================================
  // Game Actions
  // ============================================================

  sendDeclareTrump(suit: Suit): void {
    this.send('declare_trump', { suit });
  }

  sendPlayCard(card: Card): void {
    this.send('play_card', { card });
  }

  sendReady(): void {
    this.send('ready', {});
  }

  sendShuffleTeams(): void {
    this.send('shuffle_teams', {});
  }

  sendAddBot(): void {
    this.send('add_bot', {});
  }

  sendStartGame(): void {
    this.send('start_game', {});
  }

  onServerMessage(type: string, handler: (data: any) => void): void {
    // For PartyKit, we handle all messages in handleMessage()
    // This method is kept for API compatibility with ColyseusClientWrapper
    // We'll use a custom approach: wrap the original onStateChange callback
    const originalOnStateChange = this.callbacks.onStateChange;
    this.callbacks.onStateChange = (state) => {
      // Check if this is a custom event
      if (state._eventType === type) {
        handler(state);
      }
      originalOnStateChange(state);
    };
  }

  async leave(consented: boolean = true): Promise<void> {
    if (this.ws) {
      this.ws.close(consented ? 1000 : 4000, 'Client left');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.onclose = null; // Prevent onLeave callback on explicit disconnect
      this.ws.close(1000, 'Disconnect');
      this.ws = null;
    }
    this.currentRoomId = null;
    this.currentSessionId = null;
    this.reconnectSessionId = null;
    this.connectionState = 'disconnected';
  }

  // ============================================================
  // Utility
  // ============================================================

  private send(type: string, data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[PartyKitClient] Cannot send, WebSocket not open');
      return;
    }

    try {
      this.ws.send(JSON.stringify({ type, data }));
    } catch (error) {
      console.error('[PartyKitClient] Failed to send message:', error);
    }
  }
}
