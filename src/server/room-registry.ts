// Contract Crown Room Registry
// Persistent room registry with Supabase backend + local cache

import { supabaseService, type RoomRow } from './supabase.js';

interface RoomInfo {
  roomId: string;
  roomCode: string;
  adminUsername: string;
  playerCount: number;
  maxPlayers: number;
  adminSessionId: string;
  phase: string;
  createdAt: number;
}

class RoomRegistry {
  private rooms: Map<string, RoomInfo> = new Map();
  private isInitialized: boolean = false;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  
  private readonly TTL_HOURS = parseInt(process.env.ROOM_TTL_HOURS || '12', 10);
  private readonly CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MINUTES || '5', 10) * 60 * 1000;
  private readonly USE_DATABASE = supabaseService.hasServiceClient();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('[RoomRegistry] Initializing...');
    console.log('[RoomRegistry] Database enabled:', this.USE_DATABASE);
    
    if (this.USE_DATABASE) {
      await this.loadFromDatabase();
      this.startCleanupTimer();
    }
    
    this.isInitialized = true;
    console.log('[RoomRegistry] Initialized with', this.rooms.size, 'rooms');
  }

  private async loadFromDatabase(): Promise<void> {
    if (!this.USE_DATABASE) return;
    
    console.log('[RoomRegistry] Loading rooms from database...');
    const dbRooms = await supabaseService.getAllRooms();
    
    for (const dbRoom of dbRooms) {
      this.rooms.set(dbRoom.id, {
        roomId: dbRoom.id,
        roomCode: dbRoom.room_code,
        adminUsername: dbRoom.admin_username || '',
        playerCount: dbRoom.player_count,
        maxPlayers: dbRoom.max_players,
        adminSessionId: dbRoom.admin_session_id || '',
        phase: dbRoom.phase,
        createdAt: new Date(dbRoom.created_at).getTime()
      });
    }
    
    console.log('[RoomRegistry] Loaded', this.rooms.size, 'rooms from database');
  }

  private startCleanupTimer(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(async () => {
      console.log('[RoomRegistry] Running cleanup...');
      await this.cleanupOldRooms();
    }, this.CLEANUP_INTERVAL_MS);
    
    console.log('[RoomRegistry] Cleanup timer started, interval:', this.CLEANUP_INTERVAL_MS, 'ms');
  }

  private async cleanupOldRooms(): Promise<void> {
    if (!this.USE_DATABASE) return;
    
    const cutoff = Date.now() - this.TTL_HOURS * 60 * 60 * 1000;
    const toDelete: string[] = [];
    
    for (const [roomId, room] of this.rooms) {
      if (room.createdAt < cutoff) {
        toDelete.push(roomId);
      }
    }
    
    if (toDelete.length > 0) {
      console.log('[RoomRegistry] Deleting', toDelete.length, 'expired rooms from cache');
      for (const roomId of toDelete) {
        this.rooms.delete(roomId);
      }
    }
    
    const deleted = await supabaseService.cleanupOldRooms(this.TTL_HOURS);
    if (deleted > 0) {
      console.log('[RoomRegistry] Deleted', deleted, 'old rooms from database');
    }
  }

  async cleanupOnStartup(): Promise<void> {
    if (this.USE_DATABASE) {
      console.log('[RoomRegistry] Running startup cleanup...');
      await this.cleanupOldRooms();
    }
  }

  register(info: RoomInfo): void {
    this.rooms.set(info.roomId, { ...info });
    
    if (this.USE_DATABASE) {
      supabaseService.insertRoom({
        id: info.roomId,
        room_code: info.roomCode,
        phase: info.phase,
        players: [],
        admin_session_id: info.adminSessionId,
        admin_username: info.adminUsername,
        player_count: info.playerCount,
        max_players: info.maxPlayers
      }).then(({ error }) => {
        if (error) {
          console.warn('[RoomRegistry] Failed to save room to database:', error);
        }
      });
    }
  }

  updatePlayerCount(roomId: string, count: number): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.playerCount = count;
      this.syncToDatabase(roomId, { player_count: count });
    }
  }

  updateAdminUsername(roomId: string, username: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.adminUsername = username;
      this.syncToDatabase(roomId, { admin_username: username });
    }
  }

  updatePhase(roomId: string, phase: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.phase = phase;
      this.syncToDatabase(roomId, { phase });
    }
  }

  updateAdminSessionId(roomId: string, adminSessionId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.adminSessionId = adminSessionId;
      this.syncToDatabase(roomId, { admin_session_id: adminSessionId });
    }
  }

  private syncToDatabase(roomId: string, updates: Partial<RoomRow>): void {
    if (!this.USE_DATABASE) return;
    
    supabaseService.updateRoom(roomId, updates).then(({ error }) => {
      if (error) {
        console.warn('[RoomRegistry] Failed to sync room to database:', error);
      }
    });
  }

  remove(roomId: string): void {
    this.rooms.delete(roomId);
    
    if (this.USE_DATABASE) {
      supabaseService.deleteRoom(roomId).then(({ error }) => {
        if (error) {
          console.warn('[RoomRegistry] Failed to delete room from database:', error);
        }
      });
    }
  }

  listAvailable(): Array<{
    roomId: string;
    roomCode: string;
    adminUsername: string;
    playerCount: number;
    maxPlayers: number;
    adminSessionId: string;
  }> {
    console.log('[RoomRegistry] listAvailable called, total rooms:', this.rooms.size);
    const now = Date.now();
    const available: Array<{
      roomId: string;
      roomCode: string;
      adminUsername: string;
      playerCount: number;
      maxPlayers: number;
      adminSessionId: string;
    }> = [];

    for (const room of this.rooms.values()) {
      console.log('[RoomRegistry] Checking room:', room.roomCode, 'phase:', room.phase, 'playerCount:', room.playerCount);
      if (room.phase !== 'WAITING_FOR_PLAYERS') continue;
      if (room.playerCount >= room.maxPlayers) continue;
      
      const expiryAt = room.createdAt + this.TTL_HOURS * 60 * 60 * 1000;
      if (expiryAt <= now) continue;

      available.push({
        roomId: room.roomId,
        roomCode: room.roomCode,
        adminUsername: room.adminUsername,
        playerCount: room.playerCount,
        maxPlayers: room.maxPlayers,
        adminSessionId: room.adminSessionId
      });
    }

    console.log('[RoomRegistry] Available rooms:', available.map(r => r.roomCode));
    return available;
  }

  getByCode(code: string): RoomInfo | undefined {
    console.log('[RoomRegistry] getByCode: searching for', code);
    console.log('[RoomRegistry] getByCode: rooms in registry:', Array.from(this.rooms.entries()).map(([id, r]) => `${id} => ${r.roomCode}`));
    
    for (const room of this.rooms.values()) {
      console.log('[RoomRegistry] getByCode: comparing', room.roomCode, '===', code, '?', room.roomCode === code);
      if (room.roomCode === code) return room;
    }
    
    console.log('[RoomRegistry] getByCode: NOT FOUND');
    return undefined;
  }

  async getByCodeAsync(code: string): Promise<RoomInfo | undefined> {
    console.log('[RoomRegistry] getByCodeAsync: searching for', code);
    
    // First check cache
    const cached = this.getByCode(code);
    if (cached) return cached;
    
    // Try to load from database if not in cache
    if (this.USE_DATABASE) {
      console.log('[RoomRegistry] getByCodeAsync: trying database lookup...');
      const dbRoom = await supabaseService.getRoomByCode(code);
      if (dbRoom) {
        const roomInfo: RoomInfo = {
          roomId: dbRoom.id,
          roomCode: dbRoom.room_code,
          adminUsername: dbRoom.admin_username || '',
          playerCount: dbRoom.player_count,
          maxPlayers: dbRoom.max_players,
          adminSessionId: dbRoom.admin_session_id || '',
          phase: dbRoom.phase,
          createdAt: new Date(dbRoom.created_at).getTime()
        };
        this.rooms.set(dbRoom.id, roomInfo);
        console.log('[RoomRegistry] getByCodeAsync: loaded from database:', dbRoom.room_code);
        return roomInfo;
      }
    }
    
    console.log('[RoomRegistry] getByCodeAsync: NOT FOUND');
    return undefined;
  }

  getById(roomId: string): RoomInfo | undefined {
    return this.rooms.get(roomId);
  }

  getAll(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.rooms.clear();
    this.isInitialized = false;
  }
}

// Singleton instance
export const roomRegistry = new RoomRegistry();
