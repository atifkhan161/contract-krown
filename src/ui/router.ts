// Contract Crown PWA Router
// Client-side routing with Page.js - utility only, App owns route registration

import page from 'page';
import type { SessionManager } from '../session/index.js';

export class Router {
  private sessionManager: SessionManager | null = null;

  setSessionManager(sessionManager: SessionManager): void {
    this.sessionManager = sessionManager;
  }

  /**
   * Authentication guard middleware for page.js
   * Redirects to /login if user is not authenticated
   */
  requireAuth(ctx: PageJS.Context, next: () => void): void {
    if (!this.sessionManager || !this.sessionManager.isAuthenticated()) {
      sessionStorage.setItem('redirectAfterLogin', ctx.path);
      page.redirect('/login');
      return;
    }
    next();
  }

  /**
   * Navigates to a route
   */
  navigate(path: string): void {
    page(path);
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
