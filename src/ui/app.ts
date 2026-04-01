// Contract Crown PWA App
// Mainbootstrap entry point that mounts UI to the DOM

import page from 'page';
import { SessionManager } from '../session/index.js';
import { router } from './router.js';
import { LoginView } from './login-view.js';
import { LobbyView } from './lobby-view.js';
import { OfflineGameView } from './offline-game-view.js';
import { RegistrationView } from './registration-view.js';
import { ThemeManager } from './theme-manager.js';
import { OnlineGameController } from './online-game-controller.js';

class App {
  private container: HTMLElement | null = null;
  private currentView: HTMLElement | null = null;
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager();
    ThemeManager.applyTheme();
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

    // Registration route - no auth required
    page('/register', () => {
      console.log('Route /register matched');
      this.showRegistration();
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
      onPlayOffline: () => page.redirect('/offline'),
      onRegister: () => page.redirect('/register')
    });

    const viewContainer = loginView.render();
    this.container.appendChild(viewContainer);
    this.currentView = viewContainer;
  }

  private showRegistration(): void {
    this.clearCurrentView();

    if (!this.container) return;

    const registrationView = new RegistrationView();
    const viewContainer = registrationView.render();
    this.container.appendChild(viewContainer);
    this.currentView = viewContainer;
  }

  private showLobby(): void {
    this.clearCurrentView();

    if (!this.container) return;

    const lobbyView = new LobbyView(this.sessionManager, {
      onCreateGame: async () => {
        try {
          const controller = new OnlineGameController();
          const roomId = await controller.joinOrCreateRoom('crown');
          controller.stop();
          this.showRoomCodeModal(roomId);
        } catch (error) {
          console.error('Room creation failed:', error);
        }
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

  private onlineController: OnlineGameController | null = null;

  private showGame(roomId: string): void {
    this.clearCurrentView();

    if (!this.container) return;

    this.onlineController = new OnlineGameController();

    const gameView = this.onlineController.getGameView();
    gameView.setReturnToLobbyHandler(() => {
      this.onlineController?.stop();
      this.onlineController = null;
      page.redirect('/lobby');
    });
    gameView.setRestartGameHandler(() => {
      window.location.reload();
    });

    const viewContainer = document.createElement('div');
    viewContainer.className = 'online-game-container';
    this.container.appendChild(viewContainer);
    this.currentView = viewContainer;

    // Attach the GameView's internal container to the DOM
    const gameViewContainer = this.onlineController.getGameView().getContainer();
    if (gameViewContainer) {
      viewContainer.appendChild(gameViewContainer);
    }

    this.onlineController.start(roomId).catch((err) => {
      console.error('Failed to connect to game room:', err);
      viewContainer.innerHTML = `
        <div class="game-error">
          <h2>Connection Failed</h2>
          <p>Could not connect to the game server.</p>
          <button class="btn btn-primary" id="retry-btn">Retry</button>
          <button class="btn btn-ghost" id="lobby-btn">Return to Lobby</button>
        </div>
      `;
      viewContainer.querySelector('#retry-btn')?.addEventListener('click', () => {
        this.showGame(roomId);
      });
      viewContainer.querySelector('#lobby-btn')?.addEventListener('click', () => {
        page.redirect('/lobby');
      });
    });
  }

  private showRoomCodeModal(roomId: string): void {
    const modal = document.createElement('div');
    modal.className = 'room-code-modal-overlay';
    modal.innerHTML = `
      <div class="room-code-modal">
        <div class="room-code-modal-header">
          <h3>Share this code with friends</h3>
          <button class="room-code-modal-close btn btn-sm btn-circle btn-ghost">✕</button>
        </div>
        <div class="room-code-modal-body">
          <div class="room-code-display" id="room-code-text">${roomId}</div>
          <button class="btn btn-primary btn-sm" id="copy-room-code-btn">
            Copy Code
          </button>
          <p class="room-code-waiting">Waiting for players...</p>
          <button class="btn btn-outline btn-sm mt-4" id="enter-room-btn">
            Enter Game
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.room-code-modal-close');
    closeBtn?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    const copyBtn = modal.querySelector('#copy-room-code-btn');
    copyBtn?.addEventListener('click', () => {
      navigator.clipboard.writeText(roomId).then(() => {
        (copyBtn as HTMLElement).textContent = 'Copied!';
        setTimeout(() => {
          (copyBtn as HTMLElement).textContent = 'Copy Code';
        }, 2000);
      });
    });

    const enterBtn = modal.querySelector('#enter-room-btn');
    enterBtn?.addEventListener('click', () => {
      document.body.removeChild(modal);
      page.redirect(`/game/${roomId}`);
    });
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
