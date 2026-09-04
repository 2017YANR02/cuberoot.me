import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  generateWechatMiniProgramUrlLink,
  WechatMiniProgramError,
  parseWechatMiniProgramSession,
} from '../src/utils/wechat_miniprogram';

afterEach(() => vi.unstubAllGlobals());

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
