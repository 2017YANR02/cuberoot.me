// @vitest-environment jsdom
import { act, createElement, Fragment, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { decodeMobileEmbedInit, decodeMobileEmbedSelectTab, decodeMobileEmbedOpenSettings,
  mobileEmbedInitMessage, mobileEmbedBackMessage, mobileEmbedSelectTabMessage,
  mobileEmbedOpenSettingsMessage, mobileEmbedAppearanceMessage, decodeMobileEmbedAppearance } from '@cuberoot/shared/mobile-embed';
import { DEFAULT_APPEARANCE_PREFERENCES } from '@cuberoot/shared/appearance';
const state = vi.hoisted(() => ({ path: '/en/account', back: null as string | null, post: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => state.path }));
vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => null, getAuthUser: () => null,
  applySession: vi.fn(), authActions: { logout: vi.fn() }, subscribeAuthUser: () => () => undefined }));
vi.mock('@/lib/web-session-handoff', () => ({ exchangeWebSessionTicket: vi.fn() }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
vi.mock('@/lib/entry-navigation', () => ({ readEntryNavigationBack: () => state.back, subscribeEntryNavigation: () => () => undefined }));
vi.mock('@/components/AppLink', () => ({ default: ({ navigation: _nav, prefetch: _prefetch, ...props }: ComponentProps<'a'> & { navigation?: string; prefetch?: false }) => createElement('a', props) }));
vi.mock('@/components/HomeLink', () => ({ default: ({ miniProgramTarget: _target, prefetch: _prefetch, ...props }: ComponentProps<'a'> & { miniProgramTarget?: string; prefetch?: false }) => createElement('a', { ...props, href: '/' }) }));
import MobileEmbedBridge from '@/components/MobileEmbedBridge';
import PageBackLink from '@/components/PageBackLink';
import { openInstalledAppearance, useInstalledShellNavigation } from '@/lib/installed-shell-navigation';
let host: HTMLDivElement; let root: Root;
const parent = { postMessage: state.post }; const originalParent = window.parent;
const origin = 'capacitor://localhost';
function send(data: unknown, source: unknown = parent, messageOrigin = origin) {
  window.dispatchEvent(new MessageEvent('message', { data, origin: messageOrigin, source: source as Window }));
}
function click(markup: string) {
  const holder = document.createElement('div'); holder.innerHTML = markup; host.append(holder);
  const target = holder.firstElementChild!;
  const webHandler = vi.fn((event: Event) => event.preventDefault()); target.addEventListener('click', webHandler);
  act(() => target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
  return webHandler;
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  state.path = '/en/account'; state.back = null;
  localStorage.clear();
  Object.defineProperty(window, 'parent', { configurable: true, value: parent }); window.name = 'cuberoot-mobile-account';
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); window.name = '';
  Object.defineProperty(window, 'parent', { configurable: true, value: originalParent });
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  document.documentElement.removeAttribute('data-theme');
});
it.each(['tools', 'account'] as const)('uses the host top safe area only after trusted %s init and restores it on cleanup', async surface => {
  window.name = `cuberoot-mobile-${surface}`;
  const style = document.documentElement.style;
  style.setProperty('--sat', '59px');
  await act(async () => root.render(createElement(MobileEmbedBridge)));
  const init = mobileEmbedInitMessage(surface);
  send(init, parent, 'https://example.org');
  send(init, {});
  send(mobileEmbedInitMessage(surface === 'tools' ? 'account' : 'tools'));
  expect(style.getPropertyValue('--sat')).toBe('59px');
  send(init);
  expect(style.getPropertyValue('--sat')).toBe('0px');
  send(init);
  await act(async () => root.render(null));
  expect(style.getPropertyValue('--sat')).toBe('59px');
  style.removeProperty('--sat');
});
it.each(['tools', 'account'] as const)('delegates locale timer links in %s without invoking Web navigation', async surface => {
  window.name = `cuberoot-mobile-${surface}`;
  await act(async () => root.render(createElement(MobileEmbedBridge)));
  send(mobileEmbedInitMessage(surface, { shellNavigation: true })); state.post.mockClear();
  for (const path of ['/timer', '/en/timer?utm_source=homepage', '/zh/timer/']) {
    expect(click(`<a href="${path}">Timer</a>`)).not.toHaveBeenCalled();
    expect(state.post).toHaveBeenLastCalledWith(mobileEmbedSelectTabMessage(surface, 'timer'), origin);
  }
});
it.each(['old-host', 'untrusted-origin', 'wrong-source', 'standalone'])('preserves normal navigation for %s', async mode => {
  if (mode === 'standalone') Object.defineProperty(window, 'parent', { configurable: true, value: window });
  await act(async () => root.render(createElement(MobileEmbedBridge)));
  send(mobileEmbedInitMessage('account', { shellNavigation: mode !== 'old-host' }), mode === 'wrong-source' ? window : parent,
    mode === 'untrusted-origin' ? 'https://untrusted.example' : origin);
  state.post.mockClear();
  expect(click('<a href="/timer">Timer</a>')).toHaveBeenCalledOnce();
  expect(state.post).not.toHaveBeenCalled();
});
it('delegates marked appearance buttons and account appearance links to the host settings', async () => {
  await act(async () => root.render(createElement(MobileEmbedBridge)));
  send(mobileEmbedInitMessage('account', { shellNavigation: true })); state.post.mockClear();
  for (const html of ['<button data-mobile-open-settings="appearance">Appearance</button>',
    '<a href="/en/account?settings=appearance">Appearance</a>', '<a href="/zh/account?settings=general">General</a>',
    '<a href="/account?view=appearance">Appearance</a>', '<a href="/appearance">Appearance</a>']) {
    expect(click(html)).not.toHaveBeenCalled();
    expect(state.post).toHaveBeenLastCalledWith(mobileEmbedOpenSettingsMessage('account'), origin);
  }
});
it('does not turn timer subpages, resources, authentication or external links into tab switches', async () => {
  await act(async () => root.render(createElement(MobileEmbedBridge)));
  send(mobileEmbedInitMessage('account', { shellNavigation: true })); state.post.mockClear();
  for (const path of ['/timer/history', '/tools/timer.html', '/auth/mobile', '/api/timer', '/timer.json', 'https://example.org/timer']) click(`<a href="${path}">Link</a>`);
  expect(state.post.mock.calls.some(([message]) => ['cuberoot:mobile:select-tab', 'cuberoot:mobile:open-settings'].includes(message.type))).toBe(false);
});
it('never sends browser history back beyond the iframe root', async () => {
  const back = vi.spyOn(window.history, 'back');
  await act(async () => root.render(createElement(MobileEmbedBridge)));
  send(mobileEmbedInitMessage('account')); send(mobileEmbedBackMessage('account'));
  expect(back).not.toHaveBeenCalled();
});
it('keeps standalone and SSR BackHome, hides the installed Account root, and returns subpages to Account', async () => {
  expect(renderToString(createElement(PageBackLink))).toContain('href="/"');
  await act(async () => root.render(createElement(PageBackLink)));
  expect(host.querySelector('a')).toBeNull();
  state.path = '/en/account/mcp';
  await act(async () => root.render(createElement(PageBackLink)));
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/account');
  expect(host.querySelector('a')?.getAttribute('aria-label')).toBe('Back to previous page');
  state.back = '/friends';
  await act(async () => root.render(createElement(PageBackLink)));
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/friends');
  state.path = '/zh/account'; state.back = '/zh';
  await act(async () => root.render(createElement(PageBackLink)));
  expect(host.querySelector('a')).toBeNull();
  Object.defineProperty(window, 'parent', { configurable: true, value: window }); state.back = null;
  await act(async () => root.render(createElement(PageBackLink)));
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/');
});
it('validates only the three shell tabs and explicit appearance settings capability', () => {
  expect(decodeMobileEmbedSelectTab(mobileEmbedSelectTabMessage('tools', 'timer'))?.tab).toBe('timer');
  expect(decodeMobileEmbedSelectTab({ surface: 'tools', type: 'cuberoot:mobile:select-tab', tab: '/timer' })).toBeNull();
  expect(decodeMobileEmbedSelectTab({ surface: 'other', type: 'cuberoot:mobile:select-tab', tab: 'timer' })).toBeNull();
  expect(decodeMobileEmbedOpenSettings(mobileEmbedOpenSettingsMessage('account'))?.category).toBe('appearance');
  expect(decodeMobileEmbedOpenSettings({ surface: 'tools', type: 'cuberoot:mobile:open-settings', category: 'unknown' })).toBeNull();
  expect(decodeMobileEmbedInit({ ...mobileEmbedInitMessage('tools'), shellNavigation: 'yes' })).toBeNull();
});

it('applies only trusted, complete appearance messages for the current frame', async () => {
  await act(async () => root.render(createElement(MobileEmbedBridge)));
  const preferences = { ...DEFAULT_APPEARANCE_PREFERENCES, theme: 'dark' as const };
  const message = mobileEmbedAppearanceMessage('account', preferences);
  send(message);
  expect(localStorage.getItem('theme')).toBeNull();
  send(mobileEmbedInitMessage('account'));
  send(message, window); send(message, parent, 'https://untrusted.example');
  send(mobileEmbedAppearanceMessage('tools', preferences));
  send({ ...message, preferences: { theme: 'dark' } });
  expect(localStorage.getItem('theme')).toBeNull();
  send(message);
  expect(localStorage.getItem('theme')).toBe('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
});

it('keeps host appearance authoritative without repeat-init or notification loops', async () => {
  await act(async () => root.render(createElement(MobileEmbedBridge)));
  const preferences = { ...DEFAULT_APPEARANCE_PREFERENCES, theme: 'dark' as const };
  const changed = vi.fn(); window.addEventListener('theme-change', changed);
  try {
    send(mobileEmbedInitMessage('account', { appearance: preferences }));
    expect(changed).toHaveBeenCalledTimes(1);
    send(mobileEmbedInitMessage('account', { appearance: preferences }));
    send(mobileEmbedAppearanceMessage('account', preferences));
    expect(changed).toHaveBeenCalledTimes(1);
    document.documentElement.dataset.theme = 'light';
    window.dispatchEvent(new Event('theme-change'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(changed).toHaveBeenCalledTimes(2);
    localStorage.setItem('theme', 'light');
    window.dispatchEvent(new Event('theme-change'));
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(changed).toHaveBeenCalledTimes(4);
    send(mobileEmbedAppearanceMessage('account', { ...preferences, theme: 'light' }));
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(changed).toHaveBeenCalledTimes(5);
  } finally { window.removeEventListener('theme-change', changed); }
});

it('rejects partial or invalid appearance preferences instead of applying defaults', () => {
  for (const preferences of [null, {}, { theme: 'dark' }, { ...DEFAULT_APPEARANCE_PREFERENCES, palette: 'invalid' },
    { ...DEFAULT_APPEARANCE_PREFERENCES, lightBackground: 'https://untrusted.example/image.jpg' }]) {
    expect(decodeMobileEmbedAppearance({ type: 'cuberoot:mobile:appearance', surface: 'account', preferences })).toBeNull();
    expect(decodeMobileEmbedInit({ ...mobileEmbedInitMessage('account'), appearance: preferences })).toBeNull();
  }
});

it('keeps host appearance and navigation available when iframe storage is restricted', async () => {
  await act(async () => root.render(createElement(MobileEmbedBridge)));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
  send(mobileEmbedInitMessage('account', {
    shellNavigation: true, appearance: { ...DEFAULT_APPEARANCE_PREFERENCES, theme: 'dark' },
  }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(click('<a href="/timer">Timer</a>')).not.toHaveBeenCalled();
  expect(state.post).toHaveBeenLastCalledWith(mobileEmbedSelectTabMessage('account', 'timer'), origin);
});

it('publishes shell capability only after trusted init and clears it when the bridge unmounts', async () => {
  function Capability() { return createElement('output', null, String(useInstalledShellNavigation())); }
  await act(async () => root.render(createElement(Fragment, null, createElement(MobileEmbedBridge), createElement(Capability))));
  expect(host.querySelector('output')?.textContent).toBe('false');
  act(() => send(mobileEmbedInitMessage('account', { shellNavigation: true }), window));
  expect(host.querySelector('output')?.textContent).toBe('false');
  act(() => send(mobileEmbedInitMessage('account', { shellNavigation: true })));
  expect(host.querySelector('output')?.textContent).toBe('true');
  expect(renderToString(createElement(Capability))).toContain('false');
  expect(openInstalledAppearance()).toBe(true);
  expect(state.post).toHaveBeenLastCalledWith(mobileEmbedOpenSettingsMessage('account'), origin);
  await act(async () => root.render(createElement(Capability)));
  expect(host.querySelector('output')?.textContent).toBe('false');
  expect(openInstalledAppearance()).toBe(false);
});

it('switches plain Account roots from Tools to My without swallowing account intents', async () => {
  window.name = 'cuberoot-mobile-tools';
  await act(async () => root.render(createElement(MobileEmbedBridge)));
  send(mobileEmbedInitMessage('tools', { shellNavigation: true }));
  for (const path of ['/account', '/en/account', '/zh/account/', '/account?next=%2Fzh']) {
    expect(click(`<a href="${path}">My</a>`)).not.toHaveBeenCalled();
    expect(state.post).toHaveBeenLastCalledWith(mobileEmbedSelectTabMessage('tools', 'account'), origin);
  }
  state.post.mockClear();
  for (const path of ['/account?view=delete', '/account?view=signin', '/account?next=%2Fauth%2Fmobile', '/account?next=http%3A%2F%2F%5B', '/account#section']) {
    expect(click(`<a href="${path}">Account action</a>`)).toHaveBeenCalledOnce();
  }
  expect(state.post).not.toHaveBeenCalled();
});

it('preserves full timer intent URLs through the external bridge instead of dropping training or share state', async () => {
  window.name = 'cuberoot-mobile-tools';
  await act(async () => root.render(createElement(MobileEmbedBridge)));
  send(mobileEmbedInitMessage('tools', { shellNavigation: true }));
  for (const path of ['/timer?content=zbll&source=cases', '/en/timer?event=333', '/timer?training=f2l',
    '/timer?share=fixture', '/timer?replay=fixture', '/zh/timer/#clock']) {
    expect(click(`<a href="${path}">Specific timer</a>`)).not.toHaveBeenCalled();
    expect(state.post).toHaveBeenLastCalledWith({ surface: 'tools', type: 'cuberoot:mobile:external', href: new URL(path, window.location.href).href }, origin);
  }
});
