// Contract Crown Context Menu
// Full-screen bottom sheet context menu replacing the dropdown menu

import { ModalBottomSheet } from './modal-bottom-sheet.js';

export type ContextMenuItemId = 'view-cards' | 'toggle-theme' | 'restart-game' | 'return-lobby';

export interface ContextMenuItem {
  id: ContextMenuItemId;
  label: string;
  icon: string;
}

const MENU_ITEMS: ContextMenuItem[] = [
  { id: 'view-cards', label: 'View Played Cards', icon: '🃏' },
  { id: 'toggle-theme', label: 'Change Theme', icon: '🎨' },
  { id: 'restart-game', label: 'Restart Game', icon: '🔄' },
  { id: 'return-lobby', label: 'Return to Lobby', icon: '🏠' },
];

export class ContextMenu {
  private bottomSheet: ModalBottomSheet;
  private handlers: Map<ContextMenuItemId, () => void> = new Map();
  private isOpen: boolean = false;

  constructor() {
    this.bottomSheet = new ModalBottomSheet({
      allowBackdropDismiss: true,
      contentClass: 'context-menu-panel',
    });

    this.bottomSheet.setOnDismiss(() => {
      this.isOpen = false;
    });
  }

  /**
   * Sets the container element
   */
  public setContainer(container: HTMLElement): void {
    this.bottomSheet.setContainer(container);
  }

  /**
   * Sets the handler for a specific menu item
   */
  public setHandler(id: ContextMenuItemId, handler: () => void): void {
    this.handlers.set(id, handler);
  }

  /**
   * Shows the context menu
   */
  public show(): void {
    if (this.isOpen) return;

    const contentHtml = this.renderMenuItems();
    this.bottomSheet.show();
    this.bottomSheet.setContent(contentHtml);
    this.isOpen = true;

    // Set up click handlers after DOM is rendered
    this.setupItemHandlers();
  }

  /**
   * Hides the context menu
   */
  public hide(): void {
    this.bottomSheet.hide();
  }

  /**
   * Checks if the menu is open
   */
  public isMenuOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Cleans up
   */
  public destroy(): void {
    this.bottomSheet.destroy();
    this.handlers.clear();
  }

  /**
   * Renders the menu items as a list
   */
  private renderMenuItems(): string {
    const itemsHtml = MENU_ITEMS.map((item) => `
      <li class="context-menu-item" data-action="${item.id}">
        <span class="context-menu-icon" aria-hidden="true">${item.icon}</span>
        <span class="context-menu-label">${item.label}</span>
      </li>
    `).join('');

    return `
      <nav class="context-menu-nav" aria-label="Game menu">
        <ul class="context-menu-list">
          ${itemsHtml}
        </ul>
      </nav>
    `;
  }

  /**
   * Sets up click handlers for menu items
   */
  private setupItemHandlers(): void {
    const sheetElement = this.bottomSheet.getSheetElement();
    if (!sheetElement) return;

    const items = sheetElement.querySelectorAll('.context-menu-item');
    items.forEach((itemEl) => {
      const action = (itemEl as HTMLElement).getAttribute('data-action') as ContextMenuItemId;
      if (action) {
        itemEl.addEventListener('click', () => {
          const handler = this.handlers.get(action);
          if (handler) {
            this.hide();
            handler();
          }
        });
      }
    });
  }
}
