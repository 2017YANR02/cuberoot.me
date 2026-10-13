/** Isolated local preview: only the dashboard, with a database-enforced read-only pool. */
import postgres from 'postgres';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { serve } from '@hono/node-server';
import { createAdminDashboardRoutes } from '../src/routes/admin_dashboard.js';
import type { QueryRunner } from '../src/db/connection.js';

if (!process.env.DB_PASS) throw new Error('Supply the database credentials through the process environment');
const db = postgres({ host: '127.0.0.1', port: Number(process.env.DB_PORT || 15433),
  database: 'cuberoot_db', username: 'recon_user', password: process.env.DB_PASS,
  max: 2, connect_timeout: 8, idle_timeout: 20,
  connection: { default_transaction_read_only: 'on', statement_timeout: '5000' },
});
const [settings] = await db`SELECT current_setting('default_transaction_read_only') AS readonly`;
if (settings.readonly !== 'on') throw new Error('Read-only connection required');
const runQuery: QueryRunner = async <T>(text: string, params: unknown[] = []) => {
  let index = 0;
  return await db.unsafe(text.replace(/\?/g, () => `$${++index}`), params as never[]) as unknown as T[];
};
const app = new Hono();
app.route('/v1', createAdminDashboardRoutes({ runQuery, authorize: async c => {
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new HTTPException(401);
  // Validate the real session with the owning administrator endpoint, with no local role override.
  // Browser data tokens intentionally cannot access /auth/admin/* directly.
  const response = await fetch('https://api.cuberoot.me/v1/sponsor-claims?status=pending', {
    headers: { Authorization: authorization }, signal: AbortSignal.timeout(10_000),
  });
  await response.body?.cancel();
  if (!response.ok) throw new HTTPException(response.status === 401 ? 401 : 403);
} }));
app.onError((error, c) => error instanceof HTTPException ? error.getResponse() : c.json({ error: 'Preview source unavailable' }, 503));
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: Number(process.env.PORT || 3006) });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  server.close(); void db.end({ timeout: 2 }).finally(() => process.exit(0));
});
console.log('Dashboard preview started; database read-only verified.');
