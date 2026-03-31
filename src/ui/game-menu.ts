// Contract Crown Game Menu
// Dropdown menu with played cards viewer

import type { GameState, Card, Suit } from '../engine/types.js';

export interface PlayedCardInfo {
  card: Card;
  playerLabel: 'You' | 'Partner' | 'Left' | 'Right';
  playerIndex: number;
}

export interface PlayedTrickRow {
  trickNumber: number;
  winner: 'You' | 'Partner' | 'Left' | 'Right' | 'In Progress';
  isCurrentTrick: boolean;
  cards: PlayedCardInfo[];
}

export class GameMenu {
  private container: HTMLElement | null = null;
  private menuElement: HTMLElement | null = null;
  private menuButtonElement: HTMLElement | null = null;
  private modalElement: HTMLElement | null = null;
  private isOpen: boolean = false;
  private modalIsOpen: boolean = false;
  private currentUserPlayerIndex: number = 0;
  private onViewPlayedCards: (() => void) | null = null;
  private onReturnToLobby: (() => void) | null = null;
  private onRestartGame: (() => void) | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.createElements();
    }
  }

  private createElements(): void {
    if (typeof document === 'undefined') return;

    this.container = document.createElement('div');
    this.container.className = 'game-menu-container';

    // Create simple menu dropdown (no DaisyUI dependency)
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'game-menu-dropdown';
    this.menuElement.style.cssText = 'position: absolute; bottom: 100%; right: 0; display: none; z-index: 1000;';
    this.menuElement.innerHTML = `
      <div class="menu-content bg-base-100 shadow-lg rounded-box w-48 p-2">
        <button class="menu-item w-full text-left px-4 py-2 hover:bg-base-200 rounded" data-action="view-cards">
          View Played Cards
        </button>
        <button class="menu-item w-full text-left px-4 py-2 hover:bg-base-200 rounded" data-action="restart-game">
          Restart Game
        </button>
        <button class="menu-item w-full text-left px-4 py-2 hover:bg-base-200 rounded" data-action="return-lobby">
          Return to Lobby
        </button>
      </div>
    `;

    // Create modal for played cards
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'played-cards-modal modal';
    this.modalElement.style.display = 'none';

    this.container.appendChild(this.menuElement);
    this.container.appendChild(this.modalElement);
  }

  public setMenuButtonElement(element: HTMLElement): void {
    this.menuButtonElement = element;
    this.setupMenuButtonListener();
  }

  public setContainer(container: HTMLElement): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    if (this.container) {
      container.appendChild(this.container);
    }
    this.setupEventListeners();
  }

  public setReturnToLobbyHandler(handler: () => void): void {
    this.onReturnToLobby = handler;
  }

  public setViewPlayedCardsHandler(handler: () => void): void {
    this.onViewPlayedCards = handler;
  }

  public setRestartGameHandler(handler: () => void): void {
    this.onRestartGame = handler;
  }

  public show(): void {
    if (!this.menuElement) return;
    this.menuElement.style.display = 'block';
    this.isOpen = true;
  }

  public hide(): void {
    if (!this.menuElement) return;
    this.menuElement.style.display = 'none';
    this.isOpen = false;
  }

  public toggle(): void {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  public showPlayedCardsModal(state?: GameState, userPlayerIndex?: number): void {
    if (!this.modalElement) return;

    if (state && userPlayerIndex !== undefined) {
      this.currentUserPlayerIndex = userPlayerIndex;
      this.renderPlayedCardsModal(state, userPlayerIndex);
    }

    this.modalElement.style.display = 'flex';
    this.modalElement.classList.add('modal-open');
    this.modalIsOpen = true;
  }

  public hidePlayedCardsModal(): void {
    if (!this.modalElement) return;
    this.modalElement.style.display = 'none';
    this.modalElement.classList.remove('modal-open');
    this.modalIsOpen = false;
  }

  private setupMenuButtonListener(): void {
    if (!this.menuButtonElement) return;
    
    this.menuButtonElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });
  }

  private setupEventListeners(): void {
    if (!this.menuElement || !this.modalElement || !this.container) return;

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && this.menuElement && !this.menuElement.contains(e.target as Node) && this.menuButtonElement && !this.menuButtonElement.contains(e.target as Node)) {
        this.hide();
      }
    });

    // View Played Cards menu item
    const viewPlayedCardsItem = this.menuElement.querySelector('[data-action="view-cards"]');
    if (viewPlayedCardsItem) {
      viewPlayedCardsItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        if (this.onViewPlayedCards) {
          this.onViewPlayedCards();
        }
      });
    }

    // Return to Lobby menu item
    const returnToLobbyItem = this.menuElement.querySelector('[data-action="return-lobby"]');
    if (returnToLobbyItem) {
      returnToLobbyItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        if (this.onReturnToLobby) {
          this.onReturnToLobby();
        }
      });
    }

    // Restart Game menu item
    const restartGameItem = this.menuElement.querySelector('[data-action="restart-game"]');
    if (restartGameItem) {
      restartGameItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        if (this.onRestartGame) {
          this.onRestartGame();
        }
      });
    }
  }

  private renderPlayedCardsModal(state: GameState, userPlayerIndex: number): void {
    if (!this.modalElement) return;

    const trickRows = this.getPlayedCardsForUserTeam(state, userPlayerIndex);

    let contentHtml = `
      <div class="played-cards-modal-content modal-box max-w-md mx-auto" >
        <div class="modal-close-btn-container flex">
          <h3 class="modal-title font-bold text-lg mb-4 pr-8">Cards Your Team Won</h3>
          <button class="modal-close-btn btn btn-sm btn-circle btn-ghost">✕</button>
        </div>
    `;

    if (trickRows.length === 0) {
      contentHtml += `
        <div class="empty-state text-center py-8">
          <p class="text-lg mb-2">Your team hasn't won any tricks yet</p>
          <p class="text-sm text-gray-500">Keep playing to see your played cards!</p>
        </div>
      `;
    } else {
      for (const trickRow of trickRows) {
        const statusLabel = trickRow.isCurrentTrick ? 'In Progress' : `Won by ${trickRow.winner}`;
        const statusClass = trickRow.isCurrentTrick ? 'badge-warning' : 'badge-info';
        
        contentHtml += `
          <div class="trick-row mb-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="font-semibold">Trick ${trickRow.trickNumber}</span>
              <span class="badge ${statusClass} badge-sm">${statusLabel}</span>
            </div>
            <div class="cards-grid grid grid-cols-4 gap-2">
        `;

        const positions = ['You', 'Left', 'Partner', 'Right'];
        for (let i = 0; i < 4; i++) {
          const cardInfo = trickRow.cards.find(c => c.playerLabel === positions[i]);
          
          if (cardInfo) {
            const suitSymbol = this.getSuitSymbol(cardInfo.card.suit);
            const suitColor = (cardInfo.card.suit === 'HEARTS' || cardInfo.card.suit === 'DIAMONDS') ? 'text-red-500' : 'text-black';
            
            contentHtml += `
              <div class="played-card flex flex-col items-center p-2 bg-base-200 rounded">
                <span class="text-lg font-bold ${suitColor}">${cardInfo.card.rank}${suitSymbol}</span>
                <span class="text-xs text-gray-500">${cardInfo.playerLabel}</span>
              </div>
            `;
          } else {
            contentHtml += `
              <div class="played-card flex flex-col items-center p-2 bg-base-200 rounded opacity-50">
                <span class="text-lg font-bold">--</span>
                <span class="text-xs text-gray-500">${positions[i]}</span>
              </div>
            `;
          }
        }

        contentHtml += `
            </div>
          </div>
        `;
      }
    }

    contentHtml += `
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    `;

    this.modalElement.innerHTML = contentHtml;
    this.setupModalEventListeners();
  }

  private setupModalEventListeners(): void {
    if (!this.modalElement) return;

    const closeBtn = this.modalElement.querySelector('.modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hidePlayedCardsModal();
      });
    }

    const backdrop = this.modalElement.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        this.hidePlayedCardsModal();
      });
    }
  }

  public getPlayedCardsForUserTeam(state: GameState, userPlayerIndex: number): PlayedTrickRow[] {
    const userTeam = state.players[userPlayerIndex].team;
    const result: PlayedTrickRow[] = [];
    const positionLabels = ['You', 'Left', 'Partner', 'Right'];

    const getPlayerLabel = (playerIndex: number): string => {
      const relativeIndex = (playerIndex - userPlayerIndex + 4) % 4;
      return positionLabels[relativeIndex];
    };

    for (let i = 0; i < state.completedTricks.length; i++) {
      const trick = state.completedTricks[i];
      const winnerTeam = state.players[trick.winner!].team;

      if (winnerTeam === userTeam) {
        result.push({
          trickNumber: i + 1,
          winner: getPlayerLabel(trick.winner!) as 'You' | 'Partner' | 'Left' | 'Right',
          isCurrentTrick: false,
          cards: trick.cards.map(pc => ({
            card: pc.card,
            playerLabel: getPlayerLabel(pc.player) as 'You' | 'Partner' | 'Left' | 'Right',
            playerIndex: pc.player
          }))
        });
      }
    }

    if (result.length > 0 && state.currentTrick.cards.length > 0) {
      result.push({
        trickNumber: state.completedTricks.length + 1,
        winner: 'In Progress',
        isCurrentTrick: true,
        cards: state.currentTrick.cards.map(pc => ({
          card: pc.card,
          playerLabel: getPlayerLabel(pc.player) as 'You' | 'Partner' | 'Left' | 'Right',
          playerIndex: pc.player
        }))
      });
    }

    return result;
  }

  private getSuitSymbol(suit: Suit): string {
    const symbols: Record<Suit, string> = {
      'HEARTS': '♥',
      'DIAMONDS': '♦',
      'CLUBS': '♣',
      'SPADES': '♠'
    };
    return symbols[suit];
  }

  public getContainer(): HTMLElement | null {
    return this.container;
  }

  public getMenuElement(): HTMLElement | null {
    return this.menuElement;
  }

  public getModalElement(): HTMLElement | null {
    return this.modalElement;
  }

  public isMenuOpen(): boolean {
    return this.isOpen;
  }

  public isModalOpen(): boolean {
    return this.modalIsOpen;
  }

  public getCurrentUserPlayerIndex(): number {
    return this.currentUserPlayerIndex;
  }

  public destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.menuElement = null;
    this.modalElement = null;
    this.onViewPlayedCards = null;
    this.onRestartGame = null;
  }
}
