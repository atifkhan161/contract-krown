// Contract Crown Bot Manager
// Manages bot players and AI decisions

export class BotManager {
  private bots: Map<string, BotState> = new Map();

  public registerBot(botId: string): void {
    this.bots.set(botId, {
      id: botId,
      difficulty: 'medium',
      lastMove: null
    });
  }

  public makeMove(botId: string): string | null {
    const bot = this.bots.get(botId);
    if (!bot) return null;

    bot.lastMove = 'play';
    return bot.lastMove;
  }

  public unregisterBot(botId: string): void {
    this.bots.delete(botId);
  }
}

type BotState = {
  id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  lastMove: string | null;
};
