import { expect, it } from 'vitest';
import { findUnsupportedPlatformReference } from '../scripts/douyin-platform-check.mjs';

it('distinguishes a bundled local named wx from the WeChat API in the same file', async () => {
  const local = 'function pattern() { var wx = /U/; return wx.source; }';
  await expect(findUnsupportedPlatformReference(local, '.js')).resolves.toBeUndefined();
  for (const expression of ['wx.request({})', 'globalThis.wx.request({})']) {
    await expect(findUnsupportedPlatformReference(local + expression, '.js')).resolves.toBeTruthy();
  }
  await expect(findUnsupportedPlatformReference('{{ wx.request() }}', '.ttml')).resolves.toBeTruthy();
});
