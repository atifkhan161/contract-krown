// Contract Crown Trump Selector Modal
// Modal component for trump suit selection

import type { Suit } from '../engine/types.js';
import type { TrumpSelectionHandler } from './types.js';
import { HapticController } from './haptic-controller.js';

/**
 * TrumpSelector modal component
 * Requirement 2.2: Display 4 trump suit options to Crown Holder
 * Requirement 2.4: Trigger trump declaration animation
 */
export class TrumpSelector {
  private container: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private onTrumpSelect: TrumpSelectionHandler | null = null;
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
   * Sets the trump selection handler
   */
  public setTrumpSelectionHandler(handler: TrumpSelectionHandler): void {
    this.onTrumpSelect = handler;
  }

  /**
   * Shows the trump selector modal
   * Requirement 2.2: Display 4 trump suit options to Crown Holder
   */
  public show(): void {
    if (!this.container || this.isOpen) return;

    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    // Create modal overlay
    this.modal = document.createElement('div');
    this.modal.className = 'modal trump-selector-modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-labelledby', 'trump-selector-title');
    this.modal.setAttribute('aria-modal', 'true');

    this.modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <h2 id="trump-selector-title" class="modal-title">Select Trump Suit</h2>
        <p class="modal-description">As the Crown Holder, choose the trump suit for this round</p>
        <div class="suit-options">
          <button class="suit-button hearts" data-suit="HEARTS" aria-label="Hearts">
            <span class="suit-symbol">♥</span>
            <span class="suit-name">Hearts</span>
          </button>
          <button class="suit-button diamonds" data-suit="DIAMONDS" aria-label="Diamonds">
            <span class="suit-symbol">♦</span>
            <span class="suit-name">Diamonds</span>
          </button>
          <button class="suit-button clubs" data-suit="CLUBS" aria-label="Clubs">
            <span class="suit-symbol">♣</span>
            <span class="suit-name">Clubs</span>
          </button>
          <button class="suit-button spades" data-suit="SPADES" aria-label="Spades">
            <span class="suit-symbol">♠</span>
            <span class="suit-name">Spades</span>
          </button>
        </div>
      </div>
    `;

    // Add event listeners for suit selection
    const suitButtons = this.modal.querySelectorAll('.suit-button');
    suitButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        const target = event.currentTarget as HTMLElement;
        const suit = target.dataset.suit as Suit;
        if (suit) {
          this.handleSuitSelection(suit);
        }
      });

      // Add keyboard support
      button.addEventListener('keydown', (event) => {
        if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
          const target = event.currentTarget as HTMLElement;
          const suit = target.dataset.suit as Suit;
          if (suit) {
            this.handleSuitSelection(suit);
          }
        }
      });
    });

    // Close modal on overlay click
    const overlay = this.modal.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        // Don't allow closing by clicking overlay - must select a suit
      });
    }

    // Close modal on Escape key (but require selection)
    this.modal.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        // Prevent closing - crown holder must select a suit
        event.preventDefault();
      }
    });

    this.container.appendChild(this.modal);
    this.isOpen = true;

    // Focus first button for accessibility
    const firstButton = this.modal.querySelector('.suit-button') as HTMLElement;
    if (firstButton) {
      firstButton.focus();
    }
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
    this.onTrumpSelect = null;
  }
}