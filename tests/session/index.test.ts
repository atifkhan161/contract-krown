// Session Manager Property Tests
// Feature: contract-crown-game, Property 28: Session Token Expiration
// Feature: contract-crown-game, Property 29: Expired Token Redirect

import '@tests/setup.js';
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { SessionManager } from '@src/session/session-manager.js';

describe('Session Manager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Property 28: Session Token Expiration', () => {
    it('should create session token valid for 30 days', () => {
      fc.assert(
        fc.property(fc.string(), (username: string) => {
          const session = sessionManager.login('test-user', username);
          
          const expectedExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
          const tolerance = 1000; // 1 second tolerance
          
          expect(session.expiresAt).toBeGreaterThan(expectedExpiresAt - tolerance);
          expect(session.expiresAt).toBeLessThan(expectedExpiresAt + tolerance);
        }),
        { numRuns: 50 }
      );
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const session = sessionManager.login(`user-${i}`, `User ${i}`);
        tokens.add(session.token);
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('Property 29: Expired Token Redirect', () => {
    it('should return false for expired session', () => {
      const session = sessionManager.login('test-user', 'Test User');
      
      // Manually expire the token
      const expiredSession = { ...session, expiresAt: Date.now() - 1000 };
      localStorage.setItem('contract_crown_session', JSON.stringify(expiredSession));
      
      expect(sessionManager.isAuthenticated()).toBe(false);
    });

    it('should clear expired session on check', () => {
      const session = sessionManager.login('test-user', 'Test User');
      
      // Manually expire the token
      const expiredSession = { ...session, expiresAt: Date.now() - 1000 };
      localStorage.setItem('contract_crown_session', JSON.stringify(expiredSession));
      
      sessionManager.isAuthenticated();
      
      const stored = localStorage.getItem('contract_crown_session');
      expect(stored).toBeNull();
    });
  });

  describe('getSession', () => {
    it('should return null when no session exists', () => {
      expect(sessionManager.getSession()).toBeNull();
    });

    it('should return session data when valid session exists', () => {
      const session = sessionManager.login('test-user', 'Test User');
      const retrieved = sessionManager.getSession();
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.userId).toBe('test-user');
      expect(retrieved?.username).toBe('Test User');
      expect(retrieved?.token).toBe(session.token);
    });

    it('should return null for invalid JSON in localStorage', () => {
      localStorage.setItem('contract_crown_session', 'invalid-json');
      expect(sessionManager.getSession()).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear session on logout', () => {
      sessionManager.login('test-user', 'Test User');
      sessionManager.logout();
      
      expect(sessionManager.getSession()).toBeNull();
      expect(sessionManager.isAuthenticated()).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no session exists', () => {
      expect(sessionManager.isAuthenticated()).toBe(false);
    });

    it('should return true when valid session exists', () => {
      sessionManager.login('test-user', 'Test User');
      expect(sessionManager.isAuthenticated()).toBe(true);
    });
  });
});
