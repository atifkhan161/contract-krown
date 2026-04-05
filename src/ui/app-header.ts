// Contract Crown App Header
// Minimal native-style header bar with back button and title

import { HapticController } from './haptic-controller.js';

export type HeaderBackHandler = () => void;

export class AppHeader {
  private container: HTMLElement | null = null;
  private titleElement: HTMLElement | null = null;
  private backButton: HTMLElement | null = null;
  private onBack: HeaderBackHandler | null = null;
  private haptic: HapticController;

  constructor() {
    this.haptic = new HapticController();
    this.createElements();
  }

  private createElements(): void {
    if (typeof document === 'undefined') return;

    this.container = document.createElement('div');
    this.container.className = 'app-header';
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <button class="app-header-back-btn" id="header-back-btn" aria-label="Go back">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span class="app-header-title" id="header-title"></span>
      <div class="app-header-spacer"></div>
    `;

    this.backButton = this.container.querySelector('#header-back-btn');
    this.titleElement = this.container.querySelector('#header-title');

    this.backButton?.addEventListener('click', () => {
      this.haptic.triggerYourTurn();
      if (this.onBack) {
        this.onBack();
      } else {
        this.defaultBack();
      }
    });
  }

  private defaultBack(): void {
    import('./router.js').then(({ router }) => {
      router.navigate('/lobby');
    });
  }

  public setBackHandler(handler: HeaderBackHandler): void {
    this.onBack = handler;
  }

  public show(title: string): void {
    if (!this.container || !this.titleElement) return;

    this.titleElement.textContent = title;
    this.container.style.display = 'flex';
  }

  public hide(): void {
    if (!this.container) return;
    this.container.style.display = 'none';
  }

  public getContainer(): HTMLElement | null {
    return this.container;
  }

  public destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.onBack = null;
  }
}
