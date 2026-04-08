// Contract Crown Server
// Entry point that serves both API and static PWA assets

import { Elysia, t } from 'elysia';
import { join } from 'path';
import { roomRegistry } from './room-registry.js';
import { supabaseService } from './supabase.js';

const PORT = Number(process.env.PORT) || 3000;
const WS_PORT = Number(process.env.WS_PORT) || (process.env.RENDER ? 10000 : 2567);
const STATIC_DIR = join(import.meta.dir, '../../dist/client');

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

  // Auth endpoints (Supabase)
  .post('/api/auth/register', async ({ body }) => {
    const { email, password, username } = body;

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ message: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ message: 'Password must be at least 6 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!username || !username.trim()) {
      return new Response(
        JSON.stringify({ message: 'Username is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await supabaseService.signUp(email.trim(), password, username.trim());

    if (result.error) {
      return new Response(
        JSON.stringify({ message: result.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return {
      success: true,
      message: 'Check your email for confirmation link'
    };
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String(),
      username: t.String()
    })
  })

  .post('/api/auth/login', async ({ body }) => {
    const { email, password } = body;

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ message: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ message: 'Password is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await supabaseService.signIn(email.trim(), password);

    if (result.error) {
      return new Response(
        JSON.stringify({ message: result.error }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!result.data?.session) {
      return new Response(
        JSON.stringify({ message: 'No session created' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = result.data.session;
    const profile = await supabaseService.getProfile(session.user.id);

    return {
      userId: session.user.id,
      email: session.user.email,
      username: profile?.username || session.user.user_metadata?.username || 'Player',
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at
    };
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String()
    })
  })

  .post('/api/auth/signout', async () => {
    await supabaseService.signOut();

    return { success: true };
  })

  .get('/api/auth/me', async ({ headers }) => {
    const authHeader = headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ message: 'No token provided' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = authHeader.substring(7);
    const result = await supabaseService.getUser(accessToken);

    if (result.error || !result.user) {
      return new Response(
        JSON.stringify({ message: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const profile = await supabaseService.getProfile(result.user.id);

    return {
      userId: result.user.id,
      email: result.user.email,
      username: profile?.username || result.user.user_metadata?.username || 'Player'
    };
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

// Start WebSocket server
// Use WS_PORT which defaults to 2567 locally, but 10000 on Render (via RENDER env var)
// This allows both HTTP and WebSocket to share same port in production
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