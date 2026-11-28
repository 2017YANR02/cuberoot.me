// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mobileEmbedInitMessage, mobileEmbedAccountManageResultMessage, mobileEmbedAuthClearMessage, mobileEmbedWebSessionMessage } from '@cuberoot/shared/mobile-embed';

const mocks = vi.hoisted(() => ({
  logoutListeners: new Set<() => void>(),
  post: vi.fn(), alert: vi.fn(), token: vi.fn(() => 'iframe-session'),
  applySession: vi.fn((_token: string, _user: unknown, _isCurrent?: () => boolean) => false), logout: vi.fn(), exchange: vi.fn(),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/account' }));
vi.mock('@/lib/auth-store', () => ({
  getSessionToken: mocks.token, applySession: mocks.applySession,
  getAuthUser: () => ({ uid: 42 }),
  authActions: { logout: () => {
    mocks.logout();
    for (const listener of mocks.logoutListeners) listener();
  } },
  subscribeExplicitAuthLogout: (listener: () => void) => {
    mocks.logoutListeners.add(listener);
    return () => { mocks.logoutListeners.delete(listener); };
  },
  useAuthStore: { getState: () => ({ user: { uid: 42 }, logout: mocks.logout }), subscribe: () => () => undefined },
}));
vi.mock('@/lib/web-session-handoff', () => ({ exchangeWebSessionTicket: mocks.exchange }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
import MobileEmbedBridge from '@/components/MobileEmbedBridge';

let root: Root;
let host: HTMLDivElement;
const originalParent = window.parent;
const parent = { postMessage: mocks.post };
const origin = 'capacitor://localhost';
const send = (data: unknown) => window.dispatchEvent(new MessageEvent('message', { data, origin, source: parent as unknown as Window }));
beforeEach(async () => {
  vi.clearAllMocks(); vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, 'parent', { configurable: true, value: parent });
  window.name = 'cuberoot-mobile-account';
  vi.spyOn(window, 'alert').mockImplementation(mocks.alert);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(MobileEmbedBridge)));
});

function deferredSession() {
  let resolve!: (session: { token: string; user: { uid: number } }) => void;
  const promise = new Promise<{ token: string; user: { uid: number } }>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('session ticket lifecycle under Apple bridge reuse', () => {
  const ticketA = 'a'.repeat(43);
  const ticketB = 'b'.repeat(43);
  const sessionA = { token: 'old-A', user: { uid: 1 } };
  const sessionB = { token: 'new-B', user: { uid: 2 } };

  it('does not restore a session after native logout while its ticket exchange is pending', async () => {
    const pending = deferredSession(); mocks.exchange.mockReturnValueOnce(pending.promise);
    send(mobileEmbedInitMessage('account'));
    send(mobileEmbedWebSessionMessage(ticketA, 'request-A'));
    send(mobileEmbedAuthClearMessage());
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.post).not.toHaveBeenCalledWith(mobileEmbedAuthClearMessage(), origin);
    mocks.post.mockClear();
    await act(async () => pending.resolve(sessionA));
    expect(mocks.applySession).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('reports a failed handoff without signing out the App', async () => {
    mocks.exchange.mockRejectedValueOnce(new Error('Session unavailable'));
    send(mobileEmbedInitMessage('account'));
    mocks.post.mockClear();
    await act(async () => send(mobileEmbedWebSessionMessage(ticketA, 'request-A')));
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith({
      type: 'cuberoot:mobile:web-session-result', surface: 'account', requestId: 'request-A', ok: false,
    }, origin);
  });

  it('acknowledges a successful handoff', async () => {
    mocks.exchange.mockResolvedValueOnce(sessionA);
    mocks.applySession.mockReturnValueOnce(true);
    send(mobileEmbedInitMessage('account'));
    mocks.post.mockClear();
    await act(async () => send(mobileEmbedWebSessionMessage(ticketA, 'request-A')));
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith({
      type: 'cuberoot:mobile:web-session-result', surface: 'account', requestId: 'request-A', ok: true,
    }, origin);
  });

  it('notifies the App when the account UI explicitly signs out', () => {
    send(mobileEmbedInitMessage('account'));
    mocks.post.mockClear();
    for (const listener of mocks.logoutListeners) listener();
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(mobileEmbedAuthClearMessage(), origin);
  });

  it('newer account ticket wins even if an older exchange finishes last', async () => {
    const old = deferredSession(); const next = deferredSession();
    mocks.exchange.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    send(mobileEmbedInitMessage('account'));
    send(mobileEmbedWebSessionMessage(ticketA, 'request-A'));
    send(mobileEmbedWebSessionMessage(ticketB, 'request-B'));
    await act(async () => next.resolve(sessionB));
    mocks.post.mockClear();
    await act(async () => old.resolve(sessionA));
    expect(mocks.applySession).toHaveBeenCalledExactlyOnceWith('new-B', { uid: 2 }, expect.any(Function));
    expect(mocks.applySession.mock.calls[0][2]?.()).toBe(true);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('an older completion cannot clear the newer in-flight ticket guard', async () => {
    const old = deferredSession(); const next = deferredSession();
    mocks.exchange.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    send(mobileEmbedInitMessage('account'));
    send(mobileEmbedWebSessionMessage(ticketA, 'request-A'));
    send(mobileEmbedWebSessionMessage(ticketB, 'request-B'));
    await act(async () => old.resolve(sessionA));
    send(mobileEmbedWebSessionMessage(ticketB, 'request-B'));
    expect(mocks.exchange).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve(sessionB));
    expect(mocks.applySession).toHaveBeenCalledExactlyOnceWith('new-B', { uid: 2 }, expect.any(Function));
    expect(mocks.applySession.mock.calls[0][2]?.()).toBe(true);
  });

  it('never applies a pending response after the bridge unmounts', async () => {
    const pending = deferredSession(); mocks.exchange.mockReturnValueOnce(pending.promise);
    send(mobileEmbedInitMessage('account'));
    send(mobileEmbedWebSessionMessage(ticketA, 'request-A'));
    await act(async () => root.render(null));
    mocks.post.mockClear();
    await act(async () => pending.resolve(sessionA));
    expect(mocks.applySession).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('StrictMode replay and repeated native delivery consume one ticket only once', async () => {
    await act(async () => root.render(createElement(StrictMode, null, createElement(MobileEmbedBridge))));
    const pending = deferredSession(); mocks.exchange.mockReturnValueOnce(pending.promise);
    send(mobileEmbedInitMessage('account'));
    send(mobileEmbedWebSessionMessage(ticketA, 'request-A'));
    send(mobileEmbedWebSessionMessage(ticketA, 'request-A'));
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith(ticketA);
    await act(async () => pending.resolve(sessionA));
    expect(mocks.applySession).toHaveBeenCalledExactlyOnceWith('old-A', { uid: 1 }, expect.any(Function));
    expect(mocks.applySession.mock.calls[0][2]?.()).toBe(true);
  });
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  document.body.innerHTML = ''; window.name = '';
  Object.defineProperty(window, 'parent', { configurable: true, value: originalParent });
  vi.restoreAllMocks(); vi.useRealTimers();
});
function button(html: string): HTMLButtonElement {
  const div = document.createElement('div'); div.innerHTML = html; document.body.append(div);
  return div.querySelector('button')!;
}

describe('Apple installed iframe bridge', () => {
  it.each(['click', 'keydown'])('releases the login input focus before %s delegates to Browser', (type) => {
    send(mobileEmbedInitMessage('account'));
    const form = document.createElement('div');
    form.dataset.mobileAuthEntry = '';
    form.innerHTML = '<input type="email">';
    document.body.append(form);
    const input = form.querySelector('input')!;
    input.focus();
    expect(document.activeElement).toBe(input);
    mocks.post.mockClear();
    const focusedAtHandoff: Element[] = [];
    mocks.post.mockImplementationOnce(() => focusedAtHandoff.push(document.activeElement!));
    const event = type === 'click'
      ? new MouseEvent('click', { bubbles: true, cancelable: true })
      : new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(focusedAtHandoff).toEqual([document.body]);
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith({ type: 'cuberoot:mobile:auth-request', surface: 'account', provider: null }, origin);
  });

  it('leaves unrelated input focus unchanged during a login handoff', () => {
    send(mobileEmbedInitMessage('account'));
    const input = document.createElement('input'); document.body.append(input); input.focus();
    button('<div data-mobile-auth-entry><button>Sign in</button></div>').click();
    expect(document.activeElement).toBe(input);
  });

  it('shows an upgrade message and blocks React handlers on an older shell', () => {
    send(mobileEmbedInitMessage('account'));
    const item = button('<div data-mobile-auth-entry><button data-mobile-auth-provider="apple">Apple</button></div>');
    const handler = vi.fn(); item.addEventListener('click', handler);
    mocks.post.mockClear(); item.click();
    expect(mocks.alert).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('Update the CubeRoot app'));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('delegates login only after an origin-bound Apple capability handshake', () => {
    send(mobileEmbedInitMessage('account', { authProviders: ['apple'] }));
    mocks.post.mockClear(); button('<div data-mobile-auth-entry><button data-mobile-auth-provider="apple">Apple</button></div>').click();
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith({ type: 'cuberoot:mobile:auth-request', surface: 'account', provider: 'apple' }, origin);
  });

  it('delegates linking with uid but no token, consumes its ACK, and never triggers an iframe redirect handler', () => {
    send(mobileEmbedInitMessage('account', { authProviders: ['apple'], accountManagement: true }));
    mocks.post.mockClear();
    const item = button('<button data-mobile-account-link="apple">Link</button>');
    const handler = vi.fn(); item.addEventListener('click', handler); item.click();
    const request = mocks.post.mock.calls[0][0];
    expect(request).toEqual({ type: 'cuberoot:mobile:account-manage', surface: 'account', provider: 'apple', intent: 'link', expectedUid: 42, requestId: expect.any(String) });
    expect(JSON.stringify(request)).not.toContain('iframe-session');
    expect(handler).not.toHaveBeenCalled();
    send(mobileEmbedAccountManageResultMessage(true, request.requestId));
    vi.advanceTimersByTime(15_000);
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it('reports a missing or mismatched account-management ACK instead of silently hanging', () => {
    send(mobileEmbedInitMessage('account', { authProviders: ['apple'], accountManagement: true }));
    button('<button data-mobile-account-link="apple">Link</button>').click();
    send(mobileEmbedAccountManageResultMessage(true, 'different-request'));
    vi.advanceTimersByTime(15_000);
    expect(mocks.alert).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('Could not open the system browser'));
  });
});
