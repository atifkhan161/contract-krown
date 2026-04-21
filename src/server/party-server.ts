// Contract Crown PartyKit Server
// Main entry point - HTTP routes + static file serving + PartyKit room routing
// Replaces the Colyseus + Express serve.ts

import * as Party from 'partykit/server';
import { roomRegistry } from './room-registry.js';
import { supabaseService } from './supabase.js';

// ============================================================
// Environment Detection
// ============================================================
const isProduction = process.env.NODE_ENV === 'production';
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key-here';

// Set Supabase config
process.env.SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_ANON_KEY = supabaseAnonKey;

// ============================================================
// Utility Functions
// ============================================================
function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function jsonResponse(data: any, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

function corsResponse(body: BodyInit, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      ...headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// ============================================================
// Static Asset Cache (for dev mode - PartyKit serves static files in production)
// ============================================================
const staticAssets = new Map<string, { content: string; contentType: string }>();

async function loadStaticAsset(path: string): Promise<{ content: string; contentType: string } | null> {
  if (staticAssets.has(path)) {
    return staticAssets.get(path)!;
  }
  return null;
}

function getContentType(path: string): string {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

// ============================================================
// Server Class
// ============================================================
const server: Party.Server = {
  // This server only handles HTTP requests, not WebSocket connections
  // WebSocket connections are routed to the "crown" Party (crown-room.ts)
};

// ============================================================
// Static HTTP Route Handler (runs at edge, lightweight)
// ============================================================
server.onFetch = async (
  req: Party.Request,
  lobby: Party.FetchLobby,
  ctx: Party.ExecutionContext
): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  console.log(`[HTTP] ${method} ${path}`);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  // ============================================================
  // Health & Info Endpoints
  // ============================================================
  if (path === '/health' && method === 'GET') {
    return jsonResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      activeRooms: roomRegistry.getAll().length,
      environment: isProduction ? 'production' : 'local'
    });
  }

  if (path === '/api/games' && method === 'GET') {
    return jsonResponse({ games: [] });
  }

  // ============================================================
  // Room Management Endpoints
  // ============================================================
  if (path === '/api/rooms' && method === 'GET') {
    return jsonResponse(roomRegistry.listAvailable());
  }

  if (path === '/api/rooms' && method === 'POST') {
    const roomCode = generateRoomCode();

    console.log(`[API] Creating room: roomCode=${roomCode}`);

    // Store room info in registry so resolve endpoint works
    roomRegistry.register({
      roomId: roomCode,
      roomCode,
      adminUsername: '',
      playerCount: 0,
      maxPlayers: 4,
      adminSessionId: '',
      phase: 'WAITING_FOR_PLAYERS',
      createdAt: Date.now()
    });

    const partyUrl = `/parties/crown/${roomCode}`;

    return jsonResponse({
      roomId: roomCode,
      roomCode,
      partyUrl,
      wsUrl: url.origin.replace('http', 'ws') + partyUrl,
      httpUrl: url.origin
    });
  }

  if (path === '/api/rooms/resolve' && method === 'POST') {
    let body: { code?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ message: 'Invalid JSON' }, 400);
    }

    const { code } = body;
    if (!code) {
      return jsonResponse({ message: 'Code is required' }, 400);
    }

    const upperCode = code.toUpperCase();
    const allRooms = roomRegistry.getAll();

    console.log(`[API] Resolving code=${upperCode}`);

    const room = roomRegistry.getByCode(upperCode);
    if (!room) {
      return jsonResponse({
        message: 'Room not found',
        searchedCode: upperCode,
        availableCodes: allRooms.map(r => r.roomCode)
      }, 404);
    }

    return jsonResponse({ roomId: room.roomId });
  }

  if (path === '/api/games' && method === 'POST') {
    return jsonResponse({ created: true });
  }

  // ============================================================
  // Auth Endpoints
  // ============================================================
  if (path === '/api/auth/register' && method === 'POST') {
    let body: { email?: string; password?: string; username?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ message: 'Invalid JSON' }, 400);
    }

    const { email, password, username } = body;

    if (!email?.trim()) {
      return jsonResponse({ message: 'Email is required' }, 400);
    }
    if (!password || password.length < 6) {
      return jsonResponse({ message: 'Password must be at least 6 characters' }, 400);
    }
    if (!username?.trim()) {
      return jsonResponse({ message: 'Username is required' }, 400);
    }

    const result = await supabaseService.signUp(email.trim(), password, username.trim());

    if (result.error) {
      return jsonResponse({ message: result.error }, 400);
    }

    return jsonResponse({
      success: true,
      message: 'Check your email for confirmation link'
    });
  }

  if (path === '/api/auth/login' && method === 'POST') {
    let body: { email?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ message: 'Invalid JSON' }, 400);
    }

    const { email, password } = body;

    if (!email?.trim()) {
      return jsonResponse({ message: 'Email is required' }, 400);
    }
    if (!password) {
      return jsonResponse({ message: 'Password is required' }, 400);
    }

    const result = await supabaseService.signIn(email.trim(), password);

    if (result.error) {
      return jsonResponse({ message: result.error }, 401);
    }

    if (!result.data?.session) {
      return jsonResponse({ message: 'No session created' }, 500);
    }

    const session = result.data.session;
    const profile = await supabaseService.getProfile(session.user.id);

    return jsonResponse({
      userId: session.user.id,
      email: session.user.email,
      username: profile?.username || session.user.user_metadata?.username || 'Player',
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at
    });
  }

  if (path === '/api/auth/signout' && method === 'POST') {
    await supabaseService.signOut();
    return jsonResponse({ success: true });
  }

  if (path === '/api/auth/forgot-password' && method === 'POST') {
    const body = await req.json();
    const email = body?.email?.trim();

    if (!email) {
      return jsonResponse({ message: 'Email is required' }, 400);
    }

    await supabaseService.resetPasswordForEmail(email);
    return jsonResponse({ success: true });
  }

  if (path === '/api/auth/me' && method === 'GET') {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ message: 'No token provided' }, 401);
    }

    const accessToken = authHeader.substring(7);
    const result = await supabaseService.getUser(accessToken);

    if (result.error || !result.user) {
      return jsonResponse({ message: 'Invalid token' }, 401);
    }

    const profile = await supabaseService.getProfile(result.user.id);

    return jsonResponse({
      userId: result.user.id,
      email: result.user.email,
      username: profile?.username || result.user.user_metadata?.username || 'Player'
    });
  }

  // ============================================================
  // Static File Serving (SPA fallback)
  // ============================================================

  // In PartyKit, static files are served via the "serve" config in partykit.json
  // But we can also handle them here for custom routing

  // For now, return a simple index.html for root route
  if (path === '/') {
    return corsResponse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Crown</title>
  <link rel="manifest" href="/manifest.json">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app"></div>
  <script src="/app.js"></script>
</body>
</html>`, { 'Content-Type': 'text/html; charset=utf-8' });
  }

  // SPA fallback
  return corsResponse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Crown</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app"></div>
  <script src="/app.js"></script>
</body>
</html>`, { 'Content-Type': 'text/html; charset=utf-8' });
};

// WebSocket connections that don't match a Party URL go here
server.onSocket = async (
  socket: Party.FetchSocket,
  _lobby: Party.FetchLobby,
  _ctx: Party.ExecutionContext
): Promise<void> => {
  console.log('[Socket] WebSocket connection to non-Party URL');
  socket.send(JSON.stringify({ type: 'error', data: { message: 'Use /parties/crown/{roomId} for game connections' } }));
  socket.close();
};

export default server satisfies Party.Worker;
