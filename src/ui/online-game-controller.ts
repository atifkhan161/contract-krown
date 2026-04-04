// Contract Crown Online Game Controller
// Manages online multiplayer game flow via Colyseus server

import type { GameState, Card, Suit } from '../engine/types.js';
import { ColyseusClientWrapper, ConnectionState } from './colyseus-client-wrapper.js';
import { GameView } from './game-view.js';
import { HapticController } from './haptic-controller.js';
import { canPlayCard } from '../engine/index.js';
import type { WaitingRoomState } from './waiting-room-view.js';

export type OnlineGameCallback = (state: GameState) => void;

export interface OnlineGameConfig {
  serverUrl?: string;
  userPlayerIndex?: number;
}

const DEFAULT_SERVER_URL = 'ws://localhost:2567';

export class OnlineGameController {
  private clientWrapper: ColyseusClientWrapper;
  private gameView: GameView;
  private hapticController: HapticController;
  private userServerPlayerIndex: number = 0;
  private playerNames: string[] = [];
  private serverState: any = null;
  private onStateChange: OnlineGameCallback | null = null;
  private onGameStarted: ((data: { roomId: string; roomCode: string }) => void) | null = null;
  private isRunning: boolean = false;
  private previousTrickCount: number = 0;
  private previousPhase: string = 'WAITING_FOR_PLAYERS';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private waitingRoomCallbacks: Array<(state: any) => void> = [];
  private currentUsername: string = '';

  constructor(config: OnlineGameConfig = {}) {
    this.userServerPlayerIndex = config.userPlayerIndex ?? 0;
    this.gameView = new GameView();
    this.hapticController = new HapticController();

    this.clientWrapper = new ColyseusClientWrapper({
      onStateChange: (state) => this.handleStateChange(state),
      onError: (code, message) => this.handleError(code, message),
      onLeave: (code) => this.handleLeave(code),
      onGameStarted: (data) => {
        console.log('[OnlineGameController] game_started received:', data);
        this.onGameStarted?.(data);
      }
    });

    this.setupEventHandlers();
  }

  /**
   * Maps server player index to view position (relative to user)
   * View positions: 0=bottom (user), 1=left, 2=top (partner), 3=right
   */
  getViewPosition(serverPlayerIndex: number): number {
    return (serverPlayerIndex - this.userServerPlayerIndex + 4) % 4;
  }

  /**
   * Maps view position back to server player index
   */
  getServerIndex(viewPosition: number): number {
    return (viewPosition + this.userServerPlayerIndex) % 4;
  }

  /**
   * Gets the user's server player index
   */
  getUserServerPlayerIndex(): number {
    return this.userServerPlayerIndex;
  }

  /**
   * Sets the user's server player index (called when joining room)
   */
  setUserServerPlayerIndex(index: number): void {
    this.userServerPlayerIndex = index;
  }

  /**
   * Gets the rotated player names for display
   */
  getPlayerNames(): string[] {
    return this.playerNames;
  }

  private setupEventHandlers(): void {
    this.gameView.setCardTapHandler((card: Card) => {
      this.handleUserCardPlay(card);
    });

    this.gameView.setTrumpSelectionHandler((suit: Suit) => {
      this.handleUserTrumpDeclaration(suit);
    });
  }

  async start(roomId: string, serverUrl: string = DEFAULT_SERVER_URL): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.previousTrickCount = 0;
    this.previousPhase = 'WAITING_FOR_PLAYERS';

    await this.clientWrapper.connect(serverUrl);
    await this.clientWrapper.joinRoom(roomId);

    this.gameView.update(this.createEmptyGameState());
  }

  async createAndJoin(serverUrl: string = DEFAULT_SERVER_URL): Promise<string> {
    if (this.isRunning) return '';

    this.isRunning = true;
    this.previousTrickCount = 0;
    this.previousPhase = 'WAITING_FOR_PLAYERS';

    await this.clientWrapper.connect(serverUrl);
    const roomId = await this.clientWrapper.createRoom('crown');

    this.gameView.update(this.createEmptyGameState());
    return roomId;
  }

  async joinOrCreateRoom(roomName: string = 'crown', serverUrl: string = DEFAULT_SERVER_URL): Promise<string> {
    if (this.isRunning) return '';

    this.isRunning = true;
    this.previousTrickCount = 0;
    this.previousPhase = 'WAITING_FOR_PLAYERS';

    await this.clientWrapper.connect(serverUrl);
    const roomId = await this.clientWrapper.joinOrCreate(roomName);

    this.gameView.update(this.createEmptyGameState());
    return roomId;
  }

  private handleStateChange(schema: any): void {
    console.log('[OnlineGameController] handleStateChange called');
    console.log('[OnlineGameController] schema.roomCode:', schema?.roomCode);
    console.log('[OnlineGameController] schema.phase:', schema?.phase);
    console.log('[OnlineGameController] schema.adminSessionId:', schema?.adminSessionId);
    console.log('[OnlineGameController] schema.players size:', schema?.players?.size);
    
    this.serverState = schema;
    
    // Extract user's player index from session ID
    const clientSessionId = this.clientWrapper.sessionId;
    
    if (clientSessionId) {
      const playerMap = schema.players as unknown as Map<string, any>;
      for (let i = 0; i < 4; i++) {
        const ps = playerMap.get(String(i));
        if (ps && ps.sessionId === clientSessionId) {
          this.userServerPlayerIndex = i;
          console.log('[OnlineGameController] User player index set to:', this.userServerPlayerIndex);
          break;
        }
      }
    }
    
    const gameState = this.mapSchemaToGameState(schema);
    this.detectStateTransitions(gameState);
    
    // Pass rotated player names to GameView - use rotated index (always 0 after rotation)
    // But for initial render before detection, we need to handle gracefully
    const renderIndex = this.userServerPlayerIndex;
    this.gameView.render(gameState, renderIndex, this.playerNames);

    if (this.onStateChange) {
      this.onStateChange(gameState);
    }

    for (const cb of this.waitingRoomCallbacks) {
      const waitingRoomState = this.transformToWaitingRoomState(schema);
      cb(waitingRoomState);
    }
  }

  private transformToWaitingRoomState(schema: any): WaitingRoomState {
    const players = this.extractPlayers(schema);
    return {
      roomId: this.clientWrapper.roomId || '',
      roomCode: schema.roomCode || '',
      adminSessionId: schema.adminSessionId || '',
      players,
      timeRemaining: Math.max(0, Math.floor((schema.roomExpiryAt - Date.now()) / 1000)),
      isFull: players.length >= 4,
      isAdmin: this.clientWrapper.sessionId === schema.adminSessionId,
      playerCount: players.length,
      trumpDeclarer: schema.trumpDeclarer ?? undefined
    };
  }

  private detectStateTransitions(gameState: GameState): void {
    const currentPhase = gameState.phase;
    const currentTrickCount = gameState.completedTricks.length;

    // When entering TRUMP_DECLARATION phase
    if (this.previousPhase !== 'TRUMP_DECLARATION' && currentPhase === 'TRUMP_DECLARATION') {
      // If user is crown holder, show TrumpSelector
      if (gameState.crownHolder === this.userServerPlayerIndex) {
        this.gameView.showTrumpSelector();
      }
    }

    // When leaving TRUMP_DECLARATION phase (trump was declared)
    if (this.previousPhase === 'TRUMP_DECLARATION' && currentPhase !== 'TRUMP_DECLARATION') {
      this.gameView.hideTrumpSelector();
    }

    if (this.previousPhase === 'TRUMP_DECLARATION' && currentPhase === 'TRICK_PLAY') {
      this.hapticController.triggerTrumpDeclared();
    }

    if (currentTrickCount > this.previousTrickCount && currentTrickCount <= 8) {
      const lastTrick = gameState.completedTricks[currentTrickCount - 1];
      if (lastTrick.winner === this.userServerPlayerIndex) {
        this.hapticController.triggerTrickWon();
      }
    }

    if (this.previousPhase !== 'ROUND_END' && currentPhase === 'ROUND_END') {
      setTimeout(() => {
        if (this.isRunning) {
          this.gameView.showRoundEndModal();
        }
      }, 1500);
    }

    if (this.previousPhase !== 'GAME_END' && currentPhase === 'GAME_END') {
      this.hapticController.triggerVictory();
      setTimeout(() => {
        if (this.isRunning) {
          this.gameView.showVictoryModal();
        }
      }, 1000);
    }

    this.previousTrickCount = currentTrickCount;
    this.previousPhase = currentPhase;
  }

  private handleUserCardPlay(card: Card): void {
    if (!this.isRunning) return;
    if (!this.serverState) return;
    if (this.serverState.phase !== 'TRICK_PLAY') return;
    if (this.serverState.currentPlayer !== this.userServerPlayerIndex) return;

    const gameState = this.mapSchemaToGameState(this.serverState);
    if (!canPlayCard(gameState, this.userServerPlayerIndex, card)) {
      return;
    }

    try {
      this.clientWrapper.sendPlayCard(card);
      this.hapticController.triggerYourTurn();
    } catch (error) {
      console.error('Failed to send card play:', error);
    }
  }

  private handleUserTrumpDeclaration(suit: Suit): void {
    if (!this.isRunning) return;
    if (!this.serverState) return;
    if (this.serverState.phase !== 'TRUMP_DECLARATION') return;
    if (this.serverState.crownHolder !== this.userServerPlayerIndex) return;

    try {
      this.clientWrapper.sendDeclareTrump(suit);
      this.gameView.hideTrumpSelector();
    } catch (error) {
      console.error('Failed to send trump declaration:', error);
    }
  }

  private handleError(code: number, message: string): void {
    console.error(`Server error (${code}): ${message}`);
  }

  private handleLeave(code: number): void {
    this.isRunning = false;

    if (code === 4001) {
      console.log('Room is full');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private mapSchemaToGameState(schema: any): GameState {
    const players: GameState['players'] = [];
    const playerMap = schema.players as unknown as Map<string, any>;
    const rawPlayerNames: string[] = [];

    // Extract raw player data first (before rotation)
    for (let i = 0; i < 4; i++) {
      const ps = playerMap.get(String(i));
      if (ps) {
        rawPlayerNames[i] = ps.username || `Player ${i + 1}`;
        players.push({
          id: ps.id,
          hand: this.mapHand(ps.hand),
          team: ps.team as 0 | 1,
          isBot: ps.isBot
        });
      } else {
        rawPlayerNames[i] = `Player ${i + 1}`;
        players.push({
          id: i,
          hand: [],
          team: (i % 2 === 0 ? 0 : 1) as 0 | 1,
          isBot: true
        });
      }
    }

    // Rotate player names so user is at position 0
    this.playerNames = rawPlayerNames.map((_, i) => rawPlayerNames[this.getServerIndex(i)]);

    // Rotate current player index
    const rotatedCurrentPlayer = this.getViewPosition(schema.currentPlayer);
    const rotatedCrownHolder = this.getViewPosition(schema.crownHolder);
    const rotatedDealer = this.getViewPosition(schema.dealer);
    const rotatedTrumpDeclarer = schema.trumpDeclarer !== null && schema.trumpDeclarer !== undefined
      ? this.getViewPosition(schema.trumpDeclarer)
      : 0;

    const currentTrick: GameState['currentTrick'] = {
      leadPlayer: this.getViewPosition(schema.currentTrick.leadPlayer),
      cards: this.mapPlayedCards(schema.currentTrick.cards),
      winner: schema.currentTrick.winner !== null ? this.getViewPosition(schema.currentTrick.winner) : null
    };

    const completedTricks: GameState['completedTricks'] = [];
    for (let i = 0; i < schema.completedTricks.length; i++) {
      const trick = schema.completedTricks[i]!;
      completedTricks.push({
        leadPlayer: this.getViewPosition(trick.leadPlayer),
        cards: this.mapPlayedCards(trick.cards),
        winner: trick.winner !== null ? this.getViewPosition(trick.winner) : null
      });
    }

    return {
      deck: [],
      players,
      currentTrick,
      completedTricks,
      trumpSuit: (schema.trumpSuit as Suit | null) ?? null,
      crownHolder: rotatedCrownHolder,
      trumpDeclarer: rotatedTrumpDeclarer,
      dealer: rotatedDealer,
      phase: schema.phase as GameState['phase'],
      scores: [schema.scoreTeam0, schema.scoreTeam1] as [number, number],
      currentPlayer: rotatedCurrentPlayer,
      partnerIndex: (rotatedCurrentPlayer + 2) % 4, // Partner is always 2 positions away
      isDeclaringTeam: schema.isDeclaringTeam,
      tricksWonByTeam: schema.tricksWonByTeam
    };
  }

  private mapHand(hand: any): Card[] {
    const cards: Card[] = [];
    if (!hand) return cards;
    for (const cs of hand as any[]) {
      cards.push({
        suit: cs.suit as Suit,
        rank: cs.rank as any,
        value: cs.value
      });
    }
    return cards;
  }

  private mapPlayedCards(cards: any): { card: Card; player: number }[] {
    const result: { card: Card; player: number }[] = [];
    if (!cards) return result;
    for (const pc of cards as any[]) {
      result.push({
        card: {
          suit: pc.card.suit as Suit,
          rank: pc.card.rank as any,
          value: pc.card.value
        },
        player: this.getViewPosition(pc.player)
      });
    }
    return result;
  }

  setStateChangeCallback(callback: OnlineGameCallback): void {
    this.onStateChange = callback;
  }

  getGameState(): GameState | null {
    if (!this.serverState) return null;
    return this.mapSchemaToGameState(this.serverState);
  }

  getGameView(): GameView {
    return this.gameView;
  }

  getUserPlayerIndex(): number {
    return this.userServerPlayerIndex;
  }

  getConnectionState(): ConnectionState {
    return this.clientWrapper.state;
  }

  getRoomId(): string | null {
    return this.clientWrapper.roomId;
  }

  pause(): void {
    this.isRunning = false;
  }

  resume(): void {
    this.isRunning = true;
  }

  stop(): void {
    this.isRunning = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clientWrapper.disconnect();
    this.gameView.destroy();
  }

  private createEmptyGameState(): GameState {
    return {
      deck: [],
      players: [0, 1, 2, 3].map(i => ({
        id: i,
        hand: [],
        team: (i % 2 === 0 ? 0 : 1) as 0 | 1,
        isBot: true
      })),
      currentTrick: { leadPlayer: 0, cards: [], winner: null },
      completedTricks: [],
      trumpSuit: null,
      crownHolder: 0,
      trumpDeclarer: null,
      dealer: 0,
      phase: 'DEALING_INITIAL',
      scores: [0, 0],
      currentPlayer: 0,
      partnerIndex: 2,
      isDeclaringTeam: false,
      tricksWonByTeam: 0
    };
  }

  // --- Waiting Room Methods ---

  setUsername(username: string): void {
    this.currentUsername = username;
  }

  async createWaitingRoom(serverUrl: string = DEFAULT_SERVER_URL): Promise<{ roomId: string; roomCode: string }> {
    await this.clientWrapper.connect(serverUrl);
    console.log('Creating room with username:', this.currentUsername || 'Player');
    const roomId = await this.clientWrapper.createRoom('crown', {
      username: this.currentUsername || 'Player'
    });
    console.log('createRoom returned, roomId:', roomId);
    this.isRunning = true;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('Timeout waiting for room state, serverState:', this.serverState);
        reject(new Error('Timed out waiting for room state'));
      }, 10000);

      const checkState = () => {
        const code = this.serverState?.roomCode;
        console.log('Polling for roomCode, got:', code, 'at', new Date().toISOString());
        if (code && code.length > 0) {
          clearTimeout(timeout);
          resolve({ roomId, roomCode: code });
        } else {
          setTimeout(checkState, 100);
        }
      };
      setTimeout(checkState, 100);
    });
  }

  async joinWaitingRoom(roomId: string, serverUrl: string = DEFAULT_SERVER_URL): Promise<{
    roomId: string;
    roomCode: string;
    isAdmin: boolean;
    playerCount: number;
    players: Array<{ playerIndex: number; username: string; sessionId: string; isBot: boolean; isAdmin: boolean; team: 0 | 1 }>;
  }> {
    await this.clientWrapper.connect(serverUrl);
    await this.clientWrapper.joinRoom(roomId, 'crown', {
      username: this.currentUsername || 'Player'
    });
    this.isRunning = true;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for room state'));
      }, 10000);

      const checkState = () => {
        const state = this.serverState;
        if (state && state.roomCode && state.roomCode.length > 0) {
          clearTimeout(timeout);
          const players = this.extractPlayers(state);
          resolve({
            roomId,
            roomCode: state.roomCode,
            isAdmin: this.clientWrapper.sessionId === state.adminSessionId,
            playerCount: players.length,
            players
          });
        } else {
          setTimeout(checkState, 100);
        }
      };
      setTimeout(checkState, 100);
    });
  }

  private extractPlayers(state: any): Array<{ playerIndex: number; username: string; sessionId: string; isBot: boolean; isAdmin: boolean; team: 0 | 1 }> {
    const players: Array<any> = [];
    const playerMap = state.players as unknown as Map<string, any>;
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
  }

  shuffleTeams(): void {
    this.clientWrapper.sendShuffleTeams();
  }

  addBot(): void {
    this.clientWrapper.sendAddBot();
  }

  startGame(): void {
    this.clientWrapper.sendStartGame();
  }

  onWaitingRoomStateChange(callback: (state: any) => void): void {
    this.waitingRoomCallbacks.push(callback);
  }

  setOnGameStarted(callback: (data: { roomId: string; roomCode: string }) => void): void {
    this.onGameStarted = callback;
  }

  isConnectedToRoom(roomId: string): boolean {
    return this.clientWrapper.roomId === roomId && 
           this.clientWrapper.state === 'connected';
  }
}
