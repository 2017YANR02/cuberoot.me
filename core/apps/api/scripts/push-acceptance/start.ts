import { serve } from '@hono/node-server';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPushAcceptanceApi } from './api.js';

// Deliberately fixed loopback endpoint; do not inherit PORT, DB_* or push flags.
const pairingToken = randomBytes(32).toString('hex');
const directory = fileURLToPath(new URL('../../.push-acceptance/', import.meta.url));
const credentials = `${directory}/session.json`;
const app = createPushAcceptanceApi(pairingToken);
let ownsCredentials = false;
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 3339 }, () => {
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    // Refuse existing files/symlinks. After an unclean shutdown, remove the stale file explicitly.
    writeFileSync(credentials, JSON.stringify({ apiOrigin: 'http://127.0.0.1:3339', pairingToken }), { mode: 0o600, flag: 'wx' });
    ownsCredentials = true;
  } catch {
    console.error('Cannot create private pairing file. Check permissions/stale session.json after stopping any old fixture process.');
    server.close(() => process.exit(1));
    return;
  }
  console.log('Push fixture API: http://127.0.0.1:3339 (memory only, expires in 1 hour, no delivery)');
  console.log('Pairing credential: apps/api/.push-acceptance/session.json (do not share or commit)');
});
server.on('error', () => { console.error('Cannot start fixture API on loopback port 3339'); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  if (ownsCredentials) rmSync(credentials, { force: true });
  server.close(() => process.exit(0));
});
