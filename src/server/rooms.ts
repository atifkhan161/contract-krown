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
import { roomRegistry } from './room-registry.js';

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
    console.log('[CrownRoom] onCreate called, roomId:', this.roomId, 'options:', JSON.stringify(options));
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
    console.log('[CrownRoom] setState called, roomCode:', this.roomCode, 'phase:', schema.phase);

    // Set room metadata for matchMaker query
    this.setMetadata({
      roomCode: this.roomCode,
      phase: 'WAITING_FOR_PLAYERS'
    });

    // Register in room registry for listing API
    roomRegistry.register({
      roomId: this.roomId,
      roomCode: this.roomCode,
      adminUsername: '', // Set when first player joins
      playerCount: 0,
      maxPlayers: MAX_PLAYERS,
      adminSessionId: '',
      phase: 'WAITING_FOR_PLAYERS',
      createdAt: now
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
    roomRegistry.remove(this.roomId);
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

  async onJoin(client: Client, options: any) {
    console.log('[CrownRoom] onJoin, sessionId:', client.sessionId, 'options:', JSON.stringify(options));

    // Check for reconnection by sessionId
    const prevIndex = this.findReconnectingPlayer(client);
    if (prevIndex !== -1) {
      console.log('[CrownRoom] Reconnecting player, index:', prevIndex);
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

    // Check if there's a bot slot to replace (never replace admin slot 0)
    let playerIndex = -1;
    const botSlots: number[] = [];
    for (const [, ps] of this.state.players) {
      if (ps.isBot && ps.id !== 0) {
        botSlots.push(ps.id);
      }
    }

    // If bot slots exist, replace a random one; otherwise find first empty slot
    if (botSlots.length > 0) {
      playerIndex = botSlots[Math.floor(Math.random() * botSlots.length)];
      console.log('[CrownRoom] Replacing bot at slot:', playerIndex, 'with new human player');
      this.state.players.delete(String(playerIndex));
      this.playerToClient.delete(playerIndex);
    } else {
      // Find first empty player slot
      for (let i = 0; i < MAX_PLAYERS; i++) {
        if (!this.playerToClient.has(i)) {
          playerIndex = i;
          break;
        }
      }
    }

    if (playerIndex === -1) {
      console.log('[CrownRoom] Room is full, rejecting client');
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
    ps.username = options.username || `Player ${playerIndex + 1}`;
    ps.team = playerIndex % 2 === 0 ? 0 : 1;
    ps.isBot = false;
    ps.sessionId = client.sessionId;
    ps.disconnected = false;
    this.state.players.set(String(playerIndex), ps);

    console.log('[CrownRoom] Player added, index:', playerIndex, 'username:', ps.username, 'sessionId:', client.sessionId);
    console.log('[CrownRoom] Current state.phase:', this.state.phase, 'roomCode:', this.state.roomCode);
    console.log('[CrownRoom] Players in state:', Array.from(this.state.players.entries()));

    this.syncState();

    // Update room metadata
    this.setMetadata({
      roomCode: this.roomCode,
      phase: this.state.phase,
      adminSessionId: this.state.adminSessionId,
      roomExpiryAt: this.state.roomExpiryAt
    });

    // Update room registry with current player count and admin info
    roomRegistry.updatePlayerCount(this.roomId, this.clientToPlayer.size);
    roomRegistry.updateAdminSessionId(this.roomId, this.state.adminSessionId);
    if (this.clientToPlayer.size === 1) {
      roomRegistry.updateAdminUsername(this.roomId, ps.username);
    }
  }

  async onLeave(client: Client, code?: number) {
    const playerIndex = this.clientToPlayer.get(client.sessionId);
    if (playerIndex === undefined) return;

    this.clientToPlayer.delete(client.sessionId);

    // Update room registry with new player count
    roomRegistry.updatePlayerCount(this.roomId, this.clientToPlayer.size);

    if (code !== undefined) {
      // Unexpected disconnect (code is defined) — start reconnection timer
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
    this.state.phase = this.gameState.phase;
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

    // Allow in waiting or dealing phases
    if (this.state.phase !== 'WAITING_FOR_PLAYERS' && this.state.phase !== 'DEALING_INITIAL') {
      client.send('error', { message: 'Can only shuffle teams before game starts' });
      return;
    }

    // Get ALL players (humans + bots)
    const allSlots: number[] = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (this.state.players.has(String(i))) {
        allSlots.push(i);
      }
    }

    if (allSlots.length < 2) {
      client.send('error', { message: 'Need at least 2 players to shuffle' });
      return;
    }

    // Fisher-Yates shuffle all positions
    const shuffled = [...allSlots];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Assign teams based on new position: even -> Team 0, odd -> Team 1
    for (let i = 0; i < shuffled.length; i++) {
      const originalSlot = shuffled[i];
      const newTeam = i % 2 === 0 ? 0 : 1;
      
      const ps = this.state.players.get(String(originalSlot));
      if (ps) {
        ps.team = newTeam;
      }
      if (this.gameState.players[originalSlot]) {
        this.gameState.players[originalSlot].team = newTeam as 0 | 1;
      }
    }

    console.log('[CrownRoom] Shuffled all', allSlots.length, 'players');
    this.syncState();
  }

  private handleAddBot(client: Client): void {
    const isAdmin = client.sessionId === this.state.adminSessionId;
    console.log('[CrownRoom] handleAddBot, client.sessionId:', client.sessionId, 'adminSessionId:', this.state.adminSessionId, 'isAdmin:', isAdmin, 'phase:', this.state.phase);
    
    if (!isAdmin) {
      client.send('error', { message: 'Only the admin can add bots' });
      return;
    }

    // Allow adding bots in both waiting and dealing phases
    if (this.state.phase !== 'WAITING_FOR_PLAYERS' && this.state.phase !== 'DEALING_INITIAL') {
      client.send('error', { message: 'Can only add bots before game starts' });
      return;
    }

    // Fill ALL empty slots with bots (not just one)
    let botsAdded = 0;
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!this.state.players.has(String(i))) {
        this.addBotToSlot(i);
        botsAdded++;
      }
    }
    
    if (botsAdded > 0) {
      console.log('[CrownRoom] Added', botsAdded, 'bot(s) to empty slots');
      this.syncState();
    } else {
      client.send('error', { message: 'Room is full' });
    }
  }

  private handleStartGame(client: Client): void {
    if (!this.isAdmin(client)) {
      client.send('error', { message: 'Only the admin can start the game' });
      return;
    }

    // Allow starting in both waiting and dealing phases
    if (this.state.phase !== 'WAITING_FOR_PLAYERS' && this.state.phase !== 'DEALING_INITIAL') {
      client.send('error', { message: 'Game already started' });
      return;
    }

    // Count total players (humans + bots) in state
    const totalPlayers = this.state.players.size;
    if (totalPlayers < 1) {
      client.send('error', { message: 'Need at least 1 player to start' });
      return;
    }

    // Fill remaining slots with bots if needed
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!this.state.players.has(String(i))) {
        this.addBotToSlot(i);
      }
    }

    // Select random trump declarer from all players
    const playerIndices = Array.from(this.state.players.keys());
    const randomIndex = playerIndices[Math.floor(Math.random() * playerIndices.length)];
    const randomPlayer = this.state.players.get(randomIndex);
    this.state.trumpDeclarer = randomPlayer ? randomPlayer.id : 0;
    console.log('[CrownRoom] Trump declarer selected:', this.state.trumpDeclarer, 'player:', randomPlayer?.username);

    this.startGame();

    // Broadcast game_started to all clients so they all redirect
    this.broadcast('game_started', { roomId: this.roomId, roomCode: this.roomCode });

    // Update registry phase so room no longer appears in available listing
    roomRegistry.updatePhase(this.roomId, this.state.phase);
  }

  private addBotToSlot(slotIndex: number): void {
    const botNames = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'];
    
    const ps = new PlayerSchema();
    ps.id = slotIndex;
    ps.username = botNames[slotIndex] || `Bot ${slotIndex}`;
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
