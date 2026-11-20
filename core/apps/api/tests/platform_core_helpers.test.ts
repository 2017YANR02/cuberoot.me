import { describe, expect, it, vi } from 'vitest';
import { approvedQrTarget, idempotencyKey, requestHash } from '../src/platform/validation.js';
import { PlatformApiError, badRequest } from '../src/platform/errors.js';
import { platformRouter } from '../src/platform/http.js';
import { addMembershipPeriod } from '../src/platform/membership-period.js';
import { safeMoney, safeSignedMoney } from '../src/platform/commerce/amounts.js';
import { courseFields } from '../src/platform/catalog/course-fields.js';
import { saveCourseTrialLessonSelection } from '../src/platform/catalog/course-routes.js';

describe('Platform boundary helpers', () => {
  it('validates and persists explicit trial selections without changing other courses or introductions', async () => {
    const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const intro = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const course = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    expect(courseFields({ presentation: { trialLessonIds: [second, first, first] } }, false).presentation).toEqual({ trialLessonIds: [first, second] });
    expect(() => courseFields({ presentation: { trialLessonIds: ['not-an-id'] } }, false)).toThrow(PlatformApiError);
    const unsafe = vi.fn(async (statement: string, _parameters?: readonly unknown[]) => statement.includes('SELECT l.id') ? [
      { id: first, slug: 'lesson-1' }, { id: second, slug: 'lesson-2' }, { id: intro, slug: 'intro-1' },
    ] : []);
    await saveCourseTrialLessonSelection({ unsafe }, course, [second]);
    expect(unsafe.mock.calls[1]?.[0]).toContain('WHERE course_id = $1::uuid');
    expect(unsafe.mock.calls[1]?.[1]).toEqual([course, [second], [first, second]]);
    unsafe.mockClear();
    await expect(saveCourseTrialLessonSelection({ unsafe }, course, [intro])).rejects.toThrow(PlatformApiError);
    expect(unsafe).toHaveBeenCalledTimes(1);
    unsafe.mockClear();
    await saveCourseTrialLessonSelection({ unsafe }, course, []);
    expect(unsafe.mock.calls[1]?.[1]).toEqual([course, [], [first, second]]);
  });
  it('preserves separate course covers and allows the mobile cover to be cleared', () => {
    const coverUrl = '/images/course-wide.webp';
    const mobileCoverUrl = 'https://static.cuberoot.me/course-portrait.webp';
    expect(courseFields({ presentation: { coverUrl, mobileCoverUrl } }, false).presentation).toEqual({ coverUrl, mobileCoverUrl });
    expect(courseFields({ presentation: { coverUrl, mobileCoverUrl: ' ' } }, false).presentation).toEqual({ coverUrl });
    expect(() => courseFields({ presentation: { mobileCoverUrl: 'data:image/png;base64,abc' } }, false)).toThrow(PlatformApiError);
  });

  it('preserves signed ledger adjustments and rejects unsafe monetary values', () => {
    expect(safeSignedMoney('-125')).toBe(-125);
    expect(safeMoney('125')).toBe(125);
    for (const value of [Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, 1.5]) {
      expect(() => safeMoney(value)).toThrow(PlatformApiError);
      expect(() => safeSignedMoney(value)).toThrow(PlatformApiError);
    }
    expect(() => safeMoney(-1)).toThrow(PlatformApiError);
  });

  it('keeps paid and redeemed memberships on the same UTC calendar across DST', () => {
    const base = new Date('2026-03-08T09:30:00Z');
    expect(addMembershipPeriod(base, 'day', 1)).toBe('2026-03-09T09:30:00.000Z');
    expect(addMembershipPeriod(base, 'month', 1)).toBe('2026-04-08T09:30:00.000Z');
    expect(addMembershipPeriod(base, 'year', 1)).toBe('2027-03-08T09:30:00.000Z');
    expect(addMembershipPeriod(base, 'lifetime', 1)).toBeNull();
    expect(base.toISOString()).toBe('2026-03-08T09:30:00.000Z');
  });

  it('accepts only safe QR targets', () => {
    expect(approvedQrTarget('/platform/courses/basic')).toBe('/platform/courses/basic');
    expect(approvedQrTarget('https://cuberoot.me/platform')).toBe('https://cuberoot.me/platform');
    expect(() => approvedQrTarget('//evil.example/path')).toThrow(PlatformApiError);
    expect(() => approvedQrTarget('javascript:alert(1)')).toThrow(PlatformApiError);
    expect(() => approvedQrTarget('data:text/html,test')).toThrow(PlatformApiError);
    expect(() => approvedQrTarget('https://user:secret@example.com')).toThrow(PlatformApiError);
  });

  it('hashes semantically identical object payloads identically while scoping actor and operation', () => {
    const a = requestHash('order.create', 7, { items: [{ quantity: 1, id: 'c1' }], coupon: null });
    const b = requestHash('order.create', 7, { coupon: null, items: [{ id: 'c1', quantity: 1 }] });
    expect(a).toBe(b);
    expect(requestHash('order.cancel', 7, { coupon: null, items: [{ id: 'c1', quantity: 1 }] })).not.toBe(a);
    expect(requestHash('order.create', 8, { coupon: null, items: [{ id: 'c1', quantity: 1 }] })).not.toBe(a);
  });

  it('requires a bounded visible-ASCII idempotency key', () => {
    const route = platformRouter();
    route.post('/check', (c) => c.json({ key: idempotencyKey(c) }));
    expect(() => idempotencyKey({ req: { header: () => undefined } } as never)).toThrow(PlatformApiError);
    expect(() => idempotencyKey({ req: { header: () => 'short' } } as never)).toThrow(PlatformApiError);
    expect(() => idempotencyKey({ req: { header: () => 'valid-key-123' } } as never)).not.toThrow();
  });

  it('serializes Platform errors without swallowing unexpected errors', async () => {
    const route = platformRouter();
    route.get('/bad', () => badRequest('invalid input', { field: 'title' }));
    const response = await route.request('/bad');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'BAD_REQUEST', message: 'invalid input', details: { field: 'title' } },
    });
  });
});
