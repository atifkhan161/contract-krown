// Contract Crown Server
// Entry point - Single port for both HTTP and WebSocket (Render compatible)
// Uses Colyseus with express() handler for custom routes

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { roomRegistry } from './room-registry.js';
import { supabaseService } from './supabase.js';

const PORT = Number(process.env.PORT) || (process.env.RENDER ? 10000 : 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STATIC_DIR = join(__dirname, '../../dist/client');

// --- Colyseus Server with Express for custom routes ---
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { CrownRoom } from './rooms.js';
import express from 'express';

// Use default WebSocket transport (works with Node.js via tsx)
const transport = new WebSocketTransport({});

const gameServer = new Server({
  transport: transport,
  express: (app) => {
    // Add body parsing
    app.use(express.json({ limit: '10mb' }));

    // --- API Routes ---

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Games list
    app.get('/api/games', (req, res) => {
      res.json({ games: [] });
    });

    // Rooms list
    app.get('/api/rooms', (req, res) => {
      res.json(roomRegistry.listAvailable());
    });

    // Create room
    app.post('/api/rooms', (req, res) => {
      const roomId = generateRoomId();
      res.json({
        roomId,
        wsUrl: `ws://localhost:${PORT}`,
        httpUrl: `http://localhost:${PORT}`
      });
    });

    // Resolve room by code
    app.post('/api/rooms/resolve', (req, res) => {
      const { code } = req.body || {};
      
      if (!code) {
        return res.status(400).json({ message: 'Code is required' });
      }
      
      const upperCode = code.toUpperCase();
      console.log('[API] /rooms/resolve: received code=', code, ', upper=', upperCode);
      console.log('[API] /rooms/resolve: registry rooms:', roomRegistry.getAll().map(r => r.roomCode));

      const room = roomRegistry.getByCode(upperCode);
      console.log('[API] /rooms/resolve: found room=', room?.roomCode, ', roomId=', room?.roomId);

      if (!room) {
        return res.status(404).json({ 
          message: 'Room not found', 
          searchedCode: upperCode 
        });
      }

      res.json({ roomId: room.roomId });
    });

    // Create game
    app.post('/api/games', (req, res) => {
      res.json({ created: true });
    });

    // Auth: Register
    app.post('/api/auth/register', async (req, res) => {
      const { email, password, username } = req.body || {};

      if (!email || !email.trim()) {
        return res.status(400).json({ message: 'Email is required' });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      if (!username || !username.trim()) {
        return res.status(400).json({ message: 'Username is required' });
      }

      const result = await supabaseService.signUp(email.trim(), password, username.trim());

      if (result.error) {
        return res.status(400).json({ message: result.error });
      }

      res.json({
        success: true,
        message: 'Check your email for confirmation link'
      });
    });

    // Auth: Login
    app.post('/api/auth/login', async (req, res) => {
      const { email, password } = req.body || {};

      if (!email || !email.trim()) {
        return res.status(400).json({ message: 'Email is required' });
      }

      if (!password) {
        return res.status(400).json({ message: 'Password is required' });
      }

      const result = await supabaseService.signIn(email.trim(), password);

      if (result.error) {
        return res.status(401).json({ message: result.error });
      }

      if (!result.data?.session) {
        return res.status(500).json({ message: 'No session created' });
      }

      const session = result.data.session;
      const profile = await supabaseService.getProfile(session.user.id);

      res.json({
        userId: session.user.id,
        email: session.user.email,
        username: profile?.username || session.user.user_metadata?.username || 'Player',
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at
      });
    });

    // Auth: Signout
    app.post('/api/auth/signout', async (req, res) => {
      await supabaseService.signOut();
      res.json({ success: true });
    });

    // Auth: Get current user
    app.get('/api/auth/me', async (req, res) => {
      const authHeader = req.headers['authorization'];
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const accessToken = authHeader.substring(7);
      const result = await supabaseService.getUser(accessToken);

      if (result.error || !result.user) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      const profile = await supabaseService.getProfile(result.user.id);

      res.json({
        userId: result.user.id,
        email: result.user.email,
        username: profile?.username || result.user.user_metadata?.username || 'Player'
      });
    });

    // --- Static Files ---

    // Explicit root route for SPA
    app.get('/', (req, res) => {
      res.sendFile(join(STATIC_DIR, 'index.html'));
    });

    app.get('/styles.css', (req, res) => {
      res.sendFile(join(STATIC_DIR, 'styles.css'));
    });

    app.get('/app.js', (req, res) => {
      res.sendFile(join(STATIC_DIR, 'app.js'));
    });

    app.get('/manifest.json', (req, res) => {
      res.sendFile(join(STATIC_DIR, 'manifest.json'));
    });

    // SPA fallback - serve index.html for all other routes (must be LAST)
    app.use((req, res) => {
      res.sendFile(join(STATIC_DIR, 'index.html'));
    });
  }
});

gameServer.define('crown', CrownRoom);

// --- Start Server ---

function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Start Colyseus - this creates HTTP server with both API and WebSocket
await gameServer.listen(PORT);

console.log(`Contract Crown server running at http://localhost:${PORT}`);
console.log(`WebSocket server at ws://localhost:${PORT}`);
console.log('Server ready for connections...');

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  try {
    await gameServer.gracefullyShutdown();
  } catch (e) {
    // Ignore shutdown errors
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
