import { describe, expect, it } from 'vitest';

import {
  WechatMiniProgramError,
  parseWechatMiniProgramSession,
} from '../src/utils/wechat_miniprogram';

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
});
