// Contract Crown Game View
// Main game view component that integrates all UI components

import type { GameState, Card, Suit } from '../engine/types.js';
import type { UIState, CardTapHandler, TrumpSelectionHandler } from './types.js';
import { FeltGrid } from './felt-grid.js';
import { HapticController } from './haptic-controller.js';
import { TrumpSelector } from './trump-selector.js';
import { RoundEndModal } from './round-end-modal.js';
import { VictoryModal } from './victory-modal.js';
import { 
  animateCardPlay, 
  animateTrickCollection, 
  TouchGestureHandler,
  getElementPosition,
  getTrickAreaPosition,
  getPlayerPosition
} from './card-animation.js';

export class GameView {
  private container: HTMLElement | null = null;
  private feltGrid: FeltGrid;
  private hapticController: HapticController;
  private trumpSelector: TrumpSelector;
  private roundEndModal: RoundEndModal;
  private victoryModal: VictoryModal;
  private touchGestureHandler: TouchGestureHandler | null = null;
  private userPlayerIndex: number = 0;
  private onCardTap: CardTapHandler | null = null;
  private onTrumpSelect: TrumpSelectionHandler | null = null;
  private uiState: UIState;
  // Trick display buffer: holds played cards visually until collection animation completes
  private trickDisplayCards: { card: Card; player: number }[] = [];

  constructor() {
    this.feltGrid = new FeltGrid();
    this.hapticController = new HapticController();
    this.trumpSelector = new TrumpSelector();
    this.roundEndModal = new RoundEndModal();
    this.victoryModal = new VictoryModal();
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
    this.setupModalHandlers();
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

    // Add felt grid (now 3x3 layout with header info in corners)
    const feltGridContainer = this.feltGrid.getContainer();
    if (feltGridContainer) {
      this.container.appendChild(feltGridContainer);
    }

    // Set container for modals
    this.trumpSelector.setContainer(this.container);
    this.roundEndModal.setContainer(this.container);
    this.victoryModal.setContainer(this.container);
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

    // Set up touch gesture handler
    const feltGridContainer = this.feltGrid.getContainer();
    if (feltGridContainer) {
      this.touchGestureHandler = new TouchGestureHandler(feltGridContainer);
      this.touchGestureHandler.setCardTapHandler((card) => {
        this.handleCardClick(card);
      });
    }
  }

  /**
   * Sets up modal handlers
   */
  private setupModalHandlers(): void {
    // Set up trump selection handler
    this.trumpSelector.setTrumpSelectionHandler((suit) => {
      if (this.onTrumpSelect) {
        this.onTrumpSelect(suit);
      }
    });

    // Set up round end handler
    this.roundEndModal.setContinueHandler(() => {
      this.hideRoundEndModal();
    });

    // Set up victory handlers
    this.victoryModal.setNewGameHandler(() => {
      this.hideVictoryModal();
    });

    this.victoryModal.setReturnToLobbyHandler(() => {
      this.hideVictoryModal();
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

    // Animate card play
    this.animateCardPlay(card);

    // Call the card tap handler
    if (this.onCardTap) {
      this.onCardTap(card);
    }
  }

  /**
   * Animates a card being played to the trick area
   * Requirement 15.1: Animate card from player hand to trick area
   */
  private async animateCardPlay(card: Card): Promise<void> {
    if (!this.container) return;

    // Find the card element in the user's hand
    const cardElement = this.container.querySelector(
      `.user-hand .card[data-suit="${card.suit}"][data-rank="${card.rank}"]`
    ) as HTMLElement;

    if (!cardElement) return;

    // Get positions
    const trickArea = this.container.querySelector('.trick-area') as HTMLElement;
    if (!trickArea) return;

    const fromPosition = getElementPosition(cardElement, this.container);
    const toPosition = getTrickAreaPosition(trickArea);

    // Create a copy for animation
    const animatingCard = cardElement.cloneNode(true) as HTMLElement;
    animatingCard.classList.add('animating');
    this.container.appendChild(animatingCard);

    // Hide original card
    cardElement.style.opacity = '0.3';

    // Animate the card
    await animateCardPlay(animatingCard, fromPosition, toPosition, 500);

    // Remove animated card
    if (animatingCard.parentNode) {
      animatingCard.parentNode.removeChild(animatingCard);
    }
  }

  /**
   * Animates trick collection to the winner
   * Requirement 15.3: Animate all trick cards to winner's position
   */
  public async animateTrickCollection(winnerIndex: number): Promise<void> {
    if (!this.container) return;

    const trickCards = this.container.querySelectorAll('.trick-area .card') as NodeListOf<HTMLElement>;
    if (trickCards.length === 0) return;

    // Get winner's display element
    let winnerDisplay: HTMLElement | null = null;
    if (winnerIndex === this.userPlayerIndex) {
      winnerDisplay = this.container.querySelector('.user-hand') as HTMLElement;
    } else if (winnerIndex === (this.userPlayerIndex + 2) % 4) {
      winnerDisplay = this.container.querySelector('.partner-display') as HTMLElement;
    } else if (winnerIndex === (this.userPlayerIndex + 1) % 4) {
      winnerDisplay = this.container.querySelector('.left-opponent') as HTMLElement;
    } else if (winnerIndex === (this.userPlayerIndex + 3) % 4) {
      winnerDisplay = this.container.querySelector('.right-opponent') as HTMLElement;
    }

    if (!winnerDisplay) return;

    const winnerPosition = getPlayerPosition(winnerDisplay, this.container);
    const cardsArray = Array.from(trickCards);

    await animateTrickCollection(cardsArray, winnerPosition, 500);

    // Clear trick display buffer after animation completes
    this.clearTrickDisplayBuffer();
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

    // Update trick display buffer and get winner
    const trickWinner = this.updateTrickDisplayBuffer(state);

    // Render felt grid (now includes header info in corner cells)
    this.feltGrid.render(state, userPlayerIndex, this.uiState.playableCards);

    // Render trick display buffer into trick area (after felt grid render)
    this.feltGrid.renderTrickDisplayBuffer(this.trickDisplayCards, trickWinner);

    // Update active player indication
    this.feltGrid.updateActivePlayer(state, userPlayerIndex);

    // Handle re-dealing message
    if (this.uiState.reDealing) {
      this.feltGrid.showReDealingMessage();
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
   * Updates the trick display buffer based on current game state
   * Requirement 15.1, 15.3: Keep played cards visible until collection animation completes
   * Returns the winner of the trick if one exists
   */
  private updateTrickDisplayBuffer(state: GameState): number | null {
    const currentTrickCards = state.currentTrick.cards.map(pc => ({ card: pc.card, player: pc.player }));
    
    // If current trick has cards, update buffer to match
    if (currentTrickCards.length > 0) {
      this.trickDisplayCards = [...currentTrickCards];
      return state.currentTrick.winner;
    } else if (state.completedTricks.length > 0) {
      // Current trick is empty but we have a completed trick - use its cards
      // This handles the case where the 4th card was just played and trick was resolved
      const lastTrick = state.completedTricks[state.completedTricks.length - 1];
      this.trickDisplayCards = lastTrick.cards.map(pc => ({ card: pc.card, player: pc.player }));
      return lastTrick.winner;
    }
    // If both are empty, keep buffer as-is (will be cleared after animation)
    return null;
  }

  /**
   * Adds a card to the trick display buffer
   */
  public addCardToTrickDisplay(card: Card, player: number): void {
    // If current trick is empty, we're starting a new trick - clear the buffer first
    // This handles the edge case where the human wins and plays a new card quickly
    if (this.uiState.gameState.currentTrick.cards.length === 0) {
      this.trickDisplayCards = [];
    }

    // Avoid duplicates
    const exists = this.trickDisplayCards.some(
      c => c.card.suit === card.suit && c.card.rank === card.rank
    );
    if (!exists) {
      this.trickDisplayCards.push({ card, player });
      this.feltGrid.renderTrickDisplayBuffer(this.trickDisplayCards);
    }
  }

  /**
   * Clears the trick display buffer
   */
  public clearTrickDisplayBuffer(): void {
    this.trickDisplayCards = [];
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
  public showTrumpSelector(): void {
    // Pass the user's hand to the trump selector
    const userHand = this.uiState.gameState.players[this.userPlayerIndex]?.hand || [];
    this.trumpSelector.setUserHand(userHand);
    this.trumpSelector.show();
  }

  /**
   * Hides the trump selector modal
   */
  public hideTrumpSelector(): void {
    this.trumpSelector.hide();
    this.uiState.showTrumpSelector = false;
  }

  /**
   * Shows the round end modal
   * Requirement 16.1: Display round winner and points awarded
   */
  public showRoundEndModal(): void {
    this.roundEndModal.show(this.uiState.gameState);
  }

  /**
   * Hides the round end modal
   */
  public hideRoundEndModal(): void {
    this.roundEndModal.hide();
    this.uiState.showRoundEnd = false;
  }

  /**
   * Shows the victory modal
   * Requirement 16.2: Display winning team and final scores
   */
  public showVictoryModal(): void {
    this.victoryModal.show(this.uiState.gameState);
  }

  /**
   * Hides the victory modal
   */
  public hideVictoryModal(): void {
    this.victoryModal.hide();
    this.uiState.showVictory = false;
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

  /**
   * Gets the touch gesture handler
   */
  public getTouchGestureHandler(): TouchGestureHandler | null {
    return this.touchGestureHandler;
  }

  /**
   * Cleans up the game view
   */
  public destroy(): void {
    this.trumpSelector.destroy();
    this.roundEndModal.destroy();
    this.victoryModal.destroy();
    if (this.touchGestureHandler) {
      this.touchGestureHandler.destroy();
    }
    this.onCardTap = null;
    this.onTrumpSelect = null;
  }
}
