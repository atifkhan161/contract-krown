// Contract Crown Modal Bottom Sheet
// Reusable base class for bottom sheet overlays with configurable backdrop-dismiss behavior

/**
 * ModalBottomSheet component
 * Creates a full-screen overlay with a bottom sheet panel that slides up.
 * Supports configurable backdrop-dismiss behavior.
 * Uses existing CSS theme variables (--game-modal-overlay, --app-surface, etc.)
 */
export class ModalBottomSheet {
  private container: HTMLElement | null = null;
  private sheet: HTMLElement | null = null;
  private backdrop: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private contentArea: HTMLElement | null = null;
  private isOpen: boolean = false;
  private allowBackdropDismiss: boolean;
  private contentClass: string;
  private onDismiss: (() => void) | null = null;

  constructor(options: {
    allowBackdropDismiss: boolean;
    contentClass?: string;
  }) {
    this.allowBackdropDismiss = options.allowBackdropDismiss;
    this.contentClass = options.contentClass || '';
  }

  /**
   * Sets the container element for the sheet
   */
  public setContainer(container: HTMLElement): void {
    this.container = container;
  }

  /**
   * Sets a callback to be called when the sheet is dismissed
   */
  public setOnDismiss(handler: () => void): void {
    this.onDismiss = handler;
  }

  /**
   * Sets the HTML content for the sheet panel
   */
  public setContent(html: string): void {
    if (!this.contentArea) return;
    this.contentArea.innerHTML = html;
  }

  /**
   * Shows the bottom sheet
   */
  public show(): void {
    if (!this.container || this.isOpen) return;
    if (typeof document === 'undefined') return;

    this.createSheetElements();
    this.container.appendChild(this.sheet!);

    // Force reflow so the browser registers the initial transform state
    void this.panel?.offsetHeight;

    // Add open class to trigger slide-up animation
    if (this.panel) {
      this.panel.classList.add('open');
    }

    this.isOpen = true;

    // Focus first focusable element for accessibility
    const firstFocusable = this.panel?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') as HTMLElement;
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  /**
   * Hides the bottom sheet
   */
  public hide(): void {
    if (!this.sheet || !this.isOpen) return;

    // Trigger close animation
    if (this.panel) {
      this.panel.classList.remove('open');
    }

    // Remove after animation completes
    setTimeout(() => {
      if (this.sheet && this.sheet.parentNode) {
        this.sheet.parentNode.removeChild(this.sheet);
      }
      this.sheet = null;
      this.backdrop = null;
      this.panel = null;
      this.contentArea = null;
      this.isOpen = false;

      if (this.onDismiss) {
        this.onDismiss();
      }
    }, 300);
  }

  /**
   * Checks if the sheet is currently visible
   */
  public isVisible(): boolean {
    return this.isOpen;
  }

  /**
   * Gets the sheet element
   */
  public getSheetElement(): HTMLElement | null {
    return this.sheet;
  }

  /**
   * Cleans up the sheet
   */
  public destroy(): void {
    this.hide();
    this.onDismiss = null;
  }

  /**
   * Creates the DOM elements for the bottom sheet
   */
  private createSheetElements(): void {
    if (typeof document === 'undefined') return;

    // Main container
    this.sheet = document.createElement('div');
    this.sheet.className = 'modal-bottom-sheet';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-modal', 'true');

    // Backdrop overlay
    this.backdrop = document.createElement('div');
    this.backdrop.className = `modal-bottom-sheet-backdrop${this.allowBackdropDismiss ? '' : ' no-dismiss'}`;

    if (this.allowBackdropDismiss) {
      this.backdrop.addEventListener('click', () => {
        this.hide();
      });
    }

    // Sheet panel
    this.panel = document.createElement('div');
    this.panel.className = `modal-bottom-sheet-panel${this.contentClass ? ' ' + this.contentClass : ''}`;

    // Content area
    this.contentArea = document.createElement('div');
    this.contentArea.className = 'modal-bottom-sheet-content';
    this.panel.appendChild(this.contentArea);

    // Assemble - panel comes after backdrop for proper z-order
    this.sheet.appendChild(this.backdrop);
    this.sheet.appendChild(this.panel);

    // Ensure panel is above backdrop
    this.panel.style.zIndex = '1';

    // Keyboard handling
    this.sheet.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        if (this.allowBackdropDismiss) {
          this.hide();
        } else {
          event.preventDefault();
        }
      }
    });
  }
}
