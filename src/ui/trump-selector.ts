// Contract Crown Trump Selector Modal
// Modal component for trump suit selection with DaisyUI components

import type { Suit, Card } from '../engine/types.js';
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
  private userHand: Card[] = [];

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
    if (!this.container || this.isOpen) return;

    // Check if document is available (browser environment)
    if (typeof document === 'undefined') {
      return;
    }

    // Create DaisyUI modal
    this.modal = document.createElement('dialog');
    this.modal.className = 'modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-labelledby', 'trump-selector-title');
    this.modal.setAttribute('aria-modal', 'true');

    // Create modal content with DaisyUI classes
    const modalBox = document.createElement('div');
    modalBox.className = 'modal-box bg-base-100 text-base-content';

    // Modal title
    const title = document.createElement('h3');
    title.id = 'trump-selector-title';
    title.className = 'font-bold text-lg text-primary';
    title.textContent = 'Select Trump Suit';
    modalBox.appendChild(title);

    // Description
    const description = document.createElement('p');
    description.className = 'py-2 text-sm opacity-70';
    description.textContent = 'As the Crown Holder, choose the trump suit for this round based on your cards:';
    modalBox.appendChild(description);

    // Display user's cards if available
    if (this.userHand.length > 0) {
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'flex justify-center gap-2 py-3';

      for (const card of this.userHand) {
        const cardElement = this.createCardElement(card);
        cardsContainer.appendChild(cardElement);
      }

      modalBox.appendChild(cardsContainer);
    }

    // Trump suit options grid
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'grid grid-cols-2 gap-3 py-4';

    const suits: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
    const suitColors: Record<Suit, string> = {
      'HEARTS': 'text-error',
      'DIAMONDS': 'text-error',
      'CLUBS': 'text-base-content',
      'SPADES': 'text-base-content'
    };

    for (const suit of suits) {
      const button = document.createElement('button');
      button.className = 'btn btn-outline btn-lg flex flex-col items-center justify-center h-24 gap-1';
      button.dataset.suit = suit;

      const symbol = document.createElement('span');
      symbol.className = `text-3xl ${suitColors[suit]}`;
      symbol.textContent = this.getSuitSymbol(suit);

      const name = document.createElement('span');
      name.className = 'text-xs font-semibold';
      name.textContent = suit.charAt(0) + suit.slice(1).toLowerCase();

      button.appendChild(symbol);
      button.appendChild(name);

      // Add click handler
      button.addEventListener('click', (event) => {
        const target = event.currentTarget as HTMLElement;
        const selectedSuit = target.dataset.suit as Suit;
        if (selectedSuit) {
          this.handleSuitSelection(selectedSuit);
        }
      });

      // Add keyboard support
      button.addEventListener('keydown', (event) => {
        if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
          const target = event.currentTarget as HTMLElement;
          const selectedSuit = target.dataset.suit as Suit;
          if (selectedSuit) {
            this.handleSuitSelection(selectedSuit);
          }
        }
      });

      optionsContainer.appendChild(button);
    }

    modalBox.appendChild(optionsContainer);

    // Modal action buttons
    const modalAction = document.createElement('div');
    modalAction.className = 'modal-action';

    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn btn-ghost';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
      this.hide();
    });

    modalAction.appendChild(cancelButton);
    modalBox.appendChild(modalAction);

    this.modal.appendChild(modalBox);

    // Add event listeners
    this.modal.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        event.preventDefault();
        this.hide();
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

    // Focus first button for accessibility
    const firstButton = this.modal.querySelector('.btn') as HTMLElement;
    if (firstButton) {
      firstButton.focus();
    }
  }

  /**
   * Creates a card element for display
   */
  private createCardElement(card: Card): HTMLElement {
    const cardEl = document.createElement('div');
    const isRed = card.suit === 'HEARTS' || card.suit === 'DIAMONDS';
    
    cardEl.className = 'card card-compact bg-base-100 border border-base-300 shadow-md w-16 h-24';
    cardEl.innerHTML = `
      <div class="card-body items-center justify-center p-1">
        <span class="text-2xl ${isRed ? 'text-error' : 'text-base-content'}">
          ${this.getSuitSymbol(card.suit)}
        </span>
        <span class="text-lg font-bold">${card.rank}</span>
      </div>
    `;

    return cardEl;
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

    // Close the modal using DaisyUI's modal API
    if (typeof (this.modal as any).close === 'function') {
      (this.modal as any).close();
    } else {
      // Fallback for browsers that don't support dialog
      this.modal.classList.remove('modal-open');
    }

    // Remove after a short delay
    setTimeout(() => {
      if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
      }
      this.modal = null;
      this.isOpen = false;
    }, 100);
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