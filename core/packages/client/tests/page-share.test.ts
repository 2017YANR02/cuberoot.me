// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { publicPageSharePath, decodePageShareMessage } from '@cuberoot/shared/page-share';
import { copyPageLink, currentPageShare, syncMiniProgramPageShare } from '@/lib/page-share';
import { PageShareModal } from '@/components/WeChatPcShareModal';

vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: string }) => zh }));
const bridge = vi.hoisted(() => ({ postMessage: vi.fn(), load: vi.fn(), confirm: vi.fn() }));
vi.mock('@/lib/miniprogram-bridge', () => ({
  mayUseMiniProgramBridge: () => true,
  isMiniProgramWebView: () => true,
  loadMiniProgramNavigationApi: bridge.load,
  confirmMiniProgramEnvironment: bridge.confirm,
}));
vi.mock('@/lib/wechat-share', () => ({ isInWeChat: () => true }));
vi.mock('@/lib/wechat-pc-opensdk', () => ({ shareCurrentPageToWeChat: vi.fn(), WeChatPcShareError: Error }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

it.each([
  ['/zh/math/probability?tab=pll#orbit', '/zh/math/probability?tab=pll#orbit'],
  ['https://www.cuberoot.me/math/group#section', '/math/group#section'],
  ['/zh/math/probability?ticket=secret&tab=oll&%74oken=hidden#wechat_redirect&orbit', '/zh/math/probability?tab=oll#orbit'],
  ['/math?event=333#douyin_redirect&ticket=hidden&table', '/math?event=333#table'],
  ['/wca/person?q=%E8%80%BF&sort=rank', '/wca/person?q=%E8%80%BF&sort=rank'],
  ['/zh/alg/3bld/lookup?code=AB&mode=edge', '/zh/alg/3bld/lookup?code=AB&mode=edge'],
  ['/scramble/solver?state=UUUFFF', '/scramble/solver?state=UUUFFF'],
  ['/zh/dev/auth#mini-title', '/zh/dev/auth#mini-title'],
  ['/zh/org/example/classes?class=42', '/zh/org/example/classes?class=42'],
  ['/zh/learn/assignments/42', '/zh/learn/assignments/42'],
  ['/zh/account?view=signin&ticket=secret', '/zh/account?view=signin'],
  ['/admin/users', '/admin/users'],
  ['/recon/submit/42', '/recon/submit/42'],
  ['/docs/edit?id=42', '/docs/edit?id=42'],
  ['/zh/%61ccount', '/zh/%61ccount'],
])('keeps public state and strips internal parameters: %s', (input, expected) => {
  expect(publicPageSharePath(input)).toBe(expected);
});

it.each([
  undefined, null, '', '//evil.test', 'https://evil.test/zh/math', 'https://cuberoot.me.evil.test/math',
  'https://cuberoot.me@evil.test/math', '/\\evil.test', '/zh/auth/miniprogram#ticket=secret',
  '/auth/callback?code=secret', '/zh/math/../account',
  '/zh/math/%2e%2e/account', '/zh/%252e%252e/math', '/zh/%2f%2fevil',
  '/zh/math%3fnext=evil', '/zh/math\n', '/zh/%00math', '/math?%=broken',
])('rejects unsafe destinations and authentication callbacks: %s', input => {
  expect(publicPageSharePath(input)).toBeNull();
});

it('validates title messages and rejects authentication callbacks', () => {
  expect(decodePageShareMessage({ type: 'cuberoot:page-share', path: '/zh/math#wechat_redirect', title: '  数学\n ' }))
    .toEqual({ type: 'cuberoot:page-share', path: '/zh/math', title: '数学' });
  expect(decodePageShareMessage({ type: 'cuberoot:page-share', path: '/auth/callback', title: 'Account' })).toBeNull();
  expect(decodePageShareMessage({ type: 'logout', path: '/math', title: 'Math' })).toBeNull();
});

it('copies the canonical public URL, preserving language, query and anchor', async () => {
  window.history.replaceState(null, '', '/zh/math/probability?tab=pll&ticket=secret#wechat_redirect&orbit');
  document.title = '情况概率';
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  expect(currentPageShare()).toEqual({ url: 'https://cuberoot.me/zh/math/probability?tab=pll#orbit', title: '情况概率' });
  expect(await copyPageLink(currentPageShare()!.url)).toBe(true);
  expect(writeText).toHaveBeenCalledWith('https://cuberoot.me/zh/math/probability?tab=pll#orbit');
});

it.each([true, false])('reports the actual fallback result (%s) and restores focus', async copied => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error()) } });
  document.execCommand = vi.fn(() => copied);
  const button = document.createElement('button'); document.body.append(button); button.focus();
  expect(await copyPageLink('https://cuberoot.me/math')).toBe(copied);
  expect(document.activeElement).toBe(button);
  expect(document.querySelector('textarea')).toBeNull();
  button.remove();
});

it('sends the latest page after an asynchronous Mini Program bridge load', async () => {
  let loaded!: (api: { postMessage: typeof bridge.postMessage }) => void;
  bridge.load.mockReturnValueOnce(new Promise(resolve => { loaded = resolve; }));
  bridge.confirm.mockResolvedValue(true);
  window.history.replaceState(null, '', '/zh/math');
  const pending = syncMiniProgramPageShare();
  window.history.replaceState(null, '', '/zh/math/probability#wechat_redirect');
  document.title = '情况概率';
  loaded({ postMessage: bridge.postMessage });
  await pending;
  expect(bridge.postMessage).toHaveBeenLastCalledWith({ data: { type: 'cuberoot:page-share', path: 'https://cuberoot.me/zh/math/probability', title: '情况概率' } });
});

it('always offers copy in WeChat and shows a selectable link on clipboard failure', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  document.execCommand = vi.fn(() => false);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PageShareModal, { share: { url: 'https://cuberoot.me/math', title: 'Math' }, onClose: vi.fn() })));
    const copy = [...document.querySelectorAll('button')].find(button => button.textContent === '复制链接')!;
    expect(copy).toBeDefined();
    await act(async () => copy.click());
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('复制失败');
    expect(document.querySelector<HTMLInputElement>('.page-share-url')?.value).toBe('https://cuberoot.me/math');
    expect(document.body.textContent).not.toContain('链接已复制');
  } finally { await act(async () => root.unmount()); host.remove(); }
});
