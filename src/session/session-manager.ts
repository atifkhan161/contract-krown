// Contract Crown Session Manager
// Manages game sessions and player connections

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

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
}

type Session = {
  id: string;
  players: string[];
  status: 'waiting' | 'playing' | 'finished';
};
