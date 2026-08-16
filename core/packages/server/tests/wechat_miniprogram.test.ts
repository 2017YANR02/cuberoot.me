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
    expect(() => parseWechatMiniProgramSession({ errcode: 40029, errmsg: 'invalid code' }))
      .toThrow(WechatMiniProgramError);
  });

  it('rejects malformed successful responses', () => {
    expect(() => parseWechatMiniProgramSession({ unionid: 'union-id' }))
      .toThrow('wechat response has no openid');
  });
});
