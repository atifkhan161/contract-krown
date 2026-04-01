#!/usr/bin/env node
// Fixes a packaging bug in @colyseus/ws-transport v0.17.9
// The index.mjs tries to re-export TransportOptions which is not exported from WebSocketTransport.mjs
// See: https://github.com/colyseus/colyseus/issues (packaging bug in ESM build)

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const indexPath = join(
  projectRoot,
  'node_modules',
  '@colyseus',
  'ws-transport',
  'build',
  'index.mjs'
);

if (!existsSync(indexPath)) {
  console.log('[postinstall] @colyseus/ws-transport not found, skipping patch');
  process.exit(0);
}

const content = readFileSync(indexPath, 'utf-8');

// Only patch if the broken re-export is present
if (content.includes('TransportOptions')) {
  const fixed = `import { WebSocketClient } from "./WebSocketClient";
import { WebSocketTransport } from "./WebSocketTransport";
export {
  WebSocketClient,
  WebSocketTransport
};
`;
  writeFileSync(indexPath, fixed, 'utf-8');
  console.log('[postinstall] Patched @colyseus/ws-transport index.mjs (removed broken TransportOptions re-export)');
} else {
  console.log('[postinstall] @colyseus/ws-transport index.mjs already patched or fixed upstream');
}
