// Contract Crown Room Code Generator
// Generates short, human-readable 4-character alphanumeric room codes

export class RoomCodeGenerator {
  private static readonly CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  private static readonly CODE_LENGTH = 4;

  private codeToRoomId: Map<string, string> = new Map();

  generate(existingCodes: Set<string>): string {
    let code: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      code = this.randomCode();
      attempts++;
    } while ((existingCodes.has(code) || this.codeToRoomId.has(code)) && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique room code');
    }

    return code;
  }

  register(code: string, roomId: string): void {
    this.codeToRoomId.set(code, roomId);
  }

  getRoomId(code: string): string | undefined {
    return this.codeToRoomId.get(code);
  }

  removeCode(code: string): void {
    this.codeToRoomId.delete(code);
  }

  private randomCode(): string {
    let result = '';
    for (let i = 0; i < RoomCodeGenerator.CODE_LENGTH; i++) {
      result += RoomCodeGenerator.CHARS.charAt(
        Math.floor(Math.random() * RoomCodeGenerator.CHARS.length)
      );
    }
    return result;
  }
}

export const roomCodeGenerator = new RoomCodeGenerator();
