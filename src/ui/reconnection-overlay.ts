// Contract Crown Reconnection Overlay
// Displays reconnection status when WebSocket drops unexpectedly

import { router } from './router.js';

export class ReconnectionOverlay {
  private overlay: HTMLElement | null = null;
  private countdownEl: HTMLElement | null = null;
  private countdown: number = 60;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onReturnToLobby: (() => void) | null = null;

  constructor() {}

  show(): void {
    if (this.overlay) return;

    this.countdown = 60;

    this.overlay = document.createElement('div');
    this.overlay.className = 'reconnection-overlay';
    this.overlay.innerHTML = `
      <div class="reconnection-card">
        <div class="reconnection-spinner"></div>
        <h3>Reconnecting...</h3>
        <p class="reconnection-countdown" id="reconnect-countdown">${this.countdown}s remaining</p>
        <p class="reconnection-hint">Attempting to restore your connection</p>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.countdownEl = this.overlay.querySelector('#reconnect-countdown');

    this.timer = setInterval(() => {
      this.countdown--;
      if (this.countdownEl) {
        this.countdownEl.textContent = `${this.countdown}s remaining`;
      }
      if (this.countdown <= 0) {
        this.showTimeout();
      }
    }, 1000);
  }

  hide(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.countdownEl = null;
  }

  showRestored(): void {
    if (!this.overlay) return;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.overlay.innerHTML = `
      <div class="reconnection-card reconnection-success">
        <div class="reconnection-check">✓</div>
        <h3>Connection Restored</h3>
        <p class="reconnection-hint">Resuming game...</p>
      </div>
    `;

    setTimeout(() => this.hide(), 1500);
  }

  showTimeout(): void {
    if (!this.overlay) return;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.overlay.innerHTML = `
      <div class="reconnection-card reconnection-failed">
        <div class="reconnection-icon">✕</div>
        <h3>Connection Lost</h3>
        <p class="reconnection-hint">Bot replaced your seat</p>
        <button class="btn btn-primary mt-4" id="return-to-lobby-btn">Return to Lobby</button>
      </div>
    `;

    this.overlay.querySelector('#return-to-lobby-btn')?.addEventListener('click', () => {
      this.hide();
      if (this.onReturnToLobby) {
        this.onReturnToLobby();
      } else {
        router.navigate('/lobby');
      }
    });
  }

  setOnReturnToLobby(callback: () => void): void {
    this.onReturnToLobby = callback;
  }
}
