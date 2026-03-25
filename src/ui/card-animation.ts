// Contract Crown Card Animation
// CSS transform-based card animation utilities for 60 FPS performance

import type { Card, Suit } from '../engine/types.js';
import type { Position, AnimatingCard } from './types.js';

/**
 * Card animation utilities using CSS transforms for GPU-accelerated 60 FPS performance
 * Requirements: 15.1, 15.2, 15.4
 */

/**
 * Gets the position of a card element relative to a container
 */
export function getElementPosition(element: HTMLElement, container: HTMLElement): Position {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  return {
    x: elementRect.left - containerRect.left,
    y: elementRect.top - containerRect.top
  };
}

/**
 * Gets the trick area center position
 */
export function getTrickAreaPosition(trickArea: HTMLElement): Position {
  const rect = trickArea.getBoundingClientRect();
  return {
    x: rect.width / 2,
    y: rect.height / 2
  };
}

/**
 * Gets player position for trick collection animation
 */
export function getPlayerPosition(
  playerDisplay: HTMLElement,
  container: HTMLElement
): Position {
  const playerRect = playerDisplay.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  return {
    x: playerRect.left - containerRect.left + playerRect.width / 2,
    y: playerRect.top - containerRect.top + playerRect.height / 2
  };
}

/**
 * Applies GPU-accelerated transform to an element
 */
export function applyTransform(
  element: HTMLElement,
  translateX: number,
  translateY: number,
  scale: number = 1,
  opacity: number = 1
): void {
  element.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  element.style.opacity = `${opacity}`;
}

/**
 * Resets element transform to default state
 */
export function resetTransform(element: HTMLElement): void {
  element.style.transform = '';
  element.style.opacity = '';
  element.style.transition = '';
}

/**
 * Creates a card animation element for play animation
 * Requirement 15.1: Animate card from player hand to trick area
 */
export function createAnimatingCardElement(card: Card, suitSymbol: string, rankDisplay: string): HTMLElement {
  const cardElement = document.createElement('div');
  cardElement.className = 'card animating playable';
  cardElement.dataset.suit = card.suit;
  cardElement.dataset.rank = card.rank;

  const suitColor = (card.suit === 'HEARTS' || card.suit === 'DIAMONDS') ? 'red' : 'black';

  cardElement.innerHTML = `
    <div class="card-content">
      <span class="card-rank">${rankDisplay}</span>
      <span class="card-suit ${suitColor}">${suitSymbol}</span>
    </div>
  `;

  return cardElement;
}

/**
 * Gets the suit symbol for display
 */
export function getSuitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    'HEARTS': '♥',
    'DIAMONDS': '♦',
    'CLUBS': '♣',
    'SPADES': '♠'
  };
  return symbols[suit];
}

/**
 * Gets the rank display text
 */
export function getRankDisplay(rank: string): string {
  return rank;
}

/**
 * Animates a card from player's hand to the trick area
 * Requirement 15.1: Animate card from player hand to trick area
 * Requirement 15.4: 60 FPS performance with GPU acceleration
 * 
 * @param cardElement - The card DOM element to animate
 * @param fromPosition - Starting position (card in hand)
 * @param toPosition - Ending position (trick area center)
 * @param duration - Animation duration in ms (default 500ms)
 * @returns Promise that resolves when animation completes
 */
export function animateCardPlay(
  cardElement: HTMLElement,
  fromPosition: Position,
  toPosition: Position,
  duration: number = 500
): Promise<void> {
  return new Promise((resolve) => {
    // Calculate translation needed
    const translateX = toPosition.x - fromPosition.x;
    const translateY = toPosition.y - fromPosition.y;

    // Apply initial position
    cardElement.style.position = 'absolute';
    cardElement.style.left = `${fromPosition.x}px`;
    cardElement.style.top = `${fromPosition.y}px`;
    cardElement.style.zIndex = '100';
    cardElement.style.transition = 'none';

    // Force reflow to ensure initial position is applied
    cardElement.offsetHeight;

    // Enable GPU-accelerated transitions
    cardElement.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${duration}ms ease`;
    cardElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(0.9)`;
    cardElement.style.opacity = '1';

    // Handle animation completion
    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === 'transform' || event.propertyName === 'opacity') {
        cardElement.removeEventListener('transitionend', handleTransitionEnd);
        resolve();
      }
    };

    cardElement.addEventListener('transitionend', handleTransitionEnd);

    // Fallback timeout in case transitionend doesn't fire
    setTimeout(() => {
      cardElement.removeEventListener('transitionend', handleTransitionEnd);
      resolve();
    }, duration + 50);
  });
}

/**
 * Animates trick cards to winner's position for collection
 * Requirement 15.3: Animate all trick cards to winner's position
 * Requirement 15.4: 60 FPS performance with GPU acceleration
 * 
 * @param trickCards - Array of card elements in the trick
 * @param winnerPosition - Position of the trick winner
 * @param duration - Animation duration in ms (default 500ms)
 * @returns Promise that resolves when animation completes
 */
export function animateTrickCollection(
  trickCards: HTMLElement[],
  winnerPosition: Position,
  duration: number = 500
): Promise<void> {
  return new Promise((resolve) => {
    if (trickCards.length === 0) {
      resolve();
      return;
    }

    let completedAnimations = 0;
    const totalAnimations = trickCards.length;

    const checkComplete = () => {
      completedAnimations++;
      if (completedAnimations >= totalAnimations) {
        resolve();
      }
    };

    trickCards.forEach((cardElement, index) => {
      const currentRect = cardElement.getBoundingClientRect();
      const translateX = winnerPosition.x - currentRect.left - currentRect.width / 2;
      const translateY = winnerPosition.y - currentRect.top - currentRect.height / 2;

      // Enable GPU-accelerated transitions with staggered delay for visual effect
      const delay = index * 50;
      cardElement.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, opacity ${duration}ms ease ${delay}ms`;
      cardElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(0.5) rotate(${index * 5}deg)`;
      cardElement.style.opacity = '0.3';

      // Handle animation completion
      const handleTransitionEnd = (event: TransitionEvent) => {
        if (event.propertyName === 'transform' || event.propertyName === 'opacity') {
          cardElement.removeEventListener('transitionend', handleTransitionEnd);
          checkComplete();
        }
      };

      cardElement.addEventListener('transitionend', handleTransitionEnd);

      // Fallback timeout
      setTimeout(() => {
        cardElement.removeEventListener('transitionend', handleTransitionEnd);
        checkComplete();
      }, duration + delay + 50);
    });

    // Fallback for entire animation
    setTimeout(resolve, duration + (totalAnimations * 50) + 100);
  });
}

/**
 * Handles touch/tap gestures on card elements
 * Requirement 15.5: Handle tap events on cards
 */
export class TouchGestureHandler {
  private container: HTMLElement;
  private onCardTap: ((card: Card) => void) | null = null;
  private touchStartTime: number = 0;
  private touchStartPosition: Position = { x: 0, y: 0 };

  constructor(container: HTMLElement) {
    this.container = container;
    this.setupEventListeners();
  }

  /**
   * Sets up touch event listeners for gesture handling
   */
  private setupEventListeners(): void {
    // Handle touch events
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });

    // Handle mouse click events for desktop
    this.container.addEventListener('click', this.handleClick.bind(this));
  }

  /**
   * Handles touch start event
   */
  private handleTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.touchStartTime = Date.now();
      this.touchStartPosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    }
  }

  /**
   * Handles touch end event
   * Requirement 15.5: Handle tap events on cards
   */
  private handleTouchEnd(event: TouchEvent): void {
    const touchDuration = Date.now() - this.touchStartTime;

    // Only process short taps (less than 300ms)
    if (touchDuration > 300) {
      return;
    }

    const touch = event.changedTouches[0];
    const endPosition = {
      x: touch.clientX,
      y: touch.clientY
    };

    // Calculate distance moved
    const distance = Math.sqrt(
      Math.pow(endPosition.x - this.touchStartPosition.x, 2) +
      Math.pow(endPosition.y - this.touchStartPosition.y, 2)
    );

    // Only process taps with minimal movement (less than 10px)
    if (distance > 10) {
      return;
    }

    // Find the card element
    const target = event.target as HTMLElement;
    const cardElement = target.closest('.card.playable') as HTMLElement;

    if (cardElement) {
      this.triggerCardTap(cardElement);
    }
  }

  /**
   * Handles mouse click events for desktop
   */
  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const cardElement = target.closest('.card.playable') as HTMLElement;

    if (cardElement) {
      this.triggerCardTap(cardElement);
    }
  }

  /**
   * Triggers card tap callback
   */
  private triggerCardTap(cardElement: HTMLElement): void {
    if (!this.onCardTap) return;

    const suit = cardElement.dataset.suit as Suit;
    const rank = cardElement.dataset.rank as string;

    if (suit && rank) {
      this.onCardTap({ suit, rank } as Card);
    }
  }

  /**
   * Sets the card tap handler
   */
  public setCardTapHandler(handler: (card: Card) => void): void {
    this.onCardTap = handler;
  }

  /**
   * Handles swipe gestures for card selection
   * Requirement 15.5: Handle swipe gestures for card selection
   */
  public setupSwipeHandler(
    handContainer: HTMLElement,
    onSwipeSelect: (card: Card) => void
  ): void {
    let swipeStartX = 0;
    let swipeStartY = 0;
    let currentCardIndex = 0;

    handContainer.addEventListener('touchstart', (event) => {
      if (event.touches.length === 1) {
        swipeStartX = event.touches[0].clientX;
        swipeStartY = event.touches[0].clientY;
      }
    }, { passive: true });

    handContainer.addEventListener('touchmove', (event) => {
      if (event.touches.length !== 1) return;

      const deltaX = event.touches[0].clientX - swipeStartX;
      const deltaY = event.touches[0].clientY - swipeStartY;

      // Only process horizontal swipes with minimal vertical movement
      if (Math.abs(deltaY) > 30) return;

      // Detect swipe direction and magnitude
      if (Math.abs(deltaX) > 50) {
        const cards = handContainer.querySelectorAll('.card.playable');
        if (cards.length === 0) return;

        if (deltaX > 0) {
          // Swipe right - select next card
          currentCardIndex = (currentCardIndex + 1) % cards.length;
        } else {
          // Swipe left - select previous card
          currentCardIndex = (currentCardIndex - 1 + cards.length) % cards.length;
        }

        const selectedCard = cards[currentCardIndex] as HTMLElement;
        const suit = selectedCard.dataset.suit as Suit;
        const rank = selectedCard.dataset.rank as string;

        if (suit && rank) {
          // Highlight selected card
          cards.forEach(card => card.classList.remove('swipe-selected'));
          selectedCard.classList.add('swipe-selected');

          onSwipeSelect({ suit, rank } as Card);
        }

        // Reset swipe start position
        swipeStartX = event.touches[0].clientX;
        swipeStartY = event.touches[0].clientY;
      }
    }, { passive: true });
  }

  /**
   * Cleans up event listeners
   */
  public destroy(): void {
    // Event listeners will be automatically removed when container is removed from DOM
    this.onCardTap = null;
  }
}

/**
 * Creates an AnimatingCard object for tracking animation state
 */
export function createAnimatingCard(
  card: Card,
  from: Position,
  to: Position,
  duration: number = 500
): AnimatingCard {
  return {
    card,
    from,
    to,
    duration,
    startTime: Date.now()
  };
}

/**
 * Checks if an animation is complete
 */
export function isAnimationComplete(animatingCard: AnimatingCard): boolean {
  const elapsed = Date.now() - animatingCard.startTime;
  return elapsed >= animatingCard.duration;
}

/**
 * Gets the current progress of an animation (0-1)
 */
export function getAnimationProgress(animatingCard: AnimatingCard): number {
  const elapsed = Date.now() - animatingCard.startTime;
  return Math.min(elapsed / animatingCard.duration, 1);
}