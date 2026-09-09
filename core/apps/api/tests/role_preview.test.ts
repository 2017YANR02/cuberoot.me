import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let sql: ReturnType<typeof postgres>;
let app: Hono;
let rootToken: string;
let adminToken: string;
const schema = `role_test_${randomUUID().replaceAll('-', '')}`;
vi.mock('../src/db/connection.js', () => ({
  get sql() { return sql; },
  query: (statement: string, values: never[] = []) => {
    let index = 0;
    return sql.unsafe(statement.replace(/\?/g, () => `$${++index}`), values);
  },
}));

describe.skipIf(process.env.DRIVE_TEST_PG !== '1')('role preview (PostgreSQL)', () => {
  beforeAll(async () => {
    sql = postgres({
      host: process.env.DB_HOST ?? '127.0.0.1', port: Number(process.env.DB_PORT ?? 5433),
      user: process.env.DB_USER ?? 'postgres', password: process.env.DB_PASS ?? 'dev',
      database: process.env.DB_NAME ?? 'cuberoot_db', max: 4, connection: { search_path: schema },
    });
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe(`CREATE TABLE app_users (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, display_name TEXT,
      wca_id TEXT, is_admin BOOLEAN DEFAULT FALSE, show_in_member_list BOOLEAN DEFAULT TRUE,
      avatar_url TEXT, avatar_source TEXT DEFAULT 'auto', avatar_preset TEXT, merged_into_user_id BIGINT
    ); CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;`);
    for (const migration of ['0184_drive', '0189_drive_shares', '0216_drive_member_folders', '0217_role_preview', '0218_drive_compressions']) {
      await sql.unsafe(await readFile(new URL(`../migrations/${migration}.sql`, import.meta.url), 'utf8'));
    }
    await sql`INSERT INTO app_users (display_name, wca_id, is_admin)
      VALUES ('Root', '2017YANR02', FALSE), ('Admin', NULL, TRUE)`;
    const { signSession } = await import('../src/utils/session.js');
    rootToken = signSession({ uid: 1 });
    adminToken = signSession({ uid: 2 });
    const { rolePreviewGuard, authRoutes } = await import('../src/routes/auth.js');
    const { driveRoutes } = await import('../src/routes/drive.js');
    app = new Hono().use('/v1/*', rolePreviewGuard).route('/v1', authRoutes).route('/v1', driveRoutes);
    app.get('/v1/test-cache', c => { c.header('Cache-Control', 'public, max-age=300'); return c.json({ ok: true }); });
    app.onError((error, c) => c.json({ error: error.message }, 403));
  });
  afterAll(async () => {
    if (sql) {
      // Only this uniquely named test schema is removed.
      await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await sql.end();
    }
  });

  it('isolates real roles, audits writes, blocks credential minting and revokes sessions', async () => {
    const request = (token: string, path: string, method = 'GET', body?: unknown) => app.request(`/v1${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    expect((await request(adminToken, '/auth/role-preview', 'POST', { role: 'admin' })).status).toBe(403);
    expect((await request(rootToken, '/auth/role-preview', 'POST', { role: 'superadmin' })).status).toBe(400);
    for (const role of ['admin', 'member', 'user', 'guest']) {
      const response = await request(rootToken, '/auth/role-preview', 'POST', { role });
      expect(response.status).toBe(200);
      const preview = await response.json();
      const [expiry] = await sql`SELECT expires_at = 'infinity'::timestamptz AS unlimited FROM role_preview_sessions WHERE id = ${preview.id}`;
      expect(expiry.unlimited).toBe(true);
      if (role === 'guest') {
        expect(preview.user).toBeNull(); expect(preview.token).toBe('');
      } else {
        expect(jwt.decode(preview.token)).not.toHaveProperty('exp');
        expect(preview.user.uid).not.toBe(1);
        expect(preview.user.wcaId).toBeNull();
        expect(preview.user.isAdmin).toBe(role === 'admin');
        const me = await request(preview.token, '/auth/me');
        expect(me.status).toBe(200);
        expect((await request(preview.token, '/test-cache')).headers.get('Cache-Control')).toBe('no-store');
        const drive = await (await request(preview.token, '/drive')).json();
        expect(drive.allowed).toBe(role !== 'user');
        expect(drive.isSuperAdmin ?? false).toBe(false);
        expect((await request(preview.token, '/drive?all=1')).status).not.toBe(200);
        for (const path of ['/auth/refresh', '/auth/role-preview', '/auth/handoff', '/auth/profile']) {
          expect((await request(preview.token, path, 'POST', { role: 'admin' })).status).toBe(403);
        }
        expect((await app.request('/v1/drive', { headers: { Authorization: `Bearer ${preview.token}`, 'X-Admin-Key': 'test' } })).status).toBe(403);
        if (role !== 'user') {
          expect((await request(preview.token, '/drive/folders', 'POST', { name: 'Role test' })).status).toBe(201);
          const [event] = await sql`SELECT method, path FROM role_preview_events WHERE session_id = ${preview.id}`;
          expect(event).toMatchObject({ method: 'POST', path: '/v1/drive/folders' });
        }
      }
      expect((await request(rootToken, `/auth/role-preview/${preview.id}`, 'DELETE')).status).toBe(200);
      if (preview.token) {
        expect((await request(preview.token, '/auth/me')).status).toBe(401);
        const { authenticateUser } = await import('../src/utils/recon_helpers.js');
        expect(await authenticateUser(`Bearer ${preview.token}`)).toBeNull();
      }
    }
    const preview = await (await request(rootToken, '/auth/role-preview', 'POST', { role: 'member' })).json();
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM role_preview_profiles`;
    expect(count).toBe(3);
    await sql`UPDATE role_preview_sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE id = ${preview.id}`;
    expect((await request(preview.token, '/drive')).status).toBe(401);
    expect((await request(rootToken, '/drive?all=1')).status).toBe(200);
    const [root] = await sql`SELECT wca_id, is_admin FROM app_users WHERE id = 1`;
    expect(root).toEqual({ wca_id: '2017YANR02', is_admin: false });
  });
});
