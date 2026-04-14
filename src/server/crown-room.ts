// Contract Crown PartyKit Room
// Authoritative multiplayer game room using PartyKit Durable Objects

import * as Party from 'partykit/server';
import {
  dealInitial, dealFinal, declareTrump, canPlayCard, playCard,
  updateCrown, rotateDeal, calculateScore,
  isGameComplete, createInitialState, setFirstTrickLeader
} from '../engine/index.js';
import type { GameState, Card, Suit } from '../engine/types.js';
import { BotManager } from '../bot/bot-manager.js';
import { roomCodeGenerator } from './room-code-generator.js';
import { roomRegistry } from './room-registry.js';

const MAX_PLAYERS = 4;
const RECONNECT_TIMEOUT_MS = 60_000;
const ROOM_EXPIRY_MS = 3 * 60 * 1000; // 3 minutes
const EXPIRY_CHECK_INTERVAL_MS = 10_000;

interface PlayerState {
  id: number;
  username: string;
  team: 0 | 1;
  isBot: boolean;
  sessionId: string;
  disconnected: boolean;
}

interface ConnectionState {
  sessionId: string;
  username: string;
  playerIndex: number;
  connectedAt: number;
}

export interface ServerSerializedState {
  phase: string;
  currentPlayer: number;
  crownHolder: number;
  dealer: number;
  trumpDeclarer: number | null;
  trumpSuit: string | null;
  scoreTeam0: number;
  scoreTeam1: number;
  partnerIndex: number;
  isDeclaringTeam: boolean;
  tricksWonByTeam: number;
  roundNumber: number;
  roomCode: string;
  adminSessionId: string;
  roomExpiryAt: number;
  roomCreatedAt: number;
  currentTrick: {
    leadPlayer: number;
    cards: { card: Card; player: number }[];
    winner: number | null;
  };
  completedTricks: {
    leadPlayer: number;
    cards: { card: Card; player: number }[];
    winner: number | null;
  }[];
  players: Record<string, {
    id: number;
    username: string;
    hand: Card[];
    team: 0 | 1;
    isBot: boolean;
    sessionId: string;
    disconnected: boolean;
  }>;
  disconnectedAt: number;
  disconnectedPlayerIndex: number;
}

export default class CrownRoom implements Party.Server {
  // Game state
  private gameState!: GameState;
  private botManager!: BotManager;

  // Connection tracking
  private connectionToState = new Map<string, ConnectionState>(); // sessionId -> ConnectionState
  private playerToConnection = new Map<number, string>();

  // Player states (replaces Colyseus schema Map)
  private players: PlayerState[] = [];

  // Timers
  private reconnectTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private botTurnTimer: ReturnType<typeof setTimeout> | null = null;
  private expiryCheckTimer: ReturnType<typeof setTimeout> | null = null;

  // Room metadata
  private roomCode = '';
  private adminSessionId = '';
  private roomCreatedAt = 0;
  private roomExpiryAt = 0;
  private disconnectedPlayerIndex = -1;
  private disconnectedAt = 0;
  private roundNumber = 0;
  private initialized = false;

  constructor(readonly room: Party.Room) {}

  // ============================================================
  // Lifecycle Methods
  // ============================================================

  async onStart() {
    console.log('[CrownRoom] onStart: Party server started/woke from hibernation');
  }

  async onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    console.log('[CrownRoom] =========================================');
    console.log('[CrownRoom] onConnect START, connectionId:', connection.id);
    console.log('[CrownRoom] Current connections:', this.connectionToState.size);
    console.log('[CrownRoom] =========================================');

    const params = new URLSearchParams(new URL(ctx.request.url).search);
    const username = params.get('username') || `Player ${this.connectionToState.size + 1}`;
    const reconnectSessionId = params.get('reconnectSessionId') || '';
    // Use PartyKit connection.id as sessionId
    const clientSessionId = connection.id;

    // Initialize room on first connection
    if (!this.initialized) {
      this.initializeRoom(ctx.request.url);
    }

    // Check for reconnection
    if (reconnectSessionId) {
      const reconnected = this.tryReconnect(connection, reconnectSessionId, username, clientSessionId);
      if (reconnected) return;
    }

    // Reject if already registered
    if (this.connectionToState.has(clientSessionId)) {
      console.log('[CrownRoom] Duplicate connect detected, ignoring');
      return;
    }

    // Find or create player slot
    const playerIndex = this.findOrCreatePlayerSlot();
    if (playerIndex === -1) {
      console.log('[CrownRoom] Room is full, rejecting connection');
      connection.close(4001, 'Room is full');
      return;
    }

    // Register connection
    const connState: ConnectionState = { sessionId: clientSessionId, username, playerIndex, connectedAt: Date.now() };
    this.connectionToState.set(clientSessionId, connState);
    this.playerToConnection.set(playerIndex, clientSessionId);

    // Set admin on first player join
    if (this.connectionToState.size === 1) {
      this.adminSessionId = clientSessionId;
    }

    // Send sessionId back to the client so it can identify itself
    this.sendTo(clientSessionId, 'connected', { sessionId: clientSessionId, playerIndex });

    // Update player state
    const playerState = this.players[playerIndex];
    playerState.isBot = false;
    playerState.disconnected = false;
    playerState.sessionId = clientSessionId;
    playerState.username = username;

    // Sync engine state
    if (this.gameState.players[playerIndex]) {
      this.gameState.players[playerIndex].isBot = false;
    }

    console.log('[CrownRoom] Player added, index:', playerIndex, 'username:', username);

    // Delay syncState slightly to ensure connection is fully registered
    setTimeout(() => {
      this.syncState();
    }, 50);

    // Update registry
    roomRegistry.updatePlayerCount(this.room.roomId, this.connectionToState.size);
    roomRegistry.updateAdminSessionId(this.room.roomId, this.adminSessionId);
    if (this.connectionToState.size === 1) {
      roomRegistry.updateAdminUsername(this.room.roomId, username);
    }
  }

  async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    if (typeof message !== 'string') return;

    let parsed: { type: string; data: any };
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    const sessionId = sender.id;
    const connState = this.connectionToState.get(sessionId);
    if (!connState) return;

    switch (parsed.type) {
      case 'declare_trump':
        // Client sends {"type":"declare_trump","suit":"hearts"}
        this.handleDeclareTrump(sender, connState, { suit: parsed.suit });
        break;
      case 'play_card':
        // Client sends {"type":"play_card","card":{...}}
        this.handlePlayCard(sender, connState, { card: parsed.card });
        break;
      case 'ready':
        break;
      case 'shuffle_teams':
        this.handleShuffleTeams(sender, connState);
        break;
      case 'add_bot':
        this.handleAddBot(sender, connState);
        break;
      case 'start_game':
        this.handleStartGame(sender, connState);
        break;
    }
  }

  async onClose(connection: Party.Connection) {
    const sessionId = connection.id;
    const connState = this.connectionToState.get(sessionId);
    if (!connState) return;

    const { playerIndex } = connState;
    this.connectionToState.delete(sessionId);

    roomRegistry.updatePlayerCount(this.room.roomId, this.connectionToState.size);

    const playerState = this.players[playerIndex];
    if (playerState && !playerState.disconnected && this.gameState.phase !== 'WAITING_FOR_PLAYERS') {
      // Unexpected disconnect - start reconnection timer
      playerState.disconnected = true;
      this.disconnectedPlayerIndex = playerIndex;
      this.disconnectedAt = Date.now();
      this.syncState();

      this.broadcast('player_disconnected', { playerIndex });

      const timer = setTimeout(() => {
        this.replaceWithBot(playerIndex);
      }, RECONNECT_TIMEOUT_MS);
      this.reconnectTimers.set(playerIndex, timer);
    } else {
      // Clean disconnect
      this.playerToConnection.delete(playerIndex);
    }

    // If room is empty and no reconnection timers, dispose
    if (this.connectionToState.size === 0 && this.reconnectTimers.size === 0) {
      this.disconnect();
    }
  }

  async onError(connection: Party.Connection, error: Error) {
    console.error('[CrownRoom] Connection error:', error);
  }

  // ============================================================
  // Room Initialization
  // ============================================================

  private initializeRoom(requestUrl: string) {
    // Use the PartyKit room ID from the URL path (/parties/crown/{roomId})
    // this.room.id is set by PartyKit from the URL
    const partyKitRoomId = this.room.id;
    console.log('[CrownRoom] Initializing room, this.room.id:', partyKitRoomId, 'URL:', requestUrl);

    this.gameState = createInitialState();
    this.gameState.dealer = 0;
    this.gameState.phase = 'WAITING_FOR_PLAYERS';
    this.botManager = new BotManager();

    // Use the PartyKit room ID as the room code
    this.roomCode = partyKitRoomId || 'UNKNOWN';
    console.log('[CrownRoom] Using roomCode:', this.roomCode);
    roomCodeGenerator.register(this.roomCode, partyKitRoomId);

    this.roomCreatedAt = Date.now();
    this.roomExpiryAt = this.roomCreatedAt + ROOM_EXPIRY_MS;

    // Registry entry already created by HTTP API — update it instead of duplicating
    roomRegistry.updatePhase(this.room.roomId, 'WAITING_FOR_PLAYERS');

    // Initialize player states
    this.players = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      this.players[i] = {
        id: i,
        username: `Player ${i + 1}`,
        team: (i % 2) as 0 | 1,
        isBot: true,
        sessionId: '',
        disconnected: false
      };
    }

    this.startExpiryCheck();
    this.initialized = true;
    console.log('[CrownRoom] Room initialized, roomCode:', this.roomCode);
  }

  // ============================================================
  // Reconnection
  // ============================================================

  private tryReconnect(connection: Party.Connection, reconnectSessionId: string, username: string, newSessionId: string): boolean {
    // Find disconnected player with matching old sessionId
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const playerState = this.players[i];
      if (playerState.disconnected && this.reconnectTimers.has(i) && playerState.sessionId === reconnectSessionId) {
        console.log('[CrownRoom] Reconnecting player, index:', i);
        this.gameState.players[i].isBot = false;
        playerState.isBot = false;
        playerState.disconnected = false;

        const connState: ConnectionState = {
          sessionId: newSessionId,
          username: playerState.username,
          playerIndex: i,
          connectedAt: Date.now()
        };
        this.connectionToState.set(newSessionId, connState);
        this.playerToConnection.set(i, newSessionId);

        this.cancelReconnectTimer(i);
        this.syncState();
        this.maybeTriggerBotTurn();
        return true;
      }
    }
    return false;
  }

  private cancelReconnectTimer(playerIndex: number) {
    const timer = this.reconnectTimers.get(playerIndex);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(playerIndex);
    }
    this.disconnectedPlayerIndex = -1;
    this.disconnectedAt = 0;
  }

  private replaceWithBot(playerIndex: number) {
    this.cancelReconnectTimer(playerIndex);
    const playerState = this.players[playerIndex];
    if (playerState) {
      playerState.isBot = true;
      playerState.disconnected = false;
    }
    if (this.gameState.players[playerIndex]) {
      this.gameState.players[playerIndex].isBot = true;
    }
    this.playerToConnection.delete(playerIndex);
    this.syncState();

    this.broadcast('player_replaced_by_bot', { playerIndex });

    if (this.gameState.currentPlayer === playerIndex && this.gameState.phase === 'TRICK_PLAY') {
      this.maybeTriggerBotTurn();
    }
  }

  // ============================================================
  // Message Handlers
  // ============================================================

  private handleDeclareTrump(connection: Party.Connection, connState: ConnectionState, data: any) {
    const playerIndex = connState.playerIndex;

    if (playerIndex !== this.gameState.crownHolder) {
      this.sendTo(connection.id, 'error', { message: 'Only the crown holder can declare trump' });
      return;
    }
    if (this.gameState.phase !== 'TRUMP_DECLARATION') {
      this.sendTo(connection.id, 'error', { message: 'Trump can only be declared during trump declaration phase' });
      return;
    }

    try {
      console.log('[CrownRoom] handleDeclareTrump: player', playerIndex, 'declaring', data.suit);
      declareTrump(this.gameState, data.suit as Suit);
      dealFinal(this.gameState);
      setFirstTrickLeader(this.gameState);
      this.gameState.phase = 'TRICK_PLAY';
      console.log('[CrownRoom] Phase changed: TRUMP_DECLARATION -> TRICK_PLAY');
      this.syncState();

      this.maybeTriggerBotTurn();
      this.maybeTriggerBotTrumpDeclaration();
    } catch (err: any) {
      this.sendTo(connection.id, 'error', { message: err.message });
    }
  }

  private handlePlayCard(connection: Party.Connection, connState: ConnectionState, data: any) {
    const playerIndex = connState.playerIndex;
    const card = data.card as Card;

    if (this.gameState.currentPlayer !== playerIndex) {
      this.sendTo(connection.id, 'error', { message: 'Not your turn' });
      return;
    }
    if (this.gameState.phase !== 'TRICK_PLAY') {
      this.sendTo(connection.id, 'error', { message: 'Cards can only be played during trick play' });
      return;
    }
    const player = this.gameState.players[playerIndex];
    if (!player.hand.some(c => c.suit === card.suit && c.rank === card.rank)) {
      this.sendTo(connection.id, 'error', { message: 'Card not in hand' });
      return;
    }
    if (!canPlayCard(this.gameState, playerIndex, card)) {
      this.sendTo(connection.id, 'error', { message: 'Card cannot be played' });
      return;
    }

    try {
      console.log('[CrownRoom] handlePlayCard: player', playerIndex, 'playing', card.suit, card.rank);
      playCard(this.gameState, playerIndex, card);

      if (this.gameState.completedTricks.length > 0) {
        const lastTrick = this.gameState.completedTricks[this.gameState.completedTricks.length - 1];
        if (lastTrick.winner !== null) {
          const players = this.gameState.players.map(p => ({ id: p.id, team: p.team }));
          this.botManager.recordTrickResult(lastTrick, lastTrick.winner, players);
        }
      }

      const currentPhase = this.gameState.phase as string;
      if (currentPhase === 'ROUND_END') {
        this.processRoundEnd();
        this.maybeTriggerBotTrumpDeclaration();
      }

      this.syncState();

      if (currentPhase === 'GAME_END') {
        setTimeout(() => this.disconnect(), 5000);
        return;
      }

      this.maybeTriggerBotTurn();
    } catch (err: any) {
      this.sendTo(connection.id, 'error', { message: err.message });
    }
  }

  // ============================================================
  // Waiting Room Handlers
  // ============================================================

  private isAdmin(connState: ConnectionState): boolean {
    return connState.sessionId === this.adminSessionId;
  }

  private handleShuffleTeams(connection: Party.Connection, connState: ConnectionState) {
    if (!this.isAdmin(connState)) {
      this.sendTo(connection.id, 'error', { message: 'Only the admin can shuffle teams' });
      return;
    }
    if (this.gameState.phase !== 'WAITING_FOR_PLAYERS' && this.gameState.phase !== 'DEALING_INITIAL') {
      this.sendTo(connection.id, 'error', { message: 'Can only shuffle teams before game starts' });
      return;
    }

    const allSlots: number[] = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (this.players[i]) allSlots.push(i);
    }

    if (allSlots.length < 2) {
      this.sendTo(connection.id, 'error', { message: 'Need at least 2 players to shuffle' });
      return;
    }

    const shuffled = [...allSlots];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (let i = 0; i < shuffled.length; i++) {
      const originalSlot = shuffled[i];
      const newTeam = i % 2 === 0 ? 0 : 1;
      this.players[originalSlot].team = newTeam;
      if (this.gameState.players[originalSlot]) {
        this.gameState.players[originalSlot].team = newTeam as 0 | 1;
      }
    }

    console.log('[CrownRoom] Shuffled all', allSlots.length, 'players');
    this.syncState();
  }

  private handleAddBot(connection: Party.Connection, connState: ConnectionState) {
    console.log('[CrownRoom] handleAddBot called by:', connState.username);
    if (!this.isAdmin(connState)) {
      this.sendTo(connection.id, 'error', { message: 'Only the admin can add bots' });
      return;
    }
    if (this.gameState.phase !== 'WAITING_FOR_PLAYERS' && this.gameState.phase !== 'DEALING_INITIAL') {
      this.sendTo(connection.id, 'error', { message: 'Can only add bots before game starts' });
      return;
    }

    let botsAdded = 0;
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!this.playerToConnection.has(i)) {
        this.addBotToSlot(i);
        botsAdded++;
      }
    }

    if (botsAdded > 0) {
      console.log('[CrownRoom] Added', botsAdded, 'bot(s), total players:', this.players.filter(p => p.sessionId).length);
      this.syncState();
    } else {
      this.sendTo(connection.id, 'error', { message: 'Room is full' });
    }
  }

  private handleStartGame(connection: Party.Connection, connState: ConnectionState) {
    console.log('[CrownRoom] handleStartGame called by:', connState.username, 'playerIndex:', connState.playerIndex);
    if (!this.isAdmin(connState)) {
      console.log('[CrownRoom] handleStartGame: not admin, rejecting');
      this.sendTo(connection.id, 'error', { message: 'Only the admin can start the game' });
      return;
    }
    if (this.gameState.phase !== 'WAITING_FOR_PLAYERS' && this.gameState.phase !== 'DEALING_INITIAL') {
      console.log('[CrownRoom] handleStartGame: wrong phase:', this.gameState.phase);
      this.sendTo(connection.id, 'error', { message: 'Game already started' });
      return;
    }

    const humanCount = this.connectionToState.size;
    const botCount = this.countBots();
    const totalPlayers = humanCount + botCount;
    console.log('[CrownRoom] handleStartGame: humans=', humanCount, 'bots=', botCount, 'total=', totalPlayers);

    if (totalPlayers < 2) {
      this.sendTo(connection.id, 'error', { message: 'Need at least 2 players to start' });
      return;
    }

    // Fill remaining slots with bots
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!this.playerToConnection.has(i)) {
        this.addBotToSlot(i);
      }
    }

    // Select random trump declarer
    const allPlayers = this.players.filter((_, i) => this.playerToConnection.has(i) || this.players[i]?.isBot);
    const randomPlayer = allPlayers[Math.floor(Math.random() * allPlayers.length)];

    console.log('[CrownRoom] handleStartGame: starting game, roomCode:', this.roomCode);
    this.startGame();

    // Use roomCode as both roomId and roomCode since they're the same in PartyKit
    this.broadcast('game_started', { roomId: this.roomCode, roomCode: this.roomCode });

    this.roomExpiryAt = Date.now() + 24 * 60 * 60 * 1000;
    console.log('[CrownRoom] Extended room expiry to 24 hours');
    roomRegistry.updatePhase(this.room.roomId, this.gameState.phase);
  }

  // ============================================================
  // Game Flow
  // ============================================================

  private ensureEnginePlayers(): void {
    if (this.gameState.players.length === 0) {
      this.gameState.players = [];
      for (let i = 0; i < MAX_PLAYERS; i++) {
        const ps = this.players[i];
        this.gameState.players[i] = {
          id: ps.id,
          hand: [],
          team: ps.team,
          isBot: ps.isBot
        };
      }
      this.gameState.crownHolder = (this.gameState.dealer + 1) % 4;
    }
  }

  private startGame() {
    console.log('[CrownRoom] startGame called, connections:', this.connectionToState.size);
    if (this.connectionToState.size < 2) return;

    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!this.playerToConnection.has(i)) {
        this.addBotToSlot(i);
      }
    }

    this.ensureEnginePlayers();
    dealInitial(this.gameState);
    console.log('[CrownRoom] Game starting, phase:', this.gameState.phase);
    this.syncState();

    this.maybeTriggerBotTrumpDeclaration();
  }

  private maybeTriggerBotTrumpDeclaration(): void {
    if (this.gameState.phase !== 'TRUMP_DECLARATION') return;

    const crownHolder = this.gameState.crownHolder;
    const crownHolderPlayer = this.gameState.players[crownHolder];

    if (!crownHolderPlayer?.isBot) return;

    console.log('[CrownRoom] Bot auto-declaring trump');
    const selectedSuit = this.botManager.selectTrumpSuit(crownHolderPlayer.hand);
    declareTrump(this.gameState, selectedSuit);
    dealFinal(this.gameState);
    setFirstTrickLeader(this.gameState);
    this.gameState.phase = 'TRICK_PLAY';
    this.syncState();

    this.maybeTriggerBotTurn();
  }

  private processRoundEnd() {
    console.log('[CrownRoom] processRoundEnd called');
    calculateScore(this.gameState);
    updateCrown(this.gameState);
    rotateDeal(this.gameState);

    if (isGameComplete(this.gameState)) {
      this.gameState.phase = 'GAME_END';
      console.log('[CrownRoom] GAME_END! Team0:', this.gameState.scores[0], 'Team1:', this.gameState.scores[1]);
      return;
    }

    this.botManager.resetMemories();

    this.gameState.completedTricks = [];
    this.gameState.currentTrick = { leadPlayer: 0, cards: [], winner: null };
    this.gameState.trumpSuit = null;
    this.gameState.phase = 'DEALING_INITIAL';
    this.roundNumber++;

    dealInitial(this.gameState);
    console.log('[CrownRoom] New round, roundNumber:', this.roundNumber);
    this.syncState();
  }

  // ============================================================
  // Bot Management
  // ============================================================

  private addBotToSlot(slotIndex: number): void {
    const botNames = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'];

    const playerState = this.players[slotIndex];
    playerState.username = botNames[slotIndex] || `Bot ${slotIndex}`;
    playerState.isBot = true;
    playerState.disconnected = false;
    playerState.sessionId = `bot-${slotIndex}`;

    if (this.gameState.players[slotIndex]) {
      this.gameState.players[slotIndex].isBot = true;
    }

    this.playerToConnection.set(slotIndex, `bot-${slotIndex}`);
  }

  private maybeTriggerBotTurn() {
    this.cancelBotTurnTimer();
    if (this.gameState.phase !== 'TRICK_PLAY') return;

    const currentPlayerIdx = this.gameState.currentPlayer;
    const currentPlayer = this.gameState.players[currentPlayerIdx];
    if (currentPlayer?.isBot) {
      this.botTurnTimer = setTimeout(() => {
        this.executeBotTurn(currentPlayerIdx);
      }, this.botManager.getDecisionDelay());
    }
  }

  private executeBotTurn(playerIndex: number) {
    try {
      const card = this.botManager.selectCard(this.gameState, playerIndex);
      playCard(this.gameState, playerIndex, card);

      if (this.gameState.completedTricks.length > 0) {
        const lastTrick = this.gameState.completedTricks[this.gameState.completedTricks.length - 1];
        if (lastTrick.winner !== null) {
          const players = this.gameState.players.map(p => ({ id: p.id, team: p.team }));
          this.botManager.recordTrickResult(lastTrick, lastTrick.winner, players);
        }
      }

      const currentPhase = this.gameState.phase as string;
      if (currentPhase === 'ROUND_END') {
        this.processRoundEnd();
      }

      this.syncState();

      if (currentPhase === 'GAME_END') {
        setTimeout(() => this.disconnect(), 5000);
        return;
      }

      this.maybeTriggerBotTurn();
    } catch (err) {
      console.log('[CrownRoom] executeBotTurn error:', err);
    }
  }

  private cancelBotTurnTimer() {
    if (this.botTurnTimer) {
      clearTimeout(this.botTurnTimer);
      this.botTurnTimer = null;
    }
  }

  // ============================================================
  // State Serialization & Broadcast
  // ============================================================

  private syncState() {
    const gs = this.gameState;
    const playerSummary = this.players.map((p, i) => `${i}:${p.username}(bot=${p.isBot},sid=${p.sessionId ? p.sessionId.substring(0, 8) : 'none'})`).join(', ');
    console.log('[CrownRoom] syncState: phase=', gs.phase, 'roomCode=', this.roomCode, 'players=[', playerSummary, ']');

    const serialized: ServerSerializedState = {
      phase: gs.phase,
      currentPlayer: gs.currentPlayer,
      crownHolder: gs.crownHolder,
      dealer: gs.dealer,
      trumpDeclarer: gs.trumpDeclarer,
      trumpSuit: gs.trumpSuit,
      scoreTeam0: gs.scores[0],
      scoreTeam1: gs.scores[1],
      partnerIndex: gs.partnerIndex,
      isDeclaringTeam: gs.isDeclaringTeam,
      tricksWonByTeam: gs.tricksWonByTeam,
      roundNumber: this.roundNumber,
      roomCode: this.roomCode,
      adminSessionId: this.adminSessionId,
      roomExpiryAt: this.roomExpiryAt,
      roomCreatedAt: this.roomCreatedAt,
      currentTrick: {
        leadPlayer: gs.currentTrick.leadPlayer,
        cards: gs.currentTrick.cards.map(pc => ({ card: pc.card, player: pc.player })),
        winner: gs.currentTrick.winner
      },
      completedTricks: gs.completedTricks.map(trick => ({
        leadPlayer: trick.leadPlayer,
        cards: trick.cards.map(pc => ({ card: pc.card, player: pc.player })),
        winner: trick.winner
      })),
      players: Object.fromEntries(
        this.players.map(ps => [String(ps.id), {
          id: ps.id,
          username: ps.username,
          hand: gs.players[ps.id]?.hand || [],
          team: ps.team,
          isBot: ps.isBot,
          sessionId: ps.sessionId,
          disconnected: ps.disconnected
        }])
      ),
      disconnectedAt: this.disconnectedAt,
      disconnectedPlayerIndex: this.disconnectedPlayerIndex
    };

    this.broadcast('state', serialized);
  }

  // ============================================================
  // Utility
  // ============================================================

  private findOrCreatePlayerSlot(): number {
    // In waiting room phase, assign slots sequentially
    if (this.gameState.phase === 'WAITING_FOR_PLAYERS') {
      for (let i = 0; i < MAX_PLAYERS; i++) {
        if (!this.playerToConnection.has(i)) {
          return i;
        }
      }
      return -1;
    }

    // During game, find bot slots to replace (never replace slot 0 if it's admin)
    const botSlots: number[] = [];
    for (let i = 1; i < MAX_PLAYERS; i++) {
      if (this.players[i]?.isBot && !this.playerToConnection.has(i)) {
        botSlots.push(i);
      }
    }

    if (botSlots.length > 0) {
      return botSlots[Math.floor(Math.random() * botSlots.length)];
    }

    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!this.playerToConnection.has(i)) {
        return i;
      }
    }

    return -1;
  }

  private countBots(): number {
    let count = 0;
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (this.players[i]?.isBot && this.playerToConnection.has(i)) {
        count++;
      }
    }
    return count;
  }

  private broadcast(type: string, data: any) {
    const msg = JSON.stringify({ type, data });
    // Iterate over tracked connections since room.getConnections() may not work in dev
    for (const [sessionId] of this.connectionToState) {
      try {
        const conn = this.room.getConnection(sessionId);
        if (conn) {
          conn.send(msg);
        }
      } catch (e) {
        // Connection may have been closed
      }
    }
    // Also try room.broadcast as fallback
    try {
      this.room.broadcast(msg);
    } catch (e) {
      // broadcast may not be available
    }
  }

  private sendTo(connectionId: string, type: string, data: any) {
    const conn = this.room.getConnection(connectionId);
    if (conn) {
      conn.send(JSON.stringify({ type, data }));
    }
  }

  private disconnect() {
    console.log('[CrownRoom] Disconnecting all clients...');
    // PartyKit doesn't have room.close(). Broadcast a disconnect message
    // then let connections naturally close. The room will auto-dispose.
    try {
      this.room.broadcast(JSON.stringify({ type: 'room_closed' }));
    } catch (e) {
      // broadcast may fail
    }
    // Clear timers to prevent further processing
    if (this.expiryCheckTimer) {
      clearTimeout(this.expiryCheckTimer);
      this.expiryCheckTimer = null;
    }
    if (this.botTurnTimer) {
      clearTimeout(this.botTurnTimer);
      this.botTurnTimer = null;
    }
  }

  private startExpiryCheck() {
    const check = () => {
      this.checkRoomExpiry();
      this.expiryCheckTimer = setTimeout(check, EXPIRY_CHECK_INTERVAL_MS);
    };
    this.expiryCheckTimer = setTimeout(check, EXPIRY_CHECK_INTERVAL_MS);
  }

  private checkRoomExpiry(): void {
    if (this.gameState.phase !== 'WAITING_FOR_PLAYERS') return;

    const now = Date.now();
    const remaining = this.roomExpiryAt - now;

    if (remaining <= 0) {
      console.log('[CrownRoom] ROOM EXPIRED');
      this.disconnect();
      return;
    }

    if (remaining <= 10000 && remaining > 9000) {
      this.broadcast('room_expiry_warning', { remaining: 10 });
    } else if (remaining <= 30000 && remaining > 29000) {
      this.broadcast('room_expiry_warning', { remaining: 30 });
    } else if (remaining <= 60000 && remaining > 59000) {
      this.broadcast('room_expiry_warning', { remaining: 60 });
    }
  }
}
