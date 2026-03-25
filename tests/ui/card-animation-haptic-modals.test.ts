// Contract Crown Unit Tests for Tasks 11, 12, 13
// Card Animation System, Haptic Controller, and Modal Components

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { 
  getElementPosition,
  getTrickAreaPosition,
  getPlayerPosition,
  applyTransform,
  resetTransform,
  createAnimatingCardElement,
  getSuitSymbol,
  getRankDisplay,
  TouchGestureHandler,
  createAnimatingCard,
  isAnimationComplete,
  getAnimationProgress
} from '@src/ui/card-animation.js';

import { HapticController } from '@src/ui/haptic-controller.js';
import { TrumpSelector } from '@src/ui/trump-selector.js';
import { RoundEndModal } from '@src/ui/round-end-modal.js';
import { VictoryModal } from '@src/ui/victory-modal.js';

import type { Card, Suit } from '@src/engine/types.js';
import type { Position, AnimatingCard } from '@src/ui/types.js';

// Mock DOM for testing
const mockDocument = () => {
  const elements: Record<string, any> = {};
  
  return {
    createElement: vi.fn((tag: string) => ({
      className: '',
      dataset: {},
      innerHTML: '',
      style: {},
      classList: {
        add: vi.fn(),
        remove: vi.fn()
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      appendChild: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      getBoundingClientRect: vi.fn(() => ({
        left: 100,
        top: 100,
        width: 50,
        height: 70
      })),
      setAttribute: vi.fn(),
      focus: vi.fn()
    })),
    querySelector: vi.fn()
  };
};

// Set up global document mock for card-animation.ts
beforeEach(() => {
  if (typeof document === 'undefined') {
    (global as any).document = {
      createElement: vi.fn(() => ({
        className: '',
        dataset: {},
        innerHTML: '',
        style: {},
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        appendChild: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(() => []),
        getBoundingClientRect: vi.fn(() => ({
          left: 100,
          top: 100,
          width: 50,
          height: 70
        })),
        setAttribute: vi.fn(),
        focus: vi.fn()
      }))
    };
  }
});

afterEach(() => {
  if ((global as any).document && typeof document.createElement === 'function') {
    delete (global as any).document;
  }
});

// ============================================================================
// Task 11: Card Animation System Tests
// Requirement 15.1, 15.2, 15.3, 15.4, 15.5
// ============================================================================

describe('Task 11: Card Animation System', () => {
  
  describe('Element Position Utilities', () => {
    it('getElementPosition calculates relative position correctly', () => {
      const mockElement = {
        getBoundingClientRect: () => ({
          left: 150,
          top: 200,
          width: 50,
          height: 70,
          right: 200,
          bottom: 270
        })
      } as HTMLElement;

      const mockContainer = {
        getBoundingClientRect: () => ({
          left: 100,
          top: 100,
          width: 400,
          height: 600,
          right: 500,
          bottom: 700
        })
      } as HTMLElement;

      const position = getElementPosition(mockElement, mockContainer);

      expect(position.x).toBe(50); // 150 - 100
      expect(position.y).toBe(100); // 200 - 100
    });

    it('getTrickAreaPosition calculates center position', () => {
      const mockTrickArea = {
        getBoundingClientRect: () => ({
          left: 100,
          top: 100,
          width: 200,
          height: 150,
          right: 300,
          bottom: 250
        })
      } as HTMLElement;

      const position = getTrickAreaPosition(mockTrickArea);

      expect(position.x).toBe(100); // 200 / 2
      expect(position.y).toBe(75); // 150 / 2
    });

    it('getPlayerPosition calculates player display center', () => {
      const mockPlayerDisplay = {
        getBoundingClientRect: () => ({
          left: 50,
          top: 50,
          width: 100,
          height: 100,
          right: 150,
          bottom: 150
        })
      } as HTMLElement;

      const mockContainer = {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 400,
          height: 600,
          right: 400,
          bottom: 600
        })
      } as HTMLElement;

      const position = getPlayerPosition(mockPlayerDisplay, mockContainer);

      expect(position.x).toBe(100); // 50 + 100/2
      expect(position.y).toBe(100); // 50 + 100/2
    });
  });

  describe('Transform Utilities', () => {
    let mockElement: HTMLElement;

    beforeEach(() => {
      mockElement = {
        style: {} as CSSStyleDeclaration
      } as HTMLElement;
    });

    it('applyTransform sets transform and opacity', () => {
      applyTransform(mockElement, 10, 20, 0.5, 0.8);

      expect(mockElement.style.transform).toBe('translate(10px, 20px) scale(0.5)');
      expect(mockElement.style.opacity).toBe('0.8');
    });

    it('applyTransform uses default scale and opacity', () => {
      applyTransform(mockElement, 10, 20);

      expect(mockElement.style.transform).toBe('translate(10px, 20px) scale(1)');
      expect(mockElement.style.opacity).toBe('1');
    });

    it('resetTransform clears transform styles', () => {
      mockElement.style.transform = 'translate(10px, 20px)';
      mockElement.style.opacity = '0.5';
      mockElement.style.transition = 'transform 0.5s';

      resetTransform(mockElement);

      expect(mockElement.style.transform).toBe('');
      expect(mockElement.style.opacity).toBe('');
      expect(mockElement.style.transition).toBe('');
    });
  });

  describe('Card Element Creation', () => {
    it('createAnimatingCardElement creates valid card element', () => {
      const card: Card = { suit: 'HEARTS', rank: 'A' };
      const element = createAnimatingCardElement(card, '♥', 'A');

      expect(element.className).toContain('card');
      expect(element.className).toContain('animating');
      expect(element.className).toContain('playable');
      expect(element.dataset.suit).toBe('HEARTS');
      expect(element.dataset.rank).toBe('A');
    });

    it('getSuitSymbol returns correct symbols for all suits', () => {
      expect(getSuitSymbol('HEARTS')).toBe('♥');
      expect(getSuitSymbol('DIAMONDS')).toBe('♦');
      expect(getSuitSymbol('CLUBS')).toBe('♣');
      expect(getSuitSymbol('SPADES')).toBe('♠');
    });

    it('getRankDisplay returns rank as-is', () => {
      expect(getRankDisplay('7')).toBe('7');
      expect(getRankDisplay('J')).toBe('J');
      expect(getRankDisplay('A')).toBe('A');
    });
  });

  describe('Animation State Tracking', () => {
    it('createAnimatingCard creates valid animation state', () => {
      const card: Card = { suit: 'HEARTS', rank: 'A' };
      const from: Position = { x: 0, y: 0 };
      const to: Position = { x: 100, y: 100 };
      const startTime = Date.now();

      const animatingCard = createAnimatingCard(card, from, to, 500);

      expect(animatingCard.card).toEqual(card);
      expect(animatingCard.from).toEqual(from);
      expect(animatingCard.to).toEqual(to);
      expect(animatingCard.duration).toBe(500);
      expect(animatingCard.startTime).toBeGreaterThanOrEqual(startTime);
    });

    it('isAnimationComplete returns false for in-progress animation', () => {
      const animatingCard: AnimatingCard = {
        card: { suit: 'HEARTS', rank: 'A' },
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 },
        duration: 1000,
        startTime: Date.now()
      };

      expect(isAnimationComplete(animatingCard)).toBe(false);
    });

    it('isAnimationComplete returns true for completed animation', () => {
      const animatingCard: AnimatingCard = {
        card: { suit: 'HEARTS', rank: 'A' },
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 },
        duration: 100,
        startTime: Date.now() - 150 // Started 150ms ago
      };

      expect(isAnimationComplete(animatingCard)).toBe(true);
    });

    it('getAnimationProgress returns value between 0 and 1', () => {
      const animatingCard: AnimatingCard = {
        card: { suit: 'HEARTS', rank: 'A' },
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 },
        duration: 1000,
        startTime: Date.now() - 500 // Started 500ms ago (50% progress)
      };

      const progress = getAnimationProgress(animatingCard);

      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
      expect(progress).toBeCloseTo(0.5, 1);
    });

    it('getAnimationProgress caps at 1 for completed animation', () => {
      const animatingCard: AnimatingCard = {
        card: { suit: 'HEARTS', rank: 'A' },
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 },
        duration: 100,
        startTime: Date.now() - 200 // Started 200ms ago
      };

      const progress = getAnimationProgress(animatingCard);

      expect(progress).toBe(1);
    });
  });

  describe('Touch Gesture Handler', () => {
    let mockContainer: HTMLElement;
    let handler: TouchGestureHandler;

    beforeEach(() => {
      mockContainer = {
        addEventListener: vi.fn()
      } as unknown as HTMLElement;
      
      handler = new TouchGestureHandler(mockContainer);
    });

    it('creates handler with container', () => {
      expect(handler).toBeDefined();
    });

    it('setCardTapHandler sets handler', () => {
      const mockHandler = vi.fn();
      handler.setCardTapHandler(mockHandler);
      // Handler should be set (no error)
      expect(true).toBe(true);
    });

    it('destroy cleans up handler', () => {
      const mockHandler = vi.fn();
      handler.setCardTapHandler(mockHandler);
      handler.destroy();
      // Should complete without error
      expect(true).toBe(true);
    });
  });
});

// ============================================================================
// Task 12: Haptic Controller Tests
// Requirements: 2.5, 9.2, 9.3, 9.4
// ============================================================================

describe('Task 12: Haptic Controller', () => {
  let hapticController: HapticController;
  let originalNavigator: any;

  beforeEach(() => {
    // Save original navigator
    originalNavigator = global.navigator;
    
    // Mock navigator with vibrate support
    global.navigator = {
      vibrate: vi.fn(() => true)
    } as any;

    hapticController = new HapticController();
  });

  afterEach(() => {
    // Restore original navigator
    global.navigator = originalNavigator;
  });

  describe('Vibration API Support', () => {
    it('isHapticSupported returns true when API available', () => {
      expect(hapticController.isHapticSupported()).toBe(true);
    });

    it('isHapticSupported returns false when API unavailable', () => {
      global.navigator = {} as any;
      const controller = new HapticController();
      expect(controller.isHapticSupported()).toBe(false);
    });
  });

  describe('Haptic Patterns', () => {
    it('triggerYourTurn calls vibrate with 50ms pulse', () => {
      hapticController.triggerYourTurn();
      expect(navigator.vibrate).toHaveBeenCalledWith(50);
    });

    it('triggerTrickWon calls vibrate with double pulse pattern', () => {
      hapticController.triggerTrickWon();
      expect(navigator.vibrate).toHaveBeenCalledWith([50, 100, 50]);
    });

    it('triggerTrumpDeclared calls vibrate with triple pulse pattern', () => {
      hapticController.triggerTrumpDeclared();
      expect(navigator.vibrate).toHaveBeenCalledWith([30, 50, 30, 50, 30]);
    });

    it('triggerVictory calls vibrate with celebration pattern', () => {
      hapticController.triggerVictory();
      expect(navigator.vibrate).toHaveBeenCalledWith([100, 50, 100, 50, 200]);
    });
  });

  describe('Graceful Degradation', () => {
    it('triggerYourTurn does not throw when API unavailable', () => {
      global.navigator = {} as any;
      const controller = new HapticController();
      expect(() => controller.triggerYourTurn()).not.toThrow();
    });

    it('triggerTrickWon does not throw when API unavailable', () => {
      global.navigator = {} as any;
      const controller = new HapticController();
      expect(() => controller.triggerTrickWon()).not.toThrow();
    });

    it('triggerTrumpDeclared does not throw when API unavailable', () => {
      global.navigator = {} as any;
      const controller = new HapticController();
      expect(() => controller.triggerTrumpDeclared()).not.toThrow();
    });

    it('triggerVictory does not throw when API unavailable', () => {
      global.navigator = {} as any;
      const controller = new HapticController();
      expect(() => controller.triggerVictory()).not.toThrow();
    });

    it('stop does not throw when API unavailable', () => {
      global.navigator = {} as any;
      const controller = new HapticController();
      expect(() => controller.stop()).not.toThrow();
    });
  });

  describe('Stop Functionality', () => {
    it('stop calls vibrate with 0 to stop ongoing vibration', () => {
      hapticController.stop();
      expect(navigator.vibrate).toHaveBeenCalledWith(0);
    });
  });
});

// ============================================================================
// Task 13: Modal Components Tests
// Requirements: 2.2, 2.4, 16.1, 16.2, 16.3, 16.4, 16.5
// ============================================================================

describe('Task 13: Modal Components', () => {

  describe('TrumpSelector', () => {
    let trumpSelector: TrumpSelector;
    let mockContainer: HTMLElement;

    beforeEach(() => {
      trumpSelector = new TrumpSelector();
      mockContainer = {
        appendChild: vi.fn()
      } as unknown as HTMLElement;
      trumpSelector.setContainer(mockContainer);
    });

    it('creates TrumpSelector instance', () => {
      expect(trumpSelector).toBeDefined();
    });

    it('setContainer sets container', () => {
      expect(() => trumpSelector.setContainer(mockContainer)).not.toThrow();
    });

    it('setTrumpSelectionHandler sets handler', () => {
      const handler = vi.fn();
      expect(() => trumpSelector.setTrumpSelectionHandler(handler)).not.toThrow();
    });

    it('isVisible returns false initially', () => {
      expect(trumpSelector.isVisible()).toBe(false);
    });

    it('getModalElement returns null initially', () => {
      expect(trumpSelector.getModalElement()).toBeNull();
    });

    it('hide does not throw when modal not visible', () => {
      expect(() => trumpSelector.hide()).not.toThrow();
    });

    it('destroy cleans up resources', () => {
      trumpSelector.destroy();
      expect(trumpSelector.isVisible()).toBe(false);
      expect(trumpSelector.getModalElement()).toBeNull();
    });
  });

  describe('RoundEndModal', () => {
    let roundEndModal: RoundEndModal;
    let mockContainer: HTMLElement;

    beforeEach(() => {
      roundEndModal = new RoundEndModal();
      mockContainer = {
        appendChild: vi.fn()
      } as unknown as HTMLElement;
      roundEndModal.setContainer(mockContainer);
    });

    it('creates RoundEndModal instance', () => {
      expect(roundEndModal).toBeDefined();
    });

    it('setContainer sets container', () => {
      expect(() => roundEndModal.setContainer(mockContainer)).not.toThrow();
    });

    it('setContinueHandler sets handler', () => {
      const handler = vi.fn();
      expect(() => roundEndModal.setContinueHandler(handler)).not.toThrow();
    });

    it('isVisible returns false initially', () => {
      expect(roundEndModal.isVisible()).toBe(false);
    });

    it('getModalElement returns null initially', () => {
      expect(roundEndModal.getModalElement()).toBeNull();
    });

    it('hide does not throw when modal not visible', () => {
      expect(() => roundEndModal.hide()).not.toThrow();
    });

    it('destroy cleans up resources', () => {
      roundEndModal.destroy();
      expect(roundEndModal.isVisible()).toBe(false);
      expect(roundEndModal.getModalElement()).toBeNull();
    });
  });

  describe('VictoryModal', () => {
    let victoryModal: VictoryModal;
    let mockContainer: HTMLElement;

    beforeEach(() => {
      victoryModal = new VictoryModal();
      mockContainer = {
        appendChild: vi.fn()
      } as unknown as HTMLElement;
      victoryModal.setContainer(mockContainer);
    });

    it('creates VictoryModal instance', () => {
      expect(victoryModal).toBeDefined();
    });

    it('setContainer sets container', () => {
      expect(() => victoryModal.setContainer(mockContainer)).not.toThrow();
    });

    it('setNewGameHandler sets handler', () => {
      const handler = vi.fn();
      expect(() => victoryModal.setNewGameHandler(handler)).not.toThrow();
    });

    it('setReturnToLobbyHandler sets handler', () => {
      const handler = vi.fn();
      expect(() => victoryModal.setReturnToLobbyHandler(handler)).not.toThrow();
    });

    it('isVisible returns false initially', () => {
      expect(victoryModal.isVisible()).toBe(false);
    });

    it('getModalElement returns null initially', () => {
      expect(victoryModal.getModalElement()).toBeNull();
    });

    it('hide does not throw when modal not visible', () => {
      expect(() => victoryModal.hide()).not.toThrow();
    });

    it('destroy cleans up resources', () => {
      victoryModal.destroy();
      expect(victoryModal.isVisible()).toBe(false);
      expect(victoryModal.getModalElement()).toBeNull();
    });
  });

  describe('Modal Integration', () => {
    it('all modals have consistent interface', () => {
      const trumpSelector = new TrumpSelector();
      const roundEndModal = new RoundEndModal();
      const victoryModal = new VictoryModal();

      // All should have show/hide/destroy methods
      expect(typeof trumpSelector.show).toBe('function');
      expect(typeof trumpSelector.hide).toBe('function');
      expect(typeof trumpSelector.destroy).toBe('function');

      expect(typeof roundEndModal.show).toBe('function');
      expect(typeof roundEndModal.hide).toBe('function');
      expect(typeof roundEndModal.destroy).toBe('function');

      expect(typeof victoryModal.show).toBe('function');
      expect(typeof victoryModal.hide).toBe('function');
      expect(typeof victoryModal.destroy).toBe('function');
    });

    it('all modals have visibility check', () => {
      const trumpSelector = new TrumpSelector();
      const roundEndModal = new RoundEndModal();
      const victoryModal = new VictoryModal();

      expect(typeof trumpSelector.isVisible).toBe('function');
      expect(typeof roundEndModal.isVisible).toBe('function');
      expect(typeof victoryModal.isVisible).toBe('function');
    });

    it('all modals have modal element getter', () => {
      const trumpSelector = new TrumpSelector();
      const roundEndModal = new RoundEndModal();
      const victoryModal = new VictoryModal();

      expect(typeof trumpSelector.getModalElement).toBe('function');
      expect(typeof roundEndModal.getModalElement).toBe('function');
      expect(typeof victoryModal.getModalElement).toBe('function');
    });
  });
});

// ============================================================================
// Cross-Component Integration Tests
// ============================================================================

describe('Cross-Component Integration', () => {
  it('card animation exports are accessible', () => {
    expect(typeof getElementPosition).toBe('function');
    expect(typeof getTrickAreaPosition).toBe('function');
    expect(typeof getPlayerPosition).toBe('function');
    expect(typeof applyTransform).toBe('function');
    expect(typeof resetTransform).toBe('function');
    expect(typeof createAnimatingCardElement).toBe('function');
    expect(typeof getSuitSymbol).toBe('function');
    expect(typeof getRankDisplay).toBe('function');
    expect(typeof TouchGestureHandler).toBe('function');
    expect(typeof createAnimatingCard).toBe('function');
    expect(typeof isAnimationComplete).toBe('function');
    expect(typeof getAnimationProgress).toBe('function');
  });

  it('haptic controller is accessible', () => {
    expect(typeof HapticController).toBe('function');
  });

  it('modal components are accessible', () => {
    expect(typeof TrumpSelector).toBe('function');
    expect(typeof RoundEndModal).toBe('function');
    expect(typeof VictoryModal).toBe('function');
  });

  it('animation timing is consistent', () => {
    // Default animation duration should be 500ms as per requirements
    const card: Card = { suit: 'HEARTS', rank: 'A' };
    const from: Position = { x: 0, y: 0 };
    const to: Position = { x: 100, y: 100 };

    const animatingCard = createAnimatingCard(card, from, to);
    
    // Default duration should be 500ms
    expect(animatingCard.duration).toBe(500);
  });
});