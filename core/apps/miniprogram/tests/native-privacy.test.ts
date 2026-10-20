import { afterEach, expect, it, vi } from 'vitest';
import { PRIVACY_DOCUMENT, type PrivacyNode } from '@cuberoot/shared/privacy';

vi.mock('../src/lib/appearance', () => ({ applyNativeAppearance: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it.each(['zh', 'en'] as const)('renders the full shared policy and copies its links in %s', async locale => {
  let options: any;
  const setClipboardData = vi.fn();
  vi.stubGlobal('wx', { getStorageSync: () => locale, getAppBaseInfo: () => ({ language: locale }), setNavigationBarTitle: vi.fn(), setClipboardData });
  vi.stubGlobal('Page', (value: unknown) => { options = value; });
  await import('../src/pages/privacy/index');
  const page = { ...options, data: { ...options.data }, setData(value: unknown) { Object.assign(this.data, value); } };
  page.onShow();
  function text(node: PrivacyNode): string {
    return 'zh' in node ? node[locale] : node.children.map(text).join('');
  }
  expect(page.data.blocks.map((block: { text: string }) => block.text).join('')).toBe(PRIVACY_DOCUMENT.map(text).join(''));
  expect(page.data.links.map((link: { value: string }) => link.value)).toContain('yrmfxc@gmail.com');
  page.copyLink({ currentTarget: { dataset: { index: 0 } } });
  expect(setClipboardData).toHaveBeenCalledWith({ data: page.data.links[0].value });
});
