// Contract Crown Round End Modal
// Modal component for displaying round results

import type { GameState } from '../engine/types.js';
import type { ModalActionHandler } from './types.js';
import { HapticController } from './haptic-controller.js';

/**
 * RoundEndModal component
 * Requirement 16.1: Display round winner and points awarded
 */
export class RoundEndModal {
  private container: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private onContinue: ModalActionHandler | null = null;
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
   * Sets the continue handler
   */
  public setContinueHandler(handler: ModalActionHandler): void {
    this.onContinue = handler;
  }

  /**
   * Shows the round end modal with results
   * Requirement 16.1: Display round winner and points awarded
   */
  public show(state: GameState): void {
    if (!this.container || this.isOpen) return;

    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    const [team0Tricks, team1Tricks] = this.countTricksByTeam(state);
    const declaringTeam = state.players[state.crownHolder].team;
    const declaringTeamTricks = declaringTeam === 0 ? team0Tricks : team1Tricks;
    const challengingTeamTricks = declaringTeam === 0 ? team1Tricks : team0Tricks;

    let resultText = '';
    let pointsAwarded = 0;
    let winningTeam = 0;

    if (declaringTeamTricks >= 5) {
      winningTeam = declaringTeam;
      resultText = `Team ${declaringTeam + 1} Wins!`;
      pointsAwarded = declaringTeamTricks;
    } else {
      winningTeam = declaringTeam === 0 ? 1 : 0;
      resultText = `Team ${winningTeam + 1} Wins!`;
      pointsAwarded = challengingTeamTricks;
    }

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'modal round-end-modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-labelledby', 'round-end-title');
    this.modal.setAttribute('aria-modal', 'true');

    this.modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <h2 id="round-end-title" class="modal-title">Round Complete!</h2>
        <div class="round-result">
          <div class="result-highlight">
            <p class="result-text">${resultText}</p>
            <p class="points-text">+${pointsAwarded} points</p>
          </div>
          <div class="trick-summary">
            <div class="team-tricks">
              <span class="team-label">Team 1:</span>
              <span class="trick-count">${team0Tricks} tricks</span>
            </div>
            <div class="team-tricks">
              <span class="team-label">Team 2:</span>
              <span class="trick-count">${team1Tricks} tricks</span>
            </div>
          </div>
          <div class="scores">
            <div class="score-item">
              <span class="team-label">Team 1:</span>
              <span class="score-value">${state.scores[0]} points</span>
            </div>
            <div class="score-item">
              <span class="team-label">Team 2:</span>
              <span class="score-value">${state.scores[1]} points</span>
            </div>
          </div>
        </div>
        <button class="continue-button">Continue</button>
      </div>
    `;

    // Add event listener for continue button
    const continueButton = this.modal.querySelector('.continue-button');
    if (continueButton) {
      continueButton.addEventListener('click', () => {
        this.handleContinue();
      });

      // Keyboard support
      continueButton.addEventListener('keydown', (event) => {
        if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
          this.handleContinue();
        }
      });
    }

    // Close modal on overlay click
    const overlay = this.modal.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        this.handleContinue();
      });
    }

    // Close modal on Escape key
    this.modal.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        this.handleContinue();
      }
    });

    this.container.appendChild(this.modal);
    this.isOpen = true;

    // Trigger haptic feedback for trick win
    this.hapticController.triggerTrickWon();

    // Focus continue button for accessibility
    const btn = this.modal.querySelector('.continue-button') as HTMLElement;
    if (btn) {
      btn.focus();
    }
  }

  /**
   * Handles continue button click
   */
  private handleContinue(): void {
    if (this.onContinue) {
      this.onContinue();
    }
    this.hide();
  }

  /**
   * Counts tricks won by each team
   */
  private countTricksByTeam(state: GameState): [number, number] {
    let team0Tricks = 0;
    let team1Tricks = 0;

    for (const trick of state.completedTricks) {
      if (trick.winner !== null) {
        const winnerTeam = state.players[trick.winner].team;
        if (winnerTeam === 0) {
          team0Tricks++;
        } else {
          team1Tricks++;
        }
      }
    }

    return [team0Tricks, team1Tricks];
  }

  /**
   * Hides the round end modal
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
    this.onContinue = null;
  }
}