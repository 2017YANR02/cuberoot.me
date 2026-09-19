import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveWorkspacePath } from '../../../scripts/resolve-workspace-path.mjs';
import { WEB_ROUTES, resolveWebRoute, resolveWebRouteShare } from '../src/lib/web-routes';
import { createWebViewPageData, createWebViewPageOptions, markWebRouteFailed, retryWebRoute, type WebViewPageContext } from '../src/lib/web-view-page';

const callbacks = createWebViewPageOptions() as unknown as {
  onLoad(this: WebViewPageContext, query: Record<string, string>): void;
  onShareAppMessage(this: WebViewPageContext, options?: { webViewUrl?: string }): { path: string; title: string };
  handleWebViewMessage(this: WebViewPageContext, event: { detail: { data: unknown[] } }): void;
};
function context(): WebViewPageContext {
  return { data: createWebViewPageData(), setData(next) { Object.assign(this.data, next); } };
}
beforeEach(() => {
  vi.stubGlobal('wx', {
    getStorageSync: () => null, setNavigationBarTitle: vi.fn(), showShareMenu: vi.fn(), hideShareMenu: vi.fn(),
    nextTick: (callback: () => void) => callback(),
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

it('shares article B after entering from A and reopens B with filters and anchor', () => {
  const sender = context();
  callbacks.onLoad.call(sender, { key: 'home' });
  callbacks.handleWebViewMessage.call(sender, { detail: { data: [
    { type: 'cuberoot:page-share', path: '/zh/math', title: '数学' },
    { type: 'cuberoot:page-share', path: '/zh/math/probability?tab=pll#orbit', title: '情况概率' },
  ] } });
  const share = callbacks.onShareAppMessage.call(sender, { webViewUrl: 'https://cuberoot.me/zh/math/probability?tab=pll#wechat_redirect&orbit' });
  expect(share.title).toBe('情况概率');
  expect(share.path).toBe('/pages/web/index?key=home&path=%2Fzh%2Fmath%2Fprobability%3Ftab%3Dpll%23orbit');
  const recipient = context();
  callbacks.onLoad.call(recipient, { key: 'home', path: share.path.split('&path=')[1] });
  expect(recipient.data.src).toBe('https://cuberoot.me/zh/math/probability?tab=pll#orbit');
  markWebRouteFailed(recipient);
  retryWebRoute(recipient);
  expect(recipient.data.src).toBe('https://cuberoot.me/zh/math/probability?tab=pll#orbit');
});

it('never applies stale title metadata to a different current article', () => {
  expect(resolveWebRouteShare('home', 'https://cuberoot.me/math/probability', {
    type: 'cuberoot:page-share', path: '/math', title: 'Old article',
  })?.title).toBe('魔方根CubeRoot');
});

it('opens a shared article using the recipient session ticket', async () => {
  const token = 'recipient-token-1234567890';
  const ticket = 'A'.repeat(43);
  vi.stubGlobal('wx', {
    getStorageSync: () => ({ token, user: { name: 'Recipient', wcaId: null } }),
    setNavigationBarTitle: vi.fn(), showShareMenu: vi.fn(), hideShareMenu: vi.fn(),
    nextTick: (callback: () => void) => callback(),
    request(options: { header: Record<string, string>; success(result: { statusCode: number; data: unknown }): void }) {
      expect(options.header.Authorization).toBe(`Bearer ${token}`);
      options.success({ statusCode: 200, data: { ticket, expiresIn: 90 } });
    },
  });
  const recipient = context();
  const path = '/zh/math/probability?tab=pll#orbit';
  callbacks.onLoad.call(recipient, { key: 'home', path: encodeURIComponent(path) });
  await vi.waitFor(() => expect(recipient.data.src).toBe(
    `https://cuberoot.me/auth/miniprogram#wechat_redirect&ticket=${ticket}&next=${encodeURIComponent(path)}`,
  ));
});

it.each(['%2F%2Fevil.test', encodeURIComponent('/auth/miniprogram#ticket=secret'), encodeURIComponent('https://evil.test'), '%E0%A4%A'])('blocks invalid incoming share destination %s', path => {
  const recipient = context(); callbacks.onLoad.call(recipient, { key: 'home', path });
  expect(recipient.data.src).toBe('');
  expect(recipient.data.errorTitle).toBe('无法打开');
});

it('preserves percent-encoded search text instead of decoding the destination twice', () => {
  const path = '/zh/math?q=%E8%80%BF%26x#section';
  const recipient = context(); callbacks.onLoad.call(recipient, { key: 'home', path: encodeURIComponent(path) });
  expect(recipient.data.src).toBe(`https://cuberoot.me${path}`);
});

it('does not allow shared paths to override private routes or fixed native tabs', () => {
  expect(resolveWebRoute('account', '/math')).toBeNull();
  const fixed = createWebViewPageOptions('timer') as unknown as typeof callbacks;
  const recipient = context(); fixed.onLoad.call(recipient, { key: 'home', path: '/math' });
  expect(recipient.data.src).toBe('https://cuberoot.me/zh/timer#wechat_redirect');
});

it('never forwards an authentication callback or ticket', () => {
  const sender = context(); callbacks.onLoad.call(sender, { key: 'home' });
  const share = callbacks.onShareAppMessage.call(sender, { webViewUrl: 'https://cuberoot.me/auth/miniprogram#ticket=secret' });
  expect(share.path).toBe('/pages/tools/index');
  expect(resolveWebRouteShare('home', 'https://cuberoot.me/math?ticket=secret#wechat_redirect')?.path)
    .toBe('/pages/web/index?key=home&path=%2Fmath');
});

// Discover all pages through the workspace inventory, as in web-routes.test.ts.
// Dynamic IDs are URL fixtures; this verifies transport, not resource existence.
const websiteRoot = resolve(import.meta.dirname, '../../..', resolveWorkspacePath('@cuberoot/client'));
const pageRoutes = readdirSync(resolve(websiteRoot, 'app/[lang]'), { recursive: true })
  .map(file => String(file).replaceAll('\\', '/'))
  .filter(file => /(?:^|\/)page\.tsx$/.test(file))
  .map(file => '/' + file.replace(/(?:^|\/)page\.tsx$/, '').split('/')
    .filter(segment => segment && !segment.startsWith('('))
    .map(segment => segment.startsWith('[') ? 'example' : segment).join('/'));

it.each(pageRoutes)('round-trips both languages of website route %s through the native share callback', route => {
  for (const prefix of ['', '/zh']) {
    const path = `${prefix}${route}?page=2&code=AB&state=UUUFFR&q=%E9%AD%94%E6%96%B9#section`;
    const sender = context();
    callbacks.onLoad.call(sender, { key: 'home' });
    const share = callbacks.onShareAppMessage.call(sender, { webViewUrl: `https://cuberoot.me${path}` });
    const query = Object.fromEntries(new URLSearchParams(share.path.split('?')[1]));
    expect(query.path).toBe(path);
    const recipient = context();
    callbacks.onLoad.call(recipient, query);
    expect(recipient.data.src).toBe(`https://cuberoot.me${path}`);
  }
});

it.each(Object.keys(WEB_ROUTES))('shares the current page after navigation from the %s entry', key => {
  const path = '/zh/forum/t/42?page=2#reply-17';
  const sender = context();
  callbacks.onLoad.call(sender, { key });
  const share = callbacks.onShareAppMessage.call(sender, { webViewUrl: `https://cuberoot.me${path}` });
  expect(share.path).toBe(`/pages/web/index?key=home&path=${encodeURIComponent(path)}`);
});

it('uses the latest query and anchor even when no title message has arrived', () => {
  const sender = context();
  callbacks.onLoad.call(sender, { key: 'home' });
  for (const path of ['/zh/wca?event=333#results', '/zh/wca?event=222#records', '/zh/wca?event=333#results']) {
    const share = callbacks.onShareAppMessage.call(sender, { webViewUrl: `https://cuberoot.me${path}` });
    expect(share.path).toBe(`/pages/web/index?key=home&path=${encodeURIComponent(path)}`);
  }
});
