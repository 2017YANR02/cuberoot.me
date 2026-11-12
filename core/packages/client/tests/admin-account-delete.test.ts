// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ useAuthUser: vi.fn(), deleteAdminUser: vi.fn() }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: mocks.useAuthUser }));
vi.mock('@/lib/account-api', () => ({ deleteAdminUser: mocks.deleteAdminUser }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
import AdminAccountDelete from '@/components/account/AdminAccountDelete';

let host: HTMLDivElement;
let root: Root;
const onDeleted = vi.fn();
const render = (uid = 1293, wcaId: string | null = null) => act(async () => {
  root.render(createElement(AdminAccountDelete, { profile: { uid, wcaId, name: 'Role test: admin', avatar: '', avatarSource: 'auto', avatarPreset: null, isAdmin: true }, onDeleted }));
});
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  mocks.useAuthUser.mockReturnValue({ uid: 66, wcaId: '2017YANR02', isAdmin: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function input(value: string) {
  await act(async () => {
    const field = host.querySelector('input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
it('hides deletion from guests and ordinary admins and protects self and root targets', async () => {
  for (const actor of [null, { uid: 42, wcaId: null, isAdmin: true }]) {
    mocks.useAuthUser.mockReturnValue(actor); await render(); expect(host.textContent).toBe('');
  }
  mocks.useAuthUser.mockReturnValue({ uid: 66, wcaId: '2017YANR02' });
  await render(66); expect(host.textContent).toBe('');
  await render(1293, '2017YANR02'); expect(host.textContent).toBe('');
});
it('requires the exact target ID, clears cancelled confirmation, and reports successful deletion', async () => {
  await render();
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toContain('Role test: admin');
  const submit = () => host.querySelector<HTMLButtonElement>('button[type=submit]')!;
  expect(submit().disabled).toBe(true);
  await input('1294'); expect(submit().disabled).toBe(true);
  await input('1293'); expect(submit().disabled).toBe(false);
  await act(async () => host.querySelector<HTMLButtonElement>('form button[type=button]')!.click());
  await act(async () => host.querySelector('button')!.click());
  expect(host.querySelector('input')!.value).toBe('');
  expect(mocks.deleteAdminUser).not.toHaveBeenCalled();
  await input('1293');
  await act(async () => submit().click());
  expect(mocks.deleteAdminUser).toHaveBeenCalledWith(1293, '1293');
  expect(onDeleted).toHaveBeenCalledOnce();
});
it('keeps the form and explains a blocked deletion', async () => {
  mocks.deleteAdminUser.mockRejectedValue(new Error('transfer organization ownership before deleting account'));
  await render(); await act(async () => host.querySelector('button')!.click()); await input('1293');
  await act(async () => host.querySelector<HTMLButtonElement>('button[type=submit]')!.click());
  expect(host.querySelector('[role=alert]')!.textContent).toContain('机构所有权');
  expect(onDeleted).not.toHaveBeenCalled();
});
