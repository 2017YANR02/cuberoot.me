import { describe, expect, it } from 'vitest';

import {
  DouyinMiniProgramError,
  parseDouyinMiniProgramSession,
} from '../src/utils/douyin_miniprogram';

describe('parseDouyinMiniProgramSession', () => {
  it('keeps only openid and rejects expired or malformed responses', () => {
    expect(parseDouyinMiniProgramSession({
      err_no: 0,
      data: {
        openid: 'open-id',
        anonymous_openid: 'anonymous-id',
        session_key: 'secret-session-key',
      },
    })).toEqual({ openid: 'open-id' });

    expect(() => parseDouyinMiniProgramSession({ err_no: 40018 }))
      .toThrow(DouyinMiniProgramError);
    expect(() => parseDouyinMiniProgramSession({ err_no: 0, data: {} }))
      .toThrow('douyin response has invalid openid');
    expect(() => parseDouyinMiniProgramSession({ data: { openid: 'open-id' } }))
      .toThrow('douyin response has no numeric err_no');
    expect(() => parseDouyinMiniProgramSession({ err_no: 0, data: { openid: 'open\nid' } }))
      .toThrow('douyin response has invalid openid');
  });
});
