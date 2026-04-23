// Contract Crown Trump Selector Modal
// Modal component for trump suit selection with bottom sheet pattern
// Non-dismissible: user must select a suit (no cancel option)

import type { Suit, Card } from '../engine/types.js';
import type { TrumpSelectionHandler } from './types.js';
import { HapticController } from './haptic-controller.js';
import { ModalBottomSheet } from './modal-bottom-sheet.js';

/**
 * TrumpSelector modal component
 * Requirement 2.2: Display 4 trump suit options to Crown Holder
 * Requirement 2.4: Trigger trump declaration animation
 * Uses ModalBottomSheet with allowBackdropDismiss=false (non-dismissible)
 */
export class TrumpSelector {
  private bottomSheet: ModalBottomSheet;
  private onTrumpSelect: TrumpSelectionHandler | null = null;
  private hapticController: HapticController;
  private userHand: Card[] = [];

  constructor() {
    this.hapticController = new HapticController();
    this.bottomSheet = new ModalBottomSheet({
      allowBackdropDismiss: false,
    });
  }

  /**
   * Sets the container element for the modal
   */
  public setContainer(container: HTMLElement): void {
    this.bottomSheet.setContainer(container);
  }

  /**
   * Sets the trump selection handler
   */
  public setTrumpSelectionHandler(handler: TrumpSelectionHandler): void {
    this.onTrumpSelect = handler;
  }

  /**
   * Sets the user's hand for display in the modal
   */
  public setUserHand(hand: Card[]): void {
    this.userHand = hand;
  }

  /**
   * Shows the trump selector modal
   * Requirement 2.2: Display 4 trump suit options to Crown Holder
   */
  public show(): void {
    const contentHtml = this.renderContent();
    this.bottomSheet.show();
    this.bottomSheet.setContent(contentHtml);
    this.setupSuitHandlers();
  }

  /**
   * Handles suit selection
   */
  private handleSuitSelection(suit: Suit): void {
    if (this.onTrumpSelect) {
      this.onTrumpSelect(suit);
    }

    // Trigger haptic feedback for trump declaration
    this.hapticController.triggerTrumpDeclared();

    this.hide();
  }

  /**
   * Hides the trump selector modal
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
    this.onTrumpSelect = null;
  }

  /**
   * Renders the trump selector content
   */
  private renderContent(): string {
    const suits: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];

    const userCardsHtml = this.userHand.length > 0
      ? `<div class="trump-selector-cards">${this.userHand.map(card => this.renderCardElement(card)).join('')}</div>`
      : '';

    const suitButtonsHtml = suits.map(suit => `
      <button class="trump-suit-btn" data-suit="${suit}">
        <span class="trump-suit-symbol ${suit === 'HEARTS' || suit === 'DIAMONDS' ? 'suit-red' : 'suit-black'}">
          ${this.getSuitSymbol(suit)}
        </span>
        <span class="trump-suit-name">${suit.charAt(0) + suit.slice(1).toLowerCase()}</span>
      </button>
    `).join('');

    return `
      <div class="trump-selector-content">
        <h3 class="trump-selector-title">Select Trump Suit</h3>
        <p class="trump-selector-description">As the Crown Holder, choose the trump suit for this round based on your cards:</p>
        ${userCardsHtml}
        <div class="trump-suit-grid">
          ${suitButtonsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Renders a single card element HTML
   */
  private renderCardElement(card: Card): string {
    const isRed = card.suit === 'HEARTS' || card.suit === 'DIAMONDS';
    return `
      <div class="trump-card">
        <span class="trump-card-suit ${isRed ? 'suit-red' : 'suit-black'}">
          ${this.getSuitSymbol(card.suit)}
        </span>
        <span class="trump-card-rank">${card.rank}</span>
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
   * Sets up click handlers for suit buttons
   */
  private setupSuitHandlers(): void {
    const sheetElement = this.bottomSheet.getSheetElement();
    if (!sheetElement) return;

    // Suit buttons
    const suitButtons = sheetElement.querySelectorAll('.trump-suit-btn');
    suitButtons.forEach((btn) => {
      const suit = (btn as HTMLElement).getAttribute('data-suit') as Suit;
      if (suit) {
        btn.addEventListener('click', () => {
          this.handleSuitSelection(suit);
        });
      }
    });
  }
}
