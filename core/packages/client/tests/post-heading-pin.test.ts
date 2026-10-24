// @vitest-environment jsdom
import { act, createElement, type ReactNode, type AnchorHTMLAttributes } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-store', () => ({ useIsAdmin: () => true }));
vi.mock('@/hooks/useT', () => {
  const t = (zh: string) => zh;
  return { useT: () => t };
});
vi.mock('@/components/AppLink', () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement('a', props) }));
vi.mock('@/components/Tooltip', () => ({ Tooltip: ({ children }: { children: (props: object) => ReactNode }) => children({}) }));
vi.mock('@/lib/page-notices-api', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/page-notices-api')>(),
  fetchPageNotices: vi.fn(), featureHomepagePost: vi.fn(), deletePageNotice: vi.fn(),
}));
import { PostFeatureAction } from '@/app/[lang]/regulation/post/_components/PostHeading';
import { fetchPageNotices, featureHomepagePost, deletePageNotice, type PageNotice } from '@/lib/page-notices-api';

const post = { id: 'example', title: { zh: '公告', en: 'Post' } };
const pinned: PageNotice = { id: 12, path: '/', placement: 'home_featured', href: '/regulation/post/example', level: 'info', bodyZh: '公告', bodyEn: 'Post', enabled: true, dismissible: false, updatedAt: '' };
let root: ReturnType<typeof createRoot> | undefined;
beforeEach(() => {
  vi.resetAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root?.unmount());
  document.body.innerHTML = '';
});
async function render() {
  const host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(PostFeatureAction, { post })));
  return host.querySelector<HTMLButtonElement>('button')!;
}
it('restores the pin after remount and removes only that post when toggled', async () => {
  vi.mocked(fetchPageNotices).mockResolvedValue([pinned, { ...pinned, id: 13, href: '/regulation/post/other' }]);
  vi.mocked(deletePageNotice).mockResolvedValue();
  const button = await render();
  expect(button.textContent).toBe('');
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(document.body.textContent).not.toContain('一键设置');
  await act(async () => button.click());
  expect(deletePageNotice).toHaveBeenCalledExactlyOnceWith(12);
  expect(button.getAttribute('aria-pressed')).toBe('false');
  expect(featureHomepagePost).not.toHaveBeenCalled();
});
it('pins an unpinned article and retains its pin if unpinning fails', async () => {
  vi.mocked(fetchPageNotices).mockResolvedValue([]);
  vi.mocked(featureHomepagePost).mockResolvedValue(pinned);
  const button = await render();
  expect(button.getAttribute('aria-pressed')).toBe('false');
  await act(async () => button.click());
  expect(featureHomepagePost).toHaveBeenCalledExactlyOnceWith(post);
  expect(button.getAttribute('aria-pressed')).toBe('true');
  vi.mocked(deletePageNotice).mockRejectedValue(new Error('Offline'));
  await act(async () => button.click());
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('Offline');
});
