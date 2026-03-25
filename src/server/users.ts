// Contract Crown Users
// User management logic

export class UserManager {
  private users: Map<string, User> = new Map();

  public createUser(userId: string, username: string): void {
    this.users.set(userId, {
      id: userId,
      username,
      createdAt: new Date()
    });
  }

  public getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }
}

type User = {
  id: string;
  username: string;
  createdAt: Date;
};
