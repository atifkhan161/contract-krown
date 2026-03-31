// Contract Crown Database
// LokiJS persistence layer for user data, game history, and statistics

import loki from 'lokijs';

export interface UserDocument {
  userId: string;
  username: string;
  passwordHash: string;
  createdAt: number;
  lastLogin: number;
}

export interface GameDocument {
  gameId: string;
  players: string[];
  winner: 0 | 1;
  finalScores: [number, number];
  rounds: number;
  completedAt: number;
}

export interface StatisticsDocument {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  totalPoints: number;
  averagePointsPerGame: number;
}

export class Database {
  private db: any = null;
  private dbPath: string;
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private readonly AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private initialized: boolean = false;

  constructor(dbPath: string = 'contract-crown.json') {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve) => {
      try {
        this.db = new loki(this.dbPath, {
          autoload: true,
          autoloadCallback: () => {
            this.initialized = true;
            this.startAutoSave();
            resolve();
          },
          autosave: true,
          autosaveInterval: this.AUTO_SAVE_INTERVAL,
          persistenceMethod: 'fs'
        });
      } catch (e) {
        // If autoload fails, create in-memory
        this.db = new loki(this.dbPath, {
          autoload: false,
          persistenceMethod: 'fs'
        });
        this.initialized = true;
        resolve();
      }
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private ensureDb(): void {
    if (!this.db) {
      this.db = new loki('memory', {
        autoload: false
      });
      this.initialized = true;
    }
  }

  private startAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    this.autoSaveInterval = setInterval(() => {
      this.save();
    }, this.AUTO_SAVE_INTERVAL);
  }

  save(): void {
    if (this.db) {
      try {
        this.db.saveDatabase();
      } catch (e) {
        // Ignore save errors
      }
    }
  }

  // User operations
  registerUser(username: string, passwordHash: string): UserDocument {
    this.ensureDb();
    
    let users = this.db.getCollection('users');
    if (!users) {
      users = this.db.addCollection('users', {
        indices: ['username', 'userId']
      });
    }

    const existing = users.find({ username });
    if (existing.length > 0) {
      throw new Error('USERNAME_EXISTS');
    }

    const userId = this.generateUserId();
    const user: UserDocument = {
      userId,
      username,
      passwordHash,
      createdAt: Date.now(),
      lastLogin: Date.now()
    };

    users.insert(user);
    this.initializeStatistics(userId);

    return user;
  }

  createUser(userId: string, username: string, passwordHash: string): UserDocument {
    const user: UserDocument = {
      userId,
      username,
      passwordHash,
      createdAt: Date.now(),
      lastLogin: Date.now()
    };

    this.ensureDb();
    
    let users = this.db.getCollection('users');
    if (!users) {
      users = this.db.addCollection('users', {
        indices: ['username', 'userId']
      });
    }
    users.insert(user);

    // Initialize statistics for new user
    this.initializeStatistics(userId);

    return user;
  }

  getUser(userId: string): UserDocument | undefined {
    this.ensureDb();
    
    const users = this.db.getCollection('users');
    if (!users) return undefined;
    
    const result = users.find({ userId });
    return result.length > 0 ? result[0] : undefined;
  }

  getUserByUsername(username: string): UserDocument | undefined {
    this.ensureDb();
    
    const users = this.db.getCollection('users');
    if (!users) return undefined;
    
    const result = users.find({ username });
    return result.length > 0 ? result[0] : undefined;
  }

  updateUserLogin(userId: string): void {
    this.ensureDb();
    
    const users = this.db.getCollection('users');
    if (!users) return;
    
    const result = users.find({ userId });
    if (result.length > 0) {
      const user = result[0];
      user.lastLogin = Date.now();
      users.update(user);
    }
  }

  // Game operations
  saveGame(game: GameDocument): GameDocument {
    this.ensureDb();
    
    let games = this.db.getCollection('games');
    if (!games) {
      games = this.db.addCollection('games', {
        indices: ['gameId', 'completedAt']
      });
    }
    games.insert(game);
    
    return game;
  }

  getGame(gameId: string): GameDocument | undefined {
    this.ensureDb();
    
    const games = this.db.getCollection('games');
    if (!games) return undefined;
    
    const result = games.find({ gameId });
    return result.length > 0 ? result[0] : undefined;
  }

  getGamesByUser(userId: string): GameDocument[] {
    this.ensureDb();
    
    const games = this.db.getCollection('games');
    if (!games) return [];
    
    const allGames = games.find();
    return allGames.filter((g: any) => g.players && g.players.includes(userId)) as GameDocument[];
  }

  // Statistics operations
  private initializeStatistics(userId: string): void {
    this.ensureDb();

    let stats = this.db.getCollection('statistics');
    if (!stats) {
      stats = this.db.addCollection('statistics', {
        indices: ['userId']
      });
    }
    
    const existing = stats.find({ userId });
    if (existing.length === 0) {
      stats.insert({
        userId,
        gamesPlayed: 0,
        gamesWon: 0,
        totalPoints: 0,
        averagePointsPerGame: 0
      });
    }
  }

  getStatistics(userId: string): StatisticsDocument | undefined {
    this.ensureDb();
    
    const stats = this.db.getCollection('statistics');
    if (!stats) return undefined;
    
    const result = stats.find({ userId });
    return result.length > 0 ? result[0] : undefined;
  }

  updateStatistics(
    userId: string,
    won: boolean,
    pointsScored: number
  ): StatisticsDocument | undefined {
    this.ensureDb();

    let stats = this.db.getCollection('statistics');
    if (!stats) {
      this.initializeStatistics(userId);
      stats = this.db.getCollection('statistics');
    }

    if (!stats) return undefined;

    let stat = stats.find({ userId });
    if (stat.length === 0) {
      stats.insert({
        userId,
        gamesPlayed: 1,
        gamesWon: won ? 1 : 0,
        totalPoints: pointsScored,
        averagePointsPerGame: pointsScored
      });
      stat = stats.find({ userId });
    } else {
      const s = stat[0];
      s.gamesPlayed += 1;
      if (won) {
        s.gamesWon += 1;
      }
      s.totalPoints += pointsScored;
      s.averagePointsPerGame = s.totalPoints / s.gamesPlayed;
      stats.update(s);
      stat = stats.find({ userId });
    }

    return stat.length > 0 ? stat[0] : undefined;
  }

  // Cleanup
  close(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.db) {
      try {
        this.db.saveDatabase();
      } catch (e) {}
      try {
        this.db.close();
      } catch (e) {}
    }
  }

  private generateUserId(): string {
    const array = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

// Simple password hashing (in production, use bcrypt or similar)
export function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Singleton instance
export const database = new Database();
