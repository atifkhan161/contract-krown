// Contract Crown Haptic Controller
// Cross-platform haptic feedback for iOS Safari 17.4+ and Android

import { haptic } from 'ios-haptics';

export class HapticController {
  private isSupported: boolean;
  private isIosHapticsAvailable: boolean;

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && typeof window !== 'undefined';
    this.isIosHapticsAvailable = typeof haptic !== 'undefined';
  }

  public triggerYourTurn(): void {
    this.vibrate(50);
  }

  public triggerTrickWon(): void {
    this.vibrate([50, 100, 50]);
  }

  public triggerTrumpDeclared(): void {
    this.vibrate([30, 50, 30, 50, 30]);
  }

  public triggerVictory(): void {
    this.vibrate([100, 50, 100, 50, 200]);
  }

  public triggerCardSelected(): void {
    this.vibrate(30);
  }

  public triggerCardPlayed(): void {
    this.vibrate(75);
  }

  public triggerInvalidMove(): void {
    this.vibrate([20, 30, 20, 30, 20]);
  }

  public triggerButtonTap(): void {
    this.vibrate(30);
  }

  public triggerNotification(): void {
    this.vibrate([40, 50, 40]);
  }

  private vibrate(pattern: number | number[]): void {
    if (!this.isSupported) {
      return;
    }

    try {
      if (this.isIosHapticsAvailable) {
        if (Array.isArray(pattern)) {
          if (pattern.length === 1) {
            haptic();
          } else if (pattern.length === 3) {
            haptic.confirm();
          } else if (pattern.length === 5) {
            haptic.error();
          }
        } else {
          const ms = pattern as number;
          if (ms <= 40) {
            haptic();
          } else if (ms <= 60) {
            haptic.confirm();
          } else {
            haptic.error();
          }
        }
      } else if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }

  public isHapticSupported(): boolean {
    return this.isSupported;
  }

  public stop(): void {
    if (!this.isSupported) {
      return;
    }

    try {
      if (!this.isIosHapticsAvailable && 'vibrate' in navigator) {
        navigator.vibrate(0);
      }
    } catch (error) {
      // Silently ignore
    }
  }
}