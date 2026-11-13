import { describe, expect, it } from 'vitest';
import { approvedQrTarget, idempotencyKey, requestHash } from '../src/platform/validation.js';
import { PlatformApiError, badRequest } from '../src/platform/errors.js';
import { platformRouter } from '../src/platform/http.js';
import { addMembershipPeriod } from '../src/platform/membership-period.js';
import { safeMoney, safeSignedMoney } from '../src/platform/commerce/amounts.js';

describe('Platform boundary helpers', () => {
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
