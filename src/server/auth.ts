// Contract Crown Auth
// Authentication logic

export class AuthManager {
  private tokens: Map<string, Token> = new Map();

  public createToken(userId: string): string {
    const token = Math.random().toString(36).substring(2);
    this.tokens.set(token, {
      userId,
      createdAt: new Date()
    });
    return token;
  }

  public validateToken(token: string): string | null {
    const stored = this.tokens.get(token);
    if (!stored) return null;
    return stored.userId;
  }
}

type Token = {
  userId: string;
  createdAt: Date;
};
