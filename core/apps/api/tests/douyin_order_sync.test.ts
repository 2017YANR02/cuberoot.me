import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDouyinAccessToken,
  doudianEventSign,
  doudianParamJson,
  doudianSign,
} from '../src/platform/douyin_order_sync.js';

afterEach(() => vi.unstubAllGlobals());

describe('Douyin order API signing', () => {
  it('recursively sorts params and produces the stable HMAC-SHA256 signature', () => {
    const paramJson = doudianParamJson({ z: 2, nested: { z: 2, a: 1 }, a: 1 });
    expect(paramJson).toBe('{"a":1,"nested":{"a":1,"z":2},"z":2}');
    expect(doudianSign('app-key', 'secret', paramJson, '1700000000')).toBe(
      '53e8b7af0b657637e8a8013bb6b2a2c41b5da7f0dff35d98de3e9ae3e9c0a442',
    );
  });

  it('signs the exact webhook body using the configured application secret', () => {
    expect(doudianEventSign(
      'app-key',
      'secret',
      '[{"tag":"100","data":"{\\"shop_id\\":123}"}]',
    )).toBe('bed9fab93b667a2213b57ca88150a05e189c1f6e0b334ed34e29ccdb14ead058');
  });

  it('creates a self-use token and schedules refresh one hour before expiry', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      code: 10000,
      data: { access_token: 'token', expires_in: 604800, shop_id: 123 },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createDouyinAccessToken('app-key', 'secret', '123', 1_700_000_000_000)).resolves.toEqual({
      token: 'token',
      refreshAt: 1_700_601_200_000,
    });
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/token/create?');
    expect(new URL(String(url)).searchParams.get('method')).toBe('token.create');
    expect(request?.body).toBe('{"code":"","grant_type":"authorization_self","shop_id":"123"}');
  });
});
