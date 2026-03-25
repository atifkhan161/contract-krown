// Contract Crown PWA Router
// Client-side routing with Page.js

import page from 'page';
import type { SessionManager } from '../session/index.js';

export interface RouteContext {
  path: string;
  params: Record<string, string>;
  querystring: string;
}

export type RouteHandler = (ctx: RouteContext) => void | Promise<void>;

export class Router {
  private sessionManager: SessionManager | null = null;
  private routes: Map<string, RouteHandler> = new Map();
  private currentRoute: string = '/';

  constructor() {
    this.setupDefaultRoutes();
  }

  /**
   * Sets the session manager for authentication checks
   */
  setSessionManager(sessionManager: SessionManager): void {
    this.sessionManager = sessionManager;
  }

  /**
   * Sets up default routes
   */
  private setupDefaultRoutes(): void {
    // Login route - no auth required
    page('/login', () => this.handleRoute('/login'));

    // Lobby route - auth required
    page('/lobby', (ctx, next) => this.requireAuth(ctx, next), () => this.handleRoute('/lobby'));

    // Game route - auth required
    page('/game/:roomId', (ctx, next) => this.requireAuth(ctx, next), (ctx) => {
      this.handleRoute('/game', { roomId: ctx.params.roomId });
    });

    // Offline route - no auth required
    page('/offline', () => this.handleRoute('/offline'));

    // Default redirect
    page('*', () => page.redirect('/lobby'));
  }

  /**
   * Authentication guard middleware
   * Redirects to /login if user is not authenticated
   */
  private requireAuth(ctx: PageJS.Context, next: () => void): void {
    if (!this.sessionManager || !this.sessionManager.isAuthenticated()) {
      // Store intended destination for redirect after login
      sessionStorage.setItem('redirectAfterLogin', ctx.path);
      page.redirect('/login');
      return;
    }
    next();
  }

  /**
   * Handles route changes
   */
  private handleRoute(route: string, params: Record<string, string> = {}): void {
    this.currentRoute = route;
    
    const handler = this.routes.get(route);
    if (handler) {
      const ctx: RouteContext = {
        path: route,
        params,
        querystring: typeof window !== 'undefined' ? window.location.search.slice(1) : ''
      };
      handler(ctx);
    }

    // Dispatch custom event for route changes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('routechange', {
        detail: { route, params }
      }));
    }
  }

  /**
   * Registers a route handler
   */
  on(route: string, handler: RouteHandler): void {
    this.routes.set(route, handler);
    // Also register with page.js for proper integration
    page(route, (ctx: any) => {
      const routeContext: RouteContext = {
        path: ctx.path || route,
        params: ctx.params || {},
        querystring: typeof window !== 'undefined' ? window.location.search.slice(1) : ''
      };
      handler(routeContext);
    });
  }

  /**
   * Starts the router
   */
  start(): void {
    page.start();
  }

  /**
   * Stops the router
   */
  stop(): void {
    page.stop();
  }

  /**
   * Navigates to a route
   */
  navigate(path: string): void {
    page(path);
  }

  /**
   * Gets the current route
   */
  getCurrentRoute(): string {
    return this.currentRoute;
  }

  /**
   * Checks if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.sessionManager?.isAuthenticated() ?? false;
  }

  /**
   * Handles login redirect - navigates to stored destination or lobby
   */
  handleLoginRedirect(): void {
    const redirectPath = sessionStorage.getItem('redirectAfterLogin');
    sessionStorage.removeItem('redirectAfterLogin');
    this.navigate(redirectPath || '/lobby');
  }

  /**
   * Handles logout - clears session and redirects to login
   */
  handleLogout(): void {
    if (this.sessionManager) {
      this.sessionManager.logout();
    }
    this.navigate('/login');
  }
}

// Singleton instance
export const router = new Router();