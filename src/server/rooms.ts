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

const MAX_PLAYERS = 4;
const RECONNECT_TIMEOUT_MS = 60_000;

export class CrownRoom extends Room<GameStateSchema> {
  maxClients = MAX_PLAYERS;
  allowReconnectionTime = RECONNECT_TIMEOUT_MS / 1000;

  private gameState!: GameState;
  private botManager!: BotManager;
  private clientToPlayer = new Map<string, number>();
  private playerToClient = new Map<number, string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private botTurnTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Lifecycle ---

  onCreate(options: any) {
    this.gameState = createInitialState();
    this.gameState.dealer = options.dealer ?? 0;
    this.botManager = new BotManager();

    const schema = new GameStateSchema();
    schema.phase = 'WAITING_FOR_PLAYERS';
    schema.dealer = this.gameState.dealer;
    this.setState(schema);

    this.onMessage('declare_trump', (client: Client, message: any) => {
      this.handleDeclareTrump(client, message);
    });

    this.onMessage('play_card', (client: Client, message: any) => {
      this.handlePlayCard(client, message);
    });

    this.onMessage('ready', (_client: Client, _message: any) => {
      // Client acknowledges state sync — no action needed
    });
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

    // Create player in schema
    const ps = new PlayerSchema();
    ps.id = playerIndex;
    ps.team = playerIndex % 2 === 0 ? 0 : 1;
    ps.isBot = false;
    ps.sessionId = client.sessionId;
    ps.disconnected = false;
    this.state.players.set(String(playerIndex), ps);

    // If 4 players joined, start the game
    if (this.clientToPlayer.size === MAX_PLAYERS) {
      this.startGame();
    }
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

  onDispose() {
    this.cancelReconnectTimer();
    this.cancelBotTurnTimer();
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
    dealInitial(this.gameState);
    this.syncState();
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
