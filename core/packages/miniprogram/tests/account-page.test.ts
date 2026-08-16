import { afterEach, describe, expect, it, vi } from 'vitest';

describe('mini program account page', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('opens the allowlisted website account destination', async () => {
    let page: { openAccount(): void } | undefined;
    const navigateTo = vi.fn();

    vi.stubGlobal('wx', { navigateTo });
    vi.stubGlobal('Page', (options: { openAccount(): void }) => {
      page = options;
    });

    await import('../src/pages/account/index');
    expect(page).toBeDefined();
    page?.openAccount();

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=account',
    }));
  });
});
