// Contract Crown Lobby View
// Main game lobby with user statistics and game options

import { router } from './router.js';
import { ThemeManager } from './theme-manager.js';
import type { SessionManager } from '../session/index.js';

export interface LobbyViewConfig {
  onCreateGame?: () => void;
  onJoinGame?: () => void;
  onPlayOffline?: () => void;
  onLogout?: () => void;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  totalPoints: number;
  averagePoints: number;
}

export class LobbyView {
  private container: HTMLElement | null = null;
  private sessionManager: SessionManager;
  private config: LobbyViewConfig;
  private userStats: UserStats;

  constructor(sessionManager: SessionManager, config: LobbyViewConfig = {}) {
    this.sessionManager = sessionManager;
    this.config = config;
    this.userStats = {
      gamesPlayed: 0,
      gamesWon: 0,
      totalPoints: 0,
      averagePoints: 0
    };
  }

  render(): HTMLElement {
    const session = this.sessionManager.getSession();
    const isAuthenticated = this.sessionManager.isAuthenticated();

    const container = document.createElement('div');
    container.className = 'lobby-view';
    container.innerHTML = `
      <div class="lobby-container">
        <div class="lobby-header">
          <h1>Contract Crown</h1>
          <p class="subtitle">4-player trick-taking card game</p>
        </div>
        
        ${isAuthenticated && session ? `
          <div class="user-section">
            <div class="user-info">
              <span class="username">${this.escapeHtml(session.username)}</span>
            </div>
            <div class="stats-section">
              <div class="stat-item">
                <span class="stat-label">Games Played</span>
                <span class="stat-value" id="stat-games-played">${this.userStats.gamesPlayed}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Games Won</span>
                <span class="stat-value" id="stat-games-won">${this.userStats.gamesWon}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Total Points</span>
                <span class="stat-value" id="stat-total-points">${this.userStats.totalPoints}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Avg Points</span>
                <span class="stat-value" id="stat-avg-points">${this.userStats.averagePoints.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="lobby-actions">
          ${isAuthenticated ? `
            <button class="btn btn-primary btn-lg w-full" id="create-game-btn">
              Create Game
            </button>
            <button class="btn btn-outline btn-lg w-full mt-3" id="join-game-btn">
              Join Game
            </button>
          ` : ''}
          <button class="btn btn-secondary btn-lg w-full mt-4" id="play-offline-btn">
            Play Offline
          </button>
        </div>

        ${isAuthenticated ? `
          <div class="lobby-footer">
            <button class="theme-badge-btn" id="theme-badge-btn">
              <span class="theme-dot"></span>
              <span class="theme-name" id="theme-badge-name">Golden Ascent</span>
            </button>
            <button class="btn btn-ghost btn-sm" id="logout-btn">
              Logout
            </button>
          </div>
        ` : ''}
      </div>
    `;

    this.container = container;
    this.updateThemeBadge();
    this.attachEventListeners();
    return container;
  }

  private updateThemeBadge(): void {
    if (!this.container) return;
    const currentTheme = ThemeManager.getCurrentTheme();
    const themeNameEl = this.container.querySelector('#theme-badge-name');
    if (themeNameEl) {
      themeNameEl.textContent = currentTheme.name;
    }
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    const createGameBtn = this.container.querySelector('#create-game-btn');
    const joinGameBtn = this.container.querySelector('#join-game-btn');
    const playOfflineBtn = this.container.querySelector('#play-offline-btn');
    const logoutBtn = this.container.querySelector('#logout-btn');

    createGameBtn?.addEventListener('click', () => {
      if (this.config.onCreateGame) {
        this.config.onCreateGame();
      } else {
        this.handleCreateGame();
      }
    });

    joinGameBtn?.addEventListener('click', () => {
      if (this.config.onJoinGame) {
        this.config.onJoinGame();
      } else {
        this.handleJoinGame();
      }
    });

    playOfflineBtn?.addEventListener('click', () => {
      if (this.config.onPlayOffline) {
        this.config.onPlayOffline();
      } else {
        router.navigate('/offline');
      }
    });

    logoutBtn?.addEventListener('click', () => {
      this.sessionManager.logout();
      if (this.config.onLogout) {
        this.config.onLogout();
      } else {
        router.navigate('/login');
      }
    });

    const themeBadgeBtn = this.container.querySelector('#theme-badge-btn');
    themeBadgeBtn?.addEventListener('click', () => {
      this.showThemeSelector();
    });
  }

  private showThemeSelector(): void {
    const themes = ThemeManager.getAvailableThemes();
    const currentTheme = ThemeManager.getTheme();

    let cardsHtml = '';
    for (const theme of themes) {
      const isActive = theme.id === currentTheme;
      cardsHtml += `
        <div class="theme-option-card ${isActive ? 'active' : ''}" data-theme-id="${theme.id}">
          <div class="theme-option-preview">
            <span class="theme-option-preview-text">Aa</span>
          </div>
          <span class="theme-option-name">${theme.name}</span>
          <span class="theme-option-desc">${theme.description}</span>
          ${isActive ? '<span class="theme-option-active-badge">✓ Active</span>' : ''}
        </div>
      `;
    }

    const modal = document.createElement('div');
    modal.className = 'theme-selector-modal';
    modal.innerHTML = `
      <div class="theme-selector-content">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg">Choose Theme</h3>
          <button class="theme-modal-close-btn btn btn-sm btn-circle btn-ghost">✕</button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${cardsHtml}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.theme-modal-close-btn');
    closeBtn?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    const themeCards = modal.querySelectorAll('.theme-option-card');
    themeCards.forEach((card) => {
      card.addEventListener('click', () => {
        const themeId = (card as HTMLElement).getAttribute('data-theme-id');
        if (themeId) {
          ThemeManager.setTheme(themeId);
          document.body.removeChild(modal);
          this.updateThemeBadge();
        }
      });
    });
  }

  private handleCreateGame(): void {
    // Generate a random room ID
    const roomId = this.generateRoomId();
    router.navigate(`/game/${roomId}`);
  }

  private handleJoinGame(): void {
    const roomId = prompt('Enter room ID to join:');
    if (roomId && roomId.trim()) {
      router.navigate(`/game/${roomId.trim()}`);
    }
  }

  private generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setUserStats(stats: UserStats): void {
    this.userStats = stats;
    this.updateStatsDisplay();
  }

  private updateStatsDisplay(): void {
    if (!this.container) return;

    const gamesPlayedEl = this.container.querySelector('#stat-games-played');
    const gamesWonEl = this.container.querySelector('#stat-games-won');
    const totalPointsEl = this.container.querySelector('#stat-total-points');
    const avgPointsEl = this.container.querySelector('#stat-avg-points');

    if (gamesPlayedEl) gamesPlayedEl.textContent = String(this.userStats.gamesPlayed);
    if (gamesWonEl) gamesWonEl.textContent = String(this.userStats.gamesWon);
    if (totalPointsEl) totalPointsEl.textContent = String(this.userStats.totalPoints);
    if (avgPointsEl) avgPointsEl.textContent = this.userStats.averagePoints.toFixed(1);
  }

  destroy(): void {
    this.container = null;
  }
}
