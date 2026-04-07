// Contract Crown Login View
// Login form with SessionManager integration

import type { SessionManager } from '../session/index.js';
import { router } from './router.js';

const API_BASE = '';

export interface LoginViewConfig {
  onLoginSuccess?: () => void;
  onPlayOffline?: () => void;
  onRegister?: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export class LoginView {
  private container: HTMLElement | null = null;
  private sessionManager: SessionManager;
  private config: LoginViewConfig;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor(sessionManager: SessionManager, config: LoginViewConfig = {}) {
    this.sessionManager = sessionManager;
    this.config = config;
    this.setupPwaInstall();
  }

  private setupPwaInstall(): void {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
      this.hideInstallButton();
      this.deferredPrompt = null;
    });
  }

  private showInstallButton(): void {
    if (!this.container) return;
    const installBtn = this.container.querySelector('#pwa-install-btn') as HTMLButtonElement;
    if (installBtn) {
      installBtn.classList.remove('hidden');
    }
  }

  private hideInstallButton(): void {
    if (!this.container) return;
    const installBtn = this.container.querySelector('#pwa-install-btn') as HTMLButtonElement;
    if (installBtn) {
      installBtn.classList.add('hidden');
    }
  }

  private async handleInstall(): Promise<void> {
    if (!this.deferredPrompt) return;
    
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      this.hideInstallButton();
    }
    this.deferredPrompt = null;
  }

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'login-view';
    container.innerHTML = `
      <div class="login-container">
        <div class="app-title">Contract Crown</div>
        <div class="app-subtitle">A 4-player trick-taking card game</div>
        <div class="form-group">
          <input class="form-input" type="email" placeholder="Email" id="login-email" />
        </div>
        <div class="form-group">
          <input class="form-input" type="password" placeholder="Password" id="login-password" />
        </div>
        <button class="btn btn-primary w-full" id="login-btn">Login</button>
        <button class="btn btn-outline w-full mt-2" id="play-offline-btn">Play Offline (No Login)</button>
        <button class="btn btn-secondary w-full mt-2 hidden" id="pwa-install-btn">Install App</button>
        <div class="register-link mt-4">
          <span>Don't have an account? </span>
          <a href="#" id="register-link">Register</a>
        </div>
      </div>
    `;

    this.container = container;
    this.attachEventListeners();
    return container;
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    const emailInput = this.container.querySelector('#login-email') as HTMLInputElement;
    const passwordInput = this.container.querySelector('#login-password') as HTMLInputElement;
    const loginBtn = this.container.querySelector('#login-btn') as HTMLButtonElement;
    const playOfflineBtn = this.container.querySelector('#play-offline-btn') as HTMLButtonElement;
    const installBtn = this.container.querySelector('#pwa-install-btn') as HTMLButtonElement;
    const registerLink = this.container.querySelector('#register-link') as HTMLAnchorElement;

    loginBtn?.addEventListener('click', () => this.handleLogin(emailInput.value, passwordInput.value));
    
    passwordInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin(emailInput.value, passwordInput.value);
      }
    });

    installBtn?.addEventListener('click', () => this.handleInstall());

    playOfflineBtn?.addEventListener('click', () => {
      if (this.config.onPlayOffline) {
        this.config.onPlayOffline();
      } else {
        router.navigate('/offline');
      }
    });

    registerLink?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.config.onRegister) {
        this.config.onRegister();
      }
    });
  }

  private async handleLogin(email: string, password: string): Promise<void> {
    this.hideError();
    
    if (!email.trim()) {
      this.showError('Please enter your email');
      return;
    }

    if (!password.trim()) {
      this.showError('Please enter your password');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await response.json();

      if (!response.ok) {
        this.showError(data.message || 'Login failed');
        return;
      }

      this.sessionManager.loginWithSupabase(
        data.userId,
        data.username,
        data.accessToken,
        data.refreshToken,
        data.expiresAt * 1000
      );
      
      if (this.config.onLoginSuccess) {
        this.config.onLoginSuccess();
      } else {
        router.handleLoginRedirect();
      }
    } catch (error) {
      this.showError('Network error. Please try again.');
    }
  }

  private showError(message: string): void {
    if (!this.container) return;

    let errorEl = this.container.querySelector('.error-message');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'error-message';
      const loginContainer = this.container.querySelector('.login-container');
      if (loginContainer && loginContainer.firstChild) {
        loginContainer.insertBefore(errorEl, loginContainer.firstChild);
      } else if (this.container.firstChild) {
        this.container.insertBefore(errorEl, this.container.firstChild);
      }
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  hideError(): void {
    if (!this.container) return;
    const errorEl = this.container.querySelector('.error-message');
    if (errorEl) {
      errorEl.classList.add('hidden');
    }
  }

  destroy(): void {
    this.container = null;
  }
}
