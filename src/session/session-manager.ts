// Contract Crown Session Manager
// Manages game sessions and player connections

export interface SessionData {
  userId: string;
  username: string;
  token: string;
  expiresAt: number;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private readonly SESSION_KEY = 'contract_crown_session';
  private readonly SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  public createSession(sessionId: string): void {
    this.sessions.set(sessionId, {
      id: sessionId,
      players: [],
      status: 'waiting'
    });
  }

  public joinSession(sessionId: string, playerId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.players.push(playerId);
    return true;
  }

  public endSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Checks if user is authenticated
   */
  public isAuthenticated(): boolean {
    const session = this.getSession();
    if (!session) return false;
    
    // Check if token has expired
    if (Date.now() > session.expiresAt) {
      this.logout();
      return false;
    }
    
    return true;
  }

  /**
   * Gets the current session from localStorage
   */
  public getSession(): SessionData | null {
    try {
      const sessionJson = localStorage.getItem(this.SESSION_KEY);
      if (!sessionJson) return null;
      
      const session: SessionData = JSON.parse(sessionJson);
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Logs in a user and creates a session token
   */
  public login(userId: string, username: string, token?: string, expiresAt?: number): SessionData {
    const sessionToken = token || this.generateToken();
    const session: SessionData = {
      userId,
      username,
      token: sessionToken,
      expiresAt: expiresAt || Date.now() + this.SESSION_DURATION
    };
    
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return session;
  }

  /**
   * Logs out the user by clearing the session
   */
  public logout(): void {
    localStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Generates a random session token
   */
  private generateToken(): string {
    const array = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
    } else {
      // Fallback for non-browser environments
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

type Session = {
  id: string;
  players: string[];
  status: 'waiting' | 'playing' | 'finished';
};
