// Contract Crown PWA App
// Main bootstrap entry point that mounts UI to the DOM

import page from 'page';
import { SessionManager } from '../session/index.js';
import { router } from './router.js';
import { LoginView } from './login-view.js';
import { LobbyView } from './lobby-view.js';
import { OfflineGameView } from './offline-game-view.js';

class App {
  private container: HTMLElement | null = null;
  private currentView: HTMLElement | null = null;
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager();
    this.container = document.getElementById('app');
    if (!this.container) {
      console.error('App mount point #app not found');
      return;
    }
    console.log('App initialized, container:', this.container);
    this.setupRoutes();
    router.setSessionManager(this.sessionManager);
    console.log('Routes setup complete');
    page.start();
    console.log('Page.js started, current path:', window.location.pathname);
  }

  private setupRoutes(): void {
    console.log('Setting up routes...');
    // Root redirects to lobby
    page('/', () => {
      console.log('Route / matched, redirecting to /lobby');
      page.redirect('/lobby');
    });

    // Login route - no auth required
    page('/login', () => {
      console.log('Route /login matched');
      this.showLogin();
    });

    // Lobby route - auth required
    page('/lobby', (ctx, next) => {
      console.log('Route /lobby matched, auth check...');
      router.requireAuth(ctx, next);
    }, () => {
      console.log('Route /lobby auth passed');
      this.showLobby();
    });

    // Offline route - no auth required
    page('/offline', () => {
      console.log('Route /offline matched');
      this.showOfflineGame();
    });

    // Game route - auth required
    page('/game/:roomId', (ctx, next) => {
      console.log('Route /game/:roomId matched, auth check...');
      router.requireAuth(ctx, next);
    }, (ctx) => {
      console.log('Route /game/:roomId auth passed, roomId:', ctx.params.roomId);
      this.showGame(ctx.params.roomId);
    });

    // Default redirect
    page('*', () => {
      console.log('Route * matched, redirecting to /lobby');
      page.redirect('/lobby');
    });
    
    console.log('All routes registered');
  }

  private clearCurrentView(): void {
    if (this.currentView && this.currentView.parentNode) {
      this.currentView.parentNode.removeChild(this.currentView);
    }
    this.currentView = null;
  }

  private showLogin(): void {
    console.log('showLogin called');
    this.clearCurrentView();

    if (!this.container) return;

    const loginView = new LoginView(this.sessionManager, {
      onLoginSuccess: () => router.handleLoginRedirect(),
      onPlayOffline: () => page.redirect('/offline')
    });

    const viewContainer = loginView.render();
    this.container.appendChild(viewContainer);
    this.currentView = viewContainer;
  }

  private showLobby(): void {
    this.clearCurrentView();

    if (!this.container) return;

    const lobbyView = new LobbyView(this.sessionManager, {
      onCreateGame: () => {
        const roomId = this.generateRoomId();
        page.redirect(`/game/${roomId}`);
      },
      onJoinGame: () => {
        const roomId = prompt('Enter room ID to join:');
        if (roomId && roomId.trim()) {
          page.redirect(`/game/${roomId.trim()}`);
        }
      },
      onPlayOffline: () => page.redirect('/offline'),
      onLogout: () => {
        this.sessionManager.logout();
        page.redirect('/login');
      }
    });

    const viewContainer = lobbyView.render();
    this.container.appendChild(viewContainer);
    this.currentView = viewContainer;
  }

  private showOfflineGame(): void {
    this.clearCurrentView();

    const offlineView = new OfflineGameView();
    
    const gameView = offlineView.getController().getGameView();
    gameView.setReturnToLobbyHandler(() => {
      offlineView.handleReturnToLobby();
      page.redirect('/lobby');
    });
    gameView.setRestartGameHandler(() => {
      window.location.reload();
    });

    const viewContainer = offlineView.getContainer();
    if (viewContainer && this.container) {
      this.container.appendChild(viewContainer);
      this.currentView = viewContainer;
      offlineView.startGame();
    }
  }

  private showGame(roomId: string): void {
    this.clearCurrentView();

    if (!this.container) return;

    const gameContainer = document.createElement('div');
    gameContainer.className = 'game-view';
    gameContainer.innerHTML = `
      <div class="game-room">
        <h2>Game Room: ${this.escapeHtml(roomId)}</h2>
        <p>Waiting for players...</p>
        <button class="btn btn-outline" id="return-to-lobby">Return to Lobby</button>
      </div>
    `;

    this.container.appendChild(gameContainer);
    this.currentView = gameContainer;

    const returnBtn = gameContainer.querySelector('#return-to-lobby');
    returnBtn?.addEventListener('click', () => page.redirect('/lobby'));
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
}

// Boot the app when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
  } else {
    new App();
  }
}
