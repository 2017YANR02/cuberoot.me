import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import type { Hono, Context } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let sql: ReturnType<typeof postgres>;
let app: Hono;
const schema = `drive_test_${randomUUID().replaceAll('-', '')}`;
vi.mock('../src/db/connection.js', () => ({ get sql() { return sql; } }));
vi.mock('../src/utils/app_user_auth.js', () => ({
  requireAppUserId: async (c: Context) => Number(c.req.header('X-Test-User')),
}));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: async (c: Context) => {
    const [user] = await sql`SELECT is_admin, wca_id FROM app_users WHERE id = ${Number(c.req.header('X-Test-User'))}`;
    if (!user) throw new Error('unauthorized');
    return { isAdmin: user.is_admin || user.wca_id === '2017YANR02', realWcaId: user.wca_id };
  },
  requireAdmin: vi.fn(),
  checkRateLimit: () => true,
}));

// Real PG SQL and Hono requests; opt in locally, mandatory in the CI server test step.
describe.skipIf(process.env.DRIVE_TEST_PG !== '1')('Drive member folders (PostgreSQL)', () => {
  beforeAll(async () => {
    sql = postgres({
      host: process.env.DB_HOST ?? '127.0.0.1', port: Number(process.env.DB_PORT ?? 5433),
      user: process.env.DB_USER ?? 'postgres', password: process.env.DB_PASS ?? 'dev',
      database: process.env.DB_NAME ?? 'cuberoot_db', max: 6,
      connection: { search_path: schema },
    });
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe(`
      CREATE TABLE app_users (id BIGINT PRIMARY KEY, display_name TEXT, wca_id TEXT, is_admin BOOLEAN DEFAULT FALSE);
      CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
    `);
    for (const migration of ['0184_drive', '0189_drive_shares', '0216_drive_member_folders', '0218_drive_compressions']) {
      await sql.unsafe(await readFile(new URL(`../migrations/${migration}.sql`, import.meta.url), 'utf8'));
    }
    await sql`INSERT INTO app_users (id, display_name, is_admin) VALUES (1, 'Owner', true), (2, 'Admin viewer', true), (3, 'Member', false), (4, 'Outsider', false)`;
    await sql`INSERT INTO drive_members (user_id) VALUES (3)`;
    await sql`INSERT INTO app_users (id, display_name, wca_id) VALUES (5, 'Superadmin', '2017YANR02')`;
    app = (await import('../src/routes/drive.js')).driveRoutes;
    app.onError((error, c) => c.json({ error: error.message }, 403));
  });
  afterAll(async () => {
    if (sql) {
      // Only the uniquely named test schema is removed; no application tables are touched.
      await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await sql.end();
    }
    vi.restoreAllMocks();
  });

  it('inherits read access, preserves private ownership, and revokes existing download tickets', async () => {
    const request = (user: number, url: string, method = 'GET', body?: unknown) => app.request(url, {
      method, headers: { 'X-Test-User': String(user), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const folder = async (name: string, parentId: string | null = null) => {
      const response = await request(1, '/drive/folders', 'POST', { name, parentId });
      expect(response.status).toBe(201);
      return (await response.json()).node.id as string;
    };
    const privateRoot = await folder('Private parent');
    const shared = await folder('Team videos', privateRoot);
    const nested = await folder('Lessons', shared);
    const file = randomUUID();
    await sql`INSERT INTO drive_nodes (id, owner_user_id, kind, name, size_bytes, storage_key, mime_type)
      VALUES (${file}, 1, 'file', 'lesson.mp4', 4, ${`${file.slice(0, 2)}/${file}`}, 'video/mp4')`;
    const access = () => request(3, `/drive/files/${file}/access`, 'POST');
    const patch = (id: string, body: unknown) => request(1, `/drive/nodes/${id}`, 'PATCH', body);
    const ids = async (url: string, user = 3) => {
      const response = await request(user, url);
      expect(response.status).toBe(200);
      return (await response.json()).nodes.map((node: { id: string }) => node.id);
    };
    expect(await ids('/drive', 2)).toEqual([]);
    expect((await request(2, '/drive?all=1')).status).toBe(403);
    expect((await request(3, '/drive?all=1')).status).toBe(403);
    expect(await ids('/drive?all=1', 5)).toEqual([privateRoot, file]);
    expect(await ids(`/drive?all=1&parent=${privateRoot}`, 5)).toEqual([shared]);
    expect((await request(5, '/drive?all=1&members=1')).status).toBe(400);
    expect((await request(5, `/drive/files/${file}/access`, 'POST')).status).toBe(200);
    expect((await request(5, `/drive/nodes/${file}`, 'PATCH', { name: 'not mine' })).status).toBe(404);
    expect((await access()).status).toBe(404);
    expect((await request(2, `/drive?parent=${shared}`)).status).toBe(404);
    expect((await patch(file, { memberShared: true })).status).toBe(400);
    expect((await patch(shared, { memberShared: 'true' })).status).toBe(400);
    expect((await patch(shared, { memberShared: true })).status).toBe(200);
    expect(await ids('/drive?members=1')).toEqual([shared]);
    expect(await ids('/drive?members=1', 2)).toEqual([shared]);
    const outsider = await (await request(4, '/drive?members=1')).json();
    expect(outsider.allowed).toBe(false);
    expect(outsider.nodes).toEqual([]);
    expect((await request(3, `/drive?members=1&parent=${privateRoot}`)).status).toBe(404);
    const listing = await (await request(3, `/drive?members=1&parent=${nested}`)).json();
    expect(listing.breadcrumbs.map((node: { id: string }) => node.id)).toEqual([shared, nested]);
    expect((await patch(file, { parentId: nested })).status).toBe(200);
    expect(await ids(`/drive?members=1&parent=${nested}`)).toEqual([file]);
    for (const [suffix, method, body] of [
      ['', 'PATCH', { name: 'changed' }], ['/trash', 'POST', {}],
    ] as const) expect((await request(3, `/drive/nodes/${file}${suffix}`, method, body)).status).toBe(404);
    expect((await request(3, `/drive/files/${file}/share`, 'POST')).status).toBe(404);
    expect((await request(3, '/drive/folders', 'POST', { name: 'bad', parentId: shared })).status).toBe(404);
    expect((await patch(shared, { parentId: nested })).status).toBe(409);
    expect((await patch(shared, { parentId: shared })).status).toBe(409);
    // Concurrent inverse moves must not create a cycle.
    const a = await folder('A');
    const b = await folder('B');
    expect((await Promise.all([patch(a, { parentId: b }), patch(b, { parentId: a })])).map(r => r.status).sort()).toEqual([200, 409]);
    const ticket = await access();
    expect(ticket.status).toBe(200);
    const ticketBody = await ticket.json();
    const ticketUrl = new URL(ticketBody.url);
    const url = ticketUrl.pathname.replace(/^\/v1/, '') + ticketUrl.search;
    // Keep filesystem access isolated while exercising actual HEAD/Range authorization.
    const fs = await import('node:fs');
    vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 4, isFile: () => true } as Awaited<ReturnType<typeof fs.promises.stat>>);
    expect((await request(3, url, 'HEAD')).status).toBe(200);
    const range = await app.request(url, { method: 'HEAD', headers: { Range: 'bytes=2-' } });
    expect(range.status).toBe(206);
    expect(range.headers.get('Content-Range')).toBe('bytes 2-3/4');
    await sql`UPDATE drive_members SET enabled = FALSE WHERE user_id = 3`;
    expect((await request(3, url, 'HEAD')).status).toBe(404);
    await sql`UPDATE drive_members SET enabled = TRUE WHERE user_id = 3`;
    await patch(shared, { memberShared: false });
    expect((await request(3, url, 'HEAD')).status).toBe(404);
    await patch(shared, { memberShared: true });
    await patch(file, { parentId: null });
    expect((await access()).status).toBe(404);
    await patch(file, { parentId: nested });
    await patch(nested, { memberShared: true });
    await patch(shared, { memberShared: false });
    expect((await access()).status).toBe(200); // independent nested share remains
    expect((await request(1, `/drive/nodes/${shared}/trash`, 'POST')).status).toBe(200);
    expect((await access()).status).toBe(404);
    expect((await request(1, `/drive/nodes/${shared}/restore`, 'POST')).status).toBe(200);
    expect(await ids('/drive?members=1')).toEqual([]);
    expect((await access()).status).toBe(404);
  });

  it('queues resolution choices idempotently, enforces ownership, and reserves output quota', async () => {
    vi.stubEnv('DRIVE_COMPRESSION_ENABLED', '1');
    try {
      const file = randomUUID();
      const output = randomUUID();
      await sql`INSERT INTO drive_nodes (id, owner_user_id, kind, name, size_bytes, storage_key, mime_type)
        VALUES (${file}, 1, 'file', 'compression.mp4', 4096, ${`${file.slice(0, 2)}/${file}`}, 'video/mp4')`;
      const request = (user: number, resolution: unknown, id = file) => app.request(`/drive/files/${id}/compress`, {
        method: 'POST', headers: { 'X-Test-User': String(user), 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });
      expect((await request(4, 'original')).status).toBe(403);
      expect((await request(3, 'original')).status).toBe(404);
      expect((await request(2, 'original')).status).toBe(404);
      for (const body of ['null', '[]', '{']) {
        expect((await app.request(`/drive/files/${file}/compress`, {
          method: 'POST', headers: { 'X-Test-User': '1', 'Content-Type': 'application/json' }, body,
        })).status).toBe(400);
      }
      expect((await request(1, '720p')).status).toBe(400);
      expect((await request(1, null)).status).toBe(400);
      const repeated = await Promise.all([request(1, 'original'), request(1, 'original')]);
      expect(repeated.map((response) => response.status)).toEqual([202, 202]);
      const jobs = await Promise.all(repeated.map((response) => response.json()));
      expect(jobs[0].compression.id).toBe(jobs[1].compression.id);
      expect(jobs[0].compression.resolution).toBe('original');
      const lower = await request(5, '1080p');
      expect(lower.status).toBe(202);
      expect((await lower.json()).compression.resolution).toBe('1080p');
      expect(Number((await sql`SELECT SUM(reserved_bytes) AS total FROM drive_compressions WHERE source_node_id = ${file}`)[0].total)).toBe(8192);
      const listing = await (await app.request('/drive', { headers: { 'X-Test-User': '1' } })).json();
      expect(listing.nodes.find((node: { id: string }) => node.id === file).canCompress).toBe(true);
      expect(listing.nodes.find((node: { id: string }) => node.id === file).compressions).toHaveLength(2);
      await sql`UPDATE drive_compressions SET status = 'failed', error = 'quality' WHERE source_node_id = ${file} AND resolution = 'original'`;
      expect((await (await request(1, 'original')).json()).compression.id).toBe(jobs[0].compression.id);
      await sql`INSERT INTO drive_nodes (id, owner_user_id, kind, name, size_bytes, storage_key, mime_type)
        VALUES (${output}, 1, 'file', 'compressed.mp4', 1024, ${`${output.slice(0, 2)}/${output}`}, 'video/mp4')`;
      await sql`UPDATE drive_compressions SET status = 'ready', output_node_id = ${output} WHERE source_node_id = ${file} AND resolution = 'original'`;
      expect((await request(1, 'original', output)).status).toBe(400);
      // Source bytes are never rewritten by enqueue or retry.
      expect(Number((await sql`SELECT size_bytes FROM drive_nodes WHERE id = ${file}`)[0].size_bytes)).toBe(4096);
      await sql`UPDATE drive_nodes SET trashed_at = NOW(), trash_root_id = id WHERE id = ${file}`;
      expect((await request(1, '1080p')).status).toBe(404);
      await sql`UPDATE drive_nodes SET trashed_at = NULL, trash_root_id = NULL WHERE id = ${file}`;
      await sql`UPDATE drive_compressions SET status = 'failed' WHERE source_node_id = ${file} AND resolution = '1080p'`;
      await sql`UPDATE drive_nodes SET size_bytes = 21474836480 WHERE id = ${output}`;
      expect((await request(1, '1080p')).status).toBe(413);
      await sql`DELETE FROM drive_nodes WHERE id IN (${file}, ${output})`;
      vi.stubEnv('DRIVE_COMPRESSION_ENABLED', '0');
      expect((await request(1, 'original')).status).toBe(503);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
