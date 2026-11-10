import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { HOME_ANALYTICS_LAYOUT, analyticsPage, validAnalyticsEvent, type ProductAnalyticsEvent } from '@cuberoot/shared/product-analytics';
const state = vi.hoisted(() => ({ db: null as unknown, userId: 1, admin: false }));
vi.mock('../src/db/connection.js', () => ({ get sql() { return state.db; } }));
vi.mock('../src/platform/auth.js', () => ({
  requirePlatformActor: async () => ({ userId: state.userId, isAdmin: state.admin }),
  requirePlatformAdmin: async () => { if (!state.admin) { const { forbidden } = await import('../src/platform/errors.js'); forbidden(); } },
}));
import { productAnalyticsRoutes as app } from '../src/routes/product_analytics.js';
import { cleanupProductAnalytics } from '../src/platform/product_analytics.js';
import type { PlatformDb } from '../src/platform/db.js';

const event = (extra: Partial<ProductAnalyticsEvent> = {}): ProductAnalyticsEvent => ({
  id: randomUUID(), name: 'web.page_view', viewId: randomUUID(), occurredAt: new Date().toISOString(),
  route: '/timer', feature: 'timer', language: 'zh', deviceClass: 'desktop', entryPoint: 'home', ...extra,
});

it('normalizes private/dynamic routes and rejects payload contents outside the vocabulary', () => {
  expect(analyticsPage('/zh/wca/persons/2017YANR02?token=secret')).toEqual({ route: '/wca/persons/:detail', feature: 'wca-persons' });
  expect(analyticsPage('/zh/docs/private-document')).toBeNull();
  expect(analyticsPage('/zh/account')).toBeNull();
  expect(analyticsPage('/zh/wca/prediction/333')).toEqual({ route: '/wca/prediction/333', feature: 'wca-stats' });
  expect(analyticsPage('/org/private-org/students/private-id')?.route).toBe('/org/[orgSlug]/students/[studentId]');
  expect(validAnalyticsEvent({ ...event(), email: 'someone@example.com' })).toBe(false);
  expect(validAnalyticsEvent(event({ route: '/timer?secret=1' }))).toBe(false);
  expect(validAnalyticsEvent(event({ occurredAt: '2020-01-01' }))).toBe(false);
  expect(validAnalyticsEvent(event({ name: 'web.entry_click' }))).toBe(false);
});

const url = process.env.PRODUCT_ANALYTICS_TEST_DATABASE_URL;
describe.skipIf(!url)('default product analytics with real PostgreSQL', () => {
  let db: ReturnType<typeof postgres>;
  const schema = `analytics_${randomUUID().replaceAll('-', '')}`;
  const subjectToken = randomUUID();
  const sessionId = randomUUID();
  const write = (path: string, body: Record<string, unknown>, account = false) => app.request(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(account ? { Authorization: 'Bearer fixture' } : {}) },
    body: JSON.stringify({ subjectToken, ...body }),
  });
  beforeAll(async () => {
    const target = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/product_analytics_test') throw new Error('Dedicated local product_analytics_test database required');
    const setup = postgres(url!, { max: 1 });
    await setup.unsafe(`CREATE SCHEMA ${schema}`); await setup.end();
    db = postgres(url!, { max: 4, connection: { search_path: schema }, onnotice: () => {} }); state.db = db;
    await db.unsafe('CREATE TABLE app_users (id BIGINT PRIMARY KEY); INSERT INTO app_users VALUES (1), (2)');
    const snapshot = readFileSync(new URL('../src/db/schema.pg.sql', import.meta.url), 'utf8');
    for (const name of ['platform_privacy_consents', 'platform_analytics_events']) {
      const start = snapshot.indexOf(`CREATE TABLE ${name} (`);
      const end = snapshot.indexOf('\n);', start) + 3;
      await db.unsafe(snapshot.slice(start, end));
    }
    // Verify the exact migration against PG 13, rather than mocking SQL strings.
    await db.unsafe(readFileSync(new URL('../migrations/0309_product_analytics.sql', import.meta.url), 'utf8'));
  });
  afterAll(async () => { if (db) { await db.unsafe(`DROP SCHEMA ${schema} CASCADE`); await db.end(); } });

  it('accepts anonymous and member events without consent and deduplicates retries', async () => {
    const events = [event()];
    expect(await (await write('/analytics/events', { sessionId, events })).json()).toEqual({ accepted: 1 });
    expect(await (await write('/analytics/events', { sessionId, events })).json()).toEqual({ accepted: 0 });
    expect((await write('/analytics/events', { sessionId, events: [event()] }, true)).status).toBe(202);
    // Historical preference records no longer control default web statistics.
    await db.unsafe("INSERT INTO platform_privacy_consents (user_id, purpose, status, policy_version, source) VALUES (1, 'analytics', 'withdrawn', 'web-analytics-1', 'fixture')");
    expect((await write('/analytics/events', { sessionId, events: [event()] }, true)).status).toBe(202);
    const rows = await db.unsafe('SELECT user_id, consent_id, encode(anonymous_subject_hash, \'hex\') AS hash, dimensions FROM platform_analytics_events ORDER BY occurred_at');
    expect(rows[0].user_id).toBeNull(); expect(rows[0].hash).toHaveLength(64);
    expect(rows.every(row => row.consent_id === null)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain(subjectToken);
    expect((await db.unsafe('SELECT COUNT(*)::int AS count FROM platform_privacy_consents'))[0].count).toBe(1);
    expect((await write('/analytics/events', {sessionId, events:[{...event(), route:'/timer?secret=1'}]})).status).toBe(400);
  });

  it('reports matched exposure/click/use funnels, excludes admins, and purges expiry', async () => {
    expect((await app.request('/admin/product-analytics')).status).toBe(403);
    const viewId = randomUUID();
    const entry = { viewId, route: '/', feature: 'home', entryId: 'timer', placement: 'main', position: 0, layoutVersion: HOME_ANALYTICS_LAYOUT } as const;
    const events = [event({name: 'web.feature_interaction'}), event({ ...entry, name: 'web.entry_impression' }), event({ ...entry, name: 'web.entry_click' }),
      event({ name: 'web.feature_use', action: 'timer_solve', sourceViewId: viewId, sourcePlacement: 'main', sourcePosition: 0 })];
    expect((await write('/analytics/events', { sessionId, events }, true)).status).toBe(202);
    state.admin = true;
    await write('/analytics/events', { sessionId: randomUUID(), events: [event()] }, true);
    const response = await app.request('/admin/product-analytics?days=28');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const report = await response.json();
    expect(response.status, JSON.stringify(report)).toBe(200);
    expect(report.coverage).toBe('default_web');
    expect(report.features.find((row: {feature:string}) => row.feature === 'timer')).toMatchObject({interactingSessions:1, usingSessions:1});
    expect(report.summary.accountUsers).toBe(1);
    expect(report.entries[0]).toMatchObject({ impressions: 1, clicks: 1, usedAfterClick: 1 });
    expect(report.frequency[0]).toMatchObject({ feature: 'timer', users: 1, activeDaysPerUser: 1, sessionsPerUser: 1 });
    expect(JSON.stringify(report)).not.toContain(subjectToken);
    expect(JSON.stringify(report)).not.toContain(sessionId);
    await db.unsafe("UPDATE platform_analytics_events SET occurred_at=NOW()-INTERVAL '32 days', expires_at=NOW()-INTERVAL '1 day'");
    await cleanupProductAnalytics(db as unknown as PlatformDb);
    expect((await db.unsafe('SELECT COUNT(*)::int AS count FROM platform_analytics_events'))[0].count).toBe(0);
    state.admin = false;
  });

  it('deduplicates funnel steps and requires matching attribution and a click after exposure', async () => {
    const now = Date.now();
    const at = (offset: number) => new Date(now + offset).toISOString();
    const make = (viewId: string, name: ProductAnalyticsEvent['name'], offset: number, extra: Partial<ProductAnalyticsEvent> = {}) => event({
      viewId, name, occurredAt: at(offset), route: '/', feature: 'home', entryId: 'timer',
      placement: 'main', position: 0, layoutVersion: HOME_ANALYTICS_LAYOUT, ...extra,
    });
    const use = (sourceViewId: string, offset = -1000, extra: Partial<ProductAnalyticsEvent> = {}) => event({
      name: 'web.feature_use', action: 'timer_solve', occurredAt: at(offset),
      sourceViewId, sourcePlacement: 'main', sourcePosition: 0, ...extra,
    });
    const matched = randomUUID(), early = randomUUID(), wrong = randomUUID(), unseen = randomUUID(), idle = randomUUID();
    const events = [
      make(matched, 'web.entry_impression', -5000), make(matched, 'web.entry_impression', -4000),
      make(matched, 'web.entry_click', -3000), make(matched, 'web.entry_click', -2000), use(matched), use(matched),
      make(early, 'web.entry_click', -5000), make(early, 'web.entry_impression', -4000),
      make(early, 'web.entry_click', -2000), use(early),
      make(wrong, 'web.entry_impression', -5000), make(wrong, 'web.entry_click', -3000),
      use(wrong, -1000, { sourcePosition: 1 }), use(wrong, -4000),
      make(unseen, 'web.entry_click', -3000), use(unseen),
      make(idle, 'web.entry_impression', -5000), use(idle),
    ];
    expect((await write('/analytics/events', { sessionId: randomUUID(), events }, true)).status).toBe(202);
    state.admin = true;
    for (const audience of ['public', 'member', 'anonymous', 'admin']) {
      const response = await app.request('/admin/product-analytics?days=28&audience=' + audience);
      const report = await response.json();
      expect(response.status, JSON.stringify(report)).toBe(200);
      if (audience === 'public' || audience === 'member') {
        expect(report.entries).toHaveLength(1);
        expect(report.entries[0]).toMatchObject({ impressions: 4, clicks: 2, usedAfterClick: 1 });
      } else expect(report.entries).toEqual([]);
    }
    state.admin = false;
  });

});
