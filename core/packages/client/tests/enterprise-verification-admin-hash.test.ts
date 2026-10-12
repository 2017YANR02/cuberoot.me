// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useT', () => {
  const t = (_zh: string, en: string) => en;
  return { useT: () => t };
});
vi.mock('@/lib/enterprise-verification-api', () => ({
  getEnterpriseBankSettings: vi.fn().mockResolvedValue({ settings: null, keyReady: false }),
  listEnterpriseApplications: vi.fn().mockResolvedValue({ applications: [], hasMore: false }),
  saveEnterpriseBankSettings: vi.fn(),
  getEnterpriseApplicationMaterials: vi.fn(),
  reviewEnterpriseApplication: vi.fn(),
  recordEnterpriseRefund: vi.fn(),
  recordEnterpriseReceipt: vi.fn(),
  revokeEnterpriseVerification: vi.fn(),
}));

import EnterpriseVerificationAdmin from '@/app/[lang]/org/_components/EnterpriseVerificationAdmin';
import { getEnterpriseBankSettings, listEnterpriseApplications } from '@/lib/enterprise-verification-api';

describe('enterprise administrator anchor navigation with the shared hash hook', () => {
  let host: HTMLDivElement;
  let root: Root;
  const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  const scroll = vi.fn(function (this: HTMLElement, options: ScrollIntoViewOptions) {
    return {
      id: this.id,
      expanded: this.querySelector('[aria-controls="enterprise-admin-content"]')?.getAttribute('aria-expanded'),
      contentPresent: this.querySelector('#enterprise-admin-content') !== null,
      options,
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    window.history.replaceState(null, '', '/org');
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    vi.unstubAllGlobals();
  });

  async function mount(hash: string) {
    window.history.replaceState(null, '', `/org${hash}`);
    await act(async () => root.render(createElement('div', null,
      createElement('section', { id: 'other-section' }, 'Another organization section'),
      createElement(EnterpriseVerificationAdmin),
    )));
  }

  async function navigate(hash: string) {
    await act(async () => {
      window.history.replaceState(null, '', `/org${hash}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  }

  function toggle() {
    return host.querySelector<HTMLButtonElement>('[aria-controls="enterprise-admin-content"]')!;
  }

  it('opens a direct deep link before scrolling and allows the administrator to collapse it', async () => {
    await mount('#enterprise-admin');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.results[0].value).toEqual({
      id: 'enterprise-admin', expanded: 'true', contentPresent: true,
      options: { behavior: 'auto', block: 'start' },
    });
    await act(async () => toggle().click());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('#enterprise-admin-content')).toBeNull();
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#enterprise-admin');
  });

  it('ignores other page anchors without opening, fetching or scrolling the administrator panel', async () => {
    await mount('#other-section');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(scroll).not.toHaveBeenCalled();
    expect(getEnterpriseBankSettings).not.toHaveBeenCalled();
    expect(listEnterpriseApplications).not.toHaveBeenCalled();
  });

  it('opens and scrolls again after navigating away from the panel and returning to its anchor', async () => {
    await mount('#enterprise-admin');
    await act(async () => toggle().click());
    await navigate('#other-section');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(scroll).toHaveBeenCalledTimes(1);
    await navigate('#enterprise-admin');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(scroll.mock.results[1].value).toEqual({
      id: 'enterprise-admin', expanded: 'true', contentPresent: true,
      options: { behavior: 'smooth', block: 'start' },
    });
  });
});
