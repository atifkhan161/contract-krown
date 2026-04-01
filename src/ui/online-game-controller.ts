// Contract Crown Online Game Controller
// Manages online multiplayer game flow via Colyseus server

import type { GameState, Card, Suit } from '../engine/types.js';
import { ColyseusClientWrapper, ConnectionState } from './colyseus-client-wrapper.js';
import { GameView } from './game-view.js';
import { HapticController } from './haptic-controller.js';
import { canPlayCard } from '../engine/index.js';

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
  private userPlayerIndex: number = 0;
  private serverState: any = null;
  private onStateChange: OnlineGameCallback | null = null;
  private isRunning: boolean = false;
  private previousTrickCount: number = 0;
  private previousPhase: string = 'WAITING_FOR_PLAYERS';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: OnlineGameConfig = {}) {
    this.userPlayerIndex = config.userPlayerIndex ?? 0;
    this.gameView = new GameView();
    this.hapticController = new HapticController();

    this.clientWrapper = new ColyseusClientWrapper({
      onStateChange: (state) => this.handleStateChange(state),
      onError: (code, message) => this.handleError(code, message),
      onLeave: (code) => this.handleLeave(code)
    });

    this.setupEventHandlers();
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
    this.serverState = schema;
    const gameState = this.mapSchemaToGameState(schema);
    this.detectStateTransitions(gameState);
    this.gameView.update(gameState);

    if (this.onStateChange) {
      this.onStateChange(gameState);
    }
  }

  private detectStateTransitions(gameState: GameState): void {
    const currentPhase = gameState.phase;
    const currentTrickCount = gameState.completedTricks.length;

    if (this.previousPhase === 'TRUMP_DECLARATION' && currentPhase === 'TRICK_PLAY') {
      this.hapticController.triggerTrumpDeclared();
    }

    if (currentTrickCount > this.previousTrickCount && currentTrickCount <= 8) {
      const lastTrick = gameState.completedTricks[currentTrickCount - 1];
      if (lastTrick.winner === this.userPlayerIndex) {
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
    if (this.serverState.currentPlayer !== this.userPlayerIndex) return;

    const gameState = this.mapSchemaToGameState(this.serverState);
    if (!canPlayCard(gameState, this.userPlayerIndex, card)) {
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
    if (this.serverState.crownHolder !== this.userPlayerIndex) return;

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

    for (let i = 0; i < 4; i++) {
      const ps = playerMap.get(String(i));
      if (ps) {
        players.push({
          id: ps.id,
          hand: this.mapHand(ps.hand),
          team: ps.team as 0 | 1,
          isBot: ps.isBot
        });
      } else {
        players.push({
          id: i,
          hand: [],
          team: (i % 2 === 0 ? 0 : 1) as 0 | 1,
          isBot: true
        });
      }
    }

    const currentTrick: GameState['currentTrick'] = {
      leadPlayer: schema.currentTrick.leadPlayer,
      cards: this.mapPlayedCards(schema.currentTrick.cards),
      winner: schema.currentTrick.winner
    };

    const completedTricks: GameState['completedTricks'] = [];
    for (let i = 0; i < schema.completedTricks.length; i++) {
      const trick = schema.completedTricks[i]!;
      completedTricks.push({
        leadPlayer: trick.leadPlayer,
        cards: this.mapPlayedCards(trick.cards),
        winner: trick.winner
      });
    }

    return {
      deck: [],
      players,
      currentTrick,
      completedTricks,
      trumpSuit: (schema.trumpSuit as Suit | null) ?? null,
      crownHolder: schema.crownHolder,
      trumpDeclarer: schema.trumpDeclarer,
      dealer: schema.dealer,
      phase: schema.phase as GameState['phase'],
      scores: [schema.scoreTeam0, schema.scoreTeam1] as [number, number],
      currentPlayer: schema.currentPlayer,
      partnerIndex: schema.partnerIndex,
      isDeclaringTeam: schema.isDeclaringTeam,
      tricksWonByTeam: schema.tricksWonByTeam
    };
  }

  private mapHand(hand: any): Card[] {
    const cards: Card[] = [];
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
    for (const pc of cards as any[]) {
      result.push({
        card: {
          suit: pc.card.suit as Suit,
          rank: pc.card.rank as any,
          value: pc.card.value
        },
        player: pc.player
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
    return this.userPlayerIndex;
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

  async createWaitingRoom(serverUrl: string = DEFAULT_SERVER_URL): Promise<{ roomId: string; roomCode: string }> {
    await this.clientWrapper.connect(serverUrl);
    const roomId = await this.clientWrapper.createRoom('crown');
    this.isRunning = true;

    return new Promise((resolve) => {
      const checkState = () => {
        if (this.serverState && this.serverState.roomCode) {
          resolve({ roomId, roomCode: this.serverState.roomCode });
        } else {
          setTimeout(checkState, 100);
        }
      };
      setTimeout(checkState, 200);
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
    await this.clientWrapper.joinRoom(roomId);
    this.isRunning = true;

    return new Promise((resolve) => {
      const checkState = () => {
        if (this.serverState) {
          const players: Array<any> = [];
          const playerMap = this.serverState.players as unknown as Map<string, any>;
          for (let i = 0; i < 4; i++) {
            const ps = playerMap.get(String(i));
            if (ps && !ps.isBot) {
              players.push({
                playerIndex: ps.id,
                username: `Player ${ps.id + 1}`,
                sessionId: ps.sessionId,
                isBot: ps.isBot,
                isAdmin: ps.sessionId === this.serverState.adminSessionId,
                team: ps.team as 0 | 1
              });
            }
          }

          resolve({
            roomId,
            roomCode: this.serverState.roomCode || roomId.substring(0, 4).toUpperCase(),
            isAdmin: this.clientWrapper.sessionId === this.serverState.adminSessionId,
            playerCount: players.length,
            players
          });
        } else {
          setTimeout(checkState, 100);
        }
      };
      setTimeout(checkState, 200);
    });
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
    const originalCallback = this.onStateChange;
    this.onStateChange = (gameState) => {
      if (originalCallback) originalCallback(gameState);
      callback(this.serverState);
    };
  }
}
