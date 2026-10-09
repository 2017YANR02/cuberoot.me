// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), token: 'phone', user: { uid: 7, wcaId: '', name: '' }, t: (_zh: string, en: string) => en }));
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: mocks.fetch }));
vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => mocks.token, useAuthUser: () => mocks.user }));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('@/hooks/useT', () => ({ useT: () => mocks.t }));
vi.mock('@/hooks/useDocumentTitle', () => ({ useDocumentTitle: () => {} }));
vi.mock('@/components/AppLink', () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/components/HomeLink', () => ({ default: ({ children }: { children: ReactNode }) => children }));
import Page from '@/app/[lang]/account/verify/page';
let root: Root; let host: HTMLDivElement;
const pending = { status: 'pending', enabled: true, consentVersion: 'fixture', canCheck: false, sessionChanged: true, attemptId: 'a'.repeat(32), expiresAt: null };
const button = (text: string) => [...host.querySelectorAll('button')].find(item => item.textContent === text)!;
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); mocks.token = 'phone'; mocks.user = { uid: 7, wcaId: '', name: '' }; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const render = async () => act(async () => root.render(createElement(Page)));
it('explains another device and lets the owner end that exact attempt before restarting', async () => {
  mocks.fetch.mockResolvedValueOnce(Response.json(pending)).mockResolvedValueOnce(Response.json({ ...pending, status: 'failed', attemptId: null }));
  await render();
  expect(button('Check result').disabled).toBe(true);
  expect(host.textContent).toContain('another device or session');
  await act(async () => button('Restart').click());
  expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({ action: 'cancel', attemptId: pending.attemptId });
  expect(host.textContent).toContain('Verification failed or ended');
  expect(button('Start verification').disabled).toBe(true);
});
it('refreshes an expired attempt after a check error instead of trapping the owner', async () => {
  mocks.fetch.mockResolvedValueOnce(Response.json({ ...pending, canCheck: true, sessionChanged: false }))
    .mockResolvedValueOnce(Response.json({ error: 'FACE_CHECK_TOO_SOON' }, { status: 429 }))
    .mockResolvedValueOnce(Response.json({ ...pending, status: 'expired', attemptId: null }));
  await render(); await act(async () => button('Check result').click());
  expect(host.textContent).toContain('Verification expired');
  expect(button('Start verification')).toBeTruthy();
});
it('does not show the old account result after the login token changes in flight', async () => {
  let resolve!: (response: Response) => void;
  mocks.fetch.mockResolvedValueOnce(Response.json({ ...pending, canCheck: true })).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await render(); await act(async () => button('Check result').click());
  mocks.token = 'another-account';
  await act(async () => resolve(Response.json({ ...pending, status: 'passed', idLast4: '9999' })));
  expect(host.textContent).not.toContain('9999');
});

const legalNameInput = () => host.querySelector<HTMLInputElement>('input[maxlength="60"]')!;
const setInput = async (input: HTMLInputElement, value: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
it('prefills the WCA local name even in English and follows a late profile refresh', async () => {
  mocks.fetch.mockImplementation(async () => Response.json({ ...pending, status: 'none' }));
  mocks.user = { uid: 7, wcaId: '2020TEST01', name: '' };
  await render();
  expect(legalNameInput().value).toBe('');
  mocks.user = { ...mocks.user, name: 'Ming Lin (林明)' };
  await render();
  expect(legalNameInput().value).toBe('林明');
  expect(button('Start verification').disabled).toBe(true);
});
it('preserves manual edits and an explicitly cleared name across profile refreshes', async () => {
  mocks.fetch.mockImplementation(async () => Response.json({ ...pending, status: 'none' }));
  mocks.user = { uid: 7, wcaId: '2020TEST01', name: 'Ming Lin (林明)' };
  await render();
  await setInput(legalNameInput(), '林小明');
  mocks.user = { ...mocks.user, name: 'Ming Lin (林明明)' };
  await render();
  expect(legalNameInput().value).toBe('林小明');
  await setInput(legalNameInput(), '');
  await render();
  expect(legalNameInput().value).toBe('');
});
it('resets to the new account name and does not treat an unlinked nickname as a legal name', async () => {
  mocks.fetch.mockImplementation(async () => Response.json({ ...pending, status: 'none' }));
  mocks.user = { uid: 7, wcaId: '2020TEST01', name: 'Ming Lin (林明)' };
  await render();
  await setInput(legalNameInput(), '林小明');
  mocks.user = { uid: 8, wcaId: '2020TEST02', name: '王小华' };
  await render();
  expect(legalNameInput().value).toBe('王小华');
  mocks.user = { uid: 9, wcaId: '', name: 'A nickname' };
  await render();
  expect(legalNameInput().value).toBe('');
});
