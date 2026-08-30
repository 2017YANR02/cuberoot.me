import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WeChatMiniProgramApi } from '@/lib/wechat-js-sdk';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubWindowTimers(): void {
  vi.stubGlobal('window', { clearTimeout, setTimeout });
}

describe('Mini Program navigation bridge', () => {
  it('resolves successful and failed navigateTo callbacks', async () => {
    stubWindowTimers();
    const { navigateToMiniProgramPage } = await import('@/lib/miniprogram-bridge');
    const succeeded = {
      navigateTo: vi.fn((options) => options.success?.()),
    } satisfies WeChatMiniProgramApi;
    const failed = {
      navigateTo: vi.fn((options) => options.fail?.({ errMsg: 'navigateTo:fail' })),
    } satisfies WeChatMiniProgramApi;

    await expect(navigateToMiniProgramPage(succeeded, '/pages/share/index?key=home'))
      .resolves.toBe(true);
    await expect(navigateToMiniProgramPage(failed, '/pages/share/index?key=home'))
      .resolves.toBe(false);
  });

  it('times out when iOS provides no navigateTo callback', async () => {
    vi.useFakeTimers();
    stubWindowTimers();
    const { navigateToMiniProgramPage } = await import('@/lib/miniprogram-bridge');
    const miniProgram = { navigateTo: vi.fn() } satisfies WeChatMiniProgramApi;

    const navigation = navigateToMiniProgramPage(miniProgram, '/pages/share/index?key=home');
    await vi.advanceTimersByTimeAsync(4_000);

    await expect(navigation).resolves.toBe(false);
  });

  it('reports a synchronous bridge failure', async () => {
    stubWindowTimers();
    const { navigateToMiniProgramPage } = await import('@/lib/miniprogram-bridge');
    const miniProgram = {
      navigateTo: vi.fn(() => { throw new Error('bridge unavailable'); }),
    } satisfies WeChatMiniProgramApi;

    await expect(navigateToMiniProgramPage(miniProgram, '/pages/share/index?key=home'))
      .resolves.toBe(false);
  });
});
