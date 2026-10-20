/** Local-only intake service. Production identity is checked read-only; all
 * sample writes use a dedicated local database, with no background jobs. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { serve } from '@hono/node-server';
import { ownerKey } from '@cuberoot/shared/account';

const configPath = resolve(import.meta.dirname, '../../../.env.recon-intake.local');
const config = existsSync(configPath) ? parseEnv(readFileSync(configPath, 'utf8')) : {};
const key = process.env.ADMIN_API_KEY ?? config.ADMIN_API_KEY;
if (!key) throw new Error('Configure a local ADMIN_API_KEY in core/.env.recon-intake.local');
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = config.DB_PORT ?? '5433';
process.env.DB_NAME = config.DB_NAME ?? 'recon_intake_local';
process.env.DB_USER = config.DB_USER ?? 'postgres';
process.env.DB_PASS = config.DB_PASS ?? 'dev';
process.env.JWT_SECRET = 'recon-intake-local-unused-session-secret';
const { createReconIntakeRoutes } = await import('../src/routes/recon_intake.js');
const app = new Hono().route('/v1', createReconIntakeRoutes(async c => {
  if (c.req.header('X-Admin-Key') === key) return { wcaId: '__api_key__', name: 'Local runner', isAdmin: true };
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new HTTPException(401);
  const response = await fetch('https://api.cuberoot.me/v1/auth/me', {
    headers: { Authorization: authorization }, redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new HTTPException(401);
  const data = await response.json() as { user?: { uid: number; wcaId?: string; name: string; isAdmin: boolean } };
  if (!data.user?.isAdmin) throw new HTTPException(403);
  return { wcaId: ownerKey(data.user.uid, data.user.wcaId), uid: data.user.uid, name: data.user.name, isAdmin: true };
}));
const port = Number(config.PORT ?? '3011');
serve({ fetch: app.fetch, hostname: '127.0.0.1', port });
console.log(`Local intake API: http://127.0.0.1:${port}; DB ${process.env.DB_NAME} on loopback:${process.env.DB_PORT}`);
