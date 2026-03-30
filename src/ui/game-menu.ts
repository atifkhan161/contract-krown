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

  constructor() {
    if (typeof document !== 'undefined') {
      this.createElements();
    }
  }

  private createElements(): void {
    if (typeof document === 'undefined') return;

    this.container = document.createElement('div');
    this.container.className = 'game-menu-container';

    this.menuButtonElement = document.createElement('button');
    this.menuButtonElement.className = 'menu-toggle-btn btn btn-ghost btn-sm';
    this.menuButtonElement.innerHTML = '<span class="menu-icon text-2xl">≡</span>';

    this.menuElement = document.createElement('div');
    this.menuElement.className = 'game-menu dropdown dropdown-end';
    this.menuElement.innerHTML = `
      <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
        <li><a class="menu-item view-played-cards">View Played Cards</a></li>
        <li><a class="menu-item return-to-lobby">Return to Lobby</a></li>
      </ul>
    `;

    this.modalElement = document.createElement('div');
    this.modalElement.className = 'played-cards-modal modal';
    this.modalElement.style.display = 'none';

    this.container.appendChild(this.menuElement);
    this.container.appendChild(this.modalElement);
  }

  public setContainer(container: HTMLElement): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    if (this.container) {
      // Add menu button first
      if (this.menuButtonElement) {
        container.appendChild(this.menuButtonElement);
      }
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

  public show(): void {
    if (!this.menuElement) return;
    this.menuElement.classList.add('dropdown-open');
    this.isOpen = true;
  }

  public hide(): void {
    if (!this.menuElement) return;
    this.menuElement.classList.remove('dropdown-open');
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

  private setupEventListeners(): void {
    if (!this.menuElement || !this.modalElement || !this.container || !this.menuButtonElement) return;

    // Menu button toggles dropdown
    this.menuButtonElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && this.menuElement && !this.menuElement.contains(e.target as Node) && !this.menuButtonElement?.contains(e.target as Node)) {
        this.hide();
      }
    });

    // View Played Cards menu item
    const viewPlayedCardsItem = this.menuElement.querySelector('.view-played-cards');
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
    const returnToLobbyItem = this.menuElement.querySelector('.return-to-lobby');
    if (returnToLobbyItem) {
      returnToLobbyItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        if (this.onReturnToLobby) {
          this.onReturnToLobby();
        }
      });
    }
  }

  private renderPlayedCardsModal(state: GameState, userPlayerIndex: number): void {
    if (!this.modalElement) return;

    const trickRows = this.getPlayedCardsForUserTeam(state, userPlayerIndex);

    let contentHtml = `
      <div class="played-cards-modal-content modal-box max-w-md mx-auto">
        <h3 class="font-bold text-lg mb-4">Cards Your Team Won</h3>
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
  }
}
