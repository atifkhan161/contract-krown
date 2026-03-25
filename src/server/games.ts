// Contract Crown Games
// Game management logic

export class GameManager {
  private games: Map<string, Game> = new Map();

  public createGame(gameId: string): void {
    this.games.set(gameId, {
      id: gameId,
      players: [],
      status: 'waiting'
    });
  }

  public getGame(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }

  public deleteGame(gameId: string): void {
    this.games.delete(gameId);
  }
}

type Game = {
  id: string;
  players: string[];
  status: 'waiting' | 'playing' | 'finished';
};
