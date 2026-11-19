import { beforeEach, expect, it, vi } from 'vitest';
import { platformRouter } from '../src/platform/http.js';
import type { PlatformHomeContent, PlatformHomepageSettings } from '@cuberoot/shared/platform';

const state = vi.hoisted(() => ({ admin: false, query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ sql: { unsafe: state.query, begin: async (run: (db: unknown) => Promise<unknown>) => run({ unsafe: state.query }) } }));
vi.mock('../src/platform/auth.js', async () => {
  const { forbidden } = await import('../src/platform/errors.js');
  return { requirePlatformAdmin: async () => {
    if (!state.admin) forbidden();
    return { userId: 1, ownerKey: 'admin', isAdmin: true, displayName: 'Admin', viaApiKey: false, wcaId: null };
  } };
});
import { parseHomepageSettings, registerHomepageRoutes, selectHomepageSlides } from '../src/platform/catalog/homepage-routes.js';

const app = platformRouter();
registerHomepageRoutes(app);
const content = (type: PlatformHomeContent['type'], id: string): PlatformHomeContent => ({ type, id, titleZh: id, titleEn: id, summaryZh: '', summaryEn: '', coverUrl: null });
const course = content('course', 'course-1'), school = content('organization', 'school-1'), event = content('event', 'event-1');
const featured = (item: PlatformHomeContent) => ({ type: item.type, id: item.id, coverUrl: null, startsAt: null, endsAt: null });
const settings: PlatformHomepageSettings = { featuredItems: [featured(course), featured(school)], sections: ['popular', 'weekly', 'event', 'latest'] };
beforeEach(() => { state.admin = false; state.query.mockReset(); });

it('keeps manually selected content first, omits unavailable or expired sources, and deduplicates ranked winners', () => {
  const now = Date.parse('2026-11-18T12:00:00Z');
  const configured: PlatformHomepageSettings = { ...settings, featuredItems: [
    { ...featured(course), coverUrl: '/cover.webp' }, { ...featured(event), startsAt: '2026-11-19T00:00:00Z' },
    { ...featured(school), endsAt: '2026-11-18T00:00:00Z' }, featured(content('teacher', 'hidden')),
  ] };
  expect(selectHomepageSlides(configured, [
    { type: 'course', id: course.id, section: 'popular' }, { type: 'course', id: course.id, section: 'weekly' },
    { type: 'event', id: event.id, section: 'event' },
  ], [course, school, event], now)).toEqual([
    { ...course, section: 'featured', coverUrl: '/cover.webp' }, { ...event, section: 'event' },
  ]);
  expect(selectHomepageSlides({ featuredItems: [], sections: [] }, [], [], now)).toEqual([]);
});

it('rejects duplicate, unknown, invalid image URL and reversed schedule configuration', () => {
  expect(parseHomepageSettings(settings)).toEqual(settings);
  expect(() => parseHomepageSettings({ ...settings, sections: ['popular', 'popular'] })).toThrow();
  expect(() => parseHomepageSettings({ ...settings, featuredItems: [featured(course), featured(course)] })).toThrow();
  expect(() => parseHomepageSettings({ ...settings, featuredItems: [{ ...featured(course), type: 'private' }] })).toThrow();
  expect(() => parseHomepageSettings({ ...settings, featuredItems: [{ ...featured(course), coverUrl: 'javascript:alert(1)' }] })).toThrow();
  expect(() => parseHomepageSettings({ ...settings, featuredItems: [{ ...featured(course), startsAt: '2026-11-19T00:00:00Z', endsAt: '2026-11-18T00:00:00Z' }] })).toThrow();
});

it('serves public references only and ranks from distinct active learners and published content', async () => {
  state.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM platform_homepage_settings')) return [settings];
    if (sql.includes('WITH learner_counts')) return [{ section: 'popular', type: 'course', id: course.id }, { section: 'event', type: 'event', id: event.id }];
    if (sql.includes('WITH requested')) return [course, school, event];
    return [];
  });
  const response = await app.request('/platform/homepage');
  expect(response.status).toBe(200);
  expect((await response.json()).items.map((item: PlatformHomeContent) => item.id)).toEqual([course.id, school.id, event.id]);
  const sql = state.query.mock.calls.map(call => call[0]).join('\n');
  expect(sql).toContain('COUNT(DISTINCT e.user_id)');
  expect(sql).toContain("AT TIME ZONE 'Asia/Shanghai'");
  expect(sql).toContain('d.is_visible=TRUE');
  expect(sql).toContain("e.status='published' AND e.ends_at>NOW()");
  expect(sql).not.toContain('FROM organizations');
});

it('protects the administrator settings and saves JSON arrays without double encoding', async () => {
  expect((await app.request('/platform/admin/homepage')).status).toBe(403);
  expect((await app.request('/platform/admin/homepage', { method: 'PUT', body: JSON.stringify(settings) })).status).toBe(403);
  expect(state.query).not.toHaveBeenCalled();
  state.admin = true;
  let requestHash = '';
  state.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('INSERT INTO platform_idempotency_requests')) { requestHash = String(params[4]); return [{ id: 'request' }]; }
    if (sql.includes('SELECT id::text AS id, encode(request_hash')) return [{ id: 'request', request_hash_hex: requestHash, state: 'processing' }];
    if (sql.includes('WITH requested')) return [course, school];
    return [];
  });
  const response = await app.request('/platform/admin/homepage', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'homepage-test-1' }, body: JSON.stringify(settings) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ settings });
  expect(state.query.mock.calls.find(call => call[0].includes('INSERT INTO platform_homepage_settings'))?.[1]).toEqual([settings.featuredItems, settings.sections]);
});
