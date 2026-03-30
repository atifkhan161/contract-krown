// Contract Crown Felt Grid
// Main game table grid component with mobile-first 3x3 layout

import type { GameState, Card, Suit, Player } from '../engine/types.js';
import { canPlayCard } from '../engine/index.js';

export class FeltGrid {
  private container: HTMLElement | null = null;
  private topLeft: HTMLElement | null = null;
  private partnerDisplay: HTMLElement | null = null;
  private topRight: HTMLElement | null = null;
  private leftOpponentDisplay: HTMLElement | null = null;
  private trickArea: HTMLElement | null = null;
  private rightOpponentDisplay: HTMLElement | null = null;
  private bottomLeft: HTMLElement | null = null;
  private userDisplay: HTMLElement | null = null;
  private userHand: HTMLElement | null = null;
  private bottomRight: HTMLElement | null = null;
  private onMenuClick: (() => void) | null = null;

  constructor() {
    this.createElements();
  }

  /**
   * Creates the DOM elements for the felt grid (3x3 layout)
   */
  private createElements(): void {
    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    // Main container - CSS Grid layout
    this.container = document.createElement('div');
    this.container.className = 'felt-grid';

    // Top-left: Trump suit indicator
    this.topLeft = document.createElement('div');
    this.topLeft.className = 'grid-cell top-left';

    // Partner display (top-center)
    this.partnerDisplay = document.createElement('div');
    this.partnerDisplay.className = 'player-display partner-display';

    // Top-right: Crown + scores
    this.topRight = document.createElement('div');
    this.topRight.className = 'grid-cell top-right';

    // Left opponent display
    this.leftOpponentDisplay = document.createElement('div');
    this.leftOpponentDisplay.className = 'player-display opponent-display left-opponent';

    // Trick area (center)
    this.trickArea = document.createElement('div');
    this.trickArea.className = 'trick-area';

    // Right opponent display
    this.rightOpponentDisplay = document.createElement('div');
    this.rightOpponentDisplay.className = 'player-display opponent-display right-opponent';

    // Bottom-left: Trick count
    this.bottomLeft = document.createElement('div');
    this.bottomLeft.className = 'grid-cell bottom-left';

    // User hand (bottom-center - thumb zone)
    this.userHand = document.createElement('div');
    this.userHand.className = 'user-hand';

    // User display (bottom-right of user hand)
    this.userDisplay = document.createElement('div');
    this.userDisplay.className = 'player-display user-display';

    // Bottom-right: Return to lobby button placeholder
    this.bottomRight = document.createElement('div');
    this.bottomRight.className = 'grid-cell bottom-right';

    // Assemble grid (3x3)
    this.container.appendChild(this.topLeft);
    this.container.appendChild(this.partnerDisplay);
    this.container.appendChild(this.topRight);
    this.container.appendChild(this.leftOpponentDisplay);
    this.container.appendChild(this.trickArea);
    this.container.appendChild(this.rightOpponentDisplay);
    this.container.appendChild(this.bottomLeft);
    this.container.appendChild(this.userHand);
    this.container.appendChild(this.bottomRight);

    // Add user display as a child of user hand for proper positioning
    this.userHand.appendChild(this.userDisplay);
  }

  /**
   * Renders the felt grid with current game state
   * Note: Trick area is NOT rendered here - use renderTrickDisplayBuffer() separately
   */
  public render(state: GameState, userPlayerIndex: number, playableCards: Card[]): void {
    if (!this.container) return;

    // Clear previous content (except trick area - handled by renderTrickDisplayBuffer)
    this.clearDisplays();

    // Render corner cells
    this.renderTopLeft(state);
    this.renderPartnerDisplay(state, userPlayerIndex);
    this.renderTopRight(state, userPlayerIndex);
    this.renderOpponentDisplays(state, userPlayerIndex);
    // Note: Trick area is rendered separately via renderTrickDisplayBuffer()
    this.renderBottomLeft(state);
    this.renderUserHand(state, userPlayerIndex, playableCards);
    this.renderUserDisplay(state, userPlayerIndex);
    this.renderBottomRight();
  }

  /**
   * Clears all display areas (except trick area - handled by renderTrickDisplayBuffer)
   */
  private clearDisplays(): void {
    if (this.topLeft) this.topLeft.innerHTML = '';
    if (this.partnerDisplay) this.partnerDisplay.innerHTML = '';
    if (this.topRight) this.topRight.innerHTML = '';
    if (this.leftOpponentDisplay) this.leftOpponentDisplay.innerHTML = '';
    if (this.rightOpponentDisplay) this.rightOpponentDisplay.innerHTML = '';
    // Note: Trick area is NOT cleared here - renderTrickDisplayBuffer() handles it
    if (this.bottomLeft) this.bottomLeft.innerHTML = '';
    if (this.userHand) this.userHand.innerHTML = '';
    if (this.bottomRight) this.bottomRight.innerHTML = '';
  }

  /**
   * Renders top-left corner: Trump suit indicator
   */
  private renderTopLeft(state: GameState): void {
    if (!this.topLeft) return;

    const trumpSuit = state.trumpSuit;
    if (!trumpSuit) {
      this.topLeft.innerHTML = `
        <div class="trump-cell">
          <span class="trump-cell-label">Trump</span>
          <span class="trump-cell-value">--</span>
        </div>
      `;
      return;
    }

    const suitSymbol = this.getSuitSymbol(trumpSuit);
    const suitColor = this.getSuitColor(trumpSuit);

    this.topLeft.innerHTML = `
      <div class="trump-cell">
        <span class="trump-cell-label">Trump</span>
        <span class="trump-cell-value ${suitColor}">${suitSymbol}</span>
      </div>
    `;
  }

  /**
   * Renders partner display at top-center position
   */
  private renderPartnerDisplay(state: GameState, userPlayerIndex: number): void {
    if (!this.partnerDisplay) return;

    const partnerIndex = (userPlayerIndex + 2) % 4;
    const partner = state.players[partnerIndex];
    const isActive = state.currentPlayer === partnerIndex;
    const isCrownHolder = state.crownHolder === partnerIndex;
    const teamNumber = partner.team === 0 ? 'Team 1' : 'Team 2';
    const teamClass = partner.team === 0 ? 'team-0' : 'team-1';

    this.partnerDisplay.innerHTML = `
      <div class="player-info ${isActive ? 'active' : ''} ${isCrownHolder ? 'crown-holder' : ''}">
        <div class="player-avatar">
          ${isCrownHolder ? '<span class="crown-icon">👑</span>' : ''}
          ${isActive ? '<div class="active-ring"></div>' : ''}
        </div>
        <div class="player-name">Partner</div>
        <div class="team-label ${teamClass}">${teamNumber}</div>
        <div class="card-count">${partner.hand.length} cards</div>
      </div>
    `;
  }

  /**
   * Renders top-right corner: Crown holder + team scores
   */
  private renderTopRight(state: GameState, userPlayerIndex: number): void {
    if (!this.topRight) return;

    const crownHolderName = this.getCrownHolderName(state.crownHolder, userPlayerIndex);
    const team0Score = state.scores[0];
    const team1Score = state.scores[1];

    this.topRight.innerHTML = `
      <div class="scores-cell">
        <span class="scores-cell-label">Scores</span>
        <div class="scores-cell-row">
          <span class="team-score-mini team-0">${team0Score}</span>
          <span class="scores-divider">-</span>
          <span class="team-score-mini team-1">${team1Score}</span>
        </div>
        <span class="crown-cell-name">👑 ${crownHolderName}</span>
      </div>
    `;
  }

  /**
   * Renders bottom-left corner: Trick count and current round score
   */
  private renderBottomLeft(state: GameState): void {
    if (!this.bottomLeft) return;

    const completedTricks = state.completedTricks.length;
    const totalTricks = 8;

    // Calculate current round tricks won by each team
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

    this.bottomLeft.innerHTML = `
      <div class="trick-count-cell">
        <span class="trick-count-value">${completedTricks}/${totalTricks}</span>
        <span class="trick-count-label">Tricks</span>
        <div class="round-score-row">
          <span class="round-score team-0">${team0Tricks}</span>
          <span class="round-score-divider">-</span>
          <span class="round-score team-1">${team1Tricks}</span>
        </div>
      </div>
    `;
  }

  /**
   * Renders bottom-right corner: Menu button
   */
  private renderBottomRight(): void {
    if (!this.bottomRight) return;

    this.bottomRight.innerHTML = `
      <div class="bottom-right-cell">
        <button class="menu-icon-btn btn btn-ghost btn-sm">
          <span class="menu-icon text-2xl">≡</span>
        </button>
      </div>
    `;

    const menuBtn = this.bottomRight.querySelector('.menu-icon-btn');
    if (menuBtn && this.onMenuClick) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onMenuClick?.();
      });
    }
  }

  /**
   * Sets the menu click handler
   */
  public setMenuClickHandler(handler: () => void): void {
    this.onMenuClick = handler;
  }

  /**
   * Gets crown holder name relative to user
   */
  private getCrownHolderName(crownHolder: number, userPlayerIndex: number): string {
    const positionMap: Record<number, string> = {
      [userPlayerIndex]: 'You',
      [(userPlayerIndex + 1) % 4]: 'L',
      [(userPlayerIndex + 2) % 4]: 'P',
      [(userPlayerIndex + 3) % 4]: 'R'
    };
    return positionMap[crownHolder] || `P${crownHolder}`;
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
    const teamNumber = player.team === 0 ? 'Team 1' : 'Team 2';
    const teamClass = player.team === 0 ? 'team-0' : 'team-1';

    container.innerHTML = `
      <div class="player-info ${isActive ? 'active' : ''} ${isCrownHolder ? 'crown-holder' : ''}">
        <div class="player-avatar">
          ${isCrownHolder ? '<span class="crown-icon">👑</span>' : ''}
          ${isActive ? '<div class="active-ring"></div>' : ''}
        </div>
        <div class="player-name">${label}</div>
        <div class="team-label ${teamClass}">${teamNumber}</div>
        <div class="card-count">${player.hand.length} cards</div>
      </div>
    `;
  }

  /**
   * Renders the trick area in the center
   * Now supports circular card arrangement with player labels
   */
  private renderTrickArea(state: GameState): void {
    if (!this.trickArea) return;

    const trickCards = state.currentTrick.cards;
    
    if (trickCards.length === 0) {
      this.trickArea.innerHTML = '<div class="trick-placeholder">Play a card</div>';
      return;
    }

    // Render cards in circular arrangement with player labels
    let cardsHtml = '<div class="trick-cards">';
    for (const playedCard of trickCards) {
      const position = this.getCardPosition(playedCard.player);
      const playerLabel = this.getPlayerLabel(playedCard.player);
      const isWinner = state.currentTrick.winner === playedCard.player;
      
      cardsHtml += `
        <div class="trick-card-slot ${position}">
          ${this.renderCard(playedCard.card, false, false)}
          <span class="card-player-label ${isWinner ? 'winner' : ''}">${playerLabel}</span>
        </div>
      `;
    }
    cardsHtml += '</div>';

    this.trickArea.innerHTML = cardsHtml;
  }

  /**
   * Renders trick cards from a display buffer (used during animations)
   * Requirement 15.1, 15.3: Keep cards visible until collection animation completes
   */
  public renderTrickDisplayBuffer(displayCards: { card: Card; player: number }[], winner: number | null = null): void {
    if (!this.trickArea) return;

    if (displayCards.length === 0) {
      this.trickArea.innerHTML = '<div class="trick-placeholder">Play a card</div>';
      return;
    }

    let cardsHtml = '<div class="trick-cards">';
    for (const playedCard of displayCards) {
      const position = this.getCardPosition(playedCard.player);
      const playerLabel = this.getPlayerLabel(playedCard.player);
      const isWinner = winner === playedCard.player;
      
      cardsHtml += `
        <div class="trick-card-slot ${position}">
          ${this.renderCard(playedCard.card, false, false)}
          <span class="card-player-label ${isWinner ? 'winner' : ''}">${playerLabel}</span>
        </div>
      `;
    }
    cardsHtml += '</div>';

    this.trickArea.innerHTML = cardsHtml;
  }

  /**
   * Gets the CSS position class for a card based on player index
   * Positions are relative to the user (player 0 = bottom)
   */
  private getCardPosition(playerIndex: number): string {
    // Map player index to position relative to user
    // Player 0 (user) = bottom, Player 2 (partner) = top
    // Player 1 (left opponent) = left, Player 3 (right opponent) = right
    const positions: Record<number, string> = {
      0: 'position-bottom',   // User
      1: 'position-left',     // Left opponent
      2: 'position-top',      // Partner
      3: 'position-right'     // Right opponent
    };
    return positions[playerIndex] || 'position-bottom';
  }

  /**
   * Gets the display label for a player
   */
  private getPlayerLabel(playerIndex: number): string {
    const labels: Record<number, string> = {
      0: 'You',
      1: 'Left',
      2: 'Partner',
      3: 'Right'
    };
    return labels[playerIndex] || `P${playerIndex}`;
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

    // Sort cards by deck order: suit (SPADES, HEARTS, DIAMONDS, CLUBS) then rank (7, 8, 9, 10, J, Q, K, A)
    const sortedHand = [...user.hand].sort((a, b) => {
      const suitOrder = { 'SPADES': 0, 'HEARTS': 1, 'DIAMONDS': 2, 'CLUBS': 3 };
      const rankOrder = { '7': 0, '8': 1, '9': 2, '10': 3, 'J': 4, 'Q': 5, 'K': 6, 'A': 7 };
      
      const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
      if (suitDiff !== 0) return suitDiff;
      return rankOrder[a.rank] - rankOrder[b.rank];
    });

    // Build hand cards HTML
    let handHtml = '<div class="hand-cards">';
    for (const card of sortedHand) {
      const isPlayable = playableSet.has(`${card.suit}-${card.rank}`);
      handHtml += this.renderCard(card, isPlayable, false);
    }
    handHtml += '</div>';

    // Set hand cards HTML
    this.userHand.innerHTML = handHtml;

    // Re-append user display element at the bottom
    if (this.userDisplay) {
      this.userHand.appendChild(this.userDisplay);
    }
  }

  /**
   * Renders user display element
   */
  private renderUserDisplay(state: GameState, userPlayerIndex: number): void {
    if (!this.userDisplay) return;

    const user = state.players[userPlayerIndex];
    const isActive = state.currentPlayer === userPlayerIndex;
    const isCrownHolder = state.crownHolder === userPlayerIndex;
    const teamNumber = user.team === 0 ? 'Team 1' : 'Team 2';
    const teamClass = user.team === 0 ? 'team-0' : 'team-1';

    this.userDisplay.innerHTML = `
      <div class="player-info ${isActive ? 'active' : ''} ${isCrownHolder ? 'crown-holder' : ''}">
        <div class="player-avatar">
          ${isCrownHolder ? '<span class="crown-icon">👑</span>' : ''}
          ${isActive ? '<div class="active-ring"></div>' : ''}
        </div>
        <div class="player-name">You</div>
        <div class="team-label ${teamClass}">${teamNumber}</div>
        <div class="card-count">${user.hand.length} cards</div>
      </div>
    `;
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
