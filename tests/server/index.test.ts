// Database Property Tests
// Feature: contract-crown-game, Property 30: Game Result Persistence
// Feature: contract-crown-game, Property 31: Statistics Update

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database, hashPassword, verifyPassword } from '@src/server/database.js';

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database('test-db.json');
  });

  afterEach(() => {
    db.close();
    // Clean up test file
    try {
      require('fs').unlinkSync('test-db.json');
    } catch (e) {}
  });

  describe('Property 30: Game Result Persistence', () => {
    it('should save game record with all required fields', () => {
      const gameId = 'game-' + Date.now();
      const players = ['user1', 'user2', 'user3', 'user4'];
      const winner: 0 | 1 = 0;
      const finalScores: [number, number] = [52, 30];
      const rounds = 4;

      const savedGame = db.saveGame({
        gameId,
        players,
        winner,
        finalScores,
        rounds,
        completedAt: Date.now()
      });

      expect(savedGame.gameId).toBe(gameId);
      expect(savedGame.players).toEqual(players);
      expect(savedGame.winner).toBe(winner);
      expect(savedGame.finalScores).toEqual(finalScores);
      expect(savedGame.rounds).toBe(rounds);
    });

    it('should retrieve saved game by ID', () => {
      const gameId = 'game-' + Date.now();
      
      db.saveGame({
        gameId,
        players: ['user1', 'user2', 'user3', 'user4'],
        winner: 1,
        finalScores: [40, 52],
        rounds: 3,
        completedAt: Date.now()
      });

      const retrieved = db.getGame(gameId);
      expect(retrieved?.gameId).toBe(gameId);
      expect(retrieved?.winner).toBe(1);
    });

    it('should find games by user ID', () => {
      const userId = 'user-test-' + Date.now();
      
      db.saveGame({
        gameId: 'game-1',
        players: [userId, 'user2', 'user3', 'user4'],
        winner: 0,
        finalScores: [52, 20],
        rounds: 2,
        completedAt: Date.now()
      });

      db.saveGame({
        gameId: 'game-2',
        players: [userId, 'user5', 'user6', 'user7'],
        winner: 1,
        finalScores: [30, 52],
        rounds: 3,
        completedAt: Date.now()
      });

      const games = db.getGamesByUser(userId);
      expect(games.length).toBe(2);
    });
  });

  describe('Property 31: Statistics Update', () => {
    it('should update statistics after game completion - win', () => {
      const userId = 'user-' + Date.now();
      
      const stats = db.updateStatistics(userId, true, 52);
      
      expect(stats?.gamesPlayed).toBe(1);
      expect(stats?.gamesWon).toBe(1);
      expect(stats?.totalPoints).toBe(52);
      expect(stats?.averagePointsPerGame).toBe(52);
    });

    it('should update statistics after game completion - loss', () => {
      const userId = 'user-' + Date.now();
      
      db.updateStatistics(userId, false, 30);
      
      const stats = db.getStatistics(userId);
      expect(stats?.gamesPlayed).toBe(1);
      expect(stats?.gamesWon).toBe(0);
      expect(stats?.totalPoints).toBe(30);
      expect(stats?.averagePointsPerGame).toBe(30);
    });

    it('should accumulate statistics across multiple games', () => {
      const userId = 'user-' + Date.now();
      
      db.updateStatistics(userId, true, 52);
      db.updateStatistics(userId, false, 30);
      db.updateStatistics(userId, true, 40);

      const stats = db.getStatistics(userId);
      expect(stats?.gamesPlayed).toBe(3);
      expect(stats?.gamesWon).toBe(2);
      expect(stats?.totalPoints).toBe(122);
      expect(stats?.averagePointsPerGame).toBeCloseTo(40.67, 1);
    });
  });

  describe('User CRUD', () => {
    it('should create a new user', () => {
      const user = db.createUser('user-1', 'testuser', hashPassword('password'));
      
      expect(user.userId).toBe('user-1');
      expect(user.username).toBe('testuser');
      expect(user.passwordHash).toBeDefined();
      expect(user.createdAt).toBeDefined();
    });

    it('should retrieve user by ID', () => {
      db.createUser('user-1', 'testuser', hashPassword('password'));
      
      const user = db.getUser('user-1');
      expect(user?.username).toBe('testuser');
    });

    it('should retrieve user by username', () => {
      db.createUser('user-1', 'testuser', hashPassword('password'));
      
      const user = db.getUserByUsername('testuser');
      expect(user?.userId).toBe('user-1');
    });

    it('should update last login time', () => {
      const originalTime = Date.now();
      db.createUser('user-1', 'testuser', hashPassword('password'));
      
      db.updateUserLogin('user-1');
      
      const user = db.getUser('user-1');
      expect(user?.lastLogin).toBeGreaterThanOrEqual(originalTime);
    });
  });

  describe('Password hashing', () => {
    it('should hash password consistently', () => {
      const hash1 = hashPassword('testpass');
      const hash2 = hashPassword('testpass');
      expect(hash1).toBe(hash2);
    });

    it('should verify correct password', () => {
      const hash = hashPassword('testpass');
      expect(verifyPassword('testpass', hash)).toBe(true);
    });

    it('should reject incorrect password', () => {
      const hash = hashPassword('testpass');
      expect(verifyPassword('wrongpass', hash)).toBe(false);
    });

    it('should produce different hashes for different passwords', () => {
      const hash1 = hashPassword('pass1');
      const hash2 = hashPassword('pass2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('User Registration (Task 18.5)', () => {
    it('should successfully register a new user', () => {
      const user = db.registerUser('newuser', hashPassword('testpass'));
      
      expect(user.userId).toBeDefined();
      expect(user.username).toBe('newuser');
      expect(user.passwordHash).toBe(hashPassword('testpass'));
      expect(user.createdAt).toBeDefined();
      expect(user.lastLogin).toBeDefined();
    });

    it('should reject duplicate username', () => {
      db.registerUser('existinguser', hashPassword('pass1'));
      
      expect(() => {
        db.registerUser('existinguser', hashPassword('pass2'));
      }).toThrow('USERNAME_EXISTS');
    });

    it('should initialize statistics for new registered user', () => {
      db.registerUser('statuser', hashPassword('pass1'));
      
      const user = db.getUserByUsername('statuser');
      expect(user).toBeDefined();
      
      const stats = db.getStatistics(user!.userId);
      expect(stats).toBeDefined();
      expect(stats?.gamesPlayed).toBe(0);
      expect(stats?.gamesWon).toBe(0);
      expect(stats?.totalPoints).toBe(0);
    });

    it('should generate unique userId for each registration', () => {
      const user1 = db.registerUser('user1', hashPassword('pass1'));
      const user2 = db.registerUser('user2', hashPassword('pass2'));
      
      expect(user1.userId).not.toBe(user2.userId);
    });

    it('should allow registration with different usernames', () => {
      const user1 = db.registerUser('alice', hashPassword('pass1'));
      const user2 = db.registerUser('bob', hashPassword('pass2'));
      const user3 = db.registerUser('charlie', hashPassword('pass3'));
      
      expect(user1.username).toBe('alice');
      expect(user2.username).toBe('bob');
      expect(user3.username).toBe('charlie');
    });
  });
});
