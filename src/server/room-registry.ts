// Contract Crown Room Registry
// Simple in-memory registry for room listing — avoids Colyseus matchMaker singleton issues

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

  register(info: RoomInfo): void {
    this.rooms.set(info.roomId, { ...info });
  }

  updatePlayerCount(roomId: string, count: number): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.playerCount = count;
    }
  }

  updateAdminUsername(roomId: string, username: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.adminUsername = username;
    }
  }

  updatePhase(roomId: string, phase: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.phase = phase;
    }
  }

  updateAdminSessionId(roomId: string, adminSessionId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.adminSessionId = adminSessionId;
    }
  }

  remove(roomId: string): void {
    this.rooms.delete(roomId);
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
}

// Singleton instance
export const roomRegistry = new RoomRegistry();
