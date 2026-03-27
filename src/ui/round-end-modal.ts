// Contract Crown Round End Modal
// Modal component for displaying round results with DaisyUI components

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

    // Create DaisyUI modal
    this.modal = document.createElement('dialog');
    this.modal.className = 'modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-labelledby', 'round-end-title');
    this.modal.setAttribute('aria-modal', 'true');

    // Create modal content with DaisyUI classes
    const modalBox = document.createElement('div');
    modalBox.className = 'modal-box bg-base-100 text-base-content';

    // Modal title
    const title = document.createElement('h3');
    title.id = 'round-end-title';
    title.className = 'font-bold text-lg text-primary';
    title.textContent = 'Round Complete!';
    modalBox.appendChild(title);

    // Result section
    const resultSection = document.createElement('div');
    resultSection.className = 'py-4';

    // Result highlight
    const resultHighlight = document.createElement('div');
    resultHighlight.className = 'text-center mb-4';

    const resultTextEl = document.createElement('p');
    resultTextEl.className = 'text-xl font-bold text-success';
    resultTextEl.textContent = resultText;

    const pointsTextEl = document.createElement('p');
    pointsTextEl.className = 'text-2xl font-bold text-accent';
    pointsTextEl.textContent = `+${pointsAwarded} points`;

    resultHighlight.appendChild(resultTextEl);
    resultHighlight.appendChild(pointsTextEl);
    resultSection.appendChild(resultHighlight);

    // Trick summary
    const trickSummary = document.createElement('div');
    trickSummary.className = 'grid grid-cols-2 gap-4 mb-4';

    const team1TricksDiv = document.createElement('div');
    team1TricksDiv.className = 'text-center p-3 bg-base-200 rounded-lg';
    team1TricksDiv.innerHTML = `
      <div class="text-sm opacity-70">Team 1</div>
      <div class="text-lg font-bold">${team0Tricks} tricks</div>
    `;

    const team2TricksDiv = document.createElement('div');
    team2TricksDiv.className = 'text-center p-3 bg-base-200 rounded-lg';
    team2TricksDiv.innerHTML = `
      <div class="text-sm opacity-70">Team 2</div>
      <div class="text-lg font-bold">${team1Tricks} tricks</div>
    `;

    trickSummary.appendChild(team1TricksDiv);
    trickSummary.appendChild(team2TricksDiv);
    resultSection.appendChild(trickSummary);

    // Scores
    const scoresDiv = document.createElement('div');
    scoresDiv.className = 'grid grid-cols-2 gap-4';

    const team1ScoreDiv = document.createElement('div');
    team1ScoreDiv.className = 'text-center p-3 bg-primary/20 rounded-lg';
    team1ScoreDiv.innerHTML = `
      <div class="text-sm opacity-70">Team 1 Total</div>
      <div class="text-xl font-bold text-primary">${state.scores[0]} points</div>
    `;

    const team2ScoreDiv = document.createElement('div');
    team2ScoreDiv.className = 'text-center p-3 bg-primary/20 rounded-lg';
    team2ScoreDiv.innerHTML = `
      <div class="text-sm opacity-70">Team 2 Total</div>
      <div class="text-xl font-bold text-primary">${state.scores[1]} points</div>
    `;

    scoresDiv.appendChild(team1ScoreDiv);
    scoresDiv.appendChild(team2ScoreDiv);
    resultSection.appendChild(scoresDiv);

    modalBox.appendChild(resultSection);

    // Modal action buttons
    const modalAction = document.createElement('div');
    modalAction.className = 'modal-action';

    const continueButton = document.createElement('button');
    continueButton.className = 'btn btn-primary btn-lg';
    continueButton.textContent = 'Continue';
    continueButton.addEventListener('click', () => {
      this.handleContinue();
    });

    // Keyboard support
    continueButton.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
        this.handleContinue();
      }
    });

    modalAction.appendChild(continueButton);
    modalBox.appendChild(modalAction);

    this.modal.appendChild(modalBox);

    // Add event listeners
    this.modal.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        this.handleContinue();
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

    // Trigger haptic feedback for trick win
    this.hapticController.triggerTrickWon();

    // Focus continue button for accessibility
    continueButton.focus();
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