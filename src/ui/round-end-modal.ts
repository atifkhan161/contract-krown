// Contract Crown Round End Modal
// Modal component for displaying round results with bottom sheet pattern

import type { GameState } from '../engine/types.js';
import type { ModalActionHandler } from './types.js';
import { HapticController } from './haptic-controller.js';
import { ModalBottomSheet } from './modal-bottom-sheet.js';

/**
 * RoundEndModal component
 * Requirement 16.1: Display round winner and points awarded
 * Uses ModalBottomSheet with allowBackdropDismiss=true
 */
export class RoundEndModal {
  private bottomSheet: ModalBottomSheet;
  private onContinue: ModalActionHandler | null = null;
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
    const contentHtml = this.renderContent(state);
    this.bottomSheet.show();
    this.bottomSheet.setContent(contentHtml);
    this.setupContinueHandler();

    // Trigger haptic feedback for trick win
    this.hapticController.triggerTrickWon();
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
    this.onContinue = null;
  }

  /**
   * Renders the round end content
   */
  private renderContent(state: GameState): string {
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

    return `
      <div class="round-end-content">
        <h3 class="round-end-title">Round Complete!</h3>
        <div class="round-end-result">
          <p class="round-end-result-text">${resultText}</p>
          <p class="round-end-points">+${pointsAwarded} points</p>
        </div>
        <div class="round-end-tricks">
          <div class="round-end-trick-item">
            <span class="round-end-trick-label">Team 1</span>
            <span class="round-end-trick-value">${team0Tricks} tricks</span>
          </div>
          <div class="round-end-trick-item">
            <span class="round-end-trick-label">Team 2</span>
            <span class="round-end-trick-value">${team1Tricks} tricks</span>
          </div>
        </div>
        <div class="round-end-scores">
          <div class="round-end-score-item">
            <span class="round-end-score-label">Team 1 Total</span>
            <span class="round-end-score-value">${state.scores[0]} points</span>
          </div>
          <div class="round-end-score-item">
            <span class="round-end-score-label">Team 2 Total</span>
            <span class="round-end-score-value">${state.scores[1]} points</span>
          </div>
        </div>
        <div class="round-end-actions">
          <button class="round-end-continue-btn">Continue</button>
        </div>
      </div>
    `;
  }

  /**
   * Sets up the continue button handler
   */
  private setupContinueHandler(): void {
    const sheetElement = this.bottomSheet.getSheetElement();
    if (!sheetElement) return;

    const continueBtn = sheetElement.querySelector('.round-end-continue-btn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        this.handleContinue();
      });
    }
  }
}
