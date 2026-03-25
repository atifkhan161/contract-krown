// Contract Crown Offline Game View
// Integrates offline game controller with Mobile UI

import type { GameState } from '../engine/types.js';
import { OfflineGameController } from './offline-game-controller.js';
import { GameView } from './game-view.js';

export class OfflineGameView {
  private container: HTMLElement | null = null;
  private controller: OfflineGameController;
  private gameView: GameView;
  private offlineIndicator: HTMLElement | null = null;
  private returnButton: HTMLElement | null = null;
  private onReturnToLobby: (() => void) | null = null;

  constructor() {
    this.controller = new OfflineGameController();
    this.gameView = this.controller.getGameView();
    this.createElements();
    this.setupEventListeners();
  }

  /**
   * Creates the DOM elements for the offline game view
   */
  private createElements(): void {
    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    this.container = document.createElement('div');
    this.container.className = 'offline-game-view';

    // Add offline mode indicator
    this.offlineIndicator = document.createElement('div');
    this.offlineIndicator.className = 'offline-indicator';
    this.offlineIndicator.innerHTML = `
      <span class="offline-icon">📴</span>
      <span class="offline-text">Offline Mode</span>
    `;

    // Add return to lobby button
    this.returnButton = document.createElement('button');
    this.returnButton.className = 'return-to-lobby-btn';
    this.returnButton.textContent = 'Return to Lobby';

    // Add game view
    const gameViewContainer = this.gameView.getContainer();
    if (gameViewContainer) {
      this.container.appendChild(gameViewContainer);
    }

    // Add indicator and button to container
    this.container.appendChild(this.offlineIndicator);
    this.container.appendChild(this.returnButton);
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    if (!this.returnButton) return;

    this.returnButton.addEventListener('click', () => {
      this.handleReturnToLobby();
    });
  }

  /**
   * Handles return to lobby action
   */
  private handleReturnToLobby(): void {
    // Stop the game
    this.controller.stop();

    // Call the return to lobby callback
    if (this.onReturnToLobby) {
      this.onReturnToLobby();
    }
  }

  /**
   * Sets the return to lobby callback
   */
  public setReturnToLobbyHandler(handler: () => void): void {
    this.onReturnToLobby = handler;
  }

  /**
   * Starts the offline game
   */
  public startGame(): void {
    this.controller.startGame();
  }

  /**
   * Gets the container element
   */
  public getContainer(): HTMLElement | null {
    return this.container;
  }

  /**
   * Gets the offline game controller
   */
  public getController(): OfflineGameController {
    return this.controller;
  }

  /**
   * Shows the offline indicator
   */
  public showOfflineIndicator(): void {
    if (this.offlineIndicator) {
      this.offlineIndicator.style.display = 'flex';
    }
  }

  /**
   * Hides the offline indicator
   */
  public hideOfflineIndicator(): void {
    if (this.offlineIndicator) {
      this.offlineIndicator.style.display = 'none';
    }
  }

  /**
   * Updates the game state
   */
  public update(state: GameState): void {
    this.gameView.update(state);
  }

  /**
   * Cleans up the offline game view
   */
  public destroy(): void {
    this.controller.stop();
    this.onReturnToLobby = null;
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}