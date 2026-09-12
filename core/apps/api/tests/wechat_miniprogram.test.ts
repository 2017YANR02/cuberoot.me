import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  generateWechatMiniProgramUrlLink,
  WechatMiniProgramError,
  parseWechatMiniProgramSession,
  parseWechatMiniProgramPhone,
} from '../src/utils/wechat_miniprogram';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

function phoneResponse(overrides: Record<string, unknown> = {}) {
  return { errcode: 0, phone_info: { purePhoneNumber: '13800138000', countryCode: '86',
    watermark: { timestamp: Math.floor(Date.now() / 1000), appid: 'wx-test-app' }, ...overrides } };
}

describe('verified WeChat phone grant', () => {
  it('normalizes into the existing +86 identity namespace and accepts numeric country codes', () => {
    expect(parseWechatMiniProgramPhone(phoneResponse(), 'wx-test-app')).toBe('+8613800138000');
    expect(parseWechatMiniProgramPhone(phoneResponse({ countryCode: 86 }), 'wx-test-app')).toBe('+8613800138000');
  });

  it.each([
    { watermark: { appid: 'different-app', timestamp: Math.floor(Date.now() / 1000) } },
    { watermark: { appid: 'wx-test-app', timestamp: 1 } },
    { watermark: { appid: 'wx-test-app', timestamp: Math.floor(Date.now() / 1000) + 120 } },
    { watermark: { appid: 'wx-test-app', timestamp: '123' } },
    { watermark: null }, { purePhoneNumber: '138-0013-8000' },
    { purePhoneNumber: '8613800138000' }, { purePhoneNumber: '123' },
  ])('rejects malformed, stale or cross-app phone claims %#', (overrides) => {
    expect(() => parseWechatMiniProgramPhone(phoneResponse(overrides), 'wx-test-app'))
      .toThrow(WechatMiniProgramError);
  });

  it('does not turn foreign numbers into Chinese identities', () => {
    expect(() => parseWechatMiniProgramPhone(phoneResponse({ countryCode: '1', purePhoneNumber: '13800138000' }), 'wx-test-app'))
      .toThrow(expect.objectContaining({ code: 'unsupported-phone' }));
  });

  it.each([[40029, 'invalid-phone-code'], [40163, 'invalid-phone-code'], [45011, 'rate-limited'],
    [45009, 'rate-limited'], [40226, 'blocked-user'], [-1, 'upstream-unavailable']])('maps upstream error %s without leaking its message', (errcode, code) => {
    expect(() => parseWechatMiniProgramPhone({ errcode, errmsg: 'secret-token-and-phone' }, 'wx-test-app'))
      .toThrow(expect.objectContaining({ code, message: 'wechat phone authorization failed' }));
  });

  it('shares the existing access-token cache and submits the independently verified openid', async () => {
    vi.resetModules();
    vi.stubEnv('WECHAT_MINI_APP_ID', 'wx-test-app');
    const module = await import('../src/utils/wechat_miniprogram');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'sensitive-token', expires_in: 7200 })))
      .mockResolvedValueOnce(new Response(JSON.stringify(phoneResponse())))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url_link: 'https://wxaurl.cn/example' })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(module.exchangeWechatMiniProgramPhoneCode('phone-grant-code', 'server-verified-openid')).resolves.toBe('+8613800138000');
    await module.generateWechatMiniProgramUrlLink('test', 123);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ code: 'phone-grant-code', openid: 'server-verified-openid' });
  });

  it('redacts access-token URL, credentials and upstream body from transport errors', async () => {
    vi.resetModules();
    const module = await import('../src/utils/wechat_miniprogram');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('https://api.weixin.qq.com/?secret=LEAK&access_token=LEAK')));
    await expect(module.exchangeWechatMiniProgramPhoneCode('phone-code', 'openid')).rejects.toMatchObject({
      code: 'upstream-unavailable', message: 'wechat phone service unavailable',
    });
  });
});

describe('parseWechatMiniProgramSession', () => {
  it('keeps unionid and never exposes session_key', () => {
    expect(parseWechatMiniProgramSession({
      openid: 'open-id',
      unionid: 'union-id',
      session_key: 'secret-session-key',
    })).toEqual({ openid: 'open-id', unionid: 'union-id' });
  });

  it('represents an unavailable unionid explicitly', () => {
    expect(parseWechatMiniProgramSession({ openid: 'open-id' })).toEqual({
      openid: 'open-id',
      unionid: null,
    });
  });

  it('rejects WeChat error responses', () => {
    for (const [errcode, code] of [
      [40029, 'invalid-code'],
      [45011, 'rate-limited'],
      [40226, 'blocked-user'],
      [-1, 'upstream-unavailable'],
      [40163, 'upstream-unavailable'],
    ] as const) {
      try {
        parseWechatMiniProgramSession({ errcode, errmsg: 'wechat error' });
        throw new Error('expected WeChat response to be rejected');
      } catch (error) {
        expect(error).toBeInstanceOf(WechatMiniProgramError);
        expect((error as WechatMiniProgramError).code).toBe(code);
      }
    }
  });

  it('rejects malformed successful responses', () => {
    expect(() => parseWechatMiniProgramSession({ unionid: 'union-id' }))
      .toThrow('wechat response has no openid');
  });

  it('generates a release URL Link for the account approval page', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token', expires_in: 7200 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url_link: 'https://wxaurl.cn/example' })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateWechatMiniProgramUrlLink('browserLogin=approval', 1234567890))
      .resolves.toBe('https://wxaurl.cn/example');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      path: 'pages/account/index',
      query: 'browserLogin=approval',
      env_version: 'release',
      expire_type: 0,
      expire_time: 1234567890,
    });
  });
});
