// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstalledSignIn } from './InstalledSignIn';

const session = {
  token: 'synthetic-credential-session-for-tests',
  user: { uid: 42, name: 'Test account', wcaId: null, avatar: '', avatarSource: 'auto', avatarPreset: null, isAdmin: false },
};
const providers = { email: true, phone: true, wca: true, apple: true };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function button(text: string) {
  const item = [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === text);
  if (!item) throw new Error(`Missing button ${text}`);
  return item;
}

function enter(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Missing input ${selector}`);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function render(handler: (path: string, body: Record<string, unknown>) => Response) {
  const request = vi.fn(handler);
  vi.stubGlobal('fetch', vi.fn(async (href: string, init: RequestInit) => {
    const path = new URL(href).pathname;
    if (path === '/v1/auth/providers') return Response.json(providers);
    return request(path, JSON.parse(String(init.body)));
  }));
  const auth = {
    installCredentialSession: vi.fn(async () => true), issueWebSessionTicket: vi.fn(),
    login: vi.fn(async () => undefined), logout: vi.fn(async () => undefined),
    refreshAccountSession: vi.fn(async () => undefined),
    busy: false, error: false, loading: false, session: null,
  };
  const onClose = vi.fn();
  await act(async () => root.render(<InstalledSignIn recovering={false} onRecoveryChange={vi.fn()} auth={auth} language="en" onClose={onClose} openPolicy={vi.fn()} />));
  return { auth, onClose, request };
}

describe('bundled Account sign-in', () => {
  it('keeps inputs unfocused until selected and requests the email keyboard layout', async () => {
    const { request } = await render(() => Response.json({ ok: true }));
    const email = container.querySelector<HTMLInputElement>('input[type=email]')!;
    expect(document.activeElement).not.toBe(email);
    expect(email.inputMode).toBe('email');
    expect(email.getAttribute('autocapitalize')).toBe('none');
    expect(email.getAttribute('autocorrect')).toBe('off');
    expect(email.getAttribute('spellcheck')).toBe('false');

    await act(async () => { email.focus(); });
    expect(document.activeElement).toBe(email);
    await act(async () => { enter('input[type=email]', 'test@example.invalid'); });
    await act(async () => {
      email.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
      email.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, keyCode: 229 }));
    });
    expect(request).not.toHaveBeenCalled();
    await act(async () => { button('Sign in with a password').click(); });
    expect(container.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT').toBe(false);
  });

  it('installs a password session directly and keeps third-party authorization on the host', async () => {
    const { auth, onClose, request } = await render(() => Response.json(session));
    await act(async () => { button('Continue with WCA').click(); });
    expect(auth.login).toHaveBeenCalledExactlyOnceWith('wca');
    auth.login.mockClear();

    await act(async () => { button('Sign in with a password').click(); });
    await act(async () => {
      enter('input[type=email]', 'test@example.invalid');
      enter('input[type=password]', 'test-only-password');
    });
    await act(async () => { button('Sign in').click(); });
    expect(request).toHaveBeenCalledExactlyOnceWith('/v1/auth/email/password', {
      email: 'test@example.invalid', password: 'test-only-password',
    });
    expect(auth.installCredentialSession).toHaveBeenCalledExactlyOnceWith(session, expect.any(Function));
    expect(auth.login).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    { channel: 'email', selector: 'input[type=email]', target: 'test@example.invalid' },
    { channel: 'phone', selector: 'input[type=tel]', target: '13000000000' },
  ] as const)('verifies a $channel code inside the app', async ({ channel, selector, target }) => {
    const { auth, request } = await render(path => Response.json(path.endsWith('/send') ? { ok: true } : session));
    if (channel === 'phone') await act(async () => { button('Use phone number').click(); });
    await act(async () => { enter(selector, target); });
    await act(async () => { button('Send code').click(); });
    await act(async () => { enter('input[autocomplete=one-time-code]', '123456'); });
    expect(request.mock.calls).toEqual([
      [`/v1/auth/${channel}/send`, { [channel]: target }],
      [`/v1/auth/${channel}/verify`, { [channel]: target, code: '123456' }],
    ]);
    expect(auth.installCredentialSession).toHaveBeenCalledExactlyOnceWith(session, expect.any(Function));
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('requires an explicit account choice before registering a new identifier', async () => {
    const { auth, request } = await render(path => Response.json(path.endsWith('/send') ? { ok: true } : {
      code: 'ACCOUNT_CHOICE_REQUIRED',
      pending: { provider: 'email', ticket: 'A'.repeat(43), expiresInSeconds: 900 },
    }, { status: path.endsWith('/send') ? 200 : 409 }));
    await act(async () => { enter('input[type=email]', 'test@example.invalid'); });
    await act(async () => { button('Send code').click(); });
    await act(async () => { enter('input[autocomplete=one-time-code]', '123456'); });
    expect(container.textContent).toContain('Do you have a CubeRoot account?');
    expect(button('Create a new account')).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(2);
    expect(auth.installCredentialSession).not.toHaveBeenCalled();
  });

  it('verifies the existing account before confirming a new credential link', async () => {
    const ticket = 'A'.repeat(43);
    const { auth, request } = await render((path, body) => {
      if (path.endsWith('/send')) return Response.json({ ok: true });
      if (body.email === 'test@example.invalid') return Response.json({
        code: 'ACCOUNT_CHOICE_REQUIRED',
        pending: { provider: 'email', ticket, expiresInSeconds: 900 },
      }, { status: 409 });
      return Response.json(session);
    });
    const verify = async (email: string) => {
      await act(async () => { enter('input[type=email]', email); });
      await act(async () => { button('Send code').click(); });
      await act(async () => { enter('input[autocomplete=one-time-code]', '123456'); });
    };
    await verify('test@example.invalid');
    await act(async () => { button('Sign in to an existing account').click(); });
    await verify('existing@example.invalid');
    expect(request).toHaveBeenLastCalledWith('/v1/auth/email/verify', {
      email: 'existing@example.invalid', code: '123456', existingOnly: true,
    });
    expect(container.textContent).toContain(session.user.name);
    expect(auth.installCredentialSession).not.toHaveBeenCalled();
    await act(async () => { button('Confirm linking').click(); });
    expect(request).toHaveBeenLastCalledWith('/v1/auth/identity/complete', {
      ticket, action: 'link', expectedUid: session.user.uid,
    });
    expect(auth.installCredentialSession).toHaveBeenCalledExactlyOnceWith(session, expect.any(Function));
  });
});
