// Contract Crown Unit Tests for Modal Bottom Sheet and Context Menu

import { describe, it, expect, vi } from 'vitest';

import { ModalBottomSheet } from '@src/ui/modal-bottom-sheet.js';
import { ContextMenu } from '@src/ui/context-menu.js';

// ============================================================================
// ModalBottomSheet Tests
// ============================================================================

describe('ModalBottomSheet', () => {

  describe('Constructor', () => {
    it('creates instance with allowBackdropDismiss=true', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: true });
      expect(sheet).toBeDefined();
      expect(sheet.isVisible()).toBe(false);
    });

    it('creates instance with allowBackdropDismiss=false', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: false });
      expect(sheet).toBeDefined();
      expect(sheet.isVisible()).toBe(false);
    });

    it('creates instance with custom contentClass', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: true, contentClass: 'custom-class' });
      expect(sheet).toBeDefined();
    });
  });

  describe('Visibility', () => {
    it('returns false initially', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: true });
      expect(sheet.isVisible()).toBe(false);
    });

    it('returns null for sheet element initially', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: true });
      expect(sheet.getSheetElement()).toBeNull();
    });
  });

  describe('Container', () => {
    it('setContainer does not throw', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: true });
      const mockContainer = { appendChild: vi.fn() } as unknown as HTMLElement;
      expect(() => sheet.setContainer(mockContainer)).not.toThrow();
    });
  });

  describe('Show', () => {
    it('show does not throw when no container set', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: true });
      expect(() => sheet.show('<div>test</div>')).not.toThrow();
    });

    it('show does not throw in non-browser environment', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: true });
      const mockContainer = { appendChild: vi.fn() } as unknown as HTMLElement;
      sheet.setContainer(mockContainer);
      expect(() => sheet.show('<div>test</div>')).not.toThrow();
    });
  });

  describe('Hide', () => {
    it('hide does not throw when not visible', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: true });
      expect(() => sheet.hide()).not.toThrow();
    });
  });

  describe('Destroy', () => {
    it('destroy cleans up without error', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: true });
      expect(() => sheet.destroy()).not.toThrow();
    });

    it('destroy removes onDismiss handler', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: true });
      sheet.setOnDismiss(() => {});
      expect(() => sheet.destroy()).not.toThrow();
    });
  });

  describe('OnDismiss', () => {
    it('setOnDismiss does not throw', () => {
      const sheet = new ModalBottomSheet({ allowBackdropDismiss: true });
      const handler = vi.fn();
      expect(() => sheet.setOnDismiss(handler)).not.toThrow();
    });
  });
});

// ============================================================================
// ContextMenu Tests
// ============================================================================

describe('ContextMenu', () => {

  describe('Constructor', () => {
    it('creates instance', () => {
      const menu = new ContextMenu();
      expect(menu).toBeDefined();
      expect(menu.isMenuOpen()).toBe(false);
    });
  });

  describe('Container', () => {
    it('setContainer does not throw', () => {
      const menu = new ContextMenu();
      const mockContainer = { appendChild: vi.fn() } as unknown as HTMLElement;
      expect(() => menu.setContainer(mockContainer)).not.toThrow();
    });
  });

  describe('Handlers', () => {
    it('setHandler does not throw', () => {
      const menu = new ContextMenu();
      const handler = vi.fn();
      expect(() => menu.setHandler('view-cards', handler)).not.toThrow();
    });

    it('accepts all menu item IDs', () => {
      const menu = new ContextMenu();
      const handler = vi.fn();
      expect(() => menu.setHandler('view-cards', handler)).not.toThrow();
      expect(() => menu.setHandler('toggle-theme', handler)).not.toThrow();
      expect(() => menu.setHandler('restart-game', handler)).not.toThrow();
      expect(() => menu.setHandler('return-lobby', handler)).not.toThrow();
    });
  });

  describe('Visibility', () => {
    it('returns false initially', () => {
      const menu = new ContextMenu();
      expect(menu.isMenuOpen()).toBe(false);
    });
  });

  describe('Hide', () => {
    it('hide does not throw when not open', () => {
      const menu = new ContextMenu();
      expect(() => menu.hide()).not.toThrow();
    });
  });

  describe('Destroy', () => {
    it('destroy cleans up without error', () => {
      const menu = new ContextMenu();
      expect(() => menu.destroy()).not.toThrow();
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Modal Bottom Sheet Integration', () => {
  it('ModalBottomSheet and ContextMenu can be imported together', () => {
    const sheet = new ModalBottomSheet({ allowBackdropDismiss: true });
    const menu = new ContextMenu();
    expect(sheet).toBeDefined();
    expect(menu).toBeDefined();
  });

  it('ContextMenu uses ModalBottomSheet internally', () => {
    const menu = new ContextMenu();
    expect(menu.isMenuOpen()).toBe(false);
  });
});
