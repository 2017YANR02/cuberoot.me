import { afterEach, describe, expect, it, vi } from 'vitest';

describe('required Mini Program session navigation', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('opens the existing account page and resumes the original tab after sign-in', async () => {
    const switchTab = vi.fn();
    vi.stubGlobal('wx', { switchTab });
    const {
      openRequiredSessionLogin,
      resumeRequiredSessionDestination,
    } = await import('../src/lib/required-session');

    openRequiredSessionLogin({ tab: true, url: '/pages/tools/index' });
    expect(switchTab).toHaveBeenLastCalledWith({ url: '/pages/account/index' });

    expect(resumeRequiredSessionDestination()).toBe(true);
    expect(switchTab).toHaveBeenLastCalledWith({
      fail: expect.any(Function),
      url: '/pages/tools/index',
    });
    expect(resumeRequiredSessionDestination()).toBe(false);
  });

  it('resumes a native non-tab page with its original query', async () => {
    const navigateTo = vi.fn();
    vi.stubGlobal('wx', { navigateTo, switchTab: vi.fn() });
    const {
      openRequiredSessionLogin,
      resumeRequiredSessionDestination,
    } = await import('../src/lib/required-session');

    openRequiredSessionLogin({
      tab: false,
      url: '/pages/smart-cube/index?token=relay%20token',
    });
    expect(resumeRequiredSessionDestination()).toBe(true);
    expect(navigateTo).toHaveBeenCalledWith({
      fail: expect.any(Function),
      url: '/pages/smart-cube/index?token=relay%20token',
    });
  });
});
