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
  private onReturnToLobby: (() => void) | null = null;

  constructor() {
    this.controller = new OfflineGameController();
    this.gameView = this.controller.getGameView();
    this.createElements();
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
    `;

    // Add game view
    const gameViewContainer = this.gameView.getContainer();
    if (gameViewContainer) {
      this.container.appendChild(gameViewContainer);
    }

    // Add indicator to container (button removed - now in menu)
    this.container.appendChild(this.offlineIndicator);
  }

  /**
   * Sets up return to lobby handler from game menu
   */
  public setReturnToLobbyHandler(handler: () => void): void {
    this.onReturnToLobby = handler;
  }

  /**
   * Handles return to lobby action
   */
  public handleReturnToLobby(): void {
    // Stop the game
    this.controller.stop();

    // Call the return to lobby callback
    if (this.onReturnToLobby) {
      this.onReturnToLobby();
    }
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