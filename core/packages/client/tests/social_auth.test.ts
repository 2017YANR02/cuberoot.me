import { afterEach, describe, expect, it, vi } from 'vitest';

import { prefersWechatMiniProgramLogin } from '../lib/social-auth';

describe('WeChat login device routing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('recognizes an iPhone requesting the desktop Safari site without trusting its macOS UA', () => {
    vi.stubGlobal('navigator', { maxTouchPoints: 5, userAgent: 'Macintosh Safari' });
    vi.stubGlobal('screen', { width: 393, height: 852 });
    expect(prefersWechatMiniProgramLogin()).toBe(true);

    vi.stubGlobal('navigator', { maxTouchPoints: 0, userAgent: 'Macintosh Safari' });
    expect(prefersWechatMiniProgramLogin()).toBe(false);
  });
});
