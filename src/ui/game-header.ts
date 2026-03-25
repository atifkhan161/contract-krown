// Contract Crown Game Header
// Game header component with trump suit, crown holder, and scores

import type { GameState, Suit } from '../engine/types.js';

export class GameHeader {
  private container: HTMLElement | null = null;

  constructor() {
    this.createElements();
  }

  /**
   * Creates the DOM elements for the game header
   */
  private createElements(): void {
    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    this.container = document.createElement('div');
    this.container.className = 'game-header';
  }

  /**
   * Renders the game header with current state
   */
  public render(state: GameState, userPlayerIndex: number): void {
    if (!this.container) return;

    const trumpSuitDisplay = this.getTrumpSuitDisplay(state.trumpSuit);
    const crownHolderDisplay = this.getCrownHolderDisplay(state.crownHolder, userPlayerIndex);
    const scoresDisplay = this.getScoresDisplay(state.scores);

    this.container.innerHTML = `
      <div class="header-content">
        <div class="trump-indicator">
          <span class="trump-label">Trump:</span>
          <span class="trump-suit ${state.trumpSuit ? this.getSuitColor(state.trumpSuit) : ''}">${trumpSuitDisplay}</span>
        </div>
        <div class="crown-indicator">
          <span class="crown-label">Crown:</span>
          <span class="crown-holder">${crownHolderDisplay}</span>
        </div>
        <div class="scores-display">
          <div class="team-score team-0">
            <span class="team-label">Team 1:</span>
            <span class="score-value">${state.scores[0]}</span>
          </div>
          <div class="team-score team-1">
            <span class="team-label">Team 2:</span>
            <span class="score-value">${state.scores[1]}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Gets the display text for trump suit
   */
  private getTrumpSuitDisplay(trumpSuit: Suit | null): string {
    if (!trumpSuit) return 'Not set';

    const symbols: Record<Suit, string> = {
      'HEARTS': '♥ Hearts',
      'DIAMONDS': '♦ Diamonds',
      'CLUBS': '♣ Clubs',
      'SPADES': '♠ Spades'
    };
    return symbols[trumpSuit];
  }

  /**
   * Gets the color class for a suit
   */
  private getSuitColor(suit: Suit): string {
    return (suit === 'HEARTS' || suit === 'DIAMONDS') ? 'red' : 'black';
  }

  /**
   * Gets the display text for crown holder
   */
  private getCrownHolderDisplay(crownHolder: number, userPlayerIndex: number): string {
    // Map crown holder index to position name relative to user
    const positionMap: Record<number, string> = {
      [userPlayerIndex]: 'You',
      [(userPlayerIndex + 1) % 4]: 'Left',
      [(userPlayerIndex + 2) % 4]: 'Partner',
      [(userPlayerIndex + 3) % 4]: 'Right'
    };
    return positionMap[crownHolder] || `Player ${crownHolder}`;
  }

  /**
   * Gets the display text for scores
   */
  private getScoresDisplay(scores: [number, number]): string {
    return `${scores[0]} - ${scores[1]}`;
  }

  /**
   * Updates only the scores display
   */
  public updateScore(scores: [number, number]): void {
    if (!this.container) return;

    const team0Score = this.container.querySelector('.team-0 .score-value');
    const team1Score = this.container.querySelector('.team-1 .score-value');

    if (team0Score) team0Score.textContent = scores[0].toString();
    if (team1Score) team1Score.textContent = scores[1].toString();
  }

  /**
   * Updates the trump suit display
   */
  public updateTrumpSuit(trumpSuit: Suit | null): void {
    if (!this.container) return;

    const trumpSuitElement = this.container.querySelector('.trump-suit');
    if (!trumpSuitElement) return;

    trumpSuitElement.textContent = this.getTrumpSuitDisplay(trumpSuit);
    trumpSuitElement.className = `trump-suit ${trumpSuit ? this.getSuitColor(trumpSuit) : ''}`;
  }

  /**
   * Updates the crown holder display
   */
  public updateCrownHolder(crownHolder: number, userPlayerIndex: number): void {
    if (!this.container) return;

    const crownHolderElement = this.container.querySelector('.crown-holder');
    if (!crownHolderElement) return;

    crownHolderElement.textContent = this.getCrownHolderDisplay(crownHolder, userPlayerIndex);
  }

  /**
   * Gets the container element
   */
  public getContainer(): HTMLElement | null {
    return this.container;
  }
}