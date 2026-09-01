import { describe, expect, it } from 'vitest';
import { doudianParamJson, doudianSign } from '../src/platform/douyin_order_sync.js';

describe('Douyin order API signing', () => {
  it('recursively sorts params and produces the stable HMAC-SHA256 signature', () => {
    const paramJson = doudianParamJson({ z: 2, nested: { z: 2, a: 1 }, a: 1 });
    expect(paramJson).toBe('{"a":1,"nested":{"a":1,"z":2},"z":2}');
    expect(doudianSign('app-key', 'secret', paramJson, '1700000000')).toBe(
      '53e8b7af0b657637e8a8013bb6b2a2c41b5da7f0dff35d98de3e9ae3e9c0a442',
    );
  });
});
