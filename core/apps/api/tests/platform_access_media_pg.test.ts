import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null as unknown, lookup: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ get sql() { return state.db; } }));
// Session verification is the boundary fixture; Platform actor mapping and all
// course ownership/entitlement decisions below use the production implementation.
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: async (c: { req: { header(name: string): string | undefined } }) => {
    const actor = c.req.header('X-Fixture-Actor');
    if (actor === 'suspended') throw new Error('Account suspended');
    if (!actor) throw new Error('Authentication required');
    if (actor === 'legacy') return { wcaId: '2099TEST01', name: 'Legacy', isAdmin: false };
    if (actor === 'unregistered') return { wcaId: 'external-subject', name: 'External', isAdmin: false };
    const uid = Number(actor);
    return { uid, wcaId: `u${uid}`, name: `Fixture ${uid}`, isAdmin: uid === 5 };
  },
  requireAdminOrApiKey: async (c: { req: { header(name: string): string | undefined } }) => {
    if (c.req.header('X-Admin-Key') !== 'fixture-only-valid') throw new Error('Invalid key');
  },
}));
vi.mock('../src/utils/account.js', () => ({ findUserByWcaId: state.lookup }));

import { requirePlatformActor, requirePlatformAdmin } from '../src/platform/auth.js';
import { platformRouter } from '../src/platform/http.js';
import { createPlatformMediaToken } from '../src/platform/media_access.js';
import { authorizeCourseWrite } from '../src/platform/catalog/course-access.js';
import { registerMediaRoutes } from '../src/platform/learning/media-routes.js';
import { platformDb } from '../src/platform/db.js';

const authApp = platformRouter();
authApp.get('/actor', async c => c.json(await requirePlatformActor(c)));
authApp.get('/admin', async c => c.json(await requirePlatformAdmin(c)));

describe('Platform authentication adapter', () => {
  it('keeps guest, suspended, and unregistered identities out of user-backed features', async () => {
    expect((await authApp.request('/actor')).status).toBe(401);
    expect((await authApp.request('/actor', { headers: { 'X-Fixture-Actor': 'suspended' } })).status).toBe(403);
    expect((await authApp.request('/actor', { headers: { 'X-Fixture-Actor': 'unregistered' } })).status).toBe(401);
  });

  it('resolves legacy WCA identity to an existing account without changing its owner key', async () => {
    state.lookup.mockResolvedValueOnce({ id: 17 });
    const response = await authApp.request('/actor', { headers: { 'X-Fixture-Actor': 'legacy' } });
    expect(await response.json()).toMatchObject({ userId: 17, ownerKey: '2099TEST01', wcaId: '2099TEST01', viaApiKey: false });
    expect(state.lookup).toHaveBeenCalledWith('2099TEST01');
    state.lookup.mockResolvedValueOnce(null);
    expect((await authApp.request('/actor', { headers: { 'X-Fixture-Actor': 'legacy' } })).status).toBe(401);
  });

  it('requires administrator role or a verified admin key', async () => {
    expect((await authApp.request('/admin', { headers: { 'X-Fixture-Actor': '1' } })).status).toBe(403);
    expect((await authApp.request('/admin', { headers: { 'X-Fixture-Actor': '5' } })).status).toBe(200);
    const valid = await authApp.request('/admin', { headers: { 'X-Admin-Key': 'fixture-only-valid' } });
    expect(await valid.json()).toMatchObject({ userId: null, viaApiKey: true, isAdmin: true });
    expect((await authApp.request('/admin', { headers: { 'X-Admin-Key': 'invalid', 'X-Fixture-Actor': '5' } })).status).toBe(403);
  });
});

const databaseUrl = process.env.PLATFORM_MEDIA_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)('course access and signed media with PostgreSQL and actual files', () => {
  const schema = `platform_media_${randomUUID().replaceAll('-', '')}`;
  const courseId = randomUUID();
  const lessons = [randomUUID(), randomUUID(), randomUUID()];
  const mediaId = randomUUID();
  const coverId = randomUUID();
  const bytes = Buffer.from('0123456789abcdef');
  let admin: ReturnType<typeof postgres>;
  let db: ReturnType<typeof postgres>;
  let mediaDirectory: string;
  const app = platformRouter();
  registerMediaRoutes(app);
  app.get('/course/:id/write-access', async c => c.json({
    id: await authorizeCourseWrite(platformDb(), await requirePlatformActor(c), c.req.param('id')),
  }));
  const headers = (actor?: number) => actor == null ? {} : { 'X-Fixture-Actor': String(actor) };
  const descriptor = (index = 0, actor?: number) => app.request(`/lessons/${lessons[index]}/media`, { headers: headers(actor) });
  const requestUrl = (url: string, init?: RequestInit) => {
    const parsed = new URL(url);
    return app.request(parsed.pathname + parsed.search, init);
  };

  beforeAll(async () => {
    if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl!).hostname)) throw new Error('Explicit loopback PostgreSQL required');
    admin = postgres(databaseUrl!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    db = postgres(databaseUrl!, { max: 3, onnotice: () => {}, connection: { search_path: schema } });
    state.db = db;
    const scratch = fileURLToPath(new URL('../../../../.tmp/scratch/', import.meta.url));
    await mkdir(scratch, { recursive: true });
    mediaDirectory = await mkdtemp(path.join(scratch, 'platform-media-'));
    await writeFile(path.join(mediaDirectory, 'lesson.mp4'), bytes);
    await writeFile(path.join(mediaDirectory, 'cover.png'), bytes);
    vi.stubEnv('PLATFORM_MEDIA_DIR', mediaDirectory);
    vi.stubEnv('PLATFORM_MEDIA_SIGNING_SECRET', 'platform-media-integration-fixture-secret');
    await db.unsafe(`CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;
      CREATE TABLE app_users(id BIGINT PRIMARY KEY);
      CREATE TABLE teacher_directory_entries(id BIGINT PRIMARY KEY);`);
    for (const migration of ['0167_platform_core.sql', '0219_platform_lesson_grants.sql', '0244_platform_lesson_covers.sql']) {
      await db.unsafe(await readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
    }
    await db.unsafe('INSERT INTO app_users VALUES (1),(2),(3),(4),(5)');
    await db.unsafe(`INSERT INTO platform_courses(id,slug,status)
      VALUES ($1,'media-course','draft')`, [courseId]);
    await db.unsafe(`INSERT INTO platform_course_revisions(course_id,revision,title_en,status,content_hash,published_at)
      VALUES ($1,1,'Media course','published',decode(repeat('ab',32),'hex'),NOW())`, [courseId]);
    await db.unsafe(`UPDATE platform_courses SET status='published',current_revision=1,published_at=NOW() WHERE id=$1`, [courseId]);
    for (const [id, key, mime] of [[mediaId, 'lesson.mp4', 'video/mp4'], [coverId, 'cover.png', 'image/png']]) {
      await db.unsafe(`INSERT INTO platform_media_assets(id,owner_user_id,storage_key,mime_type,size_bytes,sha256,access_scope,status)
        VALUES($1,3,$2,$3,$4,decode(repeat('ab',32),'hex'),'entitled','ready')`, [id, key, mime, bytes.length]);
    }
    for (const [index, lesson] of lessons.entries()) {
      await db.unsafe(`INSERT INTO platform_lessons(id,course_id,slug,ordinal,access_scope)
        VALUES($1,$2,$3,$4,$5)`, [lesson, courseId, `lesson-${index}`, index, index === 2 ? 'public' : 'entitled']);
      await db.unsafe(`INSERT INTO platform_lesson_revisions(lesson_id,revision,title_en,status,content_hash,media_id,cover_media_id,published_at)
        VALUES($1,1,'Lesson','published',decode(repeat('ab',32),'hex'),$2,$3,NOW())`, [lesson, mediaId, coverId]);
      await db.unsafe(`UPDATE platform_lessons SET status='published',current_revision=1 WHERE id=$1`, [lesson]);
    }
    const entitlement = (await db.unsafe(`INSERT INTO platform_course_entitlements(user_id,course_id,valid_from)
      VALUES(1,$1,NOW()) RETURNING id`, [courseId]))[0].id;
    await db.unsafe(`INSERT INTO platform_entitlement_ledger(entitlement_id,entry_type,delta_access,valid_from,lesson_ids,reason,actor_user_id)
      VALUES($1,'grant',1,NOW(),ARRAY[$2::uuid],'Acceptance fixture',5)`, [entitlement, lessons[0]]);
    for (const user of [3, 4]) {
      const instructor = (await db.unsafe(`INSERT INTO platform_instructors(user_id,status,display_name_snapshot)
        VALUES($1,'active','Fixture instructor') RETURNING id`, [user]))[0].id;
      if (user === 3) await db.unsafe(`INSERT INTO platform_course_owners(course_id,instructor_id,role) VALUES($1,$2,'owner')`, [courseId, instructor]);
    }
  }, 30_000);

  afterAll(async () => {
    await db?.end();
    if (admin) { await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`); await admin.end(); }
    if (mediaDirectory) await rm(mediaDirectory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('enforces exact lesson grants, instructor ownership, and administrator access', async () => {
    expect((await descriptor()).status).toBe(401);
    expect((await descriptor(0, 2)).status).toBe(403);
    expect((await descriptor(0, 1)).status).toBe(200);
    expect((await descriptor(1, 1)).status).toBe(403);
    expect((await descriptor(1, 3)).status).toBe(200);
    expect((await descriptor(1, 4)).status).toBe(403);
    expect((await descriptor(1, 5)).status).toBe(200);
    expect((await descriptor(2)).status).toBe(200);
    for (const [actor, status] of [[1, 403], [2, 403], [3, 200], [4, 404], [5, 200]]) {
      expect((await app.request(`/course/${courseId}/write-access`, { headers: headers(actor) })).status).toBe(status);
    }
  });

  it('denies new media access when an entitlement expires or is revoked', async () => {
    try {
      await db.unsafe(`UPDATE platform_course_entitlements SET valid_from=NOW()-INTERVAL '2 days',valid_until=NOW()-INTERVAL '1 day' WHERE user_id=1`);
      expect((await descriptor(0, 1)).status).toBe(403);
      await db.unsafe(`UPDATE platform_course_entitlements SET valid_until=NULL,status='revoked' WHERE user_id=1`);
      expect((await descriptor(0, 1)).status).toBe(403);
    } finally {
      await db.unsafe(`UPDATE platform_course_entitlements SET valid_from=NOW(),valid_until=NULL,status='active' WHERE user_id=1`);
    }
  });

  it('hides new media access for draft or archived courses, including public lessons', async () => {
    try {
      for (const status of ['draft', 'archived']) {
        await db.unsafe('UPDATE platform_courses SET status=$2,archived_at=NOW() WHERE id=$1', [courseId, status]);
        expect((await descriptor(0, 1)).status).toBe(404);
        expect((await descriptor(2)).status).toBe(404);
      }
      await db.unsafe(`UPDATE platform_courses SET status='unlisted',archived_at=NULL WHERE id=$1`, [courseId]);
      expect((await descriptor(0, 1)).status).toBe(200);
    } finally {
      await db.unsafe(`UPDATE platform_courses SET status='published',archived_at=NULL WHERE id=$1`, [courseId]);
    }
  });

  it('serves signed video ranges and cover bytes with private headers and HEAD support', async () => {
    const response = await descriptor(0, 1);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { accessUrl, posterUrl } = await response.json();
    const ranged = await requestUrl(accessUrl, { headers: { Range: 'bytes=2-5' } });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get('Content-Range')).toBe('bytes 2-5/16');
    expect(ranged.headers.get('Cache-Control')).toBe('private, no-store');
    expect(ranged.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await ranged.text()).toBe('2345');
    const head = await requestUrl(accessUrl, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.headers.get('Content-Length')).toBe('16');
    expect(await head.text()).toBe('');
    const unsatisfiable = await requestUrl(accessUrl, { headers: { Range: 'bytes=16-' } });
    expect(unsatisfiable.status).toBe(416);
    expect(unsatisfiable.headers.get('Content-Range')).toBe('bytes */16');
    const poster = await requestUrl(posterUrl);
    expect(poster.headers.get('Content-Type')).toBe('image/png');
    expect(Buffer.from(await poster.arrayBuffer())).toEqual(bytes);
  });

  it('rejects tampered, expired, cross-lesson and video-as-cover tokens', async () => {
    const { accessUrl } = await (await descriptor(0, 1)).json();
    const signed = new URL(accessUrl);
    const token = signed.searchParams.get('token')!;
    const expired = createPlatformMediaToken({ mediaId, binding: `lesson:${lessons[0]}:1`, nowSeconds: Math.floor(Date.now() / 1000) - 301 });
    const [payload, signature] = token.split('.');
    const tampered = `${payload}.${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
    for (const invalid of [tampered, expired.token]) {
      expect((await app.request(`/lessons/${lessons[0]}/media?token=${invalid}`)).status).toBe(403);
    }
    expect((await app.request(`/lessons/${lessons[1]}/media?token=${token}`)).status).toBe(403);
    expect((await app.request(`/lessons/${lessons[0]}/cover?token=${token}`)).status).toBe(403);
  });

  it('fails closed when the stored media no longer matches its metadata', async () => {
    const { accessUrl } = await (await descriptor(0, 1)).json();
    await writeFile(path.join(mediaDirectory, 'lesson.mp4'), bytes.subarray(1));
    try {
      const response = await requestUrl(accessUrl);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ error: { code: 'PRIVATE_DATA_UNREADABLE' } });
    } finally { await writeFile(path.join(mediaDirectory, 'lesson.mp4'), bytes); }
  });
});
