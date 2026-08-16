import { afterEach, describe, expect, it, vi } from 'vitest';

interface AccountPage {
  openAccount(): void;
  openPrivacy(): void;
}

async function loadPage(wxApi: Record<string, unknown>): Promise<AccountPage> {
  let page: AccountPage | undefined;
  vi.stubGlobal('wx', wxApi);
  vi.stubGlobal('Page', (options: AccountPage) => {
    page = options;
  });
  await import('../src/pages/account/index');
  if (!page) throw new Error('account page was not registered');
  return page;
}

describe('mini program account page', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('opens the allowlisted website account destination', async () => {
    const navigateTo = vi.fn();
    const page = await loadPage({ navigateTo });
    page.openAccount();

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=account',
    }));
  });

  it('opens the platform privacy contract when it is available', async () => {
    const navigateTo = vi.fn();
    const openPrivacyContract = vi.fn();
    const page = await loadPage({ navigateTo, openPrivacyContract });

    page.openPrivacy();

    expect(openPrivacyContract).toHaveBeenCalledOnce();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('falls back to the canonical website policy on unsupported base libraries', async () => {
    const navigateTo = vi.fn();
    const page = await loadPage({ navigateTo });

    page.openPrivacy();

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=privacy',
    }));
  });

  it('falls back to the canonical website policy when the platform contract cannot open', async () => {
    const navigateTo = vi.fn();
    const openPrivacyContract = vi.fn((options: { fail(): void }) => options.fail());
    const page = await loadPage({ navigateTo, openPrivacyContract });

    page.openPrivacy();

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/web/index?key=privacy',
    }));
  });
});
