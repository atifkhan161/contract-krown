// Contract Crown Felt Grid
// Main game table grid component with mobile-first layout

import type { GameState, Card, Suit, Player } from '../engine/types.js';
import type { PlayerDisplayInfo, PlayerPosition, CardDisplayState } from './types.js';
import { canPlayCard } from '../engine/index.js';

export class FeltGrid {
  private container: HTMLElement | null = null;
  private partnerDisplay: HTMLElement | null = null;
  private leftOpponentDisplay: HTMLElement | null = null;
  private rightOpponentDisplay: HTMLElement | null = null;
  private trickArea: HTMLElement | null = null;
  private userHand: HTMLElement | null = null;

  constructor() {
    this.createElements();
  }

  /**
   * Creates the DOM elements for the felt grid
   */
  private createElements(): void {
    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    // Main container - CSS Grid layout
    this.container = document.createElement('div');
    this.container.className = 'felt-grid';
    
    // Partner display (top)
    this.partnerDisplay = document.createElement('div');
    this.partnerDisplay.className = 'player-display partner-display';
    
    // Left opponent display
    this.leftOpponentDisplay = document.createElement('div');
    this.leftOpponentDisplay.className = 'player-display opponent-display left-opponent';
    
    // Right opponent display
    this.rightOpponentDisplay = document.createElement('div');
    this.rightOpponentDisplay.className = 'player-display opponent-display right-opponent';
    
    // Trick area (center)
    this.trickArea = document.createElement('div');
    this.trickArea.className = 'trick-area';
    
    // User hand (bottom - thumb zone)
    this.userHand = document.createElement('div');
    this.userHand.className = 'user-hand';
    
    // Assemble grid
    this.container.appendChild(this.partnerDisplay);
    this.container.appendChild(this.leftOpponentDisplay);
    this.container.appendChild(this.trickArea);
    this.container.appendChild(this.rightOpponentDisplay);
    this.container.appendChild(this.userHand);
  }

  /**
   * Renders the felt grid with current game state
   */
  public render(state: GameState, userPlayerIndex: number, playableCards: Card[]): void {
    if (!this.container) return;

    // Clear previous content
    this.clearDisplays();

    // Render each player display
    this.renderPartnerDisplay(state, userPlayerIndex);
    this.renderOpponentDisplays(state, userPlayerIndex);
    this.renderTrickArea(state);
    this.renderUserHand(state, userPlayerIndex, playableCards);
  }

  /**
   * Clears all display areas
   */
  private clearDisplays(): void {
    if (this.partnerDisplay) this.partnerDisplay.innerHTML = '';
    if (this.leftOpponentDisplay) this.leftOpponentDisplay.innerHTML = '';
    if (this.rightOpponentDisplay) this.rightOpponentDisplay.innerHTML = '';
    if (this.trickArea) this.trickArea.innerHTML = '';
    if (this.userHand) this.userHand.innerHTML = '';
  }

  /**
   * Renders partner display at top position
   */
  private renderPartnerDisplay(state: GameState, userPlayerIndex: number): void {
    if (!this.partnerDisplay) return;

    const partnerIndex = (userPlayerIndex + 2) % 4;
    const partner = state.players[partnerIndex];
    const isActive = state.currentPlayer === partnerIndex;
    const isCrownHolder = state.crownHolder === partnerIndex;

    this.partnerDisplay.innerHTML = `
      <div class="player-info ${isActive ? 'active' : ''} ${isCrownHolder ? 'crown-holder' : ''}">
        <div class="player-avatar">
          ${isCrownHolder ? '<span class="crown-icon">👑</span>' : ''}
          ${isActive ? '<div class="active-ring"></div>' : ''}
        </div>
        <div class="player-name">Partner</div>
        <div class="card-count">${partner.hand.length} cards</div>
      </div>
    `;
  }

  /**
   * Renders opponent displays at left and right positions
   */
  private renderOpponentDisplays(state: GameState, userPlayerIndex: number): void {
    if (!this.leftOpponentDisplay || !this.rightOpponentDisplay) return;

    const leftOpponentIndex = (userPlayerIndex + 1) % 4;
    const rightOpponentIndex = (userPlayerIndex + 3) % 4;

    this.renderSingleOpponent(this.leftOpponentDisplay, state.players[leftOpponentIndex], state, leftOpponentIndex, 'Left');
    this.renderSingleOpponent(this.rightOpponentDisplay, state.players[rightOpponentIndex], state, rightOpponentIndex, 'Right');
  }

  /**
   * Renders a single opponent display
   */
  private renderSingleOpponent(
    container: HTMLElement,
    player: Player,
    state: GameState,
    playerIndex: number,
    label: string
  ): void {
    const isActive = state.currentPlayer === playerIndex;
    const isCrownHolder = state.crownHolder === playerIndex;

    container.innerHTML = `
      <div class="player-info ${isActive ? 'active' : ''} ${isCrownHolder ? 'crown-holder' : ''}">
        <div class="player-avatar">
          ${isCrownHolder ? '<span class="crown-icon">👑</span>' : ''}
          ${isActive ? '<div class="active-ring"></div>' : ''}
        </div>
        <div class="player-name">${label}</div>
        <div class="card-count">${player.hand.length} cards</div>
      </div>
    `;
  }

  /**
   * Renders the trick area in the center
   */
  private renderTrickArea(state: GameState): void {
    if (!this.trickArea) return;

    const trickCards = state.currentTrick.cards;
    
    if (trickCards.length === 0) {
      this.trickArea.innerHTML = '<div class="trick-placeholder">Play a card</div>';
      return;
    }

    // Render cards in the trick
    let cardsHtml = '<div class="trick-cards">';
    for (const playedCard of trickCards) {
      cardsHtml += this.renderCard(playedCard.card, false, false);
    }
    cardsHtml += '</div>';

    this.trickArea.innerHTML = cardsHtml;
  }

  /**
   * Renders the user's hand at the bottom (thumb zone)
   */
  private renderUserHand(
    state: GameState,
    userPlayerIndex: number,
    playableCards: Card[]
  ): void {
    if (!this.userHand) return;

    const user = state.players[userPlayerIndex];
    const playableSet = new Set(playableCards.map(c => `${c.suit}-${c.rank}`));

    let handHtml = '<div class="hand-cards">';
    for (const card of user.hand) {
      const isPlayable = playableSet.has(`${card.suit}-${card.rank}`);
      handHtml += this.renderCard(card, isPlayable, false);
    }
    handHtml += '</div>';

    this.userHand.innerHTML = handHtml;
  }

  /**
   * Renders a single card element
   */
  private renderCard(card: Card, isPlayable: boolean, isSelected: boolean): string {
    const suitSymbol = this.getSuitSymbol(card.suit);
    const suitColor = this.getSuitColor(card.suit);
    const rankDisplay = this.getRankDisplay(card.rank);

    return `
      <div class="card ${isPlayable ? 'playable' : 'unplayable'} ${isSelected ? 'selected' : ''}"
           data-suit="${card.suit}"
           data-rank="${card.rank}"
           ${isPlayable ? 'clickable' : ''}>
        <div class="card-content">
          <span class="card-rank">${rankDisplay}</span>
          <span class="card-suit ${suitColor}">${suitSymbol}</span>
        </div>
      </div>
    `;
  }

  /**
   * Gets the symbol for a suit
   */
  private getSuitSymbol(suit: Suit): string {
    const symbols: Record<Suit, string> = {
      'HEARTS': '♥',
      'DIAMONDS': '♦',
      'CLUBS': '♣',
      'SPADES': '♠'
    };
    return symbols[suit];
  }

  /**
   * Gets the color class for a suit
   */
  private getSuitColor(suit: Suit): string {
    return (suit === 'HEARTS' || suit === 'DIAMONDS') ? 'red' : 'black';
  }

  /**
   * Gets the display text for a rank
   */
  private getRankDisplay(rank: string): string {
    return rank; // Ranks are already display-ready (7, 8, 9, 10, J, Q, K, A)
  }

  /**
   * Calculates playability state for each card in a player's hand
   * Property 21: Playability Calculation Correctness
   */
  public calculatePlayableCards(state: GameState, playerIndex: number): Card[] {
    const player = state.players[playerIndex];
    const playableCards: Card[] = [];

    for (const card of player.hand) {
      if (canPlayCard(state, playerIndex, card)) {
        playableCards.push(card);
      }
    }

    return playableCards;
  }

  /**
   * Gets the container element
   */
  public getContainer(): HTMLElement | null {
    return this.container;
  }

  /**
   * Updates the active player indication
   * Property 24: Active Player Indication
   */
  public updateActivePlayer(state: GameState, userPlayerIndex: number): void {
    // Update partner display
    this.updatePlayerActiveState(this.partnerDisplay, state, (userPlayerIndex + 2) % 4);
    
    // Update opponent displays
    this.updatePlayerActiveState(this.leftOpponentDisplay, state, (userPlayerIndex + 1) % 4);
    this.updatePlayerActiveState(this.rightOpponentDisplay, state, (userPlayerIndex + 3) % 4);
  }

  /**
   * Updates active state for a player display
   */
  private updatePlayerActiveState(
    container: HTMLElement | null,
    state: GameState,
    playerIndex: number
  ): void {
    if (!container) return;

    const playerInfo = container.querySelector('.player-info');
    if (!playerInfo) return;

    const isActive = state.currentPlayer === playerIndex;
    
    if (isActive) {
      playerInfo.classList.add('active');
    } else {
      playerInfo.classList.remove('active');
    }
  }

  /**
   * Shows re-dealing message
   * Requirement 21.6: Display "Re-dealing..." message
   */
  public showReDealingMessage(): void {
    if (!this.trickArea) return;

    this.trickArea.innerHTML = '<div class="re-dealing-message">Re-dealing...</div>';
  }

  /**
   * Hides re-dealing message
   */
  public hideReDealingMessage(): void {
    if (!this.trickArea) return;

    // Clear the message - will be replaced by normal trick area content
    this.trickArea.innerHTML = '<div class="trick-placeholder">Play a card</div>';
  }
}