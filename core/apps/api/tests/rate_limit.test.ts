import { afterEach, expect, it, vi } from 'vitest';
import { checkRateLimit, RateLimitError } from '../src/utils/rate_limit.js';

afterEach(() => vi.useRealTimers());

it('expires accepted requests in a rolling window without extending the ban on rejected retries', () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  for (let i = 0; i < 30; i++) checkRateLimit('rolling');
  const rejected = () => {
    try { checkRateLimit('rolling'); } catch (e) { return e as RateLimitError; }
    throw new Error('Expected rate limit');
  };
  expect(rejected().retryAfterSeconds).toBe(60);
  vi.setSystemTime(5_000);
  expect(rejected().retryAfterSeconds).toBe(55);
  vi.setSystemTime(59_999);
  expect(rejected().retryAfterSeconds).toBe(1);
  vi.setSystemTime(60_000);
  expect(() => checkRateLimit('rolling')).not.toThrow();
});

it('keeps named quotas independent from the default quota and each other', () => {
  checkRateLimit('same', { bucket: 'first', max: 1 });
  expect(() => checkRateLimit('same', { bucket: 'first', max: 1 })).toThrow(RateLimitError);
  expect(() => checkRateLimit('same', { bucket: 'second', max: 1 })).not.toThrow();
  expect(() => checkRateLimit('same')).not.toThrow();
  expect(() => checkRateLimit('different', { bucket: 'first', max: 1 })).not.toThrow();
});
