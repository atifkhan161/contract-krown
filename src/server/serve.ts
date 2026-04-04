// Contract Crown Server
// Entry point that serves both API and static PWA assets

import { Elysia, t } from 'elysia';
import { join } from 'path';
import { database, hashPassword } from './database.js';
import { roomRegistry } from './room-registry.js';

const PORT = Number(process.env.PORT) || 3000;
const WS_PORT = Number(process.env.WS_PORT) || 2567;
const STATIC_DIR = join(import.meta.dir, '../../dist/client');
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

// --- Colyseus WebSocket Server ---
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { CrownRoom } from './rooms.js';

const gameServer = new Server({
  transport: new WebSocketTransport()
});

gameServer.define('crown', CrownRoom);

const app = new Elysia()
  // API endpoints
  .get('/health', () => ({ status: 'ok' }))
  .get('/api/games', () => ({ games: [] }))
  .get('/api/rooms', () => {
    return roomRegistry.listAvailable();
  })
  .post('/api/rooms', () => {
    const roomId = generateRoomId();
    return {
      roomId,
      wsUrl: `ws://localhost:${WS_PORT}`,
      httpUrl: `http://localhost:${PORT}`
    };
  })
  .post('/api/rooms/resolve', ({ body }) => {
    const { code } = body;
    const upperCode = code.toUpperCase();
    console.log('[API] /rooms/resolve: received code=', code, ', upper=', upperCode);
    console.log('[API] /rooms/resolve: registry rooms:', roomRegistry.getAll().map(r => r.roomCode));

    const room = roomRegistry.getByCode(upperCode);
    console.log('[API] /rooms/resolve: found room=', room?.roomCode, ', roomId=', room?.roomId);

    if (!room) {
      return new Response(
        JSON.stringify({ message: 'Room not found', searchedCode: upperCode }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return { roomId: room.roomId };
  }, {
    body: t.Object({
      code: t.String()
    })
  })
  .post('/api/games', () => ({ created: true }))

  // Registration endpoint
  .post('/api/register', async ({ body }) => {
    const { username, password } = body;

    if (!username || !username.trim()) {
      return new Response(
        JSON.stringify({ message: 'Username is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!password || password.length < 4) {
      return new Response(
        JSON.stringify({ message: 'Password must be at least 4 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const passwordHash = hashPassword(password);
      const user = database.registerUser(username.trim(), passwordHash);

      const token = generateToken();
      const expiresAt = Date.now() + SESSION_DURATION;

      return {
        userId: user.userId,
        username: user.username,
        token,
        expiresAt
      };
    } catch (error: any) {
      if (error.message === 'USERNAME_EXISTS') {
        return new Response(
          JSON.stringify({ message: 'Username is already taken' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ message: 'Registration failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String()
    })
  })

  // Serve static files from dist/client
  .get('/styles.css', () => Bun.file(join(STATIC_DIR, 'styles.css')))
  .get('/app.js', () => Bun.file(join(STATIC_DIR, 'app.js')))
  .get('/manifest.json', () => Bun.file(join(STATIC_DIR, 'manifest.json')))

  // SPA fallback - serve index.html for all other routes
  .get('*', () => Bun.file(join(STATIC_DIR, 'index.html')))

  .listen(PORT);

function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateToken(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Start WebSocket server
await gameServer.listen(WS_PORT);

console.log(`Contract Crown HTTP server running at http://localhost:${PORT}`);
console.log(`Contract Crown WebSocket server running at ws://localhost:${WS_PORT}`);
console.log('Server ready for connections...');

// Graceful shutdown for clean restarts during development
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  try {
    await gameServer.gracefullyShutdown();
  } catch (e) {
    // Ignore errors during shutdown
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);