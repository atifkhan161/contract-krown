// Contract Crown PartyKit Server
// Migration from Colyseus to PartyKit

import type * as Party from "partykit/server";
import {
  dealInitial, dealFinal, declareTrump, canPlayCard, playCard,
  updateCrown, rotateDeal, calculateScore,
  isGameComplete, createInitialState, setFirstTrickLeader
} from "../src/engine/index.js";
import type { GameState, Card, Suit, GamePhase } from "../src/engine/types.js";
import { BotManager } from "../src/bot/bot-manager.js";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_URL_DEV || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY_DEV || 'your-anon-key-here';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MAX_PLAYERS = 4;
const RECONNECT_TIMEOUT_MS = 60_000;
const ROOM_EXPIRY_MS = 3 * 60 * 1000;
const EXPIRY_CHECK_INTERVAL_MS = 10_000;

interface ExtendedGameState extends GameState {
  roundNumber: number;
  roomExpiryAt: number;
  roomCreatedAt: number;
  disconnectedAt: number;
  disconnectedPlayerIndex: number;
}

interface PlayerState {
  id: number;
  username: string;
  hand: Card[];
  team: number;
  isBot: boolean;
  disconnected: boolean;
  sessionId: string;
}

interface GameStateJSON {
  phase: GamePhase | 'WAITING_FOR_PLAYERS';
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
  players: Record<number, PlayerState>;
  disconnectedAt: number;
  disconnectedPlayerIndex: number;
}

export default class CrownServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  private gameState!: GameState;
  private botManager!: BotManager;
  private clientToPlayer = new Map<string, number>();
  private playerToClient = new Map<number, string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private botTurnTimer: ReturnType<typeof setTimeout> | null = null;
  private expiryCheckTimer: ReturnType<typeof setInterval> | null = null;
  private roomCode: string = '';
  private adminSessionId: string = '';
  private reconnectTokens = new Map<string, string>();

  async onStart() {
    console.log('[CrownServer] onStart, roomId:', this.room.id);

    const savedState = await this.room.storage.get<GameStateJSON>("gameState");
    if (savedState) {
      console.log('[CrownServer] Restoring state from storage');
      this.restoreState(savedState);
    }

    this.startExpiryCheck();
  }

  async onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    console.log('[CrownServer] =========================================');
    console.log('[CrownServer] onConnect START, connectionId:', connection.id);
    console.log('[CrownServer] roomId:', this.room.id);
    console.log('[CrownServer] =========================================');

    const url = new URL(ctx.request.url);
    const username = url.searchParams.get('username') || `Player ${Date.now() % 1000}`;

    const prevIndex = this.findReconnectingPlayer(connection.id);
    if (prevIndex !== -1) {
      console.log('[CrownServer] Reconnecting player, index:', prevIndex);
      this.gameState.players[prevIndex].isBot = false;
      this.clientToPlayer.set(connection.id, prevIndex);
      this.playerToClient.set(prevIndex, connection.id);
      this.cancelReconnectTimer();
      this.syncState();
      this.maybeTriggerBotTurn();
      return;
    }

    const existingIndex = this.clientToPlayer.get(connection.id);
    if (existingIndex !== undefined) {
      console.log('[CrownServer] Duplicate connection, ignoring');
      return;
    }

    let playerIndex = -1;
    const botSlots: number[] = [];
    const state = this.getState();
    for (const [, ps] of Object.entries(state.players)) {
      if (ps.isBot && ps.id !== 0) {
        botSlots.push(ps.id);
      }
    }

    if (botSlots.length > 0) {
      playerIndex = botSlots[Math.floor(Math.random() * botSlots.length)];
      delete state.players[playerIndex];
      this.playerToClient.delete(playerIndex);
    } else {
      for (let i = 0; i < MAX_PLAYERS; i++) {
        if (!this.playerToClient.has(i)) {
          playerIndex = i;
          break;
        }
      }
    }

    if (playerIndex === -1) {
      console.log('[CrownServer] Room is full, rejecting');
      connection.close(4001, 'Room is full');
      return;
    }

    this.clientToPlayer.set(connection.id, playerIndex);
    this.playerToClient.set(playerIndex, connection.id);

    if (this.clientToPlayer.size === 1) {
      this.adminSessionId = connection.id;
      state.adminSessionId = connection.id;
    }

    state.players[playerIndex] = {
      id: playerIndex,
      username,
      hand: [],
      team: playerIndex % 2 === 0 ? 0 : 1,
      isBot: false,
      disconnected: false,
      sessionId: connection.id
    };

    if (this.gameState.players[playerIndex]) {
      this.gameState.players[playerIndex].isBot = false;
    }

    console.log('[CrownServer] Player added, index:', playerIndex, 'username:', username);

    this.syncState();
    this.persistState();

    connection.send(JSON.stringify({
      type: 'welcome',
      playerIndex,
      sessionId: connection.id
    }));
  }

  async onMessage(message: string, sender: Party.Connection) {
    console.log('[CrownServer] onMessage:', message.substring(0, 100));

    try {
      const data = JSON.parse(message);

      switch (data.type || data.action) {
        case 'declare_trump':
          this.handleDeclareTrump(sender, data.suit);
          break;
        case 'play_card':
          this.handlePlayCard(sender, data.card);
          break;
        case 'ready':
          break;
        case 'shuffle_teams':
          this.handleShuffleTeams(sender);
          break;
        case 'add_bot':
          this.handleAddBot(sender);
          break;
        case 'start_game':
          this.handleStartGame(sender);
          break;
        default:
          console.log('[CrownServer] Unknown message type:', data.type || data.action);
      }
    } catch (err) {
      console.error('[CrownServer] Error handling message:', err);
    }
  }

  async onClose(connection: Party.Connection) {
    console.log('[CrownServer] onClose, connectionId:', connection.id);

    const playerIndex = this.clientToPlayer.get(connection.id);
    if (playerIndex === undefined) return;

    this.clientToPlayer.delete(connection.id);

    const state = this.getState();
    if (state.players[playerIndex]) {
      state.players[playerIndex].disconnected = true;
    }

    this.room.broadcast(JSON.stringify({
      type: 'player_disconnected',
      playerIndex
    }));

    this.reconnectTimer = setTimeout(() => {
      this.replaceWithBot(playerIndex);
    }, RECONNECT_TIMEOUT_MS);

        if (this.clientToPlayer.size === 0 && this.reconnectTimer) {
      // Room will be cleaned up when last connection closes
      // PartyKit handles cleanup automatically
    }

    this.persistState();
  }

  async onRequest(req: Party.Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    console.log('[CrownServer] HTTP request:', req.method, path);

    if (path === '/health') {
      return Response.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        roomId: this.room.id,
        playerCount: this.clientToPlayer.size
      });
    }

    if (path === '/api/rooms') {
      return Response.json(this.getRoomInfo());
    }

    if (path === '/api/rooms/resolve' && req.method === 'POST') {
      const body = (await req.json()) as { code?: string };
      const code = body.code?.toUpperCase();
      if (code === this.roomCode) {
        return Response.json({ roomId: this.room.id });
      }
      return Response.json({ message: 'Room not found' }, { status: 404 });
    }

    // Auth endpoints
    if (path === '/api/auth/register' && req.method === 'POST') {
      const body = (await req.json()) as { email?: string; password?: string; username?: string };
      const { email, password, username } = body || {};
      
      if (!email || !email.trim()) {
        return Response.json({ message: 'Email is required' }, { status: 400 });
      }
      if (!password || password.length < 6) {
        return Response.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
      }
      if (!username || !username.trim()) {
        return Response.json({ message: 'Username is required' }, { status: 400 });
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: username.trim() } }
      });

      if (error) {
        return Response.json({ message: error.message }, { status: 400 });
      }

      return Response.json({
        success: true,
        message: 'Check your email for confirmation link'
      });
    }

    if (path === '/api/auth/login' && req.method === 'POST') {
      const body = (await req.json()) as { email?: string; password?: string };
      const { email, password } = body || {};
      
      if (!email || !email.trim()) {
        return Response.json({ message: 'Email is required' }, { status: 400 });
      }
      if (!password) {
        return Response.json({ message: 'Password is required' }, { status: 400 });
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        return Response.json({ message: error.message }, { status: 401 });
      }

      if (!data.session) {
        return Response.json({ message: 'No session created' }, { status: 500 });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.session.user.id)
        .single();

      return Response.json({
        userId: data.session.user.id,
        email: data.session.user.email,
        username: profile?.username || data.session.user.user_metadata?.username || 'Player',
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at
      });
    }

    if (path === '/api/auth/signout' && req.method === 'POST') {
      await supabase.auth.signOut();
      return Response.json({ success: true });
    }

    if (path === '/api/auth/me' && req.method === 'GET') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return Response.json({ message: 'No token provided' }, { status: 401 });
      }

      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return Response.json({ message: 'Invalid token' }, { status: 401 });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      return Response.json({
        userId: user.id,
        email: user.email,
        username: profile?.username || user.user_metadata?.username || 'Player'
      });
    }

    return new Response('Not found', { status: 404 });
  }

  // ==================== Game Logic ====================

  private handleDeclareTrump(connection: Party.Connection, suit: string) {
    const playerIndex = this.clientToPlayer.get(connection.id);
    if (playerIndex === undefined) return;

    if (playerIndex !== this.gameState.crownHolder) {
      connection.send(JSON.stringify({ type: 'error', message: 'Only the crown holder can declare trump' }));
      return;
    }

    if (this.gameState.phase !== 'TRUMP_DECLARATION') {
      connection.send(JSON.stringify({ type: 'error', message: 'Trump can only be declared during trump declaration phase' }));
      return;
    }

    try {
      console.log('[CrownServer] handleDeclareTrump: player', playerIndex, 'declaring', suit);
      declareTrump(this.gameState, suit as Suit);
      dealFinal(this.gameState);
      setFirstTrickLeader(this.gameState);
      this.gameState.phase = 'TRICK_PLAY';

      this.syncState();
      this.persistState();
      this.maybeTriggerBotTurn();
      this.maybeTriggerBotTrumpDeclaration();
    } catch (err: any) {
      connection.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  }

  private handlePlayCard(connection: Party.Connection, card: Card) {
    const playerIndex = this.clientToPlayer.get(connection.id);
    if (playerIndex === undefined) return;

    if (this.gameState.currentPlayer !== playerIndex) {
      connection.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
      return;
    }

    if (this.gameState.phase !== 'TRICK_PLAY') {
      connection.send(JSON.stringify({ type: 'error', message: 'Cards can only be played during trick play' }));
      return;
    }

    const player = this.gameState.players[playerIndex];
    if (!player.hand.some(c => c.suit === card.suit && c.rank === card.rank)) {
      connection.send(JSON.stringify({ type: 'error', message: 'Card not in hand' }));
      return;
    }

    if (!canPlayCard(this.gameState, playerIndex, card)) {
      connection.send(JSON.stringify({ type: 'error', message: 'Card cannot be played' }));
      return;
    }

    try {
      console.log('[CrownServer] handlePlayCard: player', playerIndex, 'playing', card.suit, card.rank);
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
      this.persistState();

      if (currentPhase === 'GAME_END') {
        console.log('[CrownServer] Game ended! Final scores - Team0:', this.gameState.scores[0], 'Team1:', this.gameState.scores[1]);
        // Room will close when all clients disconnect - no explicit delete needed in PartyKit
        return;
      }

      this.maybeTriggerBotTurn();
    } catch (err: any) {
      connection.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  }

  private handleShuffleTeams(connection: Party.Connection) {
    if (connection.id !== this.adminSessionId) {
      connection.send(JSON.stringify({ type: 'error', message: 'Only the admin can shuffle teams' }));
      return;
    }

    const state = this.getState();
    if (state.phase !== 'WAITING_FOR_PLAYERS' && state.phase !== 'DEALING_INITIAL') {
      connection.send(JSON.stringify({ type: 'error', message: 'Can only shuffle teams before game starts' }));
      return;
    }

    const allSlots = Object.keys(state.players).map(Number);
    if (allSlots.length < 2) {
      connection.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players to shuffle' }));
      return;
    }

    const shuffled = [...allSlots].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length; i++) {
      const originalSlot = shuffled[i];
      const newTeam = i % 2 === 0 ? 0 : 1;
      if (state.players[originalSlot]) {
        state.players[originalSlot].team = newTeam;
      }
      if (this.gameState.players[originalSlot]) {
        this.gameState.players[originalSlot].team = newTeam as 0 | 1;
      }
    }

    console.log('[CrownServer] Shuffled all', allSlots.length, 'players');
    this.syncState();
    this.persistState();
  }

  private handleAddBot(connection: Party.Connection) {
    if (connection.id !== this.adminSessionId) {
      connection.send(JSON.stringify({ type: 'error', message: 'Only the admin can add bots' }));
      return;
    }

    const state = this.getState();
    if (state.phase !== 'WAITING_FOR_PLAYERS' && state.phase !== 'DEALING_INITIAL') {
      connection.send(JSON.stringify({ type: 'error', message: 'Can only add bots before game starts' }));
      return;
    }

    let botsAdded = 0;
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!state.players[i]) {
        this.addBotToSlot(i);
        botsAdded++;
      }
    }

    if (botsAdded > 0) {
      console.log('[CrownServer] Added', botsAdded, 'bot(s)');
      this.syncState();
      this.persistState();
    } else {
      connection.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
    }
  }

  private handleStartGame(connection: Party.Connection) {
    console.log('[CrownServer] handleStartGame called by:', connection.id);

    if (connection.id !== this.adminSessionId) {
      connection.send(JSON.stringify({ type: 'error', message: 'Only the admin can start the game' }));
      return;
    }

    const state = this.getState();
    if (state.phase !== 'WAITING_FOR_PLAYERS' && state.phase !== 'DEALING_INITIAL') {
      connection.send(JSON.stringify({ type: 'error', message: 'Game already started' }));
      return;
    }

    const totalPlayers = Object.keys(state.players).length;
    if (totalPlayers < 2) {
      connection.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players to start' }));
      return;
    }

    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!state.players[i]) {
        this.addBotToSlot(i);
      }
    }

    const playerIndices = Object.keys(state.players).map(Number);
    const randomIndex = playerIndices[Math.floor(Math.random() * playerIndices.length)];
    state.trumpDeclarer = randomIndex;

    this.startGame();

    this.room.broadcast(JSON.stringify({
      type: 'game_started',
      roomId: this.room.id,
      roomCode: this.roomCode
    }));

    state.roomExpiryAt = Date.now() + 24 * 60 * 60 * 1000;
    this.persistState();
  }

  private startGame() {
    console.log('[CrownServer] startGame, client count:', this.clientToPlayer.size);
    if (this.clientToPlayer.size < 2) return;

    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!this.playerToClient.has(i)) {
        this.addBotToSlot(i);
      }
    }

    this.ensureEnginePlayers();

    dealInitial(this.gameState);
    const state = this.getState();
    state.phase = this.gameState.phase;

    console.log('[CrownServer] Game starting, phase:', state.phase);
    this.syncState();
    this.persistState();

    this.maybeTriggerBotTrumpDeclaration();
  }

  private ensureEnginePlayers() {
    if (this.gameState.players.length === 0) {
      this.gameState.players = [];
      const state = this.getState();
      for (let i = 0; i < MAX_PLAYERS; i++) {
        const ps = state.players[i];
        if (ps) {
          this.gameState.players[i] = {
            id: ps.id,
            hand: [],
            team: ps.team as 0 | 1,
            isBot: ps.isBot
          };
        } else {
          this.gameState.players[i] = {
            id: i,
            hand: [],
            team: (i % 2) as 0 | 1,
            isBot: true
          };
        }
      }
      this.gameState.crownHolder = (this.gameState.dealer + 1) % 4;
    }
  }

  private addBotToSlot(slotIndex: number) {
    const botNames = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'];
    const state = this.getState();

    state.players[slotIndex] = {
      id: slotIndex,
      username: botNames[slotIndex] || `Bot ${slotIndex}`,
      hand: [],
      team: slotIndex % 2 === 0 ? 0 : 1,
      isBot: true,
      disconnected: false,
      sessionId: `bot-${slotIndex}`
    };

    if (this.gameState.players[slotIndex]) {
      this.gameState.players[slotIndex].isBot = true;
    }

    this.playerToClient.set(slotIndex, `bot-${slotIndex}`);
  }

  private maybeTriggerBotTrumpDeclaration() {
    if (this.gameState.phase !== 'TRUMP_DECLARATION') return;

    const crownHolder = this.gameState.crownHolder;
    const crownHolderPlayer = this.gameState.players[crownHolder];

    if (!crownHolderPlayer || !crownHolderPlayer.isBot) return;

    console.log('[CrownServer] Crown holder is bot, auto-declaring trump');

    const selectedSuit = this.botManager.selectTrumpSuit(crownHolderPlayer.hand);
    declareTrump(this.gameState, selectedSuit);
    dealFinal(this.gameState);
    setFirstTrickLeader(this.gameState);
    this.gameState.phase = 'TRICK_PLAY';

    const state = this.getState();
    state.phase = 'TRICK_PLAY';

    this.syncState();
    this.persistState();
    this.maybeTriggerBotTurn();
  }

  private processRoundEnd() {
    console.log('[CrownServer] processRoundEnd called');
    calculateScore(this.gameState);
    updateCrown(this.gameState);
    rotateDeal(this.gameState);

    if (isGameComplete(this.gameState)) {
      this.gameState.phase = 'GAME_END';
      const state = this.getState();
      state.phase = 'GAME_END';
      state.scoreTeam0 = this.gameState.scores[0];
      state.scoreTeam1 = this.gameState.scores[1];
      console.log('[CrownServer] GAME_END! Final scores - Team0:', this.gameState.scores[0], 'Team1:', this.gameState.scores[1]);
      return;
    }

    console.log('[CrownServer] Round scores - Team0:', this.gameState.scores[0], 'Team1:', this.gameState.scores[1]);

    this.botManager.resetMemories();

    this.gameState.completedTricks = [];
    this.gameState.currentTrick = { leadPlayer: 0, cards: [], winner: null };
    this.gameState.trumpSuit = null;
    this.gameState.phase = 'DEALING_INITIAL';

    const state = this.getState();
    state.roundNumber = (state.roundNumber || 0) + 1;

    dealInitial(this.gameState);
    console.log('[CrownServer] New round, roundNumber:', state.roundNumber);
    this.syncState();
    this.persistState();
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
      console.log('[CrownServer] executeBotTurn: bot player', playerIndex);
      const card = this.botManager.selectCard(this.gameState, playerIndex);
      console.log('[CrownServer] Bot selected card:', card.suit, card.rank);
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
      this.persistState();

      if (currentPhase === 'GAME_END') {
        // Room will close when all clients disconnect
        return;
      }

      this.maybeTriggerBotTurn();
    } catch (err) {
      console.log('[CrownServer] executeBotTurn error:', err);
    }
  }

  private findReconnectingPlayer(connectionId: string): number {
    for (const [playerIndex, sessionId] of this.playerToClient) {
      if (sessionId === connectionId) {
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
    const state = this.getState();
    state.disconnectedPlayerIndex = -1;
    state.disconnectedAt = 0;
  }

  private replaceWithBot(playerIndex: number) {
    this.cancelReconnectTimer();
    const state = this.getState();
    if (state.players[playerIndex]) {
      state.players[playerIndex].isBot = true;
      state.players[playerIndex].disconnected = false;
    }
    if (this.gameState.players[playerIndex]) {
      this.gameState.players[playerIndex].isBot = true;
    }
    this.playerToClient.delete(playerIndex);

    this.syncState();
    this.persistState();

    this.room.broadcast(JSON.stringify({
      type: 'player_replaced_by_bot',
      playerIndex
    }));

    if (this.gameState.currentPlayer === playerIndex && this.gameState.phase === 'TRICK_PLAY') {
      this.maybeTriggerBotTurn();
    }
  }

  // ==================== State Management ====================

  private getState(): GameStateJSON {
    const gs = this.gameState as ExtendedGameState;
    const state: GameStateJSON = {
      phase: gs.phase as GamePhase,
      currentPlayer: gs.currentPlayer,
      crownHolder: gs.crownHolder,
      dealer: gs.dealer,
      trumpDeclarer: gs.trumpDeclarer,
      trumpSuit: gs.trumpSuit || null,
      scoreTeam0: gs.scores[0],
      scoreTeam1: gs.scores[1],
      partnerIndex: gs.partnerIndex,
      isDeclaringTeam: gs.isDeclaringTeam,
      tricksWonByTeam: gs.tricksWonByTeam,
      roundNumber: gs.roundNumber || 0,
      roomCode: this.roomCode,
      adminSessionId: this.adminSessionId,
      roomExpiryAt: gs.roomExpiryAt || 0,
      roomCreatedAt: gs.roomCreatedAt || Date.now(),
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
      players: {} as Record<number, PlayerState>,
      disconnectedAt: gs.disconnectedAt || 0,
      disconnectedPlayerIndex: gs.disconnectedPlayerIndex ?? -1
    };

    for (let i = 0; i < gs.players.length; i++) {
      const p = gs.players[i];
      state.players[i] = {
        id: p.id,
        username: (this.playerToClient.get(i) || '').startsWith('bot-') 
          ? ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'][i] || `Bot ${i}`
          : state.players[i]?.username || `Player ${i + 1}`,
        hand: p.hand,
        team: p.team,
        isBot: p.isBot,
        disconnected: state.players[i]?.disconnected || false,
        sessionId: this.playerToClient.get(i) || ''
      };
    }

    return state;
  }

  private syncState() {
    const state = this.getState();
    for (let i = 0; i < this.gameState.players.length; i++) {
      const p = this.gameState.players[i];
      state.players[i] = {
        id: p.id,
        username: (this.playerToClient.get(i) || '').startsWith('bot-') 
          ? ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'][i] || `Bot ${i}`
          : state.players[i]?.username || `Player ${i + 1}`,
        hand: p.hand,
        team: p.team,
        isBot: p.isBot,
        disconnected: state.players[i]?.disconnected || false,
        sessionId: this.playerToClient.get(i) || ''
      };
    }

    this.room.broadcast(JSON.stringify({
      type: 'state_update',
      state
    }));
  }

  private async persistState() {
    const state = this.getState();
    await this.room.storage.put("gameState", state);
  }

  private restoreState(saved: GameStateJSON) {
    this.roomCode = saved.roomCode;
    this.adminSessionId = saved.adminSessionId;
    this.gameState = createInitialState();
    const gs = this.gameState as ExtendedGameState;
    gs.phase = saved.phase as GamePhase;
    gs.currentPlayer = saved.currentPlayer;
    gs.crownHolder = saved.crownHolder;
    gs.dealer = saved.dealer;
    gs.trumpDeclarer = saved.trumpDeclarer;
    gs.trumpSuit = saved.trumpSuit as Suit;
    gs.scores = [saved.scoreTeam0, saved.scoreTeam1];
    gs.partnerIndex = saved.partnerIndex;
    gs.isDeclaringTeam = saved.isDeclaringTeam;
    gs.tricksWonByTeam = saved.tricksWonByTeam;
    gs.roundNumber = saved.roundNumber;
    gs.roomExpiryAt = saved.roomExpiryAt;
    gs.roomCreatedAt = saved.roomCreatedAt;
    this.gameState.currentTrick = {
      leadPlayer: saved.currentTrick.leadPlayer,
      cards: saved.currentTrick.cards.map(pc => ({ card: pc.card, player: pc.player })),
      winner: saved.currentTrick.winner
    };
    this.gameState.completedTricks = saved.completedTricks.map(trick => ({
      leadPlayer: trick.leadPlayer,
      cards: trick.cards.map(pc => ({ card: pc.card, player: pc.player })),
      winner: trick.winner
    }));
    this.gameState.players = Object.entries(saved.players).map(([idx, ps]) => ({
      id: Number(idx),
      hand: ps.hand,
      team: ps.team as 0 | 1,
      isBot: ps.isBot
    }));

    this.playerToClient = new Map();
    for (const [idx, ps] of Object.entries(saved.players)) {
      if (!ps.isBot) {
        this.playerToClient.set(Number(idx), ps.sessionId);
      }
    }

    this.botManager = new BotManager();
  }

  private getRoomInfo() {
    const state = this.getState();
    if (state.phase !== 'WAITING_FOR_PLAYERS') return [];

    return [{
      roomId: this.room.id,
      roomCode: this.roomCode,
      playerCount: this.clientToPlayer.size,
      maxPlayers: MAX_PLAYERS,
      adminSessionId: this.adminSessionId
    }];
  }

  private startExpiryCheck() {
    if (this.expiryCheckTimer) return;

    const now = Date.now();
    const state = this.getState();
    state.roomCreatedAt = now;
    state.roomExpiryAt = now + ROOM_EXPIRY_MS;

    this.botManager = new BotManager();
    this.roomCode = this.generateRoomCode();

    this.persistState();

    this.expiryCheckTimer = setInterval(() => {
      this.checkRoomExpiry();
    }, EXPIRY_CHECK_INTERVAL_MS);
  }

  private checkRoomExpiry() {
    const state = this.getState();
    if (state.phase !== 'WAITING_FOR_PLAYERS') return;

    const now = Date.now();
    const remaining = state.roomExpiryAt - now;

    console.log('[CrownServer] checkRoomExpiry: remaining:', remaining, 'ms');

    if (remaining <= 0) {
      console.log('[CrownServer] Room expired');
      // PartyKit will clean up the room when all connections close
      // For immediate cleanup, we can broadcast a message for clients to leave
      this.room.broadcast(JSON.stringify({ type: 'room_expired' }));
      return;
    }

    if (remaining <= 10000 && remaining > 9000) {
      this.room.broadcast(JSON.stringify({ type: 'room_expiry_warning', remaining: 10 }));
    } else if (remaining <= 30000 && remaining > 29000) {
      this.room.broadcast(JSON.stringify({ type: 'room_expiry_warning', remaining: 30 }));
    } else if (remaining <= 60000 && remaining > 59000) {
      this.room.broadcast(JSON.stringify({ type: 'room_expiry_warning', remaining: 60 }));
    }
  }

  private cancelBotTurnTimer() {
    if (this.botTurnTimer) {
      clearTimeout(this.botTurnTimer);
      this.botTurnTimer = null;
    }
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}