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

// --- Environment Detection ---
const isProduction = !!process.env.RENDER;
const isRender = !!process.env.RENDER;
const externalUrl = process.env.RENDER_EXTERNAL_URL || (isProduction ? `https://${process.env.HOST}` : null);

// --- Utility Functions ---

function getHttpUrl(): string {
  if (externalUrl) return externalUrl;
  return `http://localhost:${PORT}`;
}

function getWsUrl(): string {
  if (externalUrl) {
    return externalUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  }
  return `ws://localhost:${PORT}`;
}

// --- Startup Logging ---
console.log('========================================');
console.log('Contract Crown Server Starting...');
console.log('========================================');
console.log('Server Configuration:');
console.log(`  PORT: ${PORT}`);
console.log(`  Environment: ${isProduction ? 'PRODUCTION (Render)' : 'LOCAL'}`);
console.log(`  RENDER_EXTERNAL_URL: ${externalUrl || 'not set'}`);
console.log(`  RENDER: ${isRender}`);
console.log(`  Node version: ${process.version}`);
console.log(`  Platform: ${process.platform}`);
console.log(`  Calculated HTTP URL: ${getHttpUrl()}`);
console.log(`  Calculated WS URL: ${getWsUrl()}`);
console.log('========================================');

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
    // Add request logging middleware
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[REQUEST] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });

    // Add body parsing
    app.use(express.json({ limit: '10mb' }));

    // --- API Routes ---

    // Health check
    app.get('/health', (_req, res) => {
      const rooms = roomRegistry.getAll();
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        activeRooms: rooms.length,
        environment: isProduction ? 'production' : 'local'
      });
    });

    // Games list
    app.get('/api/games', (_req, res) => {
      res.json({ games: [] });
    });

    // Rooms list
    app.get('/api/rooms', (_req, res) => {
      res.json(roomRegistry.listAvailable());
    });

    // Create room
    app.post('/api/rooms', (_req, res) => {
      const roomId = generateRoomId();
      const wsUrl = getWsUrl();
      const httpUrl = getHttpUrl();
      
      console.log(`[API] =========================================`);
      console.log(`[API] /api/rooms: Creating room`);
      console.log(`[API] roomId=${roomId}`);
      console.log(`[API] wsUrl=${wsUrl}`);
      console.log(`[API] httpUrl=${httpUrl}`);
      console.log(`[API] isProduction=${isProduction}`);
      console.log(`[API] externalUrl=${externalUrl || 'null'}`);
      console.log(`[API] =========================================`);
      
      res.json({
        roomId,
        wsUrl,
        httpUrl
      });
    });

    // Resolve room by code
    app.post('/api/rooms/resolve', (req, res) => {
      const { code } = req.body || {};
      
      if (!code) {
        console.log('[API] /rooms/resolve: ERROR - Code is required');
        return res.status(400).json({ message: 'Code is required' });
      }
      
      const upperCode = code.toUpperCase();
      const allRooms = roomRegistry.getAll();
      
      console.log('[API] /rooms/resolve: received code=' + code + ', upper=' + upperCode);
      console.log('[API] /rooms/resolve: active rooms count=' + allRooms.length);
      console.log('[API] /rooms/resolve: active room codes: ' + JSON.stringify(allRooms.map(r => r.roomCode)));

      const room = roomRegistry.getByCode(upperCode);
      console.log('[API] /rooms/resolve: found room=' + (room ? room.roomCode : 'NOT FOUND') + ', roomId=' + (room ? room.roomId : 'N/A'));

      if (!room) {
        return res.status(404).json({ 
          message: 'Room not found', 
          searchedCode: upperCode,
          availableCodes: allRooms.map(r => r.roomCode)
        });
      }

      res.json({ roomId: room.roomId });
    });

    // Create game
    app.post('/api/games', (_req, res) => {
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
    app.post('/api/auth/signout', async (_req, res) => {
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
    app.get('/', (_req, res) => {
      console.log('[STATIC] Serving index.html');
      res.sendFile(join(STATIC_DIR, 'index.html'));
    });

    app.get('/styles.css', (_req, res) => {
      res.sendFile(join(STATIC_DIR, 'styles.css'));
    });

    app.get('/app.js', (_req, res) => {
      res.sendFile(join(STATIC_DIR, 'app.js'));
    });

    app.get('/manifest.json', (_req, res) => {
      res.sendFile(join(STATIC_DIR, 'manifest.json'));
    });

    // SPA fallback - serve index.html for all other routes (must be LAST)
    app.use((req, res) => {
      console.log(`[STATIC] SPA fallback: ${req.path} -> index.html`);
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

// Start Colyseus - bind to 0.0.0.0 for external connections
console.log(`[SERVER] ========================================`);
console.log(`[SERVER] Starting server...`);
console.log(`[SERVER] ========================================`);
console.log(`[SERVER] PID: ${process.pid}`);
console.log(`[SERVER] PORT: ${PORT}`);
console.log(`[SERVER] Node: ${process.version}`);
console.log(`[SERVER] Platform: ${process.platform}`);
console.log(`[SERVER] Environment: ${isProduction ? 'PRODUCTION' : 'LOCAL'}`);
console.log(`[SERVER] RENDER: ${isRender}`);
console.log(`[SERVER] External URL: ${externalUrl || 'none'}`);
console.log(`[SERVER] Start time: ${new Date().toISOString()}`);
console.log(`[SERVER] ========================================`);

await gameServer.listen(PORT, '0.0.0.0');

console.log(`[SERVER] Contract Crown server running at http://0.0.0.0:${PORT}`);
console.log(`[SERVER] WebSocket server at ws://0.0.0.0:${PORT}`);
console.log(`[SERVER] Accessible at HTTP: ${getHttpUrl()}`);
console.log(`[SERVER] Accessible at WS: ${getWsUrl()}`);
console.log(`[SERVER] Server ready for connections...`);

console.log(`[SERVER] ========================================`);

// ============================================================
// GRACEFUL SHUTDOWN - Critical for debugging room destruction
// ============================================================
let isShuttingDown = false;
let serverStartTime = Date.now();

const shutdown = async (signal: string) => {
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
  const activeRooms = roomRegistry.getAll();
  
  console.log(`[SHUTDOWN] ========================================`);
  console.log(`[SHUTDOWN] Signal received: ${signal}`);
  console.log(`[SHUTDOWN] isShuttingDown: ${isShuttingDown}`);
  console.log(`[SHUTDOWN] Server uptime: ${uptimeSeconds} seconds`);
  console.log(`[SHUTDOWN] Active rooms count: ${activeRooms.length}`);
  console.log(`[SHUTDOWN] Room IDs: [${activeRooms.map(r => r.roomId).join(', ')}]`);
  console.log(`[SHUTDOWN] Room codes: [${activeRooms.map(r => r.roomCode).join(', ')}]`);
  console.log(`[SHUTDOWN] ========================================`);
  
  if (isShuttingDown) {
    console.log('[SHUTDOWN] Already shutting down, ignoring');
    return;
  }
  
  isShuttingDown = true;
  console.log('[SHUTDOWN] Starting graceful shutdown...');
  
  try {
    console.log('[SHUTDOWN] Calling gameServer.gracefullyShutdown()...');
    await gameServer.gracefullyShutdown();
    console.log('[SHUTDOWN] Server shutdown complete');
  } catch (e: any) {
    console.error('[SHUTDOWN] Error during shutdown:', e.message || e);
  }
  
  console.log(`[SHUTDOWN] Exiting process (code 0)`);
  process.exit(0);
};

process.on('SIGINT', () => {
  console.log('[SIGNAL] Received SIGINT');
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('[SIGNAL] Received SIGTERM');
  shutdown('SIGTERM');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[EXCEPTION] Uncaught exception:', err.message);
  console.error('[EXCEPTION] Stack:', err.stack);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[REJECTION] Unhandled rejection at:', promise);
  console.error('[REJECTION] Reason:', reason);
});
