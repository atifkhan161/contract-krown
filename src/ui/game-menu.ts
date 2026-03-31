// Contract Crown Game Menu
// Played cards viewer using ModalBottomSheet pattern

import type { GameState, Card, Suit } from '../engine/types.js';
import { ModalBottomSheet } from './modal-bottom-sheet.js';

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
  private bottomSheet: ModalBottomSheet;
  private currentUserPlayerIndex: number = 0;
  private container: HTMLElement | null = null;

  constructor() {
    this.bottomSheet = new ModalBottomSheet({
      allowBackdropDismiss: true,
    });
  }

  public setContainer(container: HTMLElement): void {
    this.container = container;
    this.bottomSheet.setContainer(container);
  }

  public showPlayedCardsModal(state?: GameState, userPlayerIndex?: number): void {
    if (state && userPlayerIndex !== undefined) {
      this.currentUserPlayerIndex = userPlayerIndex;
    }

    const contentHtml = this.renderPlayedCardsContent(state, userPlayerIndex);
    this.bottomSheet.show(contentHtml);
  }

  public hidePlayedCardsModal(): void {
    this.bottomSheet.hide();
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

  public isModalOpen(): boolean {
    return this.bottomSheet.isVisible();
  }

  public getCurrentUserPlayerIndex(): number {
    return this.currentUserPlayerIndex;
  }

  public destroy(): void {
    this.bottomSheet.destroy();
  }

  private renderPlayedCardsContent(state: GameState | undefined, userPlayerIndex: number | undefined): string {
    if (!state || userPlayerIndex === undefined) {
      return `
        <div class="played-cards-content">
          <h3 class="played-cards-title">Cards Your Team Won</h3>
          <div class="empty-state">
            <p>Your team hasn't won any tricks yet</p>
            <p class="empty-state-hint">Keep playing to see your played cards!</p>
          </div>
        </div>
      `;
    }

    const trickRows = this.getPlayedCardsForUserTeam(state, userPlayerIndex);

    if (trickRows.length === 0) {
      return `
        <div class="played-cards-content">
          <h3 class="played-cards-title">Cards Your Team Won</h3>
          <div class="empty-state">
            <p>Your team hasn't won any tricks yet</p>
            <p class="empty-state-hint">Keep playing to see your played cards!</p>
          </div>
        </div>
      `;
    }

    let tricksHtml = '';
    for (const trickRow of trickRows) {
      const statusLabel = trickRow.isCurrentTrick ? 'In Progress' : `Won by ${trickRow.winner}`;
      const statusClass = trickRow.isCurrentTrick ? 'status-in-progress' : 'status-won';

      tricksHtml += `
        <div class="trick-row">
          <div class="trick-row-header">
            <span class="trick-label">Trick ${trickRow.trickNumber}</span>
            <span class="trick-status ${statusClass}">${statusLabel}</span>
          </div>
          <div class="cards-grid">
      `;

      const positions = ['You', 'Left', 'Partner', 'Right'];
      for (let i = 0; i < 4; i++) {
        const cardInfo = trickRow.cards.find(c => c.playerLabel === positions[i]);

        if (cardInfo) {
          const suitSymbol = this.getSuitSymbol(cardInfo.card.suit);
          const suitColorClass = (cardInfo.card.suit === 'HEARTS' || cardInfo.card.suit === 'DIAMONDS') ? 'suit-red' : 'suit-black';

          tricksHtml += `
            <div class="played-card">
              <span class="played-card-value ${suitColorClass}">${cardInfo.card.rank}${suitSymbol}</span>
              <span class="played-card-player">${cardInfo.playerLabel}</span>
            </div>
          `;
        } else {
          tricksHtml += `
            <div class="played-card played-card-empty">
              <span class="played-card-value">--</span>
              <span class="played-card-player">${positions[i]}</span>
            </div>
          `;
        }
      }

      tricksHtml += `
          </div>
        </div>
      `;
    }

    return `
      <div class="played-cards-content">
        <h3 class="played-cards-title">Cards Your Team Won</h3>
        ${tricksHtml}
      </div>
    `;
  }

  private setupModalEventListeners(): void {
    // No additional listeners needed - backdrop dismiss is handled by ModalBottomSheet
  }
}
