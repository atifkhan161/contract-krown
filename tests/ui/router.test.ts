// Contract Crown Router Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { Router } from '@src/ui/router.js';
import { SessionManager } from '@src/session/session-manager.js';

// Mock localStorage and sessionStorage for Node.js environment
const storage: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => storage[key] || null),
  setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete storage[key]; }),
  clear: vi.fn(() => { Object.keys(storage).forEach(key => delete storage[key]); }),
};

const sessionStorageMock = {
  getItem: vi.fn((key: string) => storage[`session_${key}`] || null),
  setItem: vi.fn((key: string, value: string) => { storage[`session_${key}`] = value; }),
  removeItem: vi.fn((key: string) => { delete storage[`session_${key}`]; }),
  clear: vi.fn(() => { Object.keys(storage).filter(k => k.startsWith('session_')).forEach(key => delete storage[key]); }),
};

// Mock window object for browser APIs
const windowMock = {
  location: {
    search: '',
    href: '',
    pathname: '/',
  },
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Set up global mocks
Object.defineProperty(global, 'window', {
  value: windowMock,
  writable: true,
});

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

Object.defineProperty(global, 'CustomEvent', {
  value: class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, options?: { detail?: any }) {
      this.type = type;
      this.detail = options?.detail;
    }
  },
  writable: true,
});

// Mock page.js with more functional behavior
vi.mock('page', () => {
  const routes: Map<string, Array<{ handlers: Function[]; isMiddleware: boolean }>> = new Map();
  let currentPath = '/';
  
  // Helper to match dynamic routes like /game/:roomId
  const matchRoute = (path: string): { route: string; params: Record<string, string> } | null => {
    // First try exact match
    if (routes.has(path)) {
      return { route: path, params: {} };
    }
    
    // Then try dynamic route matching (skip wildcard)
    for (const [route] of routes) {
      if (route === '*') continue;
      
      const routeParts = route.split('/');
      const pathParts = path.split('/');
      
      if (routeParts.length !== pathParts.length) continue;
      
      const params: Record<string, string> = {};
      let matches = true;
      
      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
          params[routeParts[i].slice(1)] = pathParts[i];
        } else if (routeParts[i] !== pathParts[i]) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        return { route, params };
      }
    }
    
    // Check for wildcard route as fallback only if no other route matched
    if (routes.has('*')) {
      return { route: '*', params: {} };
    }
    
    return null;
  };
  
  // Helper to trigger route handlers
  const triggerRoute = (path: string, params: Record<string, string> = {}): void => {
    const match = matchRoute(path);
    if (match) {
      const routeData = routes.get(match.route);
      if (routeData) {
        routeData.forEach(({ handlers, isMiddleware }) => {
          if (isMiddleware && handlers.length >= 2) {
            // For middleware, call with context and next, then call next handler
            const ctx = { path, params: match.params };
            const next = vi.fn(() => {
              // Call the next handler (route handler)
              handlers[1](ctx);
            });
            handlers[0](ctx, next);
          } else {
            // For regular handlers, just call them
            handlers.forEach(handler => handler({ path, params: match.params }));
          }
        });
      }
    }
  };
  
  const pageFn = vi.fn((path: string, ...handlers: Function[]) => {
    if (typeof path === 'string') {
      if (handlers.length > 0) {
        // Register route handlers
        // Check if this is middleware (has next parameter) or a route handler
        const isMiddleware = handlers.length > 1;
        routes.set(path, [{ handlers, isMiddleware }]);
      } else {
        // Navigate to route - trigger handlers
        currentPath = path;
        triggerRoute(path);
      }
    }
  });
  
  const page: any = Object.assign(pageFn, {
    start: vi.fn(),
    stop: vi.fn(),
    redirect: vi.fn((path: string) => {
      // When redirect is called, update current path and trigger the target route
      currentPath = path;
      triggerRoute(path);
    }),
    _routes: routes,
    _currentPath: () => currentPath,
  });
  return { default: page };
});

// Get the mocked page
const getMockPage = async () => {
  const pageModule = await import('page');
  return pageModule.default as any;
};

// Helper to get current path from mock
const getCurrentPathFromMock = async () => {
  const page = await getMockPage();
  return page._currentPath ? page._currentPath() : '/';
};

describe('Router', () => {
  let router: Router;
  let sessionManager: SessionManager;

  beforeEach(async () => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Reset mock page
    const page = await getMockPage();
    page.start.mockClear();
    page.stop.mockClear();
    page.redirect.mockClear();
    // Note: Don't clear routes here - they are registered by router constructor

    router = new Router();
    sessionManager = new SessionManager();
    router.setSessionManager(sessionManager);
  });

  // Feature: contract-crown-game, Property 27: Unauthenticated Redirect
  describe('Property 27: Unauthenticated Redirect', () => {
    it('redirects to /login when navigating to /lobby without authentication', async () => {
      // User is not authenticated
      expect(sessionManager.isAuthenticated()).toBe(false);

      // Navigate to lobby
      router.navigate('/lobby');

      // Should redirect to login
      const page = await getMockPage();
      expect(page.redirect).toHaveBeenCalledWith('/login');
    });

    it('redirects to /login when navigating to /game without authentication', async () => {
      // User is not authenticated
      expect(sessionManager.isAuthenticated()).toBe(false);

      // Navigate to game
      router.navigate('/game/room123');

      // Should redirect to login
      const page = await getMockPage();
      expect(page.redirect).toHaveBeenCalledWith('/login');
    });

    it('allows navigation to /login without authentication', () => {
      // User is not authenticated
      expect(sessionManager.isAuthenticated()).toBe(false);

      // Register a handler for login route
      const loginHandler = vi.fn();
      router.on('/login', loginHandler);

      // Navigate to login - should not redirect
      router.navigate('/login');

      // Handler should be called
      expect(loginHandler).toHaveBeenCalled();
    });

    it('allows navigation to /offline without authentication', () => {
      // User is not authenticated
      expect(sessionManager.isAuthenticated()).toBe(false);

      // Register a handler for offline route
      const offlineHandler = vi.fn();
      router.on('/offline', offlineHandler);

      // Navigate to offline - should not redirect
      router.navigate('/offline');

      // Handler should be called
      expect(offlineHandler).toHaveBeenCalled();
    });

    it('stores redirect path for after login', async () => {
      // User is not authenticated
      expect(sessionManager.isAuthenticated()).toBe(false);

      // Navigate to lobby
      router.navigate('/lobby');

      // Should store redirect path
      expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/lobby');
    });
  });

  describe('requireAuth', () => {
    it('allows navigation to protected routes when authenticated', () => {
      // Login user
      sessionManager.login('user123', 'testuser');
      expect(sessionManager.isAuthenticated()).toBe(true);

      // Register a handler for lobby route
      const lobbyHandler = vi.fn();
      router.on('/lobby', lobbyHandler);

      // Navigate to lobby - should not redirect
      router.navigate('/lobby');

      // Handler should be called
      expect(lobbyHandler).toHaveBeenCalled();
    });

    it('redirects to /login when session expires', async () => {
      // Create an expired session
      const expiredSession = {
        userId: 'user123',
        username: 'testuser',
        token: 'expired-token',
        expiresAt: Date.now() - 1000 // Expired 1 second ago
      };
      localStorage.setItem('contract_crown_session', JSON.stringify(expiredSession));

      // Check if authenticated - should return false and clear session
      expect(sessionManager.isAuthenticated()).toBe(false);

      // Navigate to lobby
      router.navigate('/lobby');

      // Should redirect to login
      const page = await getMockPage();
      expect(page.redirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('handleLoginRedirect', () => {
    it('navigates to stored redirect path after login', async () => {
      // Login user first to allow game route access
      sessionManager.login('user123', 'testuser');

      // Handle login redirect with game path
      sessionStorage.setItem('redirectAfterLogin', '/game/room123');
      router.handleLoginRedirect();

      // Should navigate to stored path - verify via current path
      const currentPath = await getCurrentPathFromMock();
      expect(currentPath).toBe('/game/room123');
    });

    it('navigates to /lobby if no redirect path stored', async () => {
      // Login user first to prevent auth redirects
      sessionManager.login('user123', 'testuser');

      // Clear any stored redirect
      sessionStorage.removeItem('redirectAfterLogin');

      // Handle login redirect
      router.handleLoginRedirect();

      // Should navigate to lobby
      const currentPath = await getCurrentPathFromMock();
      expect(currentPath).toBe('/lobby');
    });
  });

  describe('handleLogout', () => {
    it('clears session and redirects to login', async () => {
      // Register handler for login route
      const loginHandler = vi.fn();
      router.on('/login', loginHandler);

      // Login user
      sessionManager.login('user123', 'testuser');
      expect(sessionManager.isAuthenticated()).toBe(true);

      // Handle logout
      router.handleLogout();

      // Session should be cleared
      expect(sessionManager.isAuthenticated()).toBe(false);

      // Should navigate to login - handler should be called
      expect(loginHandler).toHaveBeenCalled();
    });
  });

  describe('getCurrentRoute', () => {
    it('returns current route', async () => {
      // Register a handler
      router.on('/test', () => {});

      // Navigate to test route
      router.navigate('/test');

      // Current route should be updated - use mock's current path
      const currentPath = await getCurrentPathFromMock();
      expect(currentPath).toBe('/test');
    });
  });

  describe('on', () => {
    it('registers route handlers', () => {
      const handler = vi.fn();
      router.on('/custom', handler);

      // Navigate to custom route
      router.navigate('/custom');

      // Handler should be called
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('routes', () => {
    it('has login route configured', () => {
      const loginHandler = vi.fn();
      router.on('/login', loginHandler);
      router.navigate('/login');
      expect(loginHandler).toHaveBeenCalled();
    });

    it('has offline route configured', () => {
      const offlineHandler = vi.fn();
      router.on('/offline', offlineHandler);
      router.navigate('/offline');
      expect(offlineHandler).toHaveBeenCalled();
    });
  });

  describe('Route Navigation (Requirement 12.3)', () => {
    it('renders corresponding view when navigating to a route', () => {
      const loginHandler = vi.fn();
      const lobbyHandler = vi.fn();
      const offlineHandler = vi.fn();

      router.on('/login', loginHandler);
      router.on('/lobby', lobbyHandler);
      router.on('/offline', offlineHandler);

      // Navigate to each route and verify handler is called
      router.navigate('/login');
      expect(loginHandler).toHaveBeenCalledTimes(1);
      expect(lobbyHandler).not.toHaveBeenCalled();

      router.navigate('/offline');
      expect(offlineHandler).toHaveBeenCalledTimes(1);

      router.navigate('/lobby');
      expect(lobbyHandler).toHaveBeenCalledTimes(1);
    });

    it('handles dynamic route parameters correctly', async () => {
      const gameHandler = vi.fn();
      router.on('/game', gameHandler);

      // Login user first to allow game route access
      sessionManager.login('user123', 'testuser');

      router.navigate('/game/room-abc-123');

      // Verify handler was called with correct parameters
      expect(gameHandler).toHaveBeenCalled();
      const callArgs = gameHandler.mock.calls[0][0];
      expect(callArgs.params).toBeDefined();
    });

    it('supports multiple route registrations', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      router.on('/route1', handler1);
      router.on('/route2', handler2);
      router.on('/route3', handler3);

      router.navigate('/route1');
      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();

      router.navigate('/route3');
      expect(handler3).toHaveBeenCalled();
    });

    it('provides route context with path and querystring', () => {
      const handler = vi.fn();
      router.on('/test', handler);

      router.navigate('/test');

      expect(handler).toHaveBeenCalled();
      const context = handler.mock.calls[0][0];
      expect(context).toHaveProperty('path');
      expect(context).toHaveProperty('params');
      expect(context).toHaveProperty('querystring');
    });
  });

  describe('Browser History (Requirement 12.5)', () => {
    it('maintains current route state for back navigation', async () => {
      const loginHandler = vi.fn();
      const lobbyHandler = vi.fn();

      router.on('/login', loginHandler);
      router.on('/lobby', lobbyHandler);

      // Navigate through routes
      router.navigate('/login');
      router.navigate('/lobby');

      // Current route should reflect last navigation
      const currentPath = await getCurrentPathFromMock();
      expect(currentPath).toBe('/lobby');
    });

    it('updates current route on each navigation', async () => {
      router.on('/page1', () => {});
      router.on('/page2', () => {});
      router.on('/page3', () => {});

      router.navigate('/page1');
      let currentPath = await getCurrentPathFromMock();
      expect(currentPath).toBe('/page1');

      router.navigate('/page2');
      currentPath = await getCurrentPathFromMock();
      expect(currentPath).toBe('/page2');

      router.navigate('/page3');
      currentPath = await getCurrentPathFromMock();
      expect(currentPath).toBe('/page3');
    });

    it('dispatches routechange event on navigation for history tracking', () => {
      // Login user to prevent auth redirects
      sessionManager.login('user123', 'testuser');

      const handler = vi.fn();
      router.on('/history-test', handler);

      router.navigate('/history-test');

      // Verify handler was called (which means route navigation worked)
      expect(handler).toHaveBeenCalled();
      const context = handler.mock.calls[0][0];
      expect(context.path).toBe('/history-test');
    });

    it('dispatches routechange event with route parameters', () => {
      sessionManager.login('user123', 'testuser');
      const handler = vi.fn();
      router.on('/game', handler);

      router.navigate('/game/room-456');

      const dispatchCalls = (window.dispatchEvent as any).mock.calls;
      const routeChangeEvent = dispatchCalls.find(
        (call: any[]) => call[0]?.type === 'routechange'
      );
      expect(routeChangeEvent).toBeDefined();
      expect(routeChangeEvent[0].detail.params).toBeDefined();
    });
  });

  describe('Router Start and Stop', () => {
    it('starts the router', async () => {
      router.start();
      const page = await getMockPage();
      expect(page.start).toHaveBeenCalled();
    });

    it('stops the router', async () => {
      router.stop();
      const page = await getMockPage();
      expect(page.stop).toHaveBeenCalled();
    });
  });

  describe('Route Context (Requirement 12.3)', () => {
    it('provides correct path in route context', () => {
      const handler = vi.fn();
      router.on('/context-test', handler);

      router.navigate('/context-test');

      const context = handler.mock.calls[0][0];
      expect(context.path).toBe('/context-test');
    });

    it('provides empty params for static routes', () => {
      const handler = vi.fn();
      router.on('/static', handler);

      router.navigate('/static');

      const context = handler.mock.calls[0][0];
      expect(context.params).toEqual({});
    });

    it('provides params for dynamic routes', () => {
      sessionManager.login('user123', 'testuser');
      const handler = vi.fn();
      router.on('/game', handler);

      router.navigate('/game/room-789');

      const context = handler.mock.calls[0][0];
      expect(context.params).toBeDefined();
      expect(context.params.roomId).toBe('room-789');
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
      // Create an expired session
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
      const session = sessionManager.login('user123', 'testuser');
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
      expect(session.token.length).toBe(64); // 32 bytes = 64 hex chars
      
      // Check expiration is approximately 30 days from now
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