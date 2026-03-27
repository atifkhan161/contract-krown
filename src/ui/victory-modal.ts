// Contract Crown Victory Modal
// Modal component for displaying game victory results with DaisyUI components

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

    // Create DaisyUI modal
    this.modal = document.createElement('dialog');
    this.modal.className = 'modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-labelledby', 'victory-title');
    this.modal.setAttribute('aria-modal', 'true');

    // Create modal content with DaisyUI classes
    const modalBox = document.createElement('div');
    modalBox.className = 'modal-box bg-base-100 text-base-content text-center';

    // Victory icon
    const victoryIcon = document.createElement('div');
    victoryIcon.className = 'text-6xl mb-4';
    victoryIcon.textContent = '🏆';
    modalBox.appendChild(victoryIcon);

    // Modal title
    const title = document.createElement('h3');
    title.id = 'victory-title';
    title.className = 'font-bold text-2xl text-primary mb-2';
    title.textContent = 'Victory!';
    modalBox.appendChild(title);

    // Winner announcement
    const winnerAnnouncement = document.createElement('p');
    winnerAnnouncement.className = 'text-xl font-bold text-success mb-6';
    winnerAnnouncement.textContent = `Team ${winningTeam} Wins the Game!`;
    modalBox.appendChild(winnerAnnouncement);

    // Final scores section
    const scoresSection = document.createElement('div');
    scoresSection.className = 'mb-6';

    const scoresTitle = document.createElement('h4');
    scoresTitle.className = 'text-lg font-semibold mb-4';
    scoresTitle.textContent = 'Final Scores';
    scoresSection.appendChild(scoresTitle);

    const scoresGrid = document.createElement('div');
    scoresGrid.className = 'grid grid-cols-2 gap-4';

    const team1ScoreDiv = document.createElement('div');
    team1ScoreDiv.className = 'p-4 bg-primary/20 rounded-lg';
    team1ScoreDiv.innerHTML = `
      <div class="text-sm opacity-70">Team 1</div>
      <div class="text-3xl font-bold text-primary">${state.scores[0]}</div>
      <div class="text-sm opacity-70">points</div>
    `;

    const team2ScoreDiv = document.createElement('div');
    team2ScoreDiv.className = 'p-4 bg-primary/20 rounded-lg';
    team2ScoreDiv.innerHTML = `
      <div class="text-sm opacity-70">Team 2</div>
      <div class="text-3xl font-bold text-primary">${state.scores[1]}</div>
      <div class="text-sm opacity-70">points</div>
    `;

    scoresGrid.appendChild(team1ScoreDiv);
    scoresGrid.appendChild(team2ScoreDiv);
    scoresSection.appendChild(scoresGrid);
    modalBox.appendChild(scoresSection);

    // Modal action buttons
    const modalAction = document.createElement('div');
    modalAction.className = 'modal-action flex flex-col gap-2';

    const newGameButton = document.createElement('button');
    newGameButton.className = 'btn btn-primary btn-lg';
    newGameButton.textContent = 'New Game';
    newGameButton.addEventListener('click', () => {
      this.handleNewGame();
    });

    // Keyboard support
    newGameButton.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
        this.handleNewGame();
      }
    });

    const lobbyButton = document.createElement('button');
    lobbyButton.className = 'btn btn-ghost';
    lobbyButton.textContent = 'Return to Lobby';
    lobbyButton.addEventListener('click', () => {
      this.handleReturnToLobby();
    });

    // Keyboard support
    lobbyButton.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
        this.handleReturnToLobby();
      }
    });

    modalAction.appendChild(newGameButton);
    modalAction.appendChild(lobbyButton);
    modalBox.appendChild(modalAction);

    this.modal.appendChild(modalBox);

    // Add event listeners
    this.modal.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        // Don't auto-close on Escape for victory modal
        event.preventDefault();
      }
    });

    // Append to container
    this.container.appendChild(this.modal);
    this.isOpen = true;

    // Show the modal using DaisyUI's modal API
    if (typeof (this.modal as any).showModal === 'function') {
      (this.modal as any).showModal();
    } else {
      // Fallback for browsers that don't support dialog
      this.modal.classList.add('modal-open');
    }

    // Trigger victory haptic pattern
    // Requirement 16.3: Trigger victory haptic pattern when game ends
    this.hapticController.triggerVictory();

    // Focus new game button for accessibility
    newGameButton.focus();
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