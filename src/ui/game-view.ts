// Contract Crown Game View
// Main game view component that integrates all UI components

import type { GameState, Card, Suit } from '../engine/types.js';
import type { UIState, CardTapHandler, TrumpSelectionHandler } from './types.js';
import { FeltGrid } from './felt-grid.js';
import { GameHeader } from './game-header.js';
import { HapticController } from './haptic-controller.js';
import { canPlayCard, declareTrump } from '../engine/index.js';

export class GameView {
  private container: HTMLElement | null = null;
  private header: GameHeader;
  private feltGrid: FeltGrid;
  private hapticController: HapticController;
  private userPlayerIndex: number = 0;
  private onCardTap: CardTapHandler | null = null;
  private onTrumpSelect: TrumpSelectionHandler | null = null;
  private uiState: UIState;

  constructor() {
    this.header = new GameHeader();
    this.feltGrid = new FeltGrid();
    this.hapticController = new HapticController();
    this.uiState = {
      gameState: this.createEmptyGameState(),
      selectedCard: null,
      playableCards: [],
      animatingCards: [],
      showTrumpSelector: false,
      showRoundEnd: false,
      showVictory: false,
      reDealing: false
    };
    this.createElements();
    this.setupEventListeners();
  }

  /**
   * Creates an empty game state for initialization
   */
  private createEmptyGameState(): GameState {
    return {
      deck: [],
      players: [],
      currentTrick: { leadPlayer: 0, cards: [], winner: null },
      completedTricks: [],
      trumpSuit: null,
      crownHolder: 0,
      dealer: 0,
      phase: 'DEALING_INITIAL',
      scores: [0, 0],
      currentPlayer: 0
    };
  }

  /**
   * Creates the DOM elements for the game view
   */
  private createElements(): void {
    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    this.container = document.createElement('div');
    this.container.className = 'game-view';

    // Add header
    const headerContainer = this.header.getContainer();
    if (headerContainer) {
      this.container.appendChild(headerContainer);
    }

    // Add felt grid
    const feltGridContainer = this.feltGrid.getContainer();
    if (feltGridContainer) {
      this.container.appendChild(feltGridContainer);
    }
  }

  /**
   * Sets up event listeners for card interactions
   */
  private setupEventListeners(): void {
    if (!this.container) return;

    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    // Listen for card clicks
    this.container.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const cardElement = target.closest('.card.playable') as HTMLElement;
      
      if (cardElement) {
        const suit = cardElement.dataset.suit as Suit;
        const rank = cardElement.dataset.rank as string;
        
        if (suit && rank) {
          this.handleCardClick({ suit, rank } as Card);
        }
      }
    });
  }

  /**
   * Handles card click events
   */
  private handleCardClick(card: Card): void {
    // Check if it's the user's turn
    if (this.uiState.gameState.currentPlayer !== this.userPlayerIndex) {
      return;
    }

    // Check if card is playable
    const isPlayable = this.uiState.playableCards.some(
      c => c.suit === card.suit && c.rank === card.rank
    );

    if (!isPlayable) {
      return;
    }

    // Trigger haptic feedback
    this.hapticController.triggerYourTurn();

    // Call the card tap handler
    if (this.onCardTap) {
      this.onCardTap(card);
    }
  }

  /**
   * Renders the game view with current state
   */
  public render(state: GameState, userPlayerIndex: number): void {
    this.userPlayerIndex = userPlayerIndex;
    this.uiState.gameState = state;

    // Calculate playable cards for the user
    if (state.phase === 'TRICK_PLAY' && state.currentPlayer === userPlayerIndex) {
      this.uiState.playableCards = this.feltGrid.calculatePlayableCards(state, userPlayerIndex);
    } else {
      this.uiState.playableCards = [];
    }

    // Render header
    this.header.render(state, userPlayerIndex);

    // Render felt grid
    this.feltGrid.render(state, userPlayerIndex, this.uiState.playableCards);

    // Update active player indication
    this.feltGrid.updateActivePlayer(state, userPlayerIndex);

    // Handle re-dealing message
    if (this.uiState.reDealing) {
      this.feltGrid.showReDealingMessage();
    } else {
      this.feltGrid.hideReDealingMessage();
    }

    // Show trump selector if needed
    if (this.uiState.showTrumpSelector) {
      this.showTrumpSelector();
    }

    // Show round end modal if needed
    if (this.uiState.showRoundEnd) {
      this.showRoundEndModal();
    }

    // Show victory modal if needed
    if (this.uiState.showVictory) {
      this.showVictoryModal();
    }
  }

  /**
   * Updates the view with new state
   */
  public update(state: GameState): void {
    this.render(state, this.userPlayerIndex);
  }

  /**
   * Sets the card tap handler
   */
  public setCardTapHandler(handler: CardTapHandler): void {
    this.onCardTap = handler;
  }

  /**
   * Sets the trump selection handler
   */
  public setTrumpSelectionHandler(handler: TrumpSelectionHandler): void {
    this.onTrumpSelect = handler;
  }

  /**
   * Shows the trump selector modal
   * Requirement 2.2: Display 4 trump suit options to Crown Holder
   */
  private showTrumpSelector(): void {
    if (!this.container) return;

    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'modal trump-selector-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Select Trump Suit</h2>
        <div class="suit-options">
          <button class="suit-button hearts" data-suit="HEARTS">♥ Hearts</button>
          <button class="suit-button diamonds" data-suit="DIAMONDS">♦ Diamonds</button>
          <button class="suit-button clubs" data-suit="CLUBS">♣ Clubs</button>
          <button class="suit-button spades" data-suit="SPADES">♠ Spades</button>
        </div>
      </div>
    `;

    // Add event listeners for suit selection
    const suitButtons = modal.querySelectorAll('.suit-button');
    suitButtons.forEach(button => {
      button.addEventListener('click', () => {
        const suit = (button as HTMLElement).dataset.suit as Suit;
        if (suit && this.onTrumpSelect) {
          this.onTrumpSelect(suit);
          this.hideTrumpSelector();
          
          // Trigger haptic feedback for trump declaration
          this.hapticController.triggerTrumpDeclared();
        }
      });
    });

    this.container.appendChild(modal);
  }

  /**
   * Hides the trump selector modal
   */
  public hideTrumpSelector(): void {
    if (!this.container) return;

    const modal = this.container.querySelector('.trump-selector-modal');
    if (modal) {
      modal.remove();
    }
    this.uiState.showTrumpSelector = false;
  }

  /**
   * Shows the round end modal
   * Requirement 16.1: Display round winner and points awarded
   */
  private showRoundEndModal(): void {
    if (!this.container) return;

    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    const state = this.uiState.gameState;
    const [team0Tricks, team1Tricks] = this.countTricksByTeam(state);
    const declaringTeam = state.players[state.crownHolder].team;
    const declaringTeamTricks = declaringTeam === 0 ? team0Tricks : team1Tricks;
    const challengingTeamTricks = declaringTeam === 0 ? team1Tricks : team0Tricks;

    let resultText = '';
    let pointsAwarded = 0;

    if (declaringTeamTricks >= 5) {
      resultText = `Team ${declaringTeam + 1} wins!`;
      pointsAwarded = declaringTeamTricks;
    } else {
      const challengingTeam = declaringTeam === 0 ? 1 : 0;
      resultText = `Team ${challengingTeam + 1} wins!`;
      pointsAwarded = challengingTeamTricks;
    }

    const modal = document.createElement('div');
    modal.className = 'modal round-end-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Round Complete</h2>
        <div class="round-result">
          <p class="result-text">${resultText}</p>
          <p class="points-text">Points awarded: ${pointsAwarded}</p>
          <div class="scores">
            <p>Team 1: ${state.scores[0]} points</p>
            <p>Team 2: ${state.scores[1]} points</p>
          </div>
        </div>
        <button class="continue-button">Continue</button>
      </div>
    `;

    // Add event listener for continue button
    const continueButton = modal.querySelector('.continue-button');
    if (continueButton) {
      continueButton.addEventListener('click', () => {
        this.hideRoundEndModal();
      });
    }

    this.container.appendChild(modal);

    // Trigger haptic feedback for trick win
    this.hapticController.triggerTrickWon();
  }

  /**
   * Hides the round end modal
   */
  public hideRoundEndModal(): void {
    if (!this.container) return;

    const modal = this.container.querySelector('.round-end-modal');
    if (modal) {
      modal.remove();
    }
    this.uiState.showRoundEnd = false;
  }

  /**
   * Shows the victory modal
   * Requirement 16.2: Display winning team and final scores
   */
  private showVictoryModal(): void {
    if (!this.container) return;

    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    const state = this.uiState.gameState;
    const winningTeam = state.scores[0] >= 52 ? 1 : 2;

    const modal = document.createElement('div');
    modal.className = 'modal victory-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Game Over!</h2>
        <div class="victory-result">
          <p class="winner-text">Team ${winningTeam} wins!</p>
          <div class="final-scores">
            <p>Final Score:</p>
            <p>Team 1: ${state.scores[0]} points</p>
            <p>Team 2: ${state.scores[1]} points</p>
          </div>
        </div>
        <div class="victory-actions">
          <button class="new-game-button">New Game</button>
          <button class="lobby-button">Return to Lobby</button>
        </div>
      </div>
    `;

    // Add event listeners for buttons
    const newGameButton = modal.querySelector('.new-game-button');
    const lobbyButton = modal.querySelector('.lobby-button');

    if (newGameButton) {
      newGameButton.addEventListener('click', () => {
        this.hideVictoryModal();
        // Dispatch new game event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('newgame'));
        }
      });
    }

    if (lobbyButton) {
      lobbyButton.addEventListener('click', () => {
        this.hideVictoryModal();
        // Navigate to lobby
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('routechange', { detail: { route: '/lobby' } }));
        }
      });
    }

    this.container.appendChild(modal);

    // Trigger victory haptic pattern
    this.hapticController.triggerVictory();
  }

  /**
   * Hides the victory modal
   */
  public hideVictoryModal(): void {
    if (!this.container) return;

    const modal = this.container.querySelector('.victory-modal');
    if (modal) {
      modal.remove();
    }
    this.uiState.showVictory = false;
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
   * Shows re-dealing message
   */
  public showReDealing(): void {
    this.uiState.reDealing = true;
    this.feltGrid.showReDealingMessage();
  }

  /**
   * Hides re-dealing message
   */
  public hideReDealing(): void {
    this.uiState.reDealing = false;
    this.feltGrid.hideReDealingMessage();
  }

  /**
   * Gets the container element
   */
  public getContainer(): HTMLElement | null {
    return this.container;
  }

  /**
   * Gets the current UI state
   */
  public getUIState(): UIState {
    return this.uiState;
  }
}