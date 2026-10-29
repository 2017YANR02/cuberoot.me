/** Local-only intake service. Production identity is checked read-only; all
 * sample writes use a dedicated local database, with no background jobs. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { serve } from '@hono/node-server';
import { ownerKey } from '@cuberoot/shared/account';
import type { WcaUser } from '../src/utils/recon_helpers.js';
import { assertLocalCaptureDatabase, mapLocalCaptureUser, prepareLocalCaptureSchema } from './recon-capture-local-schema.js';

const configPath = resolve(import.meta.dirname, '../../../.env.recon-intake.local');
const config = existsSync(configPath) ? parseEnv(readFileSync(configPath, 'utf8')) : {};
const prepareOnly = process.argv.includes('--prepare');
if (process.argv.slice(2).some(arg => arg !== '--prepare')) throw new Error('Only --prepare is supported');
const key = process.env.ADMIN_API_KEY ?? config.ADMIN_API_KEY;
if (!key && !prepareOnly) throw new Error('Configure a local ADMIN_API_KEY in core/.env.recon-intake.local');
for (const [name, fallback] of Object.entries({
  DB_HOST: '127.0.0.1', DB_PORT: '5433', DB_NAME: 'recon_intake_local', DB_USER: 'postgres', DB_PASS: 'dev',
})) process.env[name] = process.env[name] ?? config[name] ?? fallback;
assertLocalCaptureDatabase();
process.env.DRIVE_STORAGE_DIR = process.env.DRIVE_STORAGE_DIR ?? config.DRIVE_STORAGE_DIR
  ?? resolve(import.meta.dirname, '../../../.local-data/recon-capture/drive');
process.env.DRIVE_COMPRESSION_ENABLED = '0';
process.env.JWT_SECRET = 'recon-intake-local-unused-session-secret';
const { sql } = await import('../src/db/connection.js');
await prepareLocalCaptureSchema(sql);
if (prepareOnly) {
  await sql.end();
  console.log('Local capture schema prepared in recon_intake_local; no production data copied.');
} else {
  const { createReconIntakeRoutes } = await import('../src/routes/recon_intake.js');
  const { createReconCaptureRoutes } = await import('../src/routes/recon_capture.js');
  const { createCaptureDriveRoutes } = await import('../src/routes/drive.js');
  const actors = new WeakMap<Context, Promise<WcaUser>>();
  const authenticate = (c: Context): Promise<WcaUser> => {
    const previous = actors.get(c);
    if (previous) return previous;
    const pending = (async (): Promise<WcaUser> => {
      // Intake runner leases/results retain their existing contract. Capture and
      // Drive routes independently reject API keys for their human-only writes.
      if (c.req.header('X-Admin-Key') === key) return { wcaId: '__api_key__', name: 'Local runner', isAdmin: true };
      const authorization = c.req.header('Authorization');
      if (!authorization?.startsWith('Bearer ')) throw new HTTPException(401, { message: 'Administrator sign-in required' });
      const response = await fetch('https://api.cuberoot.me/v1/auth/me', {
        headers: { Authorization: authorization }, redirect: 'error', signal: AbortSignal.timeout(10000),
      }).catch(() => { throw new HTTPException(503, { message: 'Cannot verify the administrator session' }); });
      if (!response.ok) {
        await response.body?.cancel();
        throw new HTTPException(response.status >= 500 ? 503 : 401, { message: 'Cannot verify the administrator session' });
      }
      const data = await response.json() as { user?: { uid?: number; wcaId?: string; name?: string; isAdmin?: boolean } };
      const remote = data.user;
      if (remote?.isAdmin !== true) throw new HTTPException(403, { message: 'Administrator access required' });
      if (!Number.isSafeInteger(remote.uid) || remote.uid! <= 0)
        throw new HTTPException(403, { message: 'Account identity required' });
      const uid = remote.uid!;
      const name = typeof remote.name === 'string' ? remote.name : '';
      const wcaId = typeof remote.wcaId === 'string' ? remote.wcaId : undefined;
      const localUid = await mapLocalCaptureUser(sql, { uid, name, wcaId });
      // Old intake ownership remains the remote owner key; only numeric Drive /
      // capture ownership uses the isolated database's mapped account ID.
      return { wcaId: ownerKey(uid, wcaId), uid: localUid, realWcaId: wcaId, name, isAdmin: true };
    })();
    actors.set(c, pending);
    return pending;
  };
  const app = new Hono();
  app.onError((error, c) => {
    c.header('Cache-Control', 'private, no-store');
    c.header('Vary', 'Authorization, X-Admin-Key');
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    console.error('[local-capture]', error);
    return c.json({ error: 'Local capture service unavailable' }, 500);
  });
  app.use('/v1/*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    c.header('Vary', 'Authorization, X-Admin-Key');
    await next();
  });
  const catalogUnavailable = async (c: Context) => {
    await authenticate(c);
    throw new HTTPException(503, { message: 'The production reconstruction catalog is not copied into this local capture database' });
  };
  app.get('/v1/recon-intake/sources', catalogUnavailable);
  app.get('/v1/recon-intake/sources/filters', catalogUnavailable);
  app.route('/v1', createReconIntakeRoutes(authenticate));
  app.route('/v1', createCaptureDriveRoutes(async c => {
    const user = await authenticate(c);
    if (!user.uid || user.wcaId === '__api_key__')
      throw new HTTPException(403, { message: 'Human administrator session required for Drive uploads' });
    return { userId: user.uid, isAdmin: user.isAdmin, isSuperAdmin: false, allowed: user.isAdmin };
  }));
  app.route('/v1', createReconCaptureRoutes(authenticate));
  const port = Number(process.env.PORT ?? config.PORT ?? '3011');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local capture API port');
  serve({ fetch: app.fetch, hostname: '127.0.0.1', port });
  console.log(`Local intake/capture API: http://127.0.0.1:${port}; DB ${process.env.DB_NAME} on loopback:${process.env.DB_PORT}`);
}
