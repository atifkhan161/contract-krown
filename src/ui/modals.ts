// Contract Crown Modals
// Modal components for game UI

export { TrumpSelector } from './trump-selector.js';
export { RoundEndModal } from './round-end-modal.js';
export { VictoryModal } from './victory-modal.js';

// Legacy Modal class for backward compatibility
export class Modal {
  public show(content: string): void {
    // Show modal
  }

  public hide(): void {
    // Hide modal
  }
}