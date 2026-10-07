import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Mini Program web-view bridge', () => {
  it.each(['MicroMessenger miniProgram', 'MicroMessenger'])('returns to the native Tools tab from %s', async (userAgent) => {
    const switchTab = vi.fn();
    const navigateTo = vi.fn((options: { success(): void }) => options.success());
    vi.stubGlobal('window', {
      clearTimeout, setTimeout, navigator: { userAgent },
      wx: { miniProgram: {
        navigateTo, switchTab,
        getEnv: (callback: (env: object) => void) => callback({ miniprogram: true }),
      } },
    });
    const { openMiniProgramHome } = await import('@/lib/miniprogram-bridge');
    await expect(openMiniProgramHome()).resolves.toBe(true);
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/web/index?nativeTab=tools&path=%2F' }));
    await expect(openMiniProgramHome('account')).resolves.toBe(true);
    expect(navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/pages/web/index?nativeTab=account' }));
  });

  it('keeps ordinary WeChat browser home navigation on the website', async () => {
    const switchTab = vi.fn();
    vi.stubGlobal('window', {
      clearTimeout, setTimeout, navigator: { userAgent: 'MicroMessenger' },
      wx: { miniProgram: {
        navigateTo: vi.fn(), switchTab,
        getEnv: (callback: (env: object) => void) => callback({ miniprogram: false }),
      } },
    });
    const { openMiniProgramHome } = await import('@/lib/miniprogram-bridge');
    await expect(openMiniProgramHome()).resolves.toBe(false);
    expect(switchTab).not.toHaveBeenCalled();
  });

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
    vi.useRealTimers();
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
    'toutiaomicroapp',
  ])('blocks external commerce in a confirmed Mini Program: %s', async (userAgent) => {
    vi.stubGlobal('window', {
      navigator: { userAgent },
    });
    const { isMiniProgramCommerceRestricted } = await import('@/lib/miniprogram-bridge');

    await expect(isMiniProgramCommerceRestricted()).resolves.toBe(true);
  });

  it('keeps external commerce available in an ordinary browser', async () => {
    vi.stubGlobal('window', {
      navigator: { userAgent: 'Mozilla/5.0' },
    });
    const { isMiniProgramCommerceRestricted } = await import('@/lib/miniprogram-bridge');

    await expect(isMiniProgramCommerceRestricted()).resolves.toBe(false);
  });

  it('restricts a runtime-marked Mini Program even without a user-agent marker', async () => {
    vi.stubGlobal('window', {
      __wxjs_environment: 'miniprogram',
      navigator: { userAgent: 'MicroMessenger' },
    });
    const { isMiniProgramCommerceRestricted } = await import('@/lib/miniprogram-bridge');
    await expect(isMiniProgramCommerceRestricted()).resolves.toBe(true);
  });

  it.each([false, true])('uses getEnv instead of mistaking the iOS WeChat browser for a Mini Program (%s)', async (miniprogram) => {
    let reply!: (env: { miniprogram: boolean }) => void;
    const getEnv = vi.fn((callback: typeof reply) => { reply = callback; });
    vi.stubGlobal('window', {
      clearTimeout, setTimeout,
      navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) MicroMessenger/8.0' },
      wx: { miniProgram: { navigateTo: vi.fn(), getEnv } },
    });
    const { isMiniProgramCommerceRestricted } = await import('@/lib/miniprogram-bridge');
    const resolved = vi.fn();
    const result = isMiniProgramCommerceRestricted().then(resolved);
    await vi.waitFor(() => expect(getEnv).toHaveBeenCalledTimes(1));
    expect(resolved).not.toHaveBeenCalled();
    reply({ miniprogram });
    await result;
    expect(resolved).toHaveBeenCalledWith(miniprogram);
  });

  it('does not classify an ordinary browser as a Mini Program just because the SDK is installed', async () => {
    vi.stubGlobal('window', {
      clearTimeout, setTimeout,
      navigator: { userAgent: 'Mozilla/5.0' },
      wx: { miniProgram: { navigateTo: vi.fn(), getEnv: (cb: (env: object) => void) => cb({ miniprogram: false }) } },
    });
    const { isMiniProgramCommerceRestricted } = await import('@/lib/miniprogram-bridge');
    await expect(isMiniProgramCommerceRestricted()).resolves.toBe(false);
  });

  it('does not leave checkout stuck when an unmarked SDK never responds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      clearTimeout, setTimeout,
      navigator: { userAgent: 'MicroMessenger' },
      wx: { miniProgram: { navigateTo: vi.fn(), getEnv: vi.fn() } },
    });
    const { isMiniProgramCommerceRestricted } = await import('@/lib/miniprogram-bridge');
    const result = isMiniProgramCommerceRestricted();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toBe(false);
  });
});
