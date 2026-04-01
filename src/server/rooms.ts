// Contract Crown Room
// Authoritative multiplayer game room with Colyseus

import { Room, Client } from 'colyseus';
import {
  GameStateSchema, PlayerSchema, CardSchema, PlayedCardSchema, TrickSchema
} from './crown-room-state.js';
import {
  dealInitial, dealFinal, declareTrump, canPlayCard, playCard,
  updateCrown, rotateDeal, calculateScore,
  isGameComplete, createInitialState, setFirstTrickLeader
} from '../engine/index.js';
import type { GameState, Card, Suit } from '../engine/types.js';
import { BotManager } from '../bot/bot-manager.js';
import { roomCodeGenerator } from './room-code-generator.js';

const MAX_PLAYERS = 4;
const RECONNECT_TIMEOUT_MS = 60_000;
const ROOM_EXPIRY_MS = 3 * 60 * 1000; // 3 minutes
const EXPIRY_CHECK_INTERVAL_MS = 10_000; // Check every 10 seconds

export class CrownRoom extends Room<GameStateSchema> {
  maxClients = MAX_PLAYERS;
  allowReconnectionTime = RECONNECT_TIMEOUT_MS / 1000;

  private gameState!: GameState;
  private botManager!: BotManager;
  private clientToPlayer = new Map<string, number>();
  private playerToClient = new Map<number, string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private botTurnTimer: ReturnType<typeof setTimeout> | null = null;
  private expiryCheckTimer: ReturnType<typeof setInterval> | null = null;
  private roomCode: string = '';

  // --- Lifecycle ---

  onCreate(options: any) {
    this.gameState = createInitialState();
    this.gameState.dealer = options.dealer ?? 0;
    this.botManager = new BotManager();

    // Generate room code
    this.roomCode = roomCodeGenerator.generate(new Set());
    roomCodeGenerator.register(this.roomCode, this.roomId);

    const now = Date.now();
    const schema = new GameStateSchema();
    schema.phase = 'WAITING_FOR_PLAYERS';
    schema.dealer = this.gameState.dealer;
    schema.roomCode = this.roomCode;
    schema.roomCreatedAt = now;
    schema.roomExpiryAt = now + ROOM_EXPIRY_MS;
    schema.adminSessionId = ''; // Set when first player joins
    this.setState(schema);

    // Set room metadata for matchMaker query
    this.setMetadata({
      roomCode: this.roomCode,
      phase: 'WAITING_FOR_PLAYERS'
    });

    // Start expiry check timer
    this.expiryCheckTimer = setInterval(() => {
      this.checkRoomExpiry();
    }, EXPIRY_CHECK_INTERVAL_MS);

    this.onMessage('declare_trump', (client: Client, message: any) => {
      this.handleDeclareTrump(client, message);
    });

    this.onMessage('play_card', (client: Client, message: any) => {
      this.handlePlayCard(client, message);
    });

    this.onMessage('ready', (_client: Client, _message: any) => {
      // Client acknowledges state sync — no action needed
    });

    this.onMessage('shuffle_teams', (client: Client, _message: any) => {
      this.handleShuffleTeams(client);
    });

    this.onMessage('add_bot', (client: Client, _message: any) => {
      this.handleAddBot(client);
    });

    this.onMessage('start_game', (client: Client, _message: any) => {
      this.handleStartGame(client);
    });
  }

  onDispose() {
    this.cancelReconnectTimer();
    this.cancelBotTurnTimer();
    if (this.expiryCheckTimer) {
      clearInterval(this.expiryCheckTimer);
      this.expiryCheckTimer = null;
    }
    roomCodeGenerator.removeCode(this.roomCode);
  }

  // --- Expiry Check ---

  private checkRoomExpiry(): void {
    if (this.state.phase !== 'WAITING_FOR_PLAYERS') return;

    const now = Date.now();
    const remaining = this.state.roomExpiryAt - now;

    if (remaining <= 0) {
      this.disconnect();
      return;
    }

    // Broadcast warnings
    if (remaining <= 10000 && remaining > 9000) {
      this.broadcast('room_expiry_warning', { remaining: 10 });
    } else if (remaining <= 30000 && remaining > 29000) {
      this.broadcast('room_expiry_warning', { remaining: 30 });
    } else if (remaining <= 60000 && remaining > 59000) {
      this.broadcast('room_expiry_warning', { remaining: 60 });
    }
  }

  async onJoin(client: Client, _options: any) {
    // Check for reconnection by sessionId
    const prevIndex = this.findReconnectingPlayer(client);
    if (prevIndex !== -1) {
      this.gameState.players[prevIndex].isBot = false;
      const ps = this.state.players.get(String(prevIndex));
      if (ps) {
        ps.isBot = false;
        ps.disconnected = false;
      }
      this.clientToPlayer.set(client.sessionId, prevIndex);
      this.playerToClient.set(prevIndex, client.sessionId);
      this.cancelReconnectTimer();
      this.syncState();
      this.maybeTriggerBotTurn();
      return;
    }

    // Find first empty player slot
    let playerIndex = -1;
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!this.playerToClient.has(i)) {
        playerIndex = i;
        break;
      }
    }
    if (playerIndex === -1) {
      client.leave(4001, 'Room is full');
      return;
    }

    // Register client
    this.clientToPlayer.set(client.sessionId, playerIndex);
    this.playerToClient.set(playerIndex, client.sessionId);

    // Set admin on first player join
    if (this.clientToPlayer.size === 1) {
      this.state.adminSessionId = client.sessionId;
    }

    // Create player in schema
    const ps = new PlayerSchema();
    ps.id = playerIndex;
    ps.team = playerIndex % 2 === 0 ? 0 : 1;
    ps.isBot = false;
    ps.sessionId = client.sessionId;
    ps.disconnected = false;
    this.state.players.set(String(playerIndex), ps);

    this.syncState();

    // Update room metadata
    this.setMetadata({
      roomCode: this.roomCode,
      phase: this.state.phase,
      adminSessionId: this.state.adminSessionId,
      roomExpiryAt: this.state.roomExpiryAt
    });
  }

  async onLeave(client: Client, consented: boolean) {
    const playerIndex = this.clientToPlayer.get(client.sessionId);
    if (playerIndex === undefined) return;

    this.clientToPlayer.delete(client.sessionId);

    if (!consented) {
      // Unexpected disconnect — start reconnection timer
      this.state.disconnectedPlayerIndex = playerIndex;
      this.state.disconnectedAt = Date.now();
      const ps = this.state.players.get(String(playerIndex));
      if (ps) ps.disconnected = true;
      this.syncState();

      this.broadcast('player_disconnected', { playerIndex });

      this.reconnectTimer = setTimeout(() => {
        this.replaceWithBot(playerIndex);
      }, RECONNECT_TIMEOUT_MS);
    } else {
      this.playerToClient.delete(playerIndex);
    }

    // If room is empty, dispose
    if (this.clientToPlayer.size === 0 && this.reconnectTimer === null) {
      this.disconnect();
    }
  }

  // --- Message Handlers ---

  private handleDeclareTrump(client: Client, message: any) {
    const playerIndex = this.clientToPlayer.get(client.sessionId);
    if (playerIndex === undefined) return;

    // Validate: must be crown holder
    if (playerIndex !== this.gameState.crownHolder) {
      client.send('error', { message: 'Only the crown holder can declare trump' });
      return;
    }
    // Validate: must be in TRUMP_DECLARATION phase
    if (this.gameState.phase !== 'TRUMP_DECLARATION') {
      client.send('error', { message: 'Trump can only be declared during trump declaration phase' });
      return;
    }

    try {
      declareTrump(this.gameState, message.suit as Suit);
      dealFinal(this.gameState);
      setFirstTrickLeader(this.gameState);
      this.gameState.phase = 'TRICK_PLAY';
      this.syncState();
      this.maybeTriggerBotTurn();
    } catch (err: any) {
      client.send('error', { message: err.message });
    }
  }

  private handlePlayCard(client: Client, message: any) {
    const playerIndex = this.clientToPlayer.get(client.sessionId);
    if (playerIndex === undefined) return;

    const card = message.card as Card;

    // Validate: must be player's turn
    if (this.gameState.currentPlayer !== playerIndex) {
      client.send('error', { message: 'Not your turn' });
      return;
    }
    // Validate: must be in TRICK_PLAY phase
    if (this.gameState.phase !== 'TRICK_PLAY') {
      client.send('error', { message: 'Cards can only be played during trick play' });
      return;
    }
    // Validate: card must be in hand
    const player = this.gameState.players[playerIndex];
    if (!player.hand.some(c => c.suit === card.suit && c.rank === card.rank)) {
      client.send('error', { message: 'Card not in hand' });
      return;
    }
    // Validate: card must be legal
    if (!canPlayCard(this.gameState, playerIndex, card)) {
      client.send('error', { message: 'Card cannot be played' });
      return;
    }

    try {
      playCard(this.gameState, playerIndex, card);

      // Record trick result for bot memory if a trick just completed
      if (this.gameState.currentTrick.cards.length === 0 && this.gameState.completedTricks.length > 0) {
        const lastTrick = this.gameState.completedTricks[this.gameState.completedTricks.length - 1];
        if (lastTrick.winner !== null) {
          const players = this.gameState.players.map(p => ({ id: p.id, team: p.team }));
          this.botManager.recordTrickResult(lastTrick, lastTrick.winner, players);
        }
      }

      // Capture phase after mutation (playCard can change it)
      const currentPhase = this.gameState.phase as string;

      // If round ended, process round end
      if (currentPhase === 'ROUND_END') {
        this.processRoundEnd();
      }

      this.syncState();

      // If game ended, persist and schedule disconnect
      if ((this.gameState.phase as string) === 'GAME_END') {
        this.persistGameResult();
        setTimeout(() => this.disconnect(), 5000);
        return;
      }

      // Trigger bot turn if needed
      this.maybeTriggerBotTurn();
    } catch (err: any) {
      client.send('error', { message: err.message });
    }
  }

  // --- Game Flow ---

  private startGame() {
    if (this.clientToPlayer.size < 2) return;

    // Fill empty slots with bots
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!this.playerToClient.has(i)) {
        this.addBotToSlot(i);
      }
    }

    dealInitial(this.gameState);
    this.syncState();
  }

  // --- Waiting Room Handlers ---

  private isAdmin(client: Client): boolean {
    return client.sessionId === this.state.adminSessionId;
  }

  private handleShuffleTeams(client: Client): void {
    if (!this.isAdmin(client)) {
      client.send('error', { message: 'Only the admin can shuffle teams' });
      return;
    }
    if (this.state.phase !== 'WAITING_FOR_PLAYERS') {
      client.send('error', { message: 'Can only shuffle teams in waiting room' });
      return;
    }

    // Get all human players
    const humanPlayers: number[] = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const ps = this.state.players.get(String(i));
      if (ps && !ps.isBot) {
        humanPlayers.push(i);
      }
    }

    if (humanPlayers.length < 2) {
      client.send('error', { message: 'Need at least 2 players to shuffle' });
      return;
    }

    // Fisher-Yates shuffle
    const shuffled = [...humanPlayers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Assign teams: even indices -> Team 0, odd -> Team 1
    for (let i = 0; i < shuffled.length; i++) {
      const playerIdx = shuffled[i];
      const newTeam = i % 2 === 0 ? 0 : 1;
      const ps = this.state.players.get(String(playerIdx));
      if (ps) {
        ps.team = newTeam;
      }
      if (this.gameState.players[playerIdx]) {
        this.gameState.players[playerIdx].team = newTeam as 0 | 1;
      }
    }

    this.syncState();
  }

  private handleAddBot(client: Client): void {
    if (!this.isAdmin(client)) {
      client.send('error', { message: 'Only the admin can add bots' });
      return;
    }
    if (this.state.phase !== 'WAITING_FOR_PLAYERS') {
      client.send('error', { message: 'Can only add bots in waiting room' });
      return;
    }

    // Find next empty slot
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!this.playerToClient.has(i)) {
        this.addBotToSlot(i);
        this.syncState();
        return;
      }
    }

    client.send('error', { message: 'Room is full' });
  }

  private handleStartGame(client: Client): void {
    if (!this.isAdmin(client)) {
      client.send('error', { message: 'Only the admin can start the game' });
      return;
    }
    if (this.state.phase !== 'WAITING_FOR_PLAYERS') {
      client.send('error', { message: 'Game already started' });
      return;
    }
    if (this.clientToPlayer.size < 1) {
      client.send('error', { message: 'Need at least 1 player to start' });
      return;
    }

    this.startGame();
  }

  private addBotToSlot(slotIndex: number): void {
    const ps = new PlayerSchema();
    ps.id = slotIndex;
    ps.team = slotIndex % 2 === 0 ? 0 : 1;
    ps.isBot = true;
    ps.sessionId = `bot-${slotIndex}`;
    ps.disconnected = false;
    this.state.players.set(String(slotIndex), ps);

    if (this.gameState.players[slotIndex]) {
      this.gameState.players[slotIndex].isBot = true;
    }

    this.playerToClient.set(slotIndex, `bot-${slotIndex}`);
  }

  // --- Room Metadata for Listing ---

  getRoomMetadata(): { roomCode: string; playerCount: number; adminSessionId: string; phase: string } {
    return {
      roomCode: this.state.roomCode,
      playerCount: this.clientToPlayer.size,
      adminSessionId: this.state.adminSessionId,
      phase: this.state.phase
    };
  }

  private processRoundEnd() {
    calculateScore(this.gameState);
    updateCrown(this.gameState);
    rotateDeal(this.gameState);

    if (isGameComplete(this.gameState)) {
      this.gameState.phase = 'GAME_END';
      this.state.phase = 'GAME_END';
      this.state.scoreTeam0 = this.gameState.scores[0];
      this.state.scoreTeam1 = this.gameState.scores[1];
      return;
    }

    // Reset bot memories for new round
    this.botManager.resetMemories();

    // Reset for new round
    this.gameState.completedTricks = [];
    this.gameState.currentTrick = { leadPlayer: 0, cards: [], winner: null };
    this.gameState.trumpSuit = null;
    this.gameState.phase = 'DEALING_INITIAL';
    this.state.roundNumber = (this.state.roundNumber || 0) + 1;

    dealInitial(this.gameState);
    this.syncState();
  }

  private maybeTriggerBotTurn() {
    this.cancelBotTurnTimer();
    if (this.gameState.phase !== 'TRICK_PLAY') return;

    const currentPlayerIdx = this.gameState.currentPlayer;
    const currentPlayer = this.gameState.players[currentPlayerIdx];
    if (currentPlayer && currentPlayer.isBot) {
      this.botTurnTimer = setTimeout(() => {
        this.executeBotTurn(currentPlayerIdx);
      }, this.botManager.getDecisionDelay());
    }
  }

  private executeBotTurn(playerIndex: number) {
    try {
      const card = this.botManager.selectCard(this.gameState, playerIndex);
      playCard(this.gameState, playerIndex, card);

      // Record trick result for bot memory if a trick just completed
      if (this.gameState.currentTrick.cards.length === 0 && this.gameState.completedTricks.length > 0) {
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

      if ((this.gameState.phase as string) === 'GAME_END') {
        this.persistGameResult();
        setTimeout(() => this.disconnect(), 5000);
        return;
      }

      this.maybeTriggerBotTurn();
    } catch (_err) {
      // Bot error — skip turn (should not happen with valid state)
    }
  }

  // --- Reconnection ---

  private findReconnectingPlayer(client: Client): number {
    for (const [playerIndex, sessionId] of this.playerToClient) {
      if (sessionId === client.sessionId) {
        return playerIndex;
      }
    }
    return -1;
  }

  private cancelReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.state.disconnectedPlayerIndex = -1;
    this.state.disconnectedAt = 0;
  }

  private replaceWithBot(playerIndex: number) {
    this.cancelReconnectTimer();
    const ps = this.state.players.get(String(playerIndex));
    if (ps) {
      ps.isBot = true;
      ps.disconnected = false;
    }
    if (this.gameState.players[playerIndex]) {
      this.gameState.players[playerIndex].isBot = true;
    }
    this.playerToClient.delete(playerIndex);
    this.syncState();

    this.broadcast('player_replaced_by_bot', { playerIndex });

    // If it's the bot's turn, trigger it
    if (this.gameState.currentPlayer === playerIndex && this.gameState.phase === 'TRICK_PLAY') {
      this.maybeTriggerBotTurn();
    }
  }

  // --- State Sync ---

  private syncState() {
    const gs = this.gameState;
    const s = this.state;

    s.phase = gs.phase;
    s.currentPlayer = gs.currentPlayer;
    s.crownHolder = gs.crownHolder;
    s.dealer = gs.dealer;
    s.trumpDeclarer = gs.trumpDeclarer;
    s.trumpSuit = gs.trumpSuit;
    s.scoreTeam0 = gs.scores[0];
    s.scoreTeam1 = gs.scores[1];
    s.partnerIndex = gs.partnerIndex;
    s.isDeclaringTeam = gs.isDeclaringTeam;
    s.tricksWonByTeam = gs.tricksWonByTeam;

    // Current trick
    s.currentTrick.leadPlayer = gs.currentTrick.leadPlayer;
    s.currentTrick.winner = gs.currentTrick.winner;
    s.currentTrick.cards.clear();
    for (const pc of gs.currentTrick.cards) {
      const pcs = new PlayedCardSchema();
      pcs.card = this.toCardSchema(pc.card);
      pcs.player = pc.player;
      s.currentTrick.cards.push(pcs);
    }

    // Completed tricks
    s.completedTricks.clear();
    for (const trick of gs.completedTricks) {
      const ts = new TrickSchema();
      ts.leadPlayer = trick.leadPlayer;
      ts.winner = trick.winner;
      for (const pc of trick.cards) {
        const pcs = new PlayedCardSchema();
        pcs.card = this.toCardSchema(pc.card);
        pcs.player = pc.player;
        ts.cards.push(pcs);
      }
      s.completedTricks.push(ts);
    }

    // Players
    for (let i = 0; i < gs.players.length; i++) {
      const p = gs.players[i];
      let ps = s.players.get(String(i));
      if (!ps) {
        ps = new PlayerSchema();
        ps.id = i;
        ps.team = p.team;
        ps.isBot = p.isBot;
        ps.sessionId = this.playerToClient.get(i) ?? '';
        s.players.set(String(i), ps);
      }
      ps.id = p.id;
      ps.team = p.team;
      ps.isBot = p.isBot;
      ps.sessionId = this.playerToClient.get(i) ?? ps.sessionId;
      ps.hand.clear();
      for (const card of p.hand) {
        ps.hand.push(this.toCardSchema(card));
      }
    }
  }

  private toCardSchema(card: Card): CardSchema {
    const cs = new CardSchema();
    cs.suit = card.suit;
    cs.rank = card.rank;
    cs.value = card.value;
    return cs;
  }

  // --- Persistence ---

  private persistGameResult() {
    import('./database.js').then(({ database }) => {
      const gameId = `game-${Date.now()}`;
      const playerIds: string[] = [];
      for (let i = 0; i < MAX_PLAYERS; i++) {
        const ps = this.state.players.get(String(i));
        if (ps) playerIds.push(ps.sessionId);
      }
      database.saveGame({
        gameId,
        players: playerIds,
        winner: (this.gameState.scores[0] >= this.gameState.scores[1] ? 0 : 1) as 0 | 1,
        finalScores: [this.gameState.scores[0], this.gameState.scores[1]],
        rounds: this.gameState.completedTricks.length / 8,
        completedAt: Date.now()
      });
    }).catch(() => {
      // Ignore persistence errors
    });
  }

  private cancelBotTurnTimer() {
    if (this.botTurnTimer) {
      clearTimeout(this.botTurnTimer);
      this.botTurnTimer = null;
    }
  }
}
