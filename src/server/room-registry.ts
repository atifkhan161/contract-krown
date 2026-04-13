// Contract Crown Room Registry
// Persistent room registry using localStorage (works in PartyKit workerd)

const STORAGE_KEY = 'contract-crown-rooms';

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

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        const data = JSON.parse(stored) as RoomInfo[];
        this.rooms = new Map(data.map(r => [r.roomId, r]));
      }
    } catch (e) {
      console.log('[RoomRegistry] Failed to load from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.rooms.values())));
      }
    } catch (e) {
      console.log('[RoomRegistry] Failed to save to storage:', e);
    }
  }

  register(info: RoomInfo): void {
    this.rooms.set(info.roomId, { ...info });
    this.saveToStorage();
    console.log('[RoomRegistry] Registered room:', info.roomCode, 'roomId:', info.roomId);
  }

  updatePlayerCount(roomId: string, count: number): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.playerCount = count;
      this.saveToStorage();
    }
  }

  updateAdminUsername(roomId: string, username: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.adminUsername = username;
      this.saveToStorage();
    }
  }

  updatePhase(roomId: string, phase: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.phase = phase;
      this.saveToStorage();
    }
  }

  updateAdminSessionId(roomId: string, adminSessionId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.adminSessionId = adminSessionId;
      this.saveToStorage();
    }
  }

  remove(roomId: string): void {
    this.rooms.delete(roomId);
    this.saveToStorage();
  }

  listAvailable(): Array<{
    roomId: string;
    roomCode: string;
    adminUsername: string;
    playerCount: number;
    maxPlayers: number;
    adminSessionId: string;
  }> {
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
      // Only rooms waiting for players
      if (room.phase !== 'WAITING_FOR_PLAYERS') continue;
      // Skip full rooms
      if (room.playerCount >= room.maxPlayers) continue;
      // Skip expired rooms (3-minute TTL from creation)
      const expiryAt = room.createdAt + 3 * 60 * 1000;
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
    for (const room of this.rooms.values()) {
      if (room.roomCode === code) return room;
    }
    return undefined;
  }

  getById(roomId: string): RoomInfo | undefined {
    return this.rooms.get(roomId);
  }

  getAll(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }
}

// Singleton instance
export const roomRegistry = new RoomRegistry();
