// Contract Crown PWA App
// Main bootstrap entry point that mounts UI to the DOM

import page from 'page';
import { OfflineGameView } from './offline-game-view.js';

class App {
  private container: HTMLElement | null = null;
  private currentView: HTMLElement | null = null;

  constructor() {
    this.container = document.getElementById('app');
    if (!this.container) {
      console.error('App mount point #app not found');
      return;
    }
    this.setupRoutes();
    page.start();
  }

  private setupRoutes(): void {
    page('/', () => page.redirect('/offline'));

    page('/offline', () => this.showOfflineGame());

    page('/login', () => this.showLogin());

    page('*', () => page.redirect('/offline'));
  }

  private clearCurrentView(): void {
    if (this.currentView && this.currentView.parentNode) {
      this.currentView.parentNode.removeChild(this.currentView);
    }
    this.currentView = null;
  }

  private showOfflineGame(): void {
    this.clearCurrentView();

    const offlineView = new OfflineGameView();
    offlineView.setReturnToLobbyHandler(() => {
      offlineView.destroy();
      page.redirect('/offline');
    });

    const viewContainer = offlineView.getContainer();
    if (viewContainer && this.container) {
      this.container.appendChild(viewContainer);
      this.currentView = viewContainer;
      offlineView.startGame();
    }
  }

  private showLogin(): void {
    this.clearCurrentView();

    if (!this.container) return;

    const loginView = document.createElement('div');
    loginView.className = 'login-view';
    loginView.innerHTML = `
      <div class="app-title">Contract Crown</div>
      <div class="app-subtitle">A 4-player trick-taking card game</div>
      <div class="form-group">
        <input class="form-input" type="text" placeholder="Username" id="login-username" />
      </div>
      <div class="form-group">
        <input class="form-input" type="password" placeholder="Password" id="login-password" />
      </div>
      <button class="btn-primary" id="login-btn">Login</button>
      <button class="btn-secondary" id="play-offline-btn">Play Offline (No Login)</button>
    `;

    this.container.appendChild(loginView);
    this.currentView = loginView;

    const playOfflineBtn = loginView.querySelector('#play-offline-btn');
    if (playOfflineBtn) {
      playOfflineBtn.addEventListener('click', () => page.redirect('/offline'));
    }
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
