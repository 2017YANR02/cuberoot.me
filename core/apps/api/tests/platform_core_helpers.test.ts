import { describe, expect, it } from 'vitest';
import { approvedQrTarget, idempotencyKey, requestHash } from '../src/platform/validation.js';
import { PlatformApiError, badRequest } from '../src/platform/errors.js';
import { platformRouter } from '../src/platform/http.js';

describe('Platform boundary helpers', () => {
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
