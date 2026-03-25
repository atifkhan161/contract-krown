// Contract Crown Server
// Entry point that serves both API and static PWA assets

import { Elysia } from 'elysia';
import { join } from 'path';

const PORT = Number(process.env.PORT) || 3000;
const STATIC_DIR = join(import.meta.dir, '../../dist/client');

const app = new Elysia()
  // API endpoints
  .get('/health', () => ({ status: 'ok' }))
  .get('/api/games', () => ({ games: [] }))
  .post('/api/games', () => ({ created: true }))

  // Serve static files from dist/client
  .get('/styles.css', () => Bun.file(join(STATIC_DIR, 'styles.css')))
  .get('/app.js', () => Bun.file(join(STATIC_DIR, 'app.js')))
  .get('/manifest.json', () => Bun.file(join(STATIC_DIR, 'manifest.json')))

  // SPA fallback - serve index.html for all other routes
  .get('*', () => Bun.file(join(STATIC_DIR, 'index.html')))

  .listen(PORT);

console.log(`Contract Crown server running at http://localhost:${app.server?.port}`);
