// Contract Crown Router Tests
import '@tests/setup.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '@src/ui/router.js';
import { SessionManager } from '@src/session/session-manager.js';

vi.mock('page', () => ({
  default: vi.fn((_path: string) => {
    // Simple mock - just store the path
  }),
}));

describe('Router', () => {
  let router: Router;
  let sessionManager: SessionManager;

  beforeEach(() => {
    router = new Router();
    sessionManager = new SessionManager();
    router.setSessionManager(sessionManager);
  });

  describe('setSessionManager', () => {
    it('sets the session manager', () => {
      expect(router).toBeDefined();
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when not authenticated', () => {
      expect(router.isAuthenticated()).toBe(false);
    });

    it('returns true when authenticated', () => {
      sessionManager.login('user123', 'testuser');
      expect(router.isAuthenticated()).toBe(true);
    });
  });

  describe('navigate', () => {
    it('router is defined and has navigate method', () => {
      expect(typeof router.navigate).toBe('function');
    });
  });

  describe('handleLoginRedirect', () => {
    it('router has handleLoginRedirect method', () => {
      expect(typeof router.handleLoginRedirect).toBe('function');
    });
  });

  describe('handleLogout', () => {
    it('clears session when logout is called', () => {
      sessionManager.login('user123', 'testuser');
      expect(sessionManager.isAuthenticated()).toBe(true);
      
      router.handleLogout();
      
      expect(sessionManager.isAuthenticated()).toBe(false);
    });
  });

  describe('requireAuth middleware', () => {
    it('does not call next when not authenticated', () => {
      const next = vi.fn();
      const ctx = { path: '/lobby' };
      
      router.requireAuth(ctx as any, next);
      
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next when authenticated', () => {
      sessionManager.login('user123', 'testuser');
      
      const next = vi.fn();
      const ctx = { path: '/lobby' };
      
      router.requireAuth(ctx as any, next);
      
      expect(next).toHaveBeenCalled();
    });
  });
});

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    localStorage.clear();
    sessionManager = new SessionManager();
  });

  describe('isAuthenticated', () => {
    it('returns false when no session exists', () => {
      expect(sessionManager.isAuthenticated()).toBe(false);
    });

    it('returns true when valid session exists', () => {
      sessionManager.login('user123', 'testuser');
      expect(sessionManager.isAuthenticated()).toBe(true);
    });

    it('returns false and clears session when token expires', () => {
      const expiredSession = {
        userId: 'user123',
        username: 'testuser',
        token: 'expired-token',
        expiresAt: Date.now() - 1000
      };
      localStorage.setItem('contract_crown_session', JSON.stringify(expiredSession));

      expect(sessionManager.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('contract_crown_session')).toBeNull();
    });
  });

  describe('getSession', () => {
    it('returns null when no session exists', () => {
      expect(sessionManager.getSession()).toBeNull();
    });

    it('returns session data when session exists', () => {
      sessionManager.login('user123', 'testuser');
      const retrieved = sessionManager.getSession();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.userId).toBe('user123');
      expect(retrieved?.username).toBe('testuser');
      expect(retrieved?.token).toBeDefined();
      expect(retrieved?.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('login', () => {
    it('creates a session with 30-day expiration', () => {
      const beforeLogin = Date.now();
      const session = sessionManager.login('user123', 'testuser');
      const afterLogin = Date.now();

      expect(session.userId).toBe('user123');
      expect(session.username).toBe('testuser');
      expect(session.token).toBeDefined();
      expect(session.token.length).toBe(64);
      
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(session.expiresAt).toBeGreaterThanOrEqual(beforeLogin + thirtyDaysMs);
      expect(session.expiresAt).toBeLessThanOrEqual(afterLogin + thirtyDaysMs);
    });

    it('stores session in localStorage', () => {
      sessionManager.login('user123', 'testuser');
      const stored = localStorage.getItem('contract_crown_session');
      expect(stored).not.toBeNull();
    });
  });

  describe('logout', () => {
    it('clears session from localStorage', () => {
      sessionManager.login('user123', 'testuser');
      expect(localStorage.getItem('contract_crown_session')).not.toBeNull();

      sessionManager.logout();
      expect(localStorage.getItem('contract_crown_session')).toBeNull();
    });

    it('makes isAuthenticated return false', () => {
      sessionManager.login('user123', 'testuser');
      expect(sessionManager.isAuthenticated()).toBe(true);

      sessionManager.logout();
      expect(sessionManager.isAuthenticated()).toBe(false);
    });
  });
});
