// Contract Crown Waiting Room View
// Displays a waiting room where players can join before game starts

import { HapticController } from './haptic-controller.js';

export interface WaitingRoomPlayer {
  playerIndex: number;
  username: string;
  sessionId: string;
  isBot: boolean;
  isAdmin: boolean;
  team: 0 | 1;
}

export interface WaitingRoomState {
  roomId: string;
  roomCode: string;
  adminSessionId: string;
  players: WaitingRoomPlayer[];
  timeRemaining: number;
  isFull: boolean;
  isAdmin: boolean;
  playerCount: number;
  trumpDeclarer?: number;
}

export interface WaitingRoomCallbacks {
  onShuffleTeams: () => void;
  onAddBot: () => void;
  onStartGame: () => void;
  onReturnToLobby: () => void;
  onCopyCode: (code: string) => void;
}

export class WaitingRoomView {
  private container: HTMLElement | null = null;
  private state: WaitingRoomState;
  private callbacks: WaitingRoomCallbacks;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private haptic: HapticController;

  constructor(state: WaitingRoomState, callbacks: WaitingRoomCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
    this.haptic = new HapticController();
  }

  render(): HTMLElement {
    this.container = document.createElement('div');
    this.container.className = 'waiting-room-view';

    this.container.innerHTML = `
      <div class="waiting-room-header">
        <button class="btn btn-ghost btn-sm waiting-room-back-btn" id="wr-back-btn">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
          </svg>
          Back
        </button>
        <h1 class="waiting-room-title">Contract Crown</h1>
      </div>

      <div class="waiting-room-info">
        <div class="room-code-section">
          <span class="room-code-label">Room Code</span>
          <div class="room-code-display">
            <span class="room-code-text" id="wr-room-code">${this.state.roomCode}</span>
            <button class="btn btn-ghost btn-xs" id="wr-copy-btn" title="Copy code">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
        <div class="room-timer">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 timer-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span id="wr-timer-text">${this.formatTime(this.state.timeRemaining)}</span>
        </div>
        <div class="room-player-count">
          <span id="wr-player-count">${this.state.playerCount}/4 players</span>
        </div>
        ${this.state.trumpDeclarer !== undefined ? `
        <div class="trump-declarer-section" id="wr-trump-declarer">
          <span class="trump-declarer-label">🎯 Trump Declares:</span>
          <span class="trump-declarer-name">${this.getTrumpDeclarerName()}</span>
        </div>
        ` : ''}
      </div>

      <div class="team-slots-container">
        ${this.renderTeamSection(0)}
        ${this.renderTeamSection(1)}
      </div>

      <div class="waiting-room-controls" id="wr-controls">
        ${this.state.isAdmin ? this.renderAdminControls() : ''}
      </div>
    `;

    this.setupEventListeners();
    this.startCountdown();

    return this.container;
  }

  private renderTeamSection(team: 0 | 1): string {
    return `
      <div class="team-section">
        <div class="team-section-header">
          <span class="team-badge team-badge-${team}">Team ${team}</span>
        </div>
        <div class="team-players-list" id="wr-team-${team}">
          ${this.renderTeamSlots(team)}
        </div>
      </div>
    `;
  }

  private renderTeamSlots(team: 0 | 1): string {
    const teamPlayers = this.state.players.filter(p => p.team === team);
    let html = '';

    for (let i = 0; i < 2; i++) {
      const player = teamPlayers[i];
      const playerIndex = player?.playerIndex ?? -1;

      if (player) {
        const isTrumpDeclarer = this.state.trumpDeclarer !== undefined && this.state.trumpDeclarer === player.playerIndex;
        html += `
          <div class="player-slot ${player.isAdmin ? 'player-slot-admin' : ''}" data-player-index="${playerIndex}">
            <div class="player-avatar">
              <div class="avatar-circle">${player.username.charAt(0).toUpperCase()}</div>
              ${player.isAdmin ? '<span class="admin-crown">👑</span>' : ''}
              ${isTrumpDeclarer ? '<span class="trump-declarer-badge">🎯</span>' : ''}
            </div>
            <div class="player-info">
              <span class="player-name">${player.username}${player.isBot ? ' (Bot)' : ''}</span>
              ${player.isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
              ${isTrumpDeclarer ? '<span class="trump-declarer-text">Trump Declares</span>' : ''}
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="player-slot player-slot-empty" data-player-index="${i}">
            <div class="player-avatar">
              <div class="avatar-circle avatar-empty">?</div>
            </div>
            <div class="player-info">
              <span class="player-name player-name-empty">Waiting for player...</span>
            </div>
          </div>
        `;
      }
    }

    return html;
  }

  private renderAdminControls(): string {
    const playerCount = this.state.playerCount;
    const isFull = this.state.isFull;

    return `
      <div class="admin-controls">
        <button class="btn btn-outline btn-sm" id="wr-shuffle-btn" ${playerCount < 2 ? 'disabled' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Shuffle Teams
        </button>
        <button class="btn btn-outline btn-sm" id="wr-add-bot-btn" ${isFull ? 'disabled' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Bot
        </button>
      </div>
      <button class="btn btn-primary btn-block" id="wr-start-btn" ${playerCount < 1 ? 'disabled' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Start Game
      </button>
    `;
  }

  private setupEventListeners(): void {
    if (!this.container) return;

    this.container.querySelector('#wr-back-btn')?.addEventListener('click', () => {
      this.callbacks.onReturnToLobby();
    });

    this.container.querySelector('#wr-copy-btn')?.addEventListener('click', () => {
      const code = this.state.roomCode;
      navigator.clipboard.writeText(code).then(() => {
        const btn = this.container?.querySelector('#wr-copy-btn');
        if (btn) {
          const originalHTML = btn.innerHTML;
          btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>';
          setTimeout(() => {
            btn.innerHTML = originalHTML;
          }, 2000);
        }
        this.haptic.triggerTrickWon();
      });
      this.callbacks.onCopyCode(code);
    });

    this.container.querySelector('#wr-shuffle-btn')?.addEventListener('click', () => {
      this.haptic.triggerYourTurn();
      this.callbacks.onShuffleTeams();
    });

    this.container.querySelector('#wr-add-bot-btn')?.addEventListener('click', () => {
      this.haptic.triggerYourTurn();
      this.callbacks.onAddBot();
    });

    this.container.querySelector('#wr-start-btn')?.addEventListener('click', () => {
      this.haptic.triggerVictory();
      this.callbacks.onStartGame();
    });
  }

  updateState(updates: Partial<WaitingRoomState>): void {
    this.state = { ...this.state, ...updates };

    if (!this.container) return;

    // Update room code
    const codeEl = this.container.querySelector('#wr-room-code');
    if (codeEl && updates.roomCode) {
      codeEl.textContent = updates.roomCode;
    }

    // Update timer
    if (updates.timeRemaining !== undefined) {
      this.updateTimerDisplay(updates.timeRemaining);
    }

    // Update player count
    if (updates.playerCount !== undefined) {
      const countEl = this.container.querySelector('#wr-player-count');
      if (countEl) {
        countEl.textContent = `${updates.playerCount}/4 players`;
      }
    }

    // Update team slots
    if (updates.players) {
      const team0El = this.container.querySelector('#wr-team-0');
      const team1El = this.container.querySelector('#wr-team-1');
      if (team0El) team0El.innerHTML = this.renderTeamSlots(0);
      if (team1El) team1El.innerHTML = this.renderTeamSlots(1);
    }

    // Update team sections (re-render entire sections if player structure changed)
    if (updates.players || updates.isAdmin) {
      const slotsContainer = this.container?.querySelector('.team-slots-container');
      if (slotsContainer) {
        slotsContainer.innerHTML = `
          ${this.renderTeamSection(0)}
          ${this.renderTeamSection(1)}
        `;
      }
    }

    // Update admin controls
    if (updates.isAdmin !== undefined || updates.playerCount !== undefined || updates.isFull !== undefined || updates.players) {
      const controlsEl = this.container.querySelector('#wr-controls');
      if (controlsEl) {
        controlsEl.innerHTML = this.state.isAdmin ? this.renderAdminControls() : '';
        this.setupEventListeners();
      }
    }

    // Update trump declarer info section
    if (updates.trumpDeclarer !== undefined) {
      const infoSection = this.container?.querySelector('.waiting-room-info');
      if (infoSection) {
        const existingDeclarer = infoSection.querySelector('.trump-declarer-section');
        if (existingDeclarer) {
          existingDeclarer.remove();
        }
        if (this.state.trumpDeclarer !== undefined) {
          const declarerHtml = document.createElement('div');
          declarerHtml.className = 'trump-declarer-section';
          declarerHtml.id = 'wr-trump-declarer';
          declarerHtml.innerHTML = `
            <span class="trump-declarer-label">🎯 Trump Declares:</span>
            <span class="trump-declarer-name">${this.getTrumpDeclarerName()}</span>
          `;
          infoSection.appendChild(declarerHtml);
        }
      }
    }
  }

  private startCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }

    this.countdownTimer = setInterval(() => {
      this.state.timeRemaining = Math.max(0, this.state.timeRemaining - 1);
      this.updateTimerDisplay(this.state.timeRemaining);

      if (this.state.timeRemaining <= 0) {
        this.stopCountdown();
        this.haptic.triggerTrickWon();
        this.callbacks.onReturnToLobby();
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private updateTimerDisplay(seconds: number): void {
    if (!this.container) return;
    const timerEl = this.container.querySelector('#wr-timer-text');
    if (timerEl) {
      timerEl.textContent = this.formatTime(seconds);
      if (seconds <= 30) {
        timerEl.classList.add('timer-warning');
      } else {
        timerEl.classList.remove('timer-warning');
      }
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private getTrumpDeclarerName(): string {
    if (this.state.trumpDeclarer === undefined) return '';
    const player = this.state.players.find(p => p.playerIndex === this.state.trumpDeclarer);
    return player?.username || `Player ${this.state.trumpDeclarer + 1}`;
  }

  destroy(): void {
    this.stopCountdown();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
