import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../src/db/connection.js', () => ({ get sql() { return state.db; } }));
vi.mock('../src/platform/auth.js', () => ({
  requirePlatformAdmin: async () => ({ userId: 1, ownerKey: 'user:1', isAdmin: true }),
}));
import { platformQrRoutes } from '../src/routes/platform_qr.js';

const url = process.env.PLATFORM_QR_TEST_DATABASE_URL;
describe.skipIf(!url)('QR creation against PostgreSQL', () => {
  const schema = `qr_creation_${randomUUID().replaceAll('-', '')}`;
  let admin: ReturnType<typeof postgres>;
  let db: ReturnType<typeof postgres>;
  const app = new Hono().route('/v1/platform', platformQrRoutes);
  const migration = (file: string) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
  beforeAll(async () => {
    if (!['localhost', '127.0.0.1'].includes(new URL(url!).hostname)) throw new Error('Loopback database required');
    admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    db = postgres(url!, { max: 2, connection: { search_path: schema }, onnotice: () => {} });
    state.db = db;
    await db.unsafe(`CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;
      CREATE TABLE app_users(id BIGINT PRIMARY KEY); CREATE TABLE teacher_directory_entries(id BIGINT PRIMARY KEY);`);
    await db.unsafe(migration('0142_teaching_foundation.sql').split('CREATE TABLE student_profiles')[0]);
    for (const file of ['0167_platform_core.sql', '0202_qr_card_designs.sql', '0203_qr_landing_content.sql', '0258_platform_qr_daily_scans.sql']) await db.unsafe(migration(file));
    await db.unsafe('INSERT INTO app_users VALUES (1)');
  }, 60000);
  afterAll(async () => {
    await db?.end();
    if (admin) { await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`); await admin.end(); }
  });
  const write = (path: string, body: unknown, key = randomUUID(), method = 'POST') => app.request(`/v1/platform${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body),
  });

  it('creates the screenshot input and replays without duplicating, then reads and exports it', async () => {
    const key = randomUUID();
    const payload = { label: '1', count: 1, targetValue: '/' };
    const response = await write('/admin/qr', payload, key);
    const text = await response.text();
    expect(response.status, text).toBe(201);
    const item = JSON.parse(text);
    expect(item).toMatchObject({ label: '1', targetKind: 'internal_path', targetValue: '/', links: [] });
    const replay = await write('/admin/qr', payload, key);
    expect(replay.status).toBe(201);
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    expect((await replay.json()).id).toBe(item.id);
    const listResponse = await app.request('/v1/platform/admin/qr?q=1');
    expect(listResponse.status, await listResponse.clone().text()).toBe(200);
    expect(await listResponse.json()).toMatchObject({ total: 1, items: [{ id: item.id, links: [] }] });
    const svg = await app.request(`/v1/platform/qr/${item.code}/svg`);
    expect(svg.status).toBe(200);
    expect(await svg.text()).toContain('<svg');
  });

  it('creates a batch, preserves landing links, and approves external targets', async () => {
    const links = [{ label: '课程', href: '/platform/courses' }];
    const batch = await write('/admin/qr', { label: 'batch', count: 2, targetKind: 'content', targetValue: '课程入口', type: 'landing', links });
    expect(batch.status, await batch.clone().text()).toBe(201);
    const body = await batch.json();
    expect(body.count).toBe(2);
    const detail = await app.request(`/v1/platform/admin/qr/${body.items[0].code}`);
    expect((await detail.json()).links).toEqual(links);
    const external = await write('/admin/qr', { targetValue: 'https://example.com/lesson' });
    expect(external.status, await external.clone().text()).toBe(201);
    const item = await external.json();
    const rows = await db.unsafe('SELECT approved_by_user_id::text AS approver, approved_by_actor_key AS actor, approved_at IS NOT NULL AS approved FROM platform_qr_revisions WHERE qr_code_id=$1', [item.id]);
    expect(rows[0]).toEqual({ approver: '1', actor: 'user:1', approved: true });
    const edit = await write(`/admin/qr/${item.id}`, { targetKind: 'internal_path', targetValue: '/platform' }, randomUUID(), 'PATCH');
    expect(edit.status, await edit.clone().text()).toBe(200);
  });

  it('saves and duplicates card designs without double encoding, then disables the copy', async () => {
    const created = await write('/admin/qr', { targetValue: '/' });
    const item = await created.json();
    const card = { intro: 'QR fixture', quote: 'Keep turning' };
    const save = await write(`/admin/qr/${item.id}/card`, { card }, randomUUID(), 'PATCH');
    expect(save.status, await save.clone().text()).toBe(200);
    const read = await app.request(`/v1/platform/admin/qr/${item.id}/card`);
    expect((await read.json()).card).toMatchObject(card);
    const combined = await write(`/admin/qr/${item.id}`, { titleZh: '二维码', card: { ...card, intro: 'Updated' } }, randomUUID(), 'PATCH');
    expect(combined.status, await combined.clone().text()).toBe(200);
    const duplicate = await write(`/admin/qr/${item.id}/duplicate`, {});
    expect(duplicate.status, await duplicate.clone().text()).toBe(201);
    const copy = await duplicate.json();
    const copyCard = await app.request(`/v1/platform/admin/qr/${copy.id}/card`);
    expect((await copyCard.json()).card).toMatchObject({ intro: 'Updated', quote: 'Keep turning' });
    const disabled = await write(`/admin/qr/${copy.id}/disabled`, { disabled: true }, randomUUID(), 'PATCH');
    expect(disabled.status, await disabled.clone().text()).toBe(200);
    expect((await disabled.json()).status).toBe('disabled');
  });

  it('round trips template JSON and card-job state', async () => {
    const template = { body: 'A cube card' };
    const response = await write('/admin/qr/cards', { templateKey: 'fixture', nameZh: '测试', template });
    expect(response.status, await response.clone().text()).toBe(201);
    const saved = await response.json();
    expect(saved.template).toEqual(template);
    const edit = await write(`/admin/qr/cards/${saved.id}`, { template: { body: 'Updated cube' } }, randomUUID(), 'PATCH');
    expect(edit.status, await edit.clone().text()).toBe(200);
    expect((await edit.json()).template).toEqual({ body: 'Updated cube' });
    const job = await write('/admin/qr/card-jobs', { templateId: saved.id, request: { count: 1 } });
    expect(job.status, await job.clone().text()).toBe(202);
    const jobBody = await job.json();
    expect(jobBody.requestSnapshot).toEqual({ count: 1 });
    const running = await write(`/admin/qr/card-jobs/${jobBody.id}`, { status: 'running' }, randomUUID(), 'PATCH');
    expect(running.status, await running.clone().text()).toBe(200);
  });
});
