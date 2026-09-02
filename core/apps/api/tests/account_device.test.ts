import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));

import { captureAccountDevice } from '../src/utils/account_device.js';
import { classifyUserAgent } from '../src/utils/user_agent.js';

const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
const IPHONE_WECHAT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.76';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 15; Pixel Tablet) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';

describe('account latest-device classification', () => {
  beforeEach(() => mocks.query.mockReset());

  it('classifies desktop, mobile container, and tablet user agents', () => {
    expect(classifyUserAgent(WINDOWS_CHROME)).toMatchObject({
      deviceType: 'desktop', osFamily: 'windows', browserFamily: 'chrome', browserMajor: 140, container: 'browser',
    });
    expect(classifyUserAgent(IPHONE_WECHAT)).toMatchObject({
      deviceType: 'phone', osFamily: 'ios', osMajor: 18, browserFamily: 'wechat', browserMajor: 8, container: 'wechat',
    });
    expect(classifyUserAgent(ANDROID_TABLET)).toMatchObject({
      deviceType: 'tablet', osFamily: 'android', osMajor: 15, browserFamily: 'chrome', container: 'browser',
    });
  });

  it('stores normalized dimensions without retaining the raw user agent', async () => {
    mocks.query.mockResolvedValue([]);
    await captureAccountDevice(42, WINDOWS_CHROME);

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0]?.[1]).toEqual([42, 'desktop', 'windows', 10, 'chrome', 140, 'browser']);
    expect(mocks.query.mock.calls.flat().join(' ')).not.toContain(WINDOWS_CHROME);
  });

  it('ignores empty or invalid capture inputs', async () => {
    await captureAccountDevice(0, WINDOWS_CHROME);
    await captureAccountDevice(42, '');
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
