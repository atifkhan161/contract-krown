// Contract Crown Victory Modal
// Modal component for displaying game victory results with bottom sheet pattern

import type { GameState } from '../engine/types.js';
import type { ModalActionHandler } from './types.js';
import { HapticController } from './haptic-controller.js';
import { ModalBottomSheet } from './modal-bottom-sheet.js';

/**
 * VictoryModal component
 * Requirement 16.2: Display winning team and final scores
 * Requirement 16.3: Trigger victory haptic pattern
 * Requirement 16.4, 16.5: Provide "New Game" and "Return to Lobby" buttons
 * Uses ModalBottomSheet with allowBackdropDismiss=true
 */
export class VictoryModal {
  private bottomSheet: ModalBottomSheet;
  private onNewGame: ModalActionHandler | null = null;
  private onReturnToLobby: ModalActionHandler | null = null;
  private hapticController: HapticController;

  constructor() {
    this.hapticController = new HapticController();
    this.bottomSheet = new ModalBottomSheet({
      allowBackdropDismiss: true,
    });
  }

  /**
   * Sets the container element for the modal
   */
  public setContainer(container: HTMLElement): void {
    this.bottomSheet.setContainer(container);
  }

  /**
   * Sets the new game handler
   */
  public setNewGameHandler(handler: ModalActionHandler): void {
    this.onNewGame = handler;
  }

  /**
   * Sets the return to lobby handler
   */
  public setReturnToLobbyHandler(handler: ModalActionHandler): void {
    this.onReturnToLobby = handler;
  }

  /**
   * Shows the victory modal with game results
   * Requirement 16.2: Display winning team and final scores
   */
  public show(state: GameState): void {
    const contentHtml = this.renderContent(state);
    this.bottomSheet.show(contentHtml);
    this.setupButtonHandlers();

    // Trigger victory haptic pattern
    this.hapticController.triggerVictory();
  }

  /**
   * Handles new game button click
   * Requirement 16.4: Provide "New Game" button
   */
  private handleNewGame(): void {
    if (this.onNewGame) {
      this.onNewGame();
    }
    this.hide();

    // Dispatch new game event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('newgame'));
    }
  }

  /**
   * Handles return to lobby button click
   * Requirement 16.5: Provide "Return to Lobby" button
   */
  private handleReturnToLobby(): void {
    if (this.onReturnToLobby) {
      this.onReturnToLobby();
    }
    this.hide();

    // Navigate to lobby
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('routechange', { detail: { route: '/lobby' } }));
    }
  }

  /**
   * Hides the victory modal
   */
  public hide(): void {
    this.bottomSheet.hide();
  }

  /**
   * Checks if the modal is currently open
   */
  public isVisible(): boolean {
    return this.bottomSheet.isVisible();
  }

  /**
   * Gets the modal element
   */
  public getModalElement(): HTMLElement | null {
    return this.bottomSheet.getSheetElement();
  }

  /**
   * Cleans up the modal
   */
  public destroy(): void {
    this.bottomSheet.destroy();
    this.onNewGame = null;
    this.onReturnToLobby = null;
  }

  /**
   * Renders the victory content
   */
  private renderContent(state: GameState): string {
    const winningTeam = state.scores[0] >= 52 ? 1 : 2;

    return `
      <div class="victory-content">
        <div class="victory-icon">🏆</div>
        <h3 class="victory-title">Victory!</h3>
        <p class="victory-winner">Team ${winningTeam} Wins the Game!</p>
        <div class="victory-scores">
          <h4 class="victory-scores-title">Final Scores</h4>
          <div class="victory-scores-grid">
            <div class="victory-score-item">
              <span class="victory-score-label">Team 1</span>
              <span class="victory-score-value">${state.scores[0]}</span>
              <span class="victory-score-unit">points</span>
            </div>
            <div class="victory-score-item">
              <span class="victory-score-label">Team 2</span>
              <span class="victory-score-value">${state.scores[1]}</span>
              <span class="victory-score-unit">points</span>
            </div>
          </div>
        </div>
        <div class="victory-actions">
          <button class="victory-new-game-btn">New Game</button>
          <button class="victory-lobby-btn">Return to Lobby</button>
        </div>
      </div>
    `;
  }

  /**
   * Sets up button handlers
   */
  private setupButtonHandlers(): void {
    const sheetElement = this.bottomSheet.getSheetElement();
    if (!sheetElement) return;

    const newGameBtn = sheetElement.querySelector('.victory-new-game-btn');
    if (newGameBtn) {
      newGameBtn.addEventListener('click', () => {
        this.handleNewGame();
      });
    }

    const lobbyBtn = sheetElement.querySelector('.victory-lobby-btn');
    if (lobbyBtn) {
      lobbyBtn.addEventListener('click', () => {
        this.handleReturnToLobby();
      });
    }
  }
}
