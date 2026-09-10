import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Mini Program web-view bridge', () => {
  it('opens native WeChat order checkout without forwarding credentials or an arbitrary URL', async () => {
    const navigateTo = vi.fn((options: { success(): void }) => options.success());
    vi.stubGlobal('window', { clearTimeout, setTimeout, navigator: { userAgent: 'MicroMessenger miniProgram' }, wx: { miniProgram: { navigateTo } } });
    const { openMiniProgramOrderPayment } = await import('@/lib/miniprogram-bridge');
    const id = '11111111-1111-4111-8111-111111111111';
    await expect(openMiniProgramOrderPayment(id)).resolves.toBe(true);
    expect(navigateTo.mock.calls[0][0]).toMatchObject({ url: `/pages/payment/index?orderId=${id}` });
    await expect(openMiniProgramOrderPayment('https://example.com')).resolves.toBe(false);
    expect(navigateTo).toHaveBeenCalledTimes(1);
  });

  it.each(['toutiaomicroapp', 'MicroMessenger'])('does not invoke WeChat payment in unsupported container %s', async (userAgent) => {
    const navigateTo = vi.fn();
    vi.stubGlobal('window', { clearTimeout, setTimeout, navigator: { userAgent }, wx: { miniProgram: { navigateTo, getEnv: (callback: (env: object) => void) => callback({ miniprogram: false }) } } });
    const { openMiniProgramOrderPayment } = await import('@/lib/miniprogram-bridge');
    await expect(openMiniProgramOrderPayment('11111111-1111-4111-8111-111111111111')).resolves.toBe(false);
    expect(navigateTo).not.toHaveBeenCalled();
  });
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

  it.each([
    'MicroMessenger miniProgram',
    'MicroMessenger',
    'toutiaomicroapp',
  ])('blocks external commerce in embedded candidate: %s', async (userAgent) => {
    vi.stubGlobal('window', {
      navigator: { userAgent },
    });
    const { isMiniProgramCommerceRestricted } = await import('@/lib/miniprogram-bridge');

    expect(isMiniProgramCommerceRestricted()).toBe(true);
  });

  it('keeps external commerce available in an ordinary browser', async () => {
    vi.stubGlobal('window', {
      navigator: { userAgent: 'Mozilla/5.0' },
    });
    const { isMiniProgramCommerceRestricted } = await import('@/lib/miniprogram-bridge');

    expect(isMiniProgramCommerceRestricted()).toBe(false);
  });
});
