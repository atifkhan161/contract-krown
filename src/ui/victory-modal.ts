// Contract Crown Victory Modal
// Modal component for displaying game victory results

import type { GameState } from '../engine/types.js';
import type { ModalActionHandler } from './types.js';
import { HapticController } from './haptic-controller.js';

/**
 * VictoryModal component
 * Requirement 16.2: Display winning team and final scores
 * Requirement 16.3: Trigger victory haptic pattern
 * Requirement 16.4, 16.5: Provide "New Game" and "Return to Lobby" buttons
 */
export class VictoryModal {
  private container: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private onNewGame: ModalActionHandler | null = null;
  private onReturnToLobby: ModalActionHandler | null = null;
  private hapticController: HapticController;
  private isOpen: boolean = false;

  constructor() {
    this.hapticController = new HapticController();
  }

  /**
   * Sets the container element for the modal
   */
  public setContainer(container: HTMLElement): void {
    this.container = container;
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
    if (!this.container || this.isOpen) return;

    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    const winningTeam = state.scores[0] >= 52 ? 1 : 2;

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'modal victory-modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-labelledby', 'victory-title');
    this.modal.setAttribute('aria-modal', 'true');

    this.modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="victory-header">
          <h2 id="victory-title" class="modal-title">🏆 Victory! 🏆</h2>
          <p class="winner-announcement">Team ${winningTeam} Wins the Game!</p>
        </div>
        <div class="victory-result">
          <div class="final-scores">
            <h3>Final Scores</h3>
            <div class="score-row">
              <span class="team-label">Team 1</span>
              <span class="team-score">${state.scores[0]} points</span>
            </div>
            <div class="score-row">
              <span class="team-label">Team 2</span>
              <span class="team-score">${state.scores[1]} points</span>
            </div>
          </div>
        </div>
        <div class="victory-actions">
          <button class="new-game-button primary-button">New Game</button>
          <button class="lobby-button secondary-button">Return to Lobby</button>
        </div>
      </div>
    `;

    // Add event listener for new game button
    const newGameButton = this.modal.querySelector('.new-game-button');
    if (newGameButton) {
      newGameButton.addEventListener('click', () => {
        this.handleNewGame();
      });

      // Keyboard support
      newGameButton.addEventListener('keydown', (event) => {
        if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
          this.handleNewGame();
        }
      });
    }

    // Add event listener for lobby button
    const lobbyButton = this.modal.querySelector('.lobby-button');
    if (lobbyButton) {
      lobbyButton.addEventListener('click', () => {
        this.handleReturnToLobby();
      });

      // Keyboard support
      lobbyButton.addEventListener('keydown', (event) => {
        if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
          this.handleReturnToLobby();
        }
      });
    }

    // Close modal on overlay click
    const overlay = this.modal.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        // Don't auto-close on overlay click for victory modal
      });
    }

    this.container.appendChild(this.modal);
    this.isOpen = true;

    // Trigger victory haptic pattern
    // Requirement 16.3: Trigger victory haptic pattern when game ends
    this.hapticController.triggerVictory();

    // Focus new game button for accessibility
    const btn = this.modal.querySelector('.new-game-button') as HTMLElement;
    if (btn) {
      btn.focus();
    }
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
    if (!this.modal || !this.isOpen) return;

    // Add closing animation
    this.modal.classList.add('modal-closing');

    // Remove after animation completes
    setTimeout(() => {
      if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
      }
      this.modal = null;
      this.isOpen = false;
    }, 300);
  }

  /**
   * Checks if the modal is currently open
   */
  public isVisible(): boolean {
    return this.isOpen;
  }

  /**
   * Gets the modal element
   */
  public getModalElement(): HTMLElement | null {
    return this.modal;
  }

  /**
   * Cleans up the modal
   */
  public destroy(): void {
    this.hide();
    this.onNewGame = null;
    this.onReturnToLobby = null;
  }
}