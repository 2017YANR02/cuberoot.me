import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Mini Program web-view bridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('notifies the native session store and returns after website logout', async () => {
    const postMessage = vi.fn();
    const navigateBack = vi.fn();
    vi.stubGlobal('window', {
      clearTimeout,
      navigator: { userAgent: 'MicroMessenger miniProgram' },
      setTimeout,
      wx: {
        miniProgram: {
          navigateBack,
          navigateTo: vi.fn(),
          postMessage,
        },
      },
    });
    const { notifyMiniProgramLogout } = await import('@/lib/miniprogram-bridge');

    await expect(notifyMiniProgramLogout()).resolves.toBe(true);
    expect(postMessage).toHaveBeenCalledWith({
      data: { type: 'cuberoot:session', action: 'logout' },
    });
    expect(navigateBack).toHaveBeenCalledWith({ delta: 1 });
    expect(postMessage.mock.invocationCallOrder[0]).toBeLessThan(
      navigateBack.mock.invocationCallOrder[0],
    );
  });

  it('does nothing in an ordinary browser', async () => {
    const postMessage = vi.fn();
    vi.stubGlobal('window', {
      clearTimeout,
      navigator: { userAgent: 'Mozilla/5.0' },
      setTimeout,
      wx: { miniProgram: { navigateTo: vi.fn(), postMessage } },
    });
    const { notifyMiniProgramLogout } = await import('@/lib/miniprogram-bridge');

    await expect(notifyMiniProgramLogout()).resolves.toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });
});
