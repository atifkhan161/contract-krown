// Contract Crown Server
// Entry point that serves both API and static PWA assets

import { Elysia, t } from 'elysia';
import { join } from 'path';
import { database, hashPassword } from './database.js';

const PORT = Number(process.env.PORT) || 3000;
const STATIC_DIR = join(import.meta.dir, '../../dist/client');
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

const app = new Elysia()
  // API endpoints
  .get('/health', () => ({ status: 'ok' }))
  .get('/api/games', () => ({ games: [] }))
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

console.log(`Contract Crown server running at http://localhost:${app.server?.port}`);
