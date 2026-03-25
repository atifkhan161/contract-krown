// Contract Crown Haptic Controller
// Haptic feedback controller for mobile devices

export class HapticController {
  private isSupported: boolean;

  constructor() {
    // Check for Vibration API support
    this.isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  /**
   * Triggers haptic feedback when it becomes the user's turn
   * Pattern: Single short pulse (50ms)
   * Requirement 9.2: Trigger short vibration pulse when it becomes user's turn
   */
  public triggerYourTurn(): void {
    this.vibrate(50);
  }

  /**
   * Triggers haptic feedback when user wins a trick
   * Pattern: Double pulse (50ms, 50ms with 100ms gap)
   * Requirement 9.3: Trigger short vibration pulse when user wins a trick
   */
  public triggerTrickWon(): void {
    this.vibrate([50, 100, 50]);
  }

  /**
   * Triggers haptic feedback when trump is declared
   * Pattern: Triple pulse (30ms, 30ms, 30ms with 50ms gaps)
   * Requirement 2.5: Trigger short vibration pulse when trump is declared
   */
  public triggerTrumpDeclared(): void {
    this.vibrate([30, 50, 30, 50, 30]);
  }

  /**
   * Triggers haptic feedback for victory
   * Pattern: Long celebration pattern (100ms, 50ms, 100ms, 50ms, 200ms)
   * Requirement 9.4: Trigger victory vibration pattern when game or round ends
   */
  public triggerVictory(): void {
    this.vibrate([100, 50, 100, 50, 200]);
  }

  /**
   * Triggers haptic feedback with the specified pattern
   * Gracefully degrades if Vibration API is not supported
   */
  private vibrate(pattern: number | number[]): void {
    if (!this.isSupported) {
      // Silently skip vibration if API unavailable
      return;
    }

    try {
      navigator.vibrate(pattern);
    } catch (error) {
      // Silently handle any errors
      console.warn('Haptic feedback failed:', error);
    }
  }

  /**
   * Checks if haptic feedback is supported
   */
  public isHapticSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Stops any ongoing vibration
   */
  public stop(): void {
    if (this.isSupported) {
      navigator.vibrate(0);
    }
  }
}