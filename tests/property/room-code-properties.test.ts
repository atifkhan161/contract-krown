import { describe, test, expect } from 'bun:test';
import fc from 'fast-check';
import { RoomCodeGenerator } from '../../src/server/room-code-generator.js';

// Feature: contract-crown-game, Room Code Generation
// Validates that room codes are 4-char alphanumeric, unique, and properly mapped

describe('RoomCodeGenerator', () => {
  test('generated codes are exactly 4 characters', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const gen = new RoomCodeGenerator();
        const code = gen.generate(new Set());
        expect(code.length).toBe(4);
      }),
      { numRuns: 100 }
    );
  });

  test('generated codes contain only valid characters', () => {
    const validChars = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');

    fc.assert(
      fc.property(fc.constant(null), () => {
        const gen = new RoomCodeGenerator();
        const code = gen.generate(new Set());
        for (const char of code) {
          expect(validChars.has(char)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('generated codes are unique within the same generator', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 10 }), (count: number) => {
        const gen = new RoomCodeGenerator();
        const existingCodes = new Set<string>();
        const codes: string[] = [];

        for (let i = 0; i < count; i++) {
          const code = gen.generate(existingCodes);
          codes.push(code);
          existingCodes.add(code);
        }

        const uniqueCodes = new Set(codes);
        expect(uniqueCodes.size).toBe(count);
      }),
      { numRuns: 50 }
    );
  });

  test('code registration and lookup works correctly', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 4, maxLength: 4 }), (roomId: string) => {
        const gen = new RoomCodeGenerator();
        const code = gen.generate(new Set());
        gen.register(code, roomId);

        expect(gen.getRoomId(code)).toBe(roomId);
        expect(gen.getRoomId('XXXX')).toBeUndefined();
      }),
      { numRuns: 50 }
    );
  });

  test('code removal works correctly', () => {
    const gen = new RoomCodeGenerator();
    const code = gen.generate(new Set());
    gen.register(code, 'room-123');

    expect(gen.getRoomId(code)).toBe('room-123');

    gen.removeCode(code);
    expect(gen.getRoomId(code)).toBeUndefined();
  });

  test('generates unique codes even with many existing codes', () => {
    const gen = new RoomCodeGenerator();
    const blockingSet = new Set<string>();
    for (let i = 0; i < 200; i++) {
      blockingSet.add(gen.generate(new Set()));
    }

    expect(() => gen.generate(blockingSet)).not.toThrow();
  });
});
