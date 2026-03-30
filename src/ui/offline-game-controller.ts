// Contract Crown Offline Game Controller
// Manages offline game flow with bot players

import type { GameState, Card, Suit } from '../engine/types.js';
import { 
  createInitialState, 
  createDeck,
  shuffle,
  createPlayers,
  declareTrump, 
  playCard, 
  canPlayCard,
  calculateScore,
  isGameComplete,
  startNewRound as engineStartNewRound
} from '../engine/index.js';
import { BotManager } from '../bot/index.js';
import { GameView } from './game-view.js';
import { HapticController } from './haptic-controller.js';

export type OfflineGameCallback = (state: GameState) => void;

export class OfflineGameController {
  private gameState: GameState;
  private botManager: BotManager;
  private gameView: GameView;
  private hapticController: HapticController;
  private userPlayerIndex: number = 0;
  private botTurnTimeout: ReturnType<typeof setTimeout> | null = null;
  private onStateChange: OfflineGameCallback | null = null;
  private isRunning: boolean = false;
  private roundNumber: number = 0;

  constructor() {
    this.gameState = createInitialState();
    this.botManager = new BotManager();
    this.gameView = new GameView();
    this.hapticController = new HapticController();
    this.setupEventHandlers();
  }

  /**
   * Sets up event handlers for UI interactions
   */
  private setupEventHandlers(): void {
    // Handle card taps from user
    this.gameView.setCardTapHandler((card: Card) => {
      this.handleUserCardPlay(card);
    });

    // Handle trump selection from user
    this.gameView.setTrumpSelectionHandler((suit: Suit) => {
      this.handleUserTrumpDeclaration(suit);
    });
  }

  /**
   * Starts a new offline game
   * Requirement 10.1: Provide 3 AI opponents for local single-player games
   */
  public startGame(): void {
    this.isRunning = true;
    this.roundNumber = 0;
    this.gameState = createInitialState();
    
    // Create players with bots
    this.gameState.players = [
      { id: 0, hand: [], team: 0, isBot: false }, // User
      { id: 1, hand: [], team: 1, isBot: true },  // Bot
      { id: 2, hand: [], team: 0, isBot: true },  // Bot
      { id: 3, hand: [], team: 1, isBot: true }   // Bot
    ];

    // Start the game flow
    this.startNewRound();
  }

  /**
   * Starts a new round
   * Requirement 2.1, 2.2, 4.1, 4.2, 10.1
   */
  private startNewRound(): void {
    if (!this.isRunning) return;

    // Increment round counter
    this.roundNumber++;

    // Show re-dealing message
    this.gameView.showReDealing();

    // Deal cards with validation (handles re-deal if needed)
    setTimeout(() => {
      // Create new deck and shuffle
      this.gameState.deck = shuffle(createDeck());
      
      // Reset players with fresh hands (preserve team assignments)
      this.gameState.players = createPlayers();
      
      // Deal 4 cards to each player
      for (let i = 0; i < 4; i++) {
        for (const player of this.gameState.players) {
          player.hand.push(this.gameState.deck.pop()!);
        }
      }

      // Set crown holder: force human on first round, normal crown rule after
      if (this.roundNumber === 1) {
        this.gameState.crownHolder = this.userPlayerIndex;
      } else {
        this.gameState.crownHolder = (this.gameState.dealer + 1) % 4;
      }
      this.gameState.currentPlayer = this.gameState.crownHolder;
      this.gameState.phase = 'TRUMP_DECLARATION';
      
      // Hide re-dealing message
      this.gameView.hideReDealing();

      // Update UI
      this.notifyStateChange();

      // Check if crown holder is a bot
      if (this.gameState.crownHolder !== this.userPlayerIndex) {
        // Bot declares trump
        this.scheduleBotTrumpDeclaration();
      } else {
        // Show trump selector for user
        this.gameView.showTrumpSelector();
      }
    }, 500);
  }

  /**
   * Schedules bot trump declaration with delay
   * Requirement 10.2: Select legal card within 1 second
   */
  private scheduleBotTrumpDeclaration(): void {
    const delay = this.botManager.getDecisionDelay();
    
    this.botTurnTimeout = setTimeout(() => {
      if (!this.isRunning) return;

      const botIndex = this.gameState.crownHolder;
      const botHand = this.gameState.players[botIndex].hand;
      const selectedSuit = this.botManager.selectTrumpSuit(botHand);

      // Declare trump
      declareTrump(this.gameState, selectedSuit);
      
      // Trigger haptic feedback
      this.hapticController.triggerTrumpDeclared();

      // Deal final 4 cards to each player
      for (let i = 0; i < 4; i++) {
        for (const player of this.gameState.players) {
          player.hand.push(this.gameState.deck.pop()!);
        }
      }

      this.gameState.phase = 'TRICK_PLAY';
      this.notifyStateChange();

      // Start trick play
      this.scheduleBotTurn();
    }, delay);
  }

  /**
   * Handles user trump declaration
   */
  private handleUserTrumpDeclaration(suit: Suit): void {
    if (this.gameState.phase !== 'TRUMP_DECLARATION') return;
    if (this.gameState.crownHolder !== this.userPlayerIndex) return;

    // Declare trump
    declareTrump(this.gameState, suit);
    
    // Hide trump selector
    this.gameView.hideTrumpSelector();

    // Trigger haptic feedback
    this.hapticController.triggerTrumpDeclared();

    // Deal final 4 cards to each player
    for (let i = 0; i < 4; i++) {
      for (const player of this.gameState.players) {
        player.hand.push(this.gameState.deck.pop()!);
      }
    }

    this.gameState.phase = 'TRICK_PLAY';
    this.notifyStateChange();

    // Start trick play
    this.scheduleBotTurn();
  }

  /**
   * Schedules bot card play with delay
   * Requirement 10.2: Select legal card within 1 second
   */
  private scheduleBotTurn(): void {
    if (!this.isRunning) return;
    if (this.gameState.phase !== 'TRICK_PLAY') return;

    const currentPlayer = this.gameState.currentPlayer;

    // If it's user's turn, don't schedule bot
    if (currentPlayer === this.userPlayerIndex) {
      this.notifyStateChange();
      return;
    }

    // Schedule bot turn
    const delay = this.botManager.getDecisionDelay();
    
    this.botTurnTimeout = setTimeout(() => {
      if (!this.isRunning) return;

      this.executeBotTurn(currentPlayer);
    }, delay);
  }

  /**
   * Executes a bot's turn
   * Requirement 10.2: Select legal card within 1 second
   * Requirement 10.5: Implement basic strategy
   */
  private executeBotTurn(playerIndex: number): void {
    if (!this.isRunning) return;
    if (this.gameState.phase !== 'TRICK_PLAY') return;
    if (this.gameState.currentPlayer !== playerIndex) return;

    try {
      // Bot selects a card
      const selectedCard = this.botManager.selectCard(this.gameState, playerIndex);

      // Play the card
      playCard(this.gameState, playerIndex, selectedCard);

      // Check if trick is complete
      if (this.gameState.currentTrick.cards.length === 0 && this.gameState.completedTricks.length > 0) {
        // Trick was just completed - show cards briefly before collecting
        const lastTrick = this.gameState.completedTricks[this.gameState.completedTricks.length - 1];
        if (lastTrick.winner !== null) {
          // Update UI first to show the complete trick (including the 4th card)
          this.notifyStateChange();
          
          // Wait 2 seconds before animating trick collection so players can see the result
          setTimeout(() => {
            if (!this.isRunning) return;
            
            this.gameView.animateTrickCollection(lastTrick.winner!);
            
            // Trigger haptic if user won
            if (lastTrick.winner === this.userPlayerIndex) {
              this.hapticController.triggerTrickWon();
            }
            
            // Check if round is complete after animation
            if (this.gameState.completedTricks.length === 8) {
              // Wait for trick collection animation to complete before showing round end modal
              setTimeout(() => this.handleRoundEnd(), 600);
              return;
            }
            
            // Schedule next bot turn or wait for user
            this.scheduleBotTurn();
          }, 2000);
          return;
        }
      }

      // FIX: Update UI immediately for all bot card plays
      // This ensures the card is displayed in the trick area before any delay
      this.notifyStateChange();

      // Check if round is complete (after trick resolution)
      if (this.gameState.completedTricks.length === 8) {
        this.handleRoundEnd();
        return;
      }

      // Schedule next bot turn or wait for user
      this.scheduleBotTurn();
    } catch (error) {
      console.error('Bot turn error:', error);
      // Try again with a different card
      this.executeBotTurn(playerIndex);
    }
  }

  /**
   * Handles user card play
   */
  private handleUserCardPlay(card: Card): void {
    if (!this.isRunning) return;
    if (this.gameState.phase !== 'TRICK_PLAY') return;
    if (this.gameState.currentPlayer !== this.userPlayerIndex) return;

    // Validate card can be played
    if (!canPlayCard(this.gameState, this.userPlayerIndex, card)) {
      return;
    }

    try {
      // Play the card
      playCard(this.gameState, this.userPlayerIndex, card);

      // Trigger haptic feedback
      this.hapticController.triggerYourTurn();

      // Check if trick is complete
      if (this.gameState.currentTrick.cards.length === 0 && this.gameState.completedTricks.length > 0) {
        // Trick was just completed - show cards briefly before collecting
        const lastTrick = this.gameState.completedTricks[this.gameState.completedTricks.length - 1];
        if (lastTrick.winner !== null) {
          // Update UI first to show the complete trick
          this.notifyStateChange();
          
          // Wait 2 seconds before animating trick collection so players can see the result
          setTimeout(() => {
            if (!this.isRunning) return;
            
            this.gameView.animateTrickCollection(lastTrick.winner!);
            
            // Trigger haptic if user won
            if (lastTrick.winner === this.userPlayerIndex) {
              this.hapticController.triggerTrickWon();
            }
            
            // Check if round is complete after animation
            if (this.gameState.completedTricks.length === 8) {
              setTimeout(() => this.handleRoundEnd(), 600);
              return;
            }
            
            // Schedule next bot turn
            this.scheduleBotTurn();
          }, 2000);
          return;
        }
      }

      // Update UI
      this.notifyStateChange();

      // Check if round is complete (after trick resolution)
      if (this.gameState.completedTricks.length === 8) {
        this.handleRoundEnd();
        return;
      }

      // Schedule next bot turn
      this.scheduleBotTurn();
    } catch (error) {
      console.error('User card play error:', error);
    }
  }

  /**
   * Handles round end
   */
  private handleRoundEnd(): void {
    if (!this.isRunning) return;

    // Calculate scores for this round
    calculateScore(this.gameState);

    // Update UI to show final scores
    this.notifyStateChange();

    // Show round end modal after a delay (2 seconds)
    setTimeout(() => {
      if (!this.isRunning) return;

      this.gameView.showRoundEndModal();

      // Wait for user to continue
      setTimeout(() => {
        if (!this.isRunning) return;

        // Check if game is complete
        if (isGameComplete(this.gameState)) {
          this.gameState.phase = 'GAME_END';
          this.handleGameEnd();
          return;
        }

        // Rotate dealer and crown for next round
        this.gameState.dealer = (this.gameState.dealer + 1) % 4;
        
        // Reset for new round (keep scores, reset tricks)
        this.gameState.completedTricks = [];
        this.gameState.currentTrick = { leadPlayer: 0, cards: [], winner: null };
        this.gameState.trumpSuit = null;
        this.gameState.phase = 'DEALING_INITIAL';

        // CRITICAL: Clear trick display buffer to flush old cards from UI
        // This ensures no cards from the previous round are visible when new round starts
        this.gameView.clearTrickDisplayBuffer();

        // Start new round
        this.startNewRound();
      }, 2000);
    }, 2000);
  }

  /**
   * Handles game end
   */
  private handleGameEnd(): void {
    if (!this.isRunning) return;

    // Trigger victory haptic
    this.hapticController.triggerVictory();

    // Show victory modal
    this.gameView.showVictoryModal();
  }

  /**
   * Notifies state change to UI
   */
  private notifyStateChange(): void {
    this.gameView.update(this.gameState);
    
    if (this.onStateChange) {
      this.onStateChange(this.gameState);
    }
  }

  /**
   * Sets a callback for state changes
   */
  public setStateChangeCallback(callback: OfflineGameCallback): void {
    this.onStateChange = callback;
  }

  /**
   * Gets the current game state
   */
  public getGameState(): GameState {
    return this.gameState;
  }

  /**
   * Gets the game view
   */
  public getGameView(): GameView {
    return this.gameView;
  }

  /**
   * Gets the user player index
   */
  public getUserPlayerIndex(): number {
    return this.userPlayerIndex;
  }

  /**
   * Pauses the game
   */
  public pause(): void {
    this.isRunning = false;
    if (this.botTurnTimeout) {
      clearTimeout(this.botTurnTimeout);
      this.botTurnTimeout = null;
    }
  }

  /**
   * Resumes the game
   */
  public resume(): void {
    this.isRunning = true;
    this.scheduleBotTurn();
  }

  /**
   * Stops the game and cleans up
   */
  public stop(): void {
    this.isRunning = false;
    if (this.botTurnTimeout) {
      clearTimeout(this.botTurnTimeout);
      this.botTurnTimeout = null;
    }
    this.gameView.destroy();
  }

  /**
   * Restarts the game
   */
  public restart(): void {
    this.stop();
    this.gameView = new GameView();
    this.setupEventHandlers();
    this.startGame();
  }
}