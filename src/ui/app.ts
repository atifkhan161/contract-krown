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
import { WaitingRoomView } from './waiting-room-view.js';
import { JoinRoomModal } from './join-room-modal.js';

class App {
  private container: HTMLElement | null = null;
  private currentView: HTMLElement | null = null;
  private sessionManager: SessionManager;
  private joinRoomModal: JoinRoomModal | null = null;

  constructor() {
    this.sessionManager = new SessionManager();
    ThemeManager.applyTheme();
    this.container = document.getElementById('app');
    if (!this.container) {
      console.error('App mount point #app not found');
      return;
    }
    this.setupRoutes();
    router.setSessionManager(this.sessionManager);
    console.log('Routes setup complete');
    page.start();
    console.log('Page.js started, current path:', window.location.pathname);
  }

  private setupRoutes(): void {
    console.log('Setting up routes...');
    page('/', () => {
      console.log('Route / matched, redirecting to /lobby');
      page.redirect('/lobby');
    });

    page('/login', () => {
      console.log('Route /login matched');
      this.showLogin();
    });

    page('/register', () => {
      console.log('Route /register matched');
      this.showRegistration();
    });

    page('/lobby', (ctx, next) => {
      console.log('Route /lobby matched, auth check...');
      router.requireAuth(ctx, next);
    }, () => {
      console.log('Route /lobby auth passed');
      this.showLobby();
    });

    page('/offline', () => {
      console.log('Route /offline matched');
      this.showOfflineGame();
    });

    page('/waiting/:roomId', (ctx, next) => {
      console.log('Route /waiting/:roomId matched, auth check...');
      router.requireAuth(ctx, next);
    }, (ctx) => {
      console.log('Route /waiting/:roomId auth passed, roomId:', ctx.params.roomId);
      this.showWaitingRoom(ctx.params.roomId);
    });

    page('/game/:roomId', (ctx, next) => {
      console.log('Route /game/:roomId matched, auth check...');
      router.requireAuth(ctx, next);
    }, (ctx) => {
      console.log('Route /game/:roomId auth passed, roomId:', ctx.params.roomId);
      this.showGame(ctx.params.roomId);
    });

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
      onCreateGame: () => {
        page.redirect('/waiting/new');
      },
      onJoinGame: () => {
        this.showJoinRoomModal();
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

  private showWaitingRoom(roomIdParam: string): void {
    this.clearCurrentView();

    if (!this.container) return;

    const isNewRoom = roomIdParam === 'new';
    const session = this.sessionManager.getSession();
    const username = session?.username ?? 'Player';

    const viewContainer = document.createElement('div');
    viewContainer.className = 'waiting-room-wrapper';
    viewContainer.innerHTML = `
      <div class="waiting-room-loading">
        <div class="reconnection-spinner"></div>
        <p>${isNewRoom ? 'Creating room...' : 'Joining room...'}</p>
      </div>
    `;
    this.container.appendChild(viewContainer);
    this.currentView = viewContainer;

    const handleReturnToLobby = () => {
      if (this.onlineController) {
        this.onlineController.stop();
        this.onlineController = null;
      }
      page.redirect('/lobby');
    };

    if (isNewRoom) {
      this.onlineController = new OnlineGameController();
      this.onlineController.setUsername(username);
      this.onlineController.createWaitingRoom().then(({ roomId, roomCode }) => {
        viewContainer.innerHTML = '';

        const waitingView = new WaitingRoomView({
          roomId,
          roomCode,
          adminSessionId: session?.token ?? '',
          players: [{
            playerIndex: 0,
            username,
            sessionId: session?.token ?? '',
            isBot: false,
            isAdmin: true,
            team: 0
          }],
          timeRemaining: 180,
          isFull: false,
          isAdmin: true,
          playerCount: 1
        }, {
          onShuffleTeams: () => {
            this.onlineController?.shuffleTeams();
          },
          onAddBot: () => {
            this.onlineController?.addBot();
          },
          onStartGame: () => {
            this.onlineController?.startGame();
          },
          onReturnToLobby: handleReturnToLobby,
          onCopyCode: () => {}
        });

        const wrContainer = waitingView.render();
        viewContainer.appendChild(wrContainer);

        this.onlineController?.onWaitingRoomStateChange((state) => {
          waitingView.updateState(state);
        });

        this.onlineController?.setOnGameStarted((data) => {
          console.log('[App] game_started received, redirecting to:', `/game/${data.roomId}`);
          page.redirect(`/game/${data.roomId}`);
        });
      }).catch((err: any) => {
        console.error('Failed to create waiting room:', err);
        viewContainer.innerHTML = `
          <div class="game-error">
            <h2>Room Creation Failed</h2>
            <p>Could not create a game room. Make sure the server is running.</p>
            <p class="error-detail">${err?.message || 'Unknown error'}</p>
            <button class="btn btn-primary" id="lobby-btn">Return to Lobby</button>
          </div>
        `;
        viewContainer.querySelector('#lobby-btn')?.addEventListener('click', () => {
          page.redirect('/lobby');
        });
      });
    } else {
      this.onlineController = new OnlineGameController();
      this.onlineController.setUsername(username);
      this.onlineController.joinWaitingRoom(roomIdParam).then(({ roomId, roomCode, isAdmin, playerCount, players }) => {
        viewContainer.innerHTML = '';

        const waitingView = new WaitingRoomView({
          roomId,
          roomCode,
          adminSessionId: '',
          players: players || [],
          timeRemaining: 180,
          isFull: playerCount >= 4,
          isAdmin,
          playerCount
        }, {
          onShuffleTeams: () => {
            this.onlineController?.shuffleTeams();
          },
          onAddBot: () => {
            this.onlineController?.addBot();
          },
          onStartGame: () => {
            this.onlineController?.startGame();
          },
          onReturnToLobby: handleReturnToLobby,
          onCopyCode: () => {}
        });

        const wrContainer = waitingView.render();
        viewContainer.appendChild(wrContainer);

        this.onlineController?.onWaitingRoomStateChange((state) => {
          waitingView.updateState(state);
        });

        this.onlineController?.setOnGameStarted((data) => {
          console.log('[App] game_started received (join), redirecting to:', `/game/${data.roomId}`);
          page.redirect(`/game/${data.roomId}`);
        });
      }).catch((err: any) => {
        console.error('Failed to join waiting room:', err);
        viewContainer.innerHTML = `
          <div class="game-error">
            <h2>Room Not Found</h2>
            <p>Could not find the room. It may have expired or the code is invalid.</p>
            <button class="btn btn-primary" id="lobby-btn">Return to Lobby</button>
          </div>
        `;
        viewContainer.querySelector('#lobby-btn')?.addEventListener('click', () => {
          page.redirect('/lobby');
        });
      });
    }
  }

  private showJoinRoomModal(): void {
    if (!this.container) return;

    if (!this.joinRoomModal) {
      this.joinRoomModal = new JoinRoomModal((roomId: string) => {
        page.redirect(`/waiting/${roomId}`);
      });
      this.joinRoomModal.setContainer(this.container);
    }

    fetch('/api/rooms')
      .then(res => res.json())
      .then(rooms => {
        this.joinRoomModal?.show(rooms);
      })
      .catch(() => {
        this.joinRoomModal?.show([]);
      });
  }

  private showGame(roomId: string): void {
    this.clearCurrentView();

    if (!this.container) return;

    const isAlreadyConnected = this.onlineController?.isConnectedToRoom(roomId);
    
    if (isAlreadyConnected) {
      console.log('[App] Reusing existing connection for game room:', roomId);
      this.setupGameViewFromExisting();
    } else {
      console.log('[App] Creating new controller for game room:', roomId);
      this.setupNewGameController(roomId);
    }
  }

  private setupGameViewFromExisting(): void {
    if (!this.onlineController || !this.container) return;

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

    const gameViewContainer = gameView.getContainer();
    if (gameViewContainer) {
      viewContainer.appendChild(gameViewContainer);
    }
  }

  private setupNewGameController(roomId: string): void {
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
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
  } else {
    new App();
  }
}
