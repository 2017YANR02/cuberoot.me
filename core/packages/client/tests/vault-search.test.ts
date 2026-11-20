// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VaultPage from '@/app/[lang]/vault/page';

const { user } = vi.hoisted(() => ({ user: { uid: 1, name: 'Test owner' } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => user, authActions: { login: vi.fn() },
  useAuthStore: () => vi.fn() }));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/hooks/useCopy', () => ({ useCopy: () => ({ copy: vi.fn(), copiedKey: null }) }));
vi.mock('@/hooks/usePinnedCountries', () => ({ usePinnedCountries: () => [[], vi.fn()] }));
vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('@/lib/admin-api', () => ({ authHeaders: () => ({}), handleApi: (response: Response) => response.json() }));
vi.mock('@/lib/vault-crypto', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/vault-crypto')>(),
  isValidVaultPassphrase: () => true,
  unlockVaultPrivateKey: async () => ({}),
  decryptVaultEntry: async (ciphertext?: string) => ciphertext ? JSON.parse(ciphertext) : ({ id: 'entry', title: 'Test entry', fields: [], notes: '' }),
  encryptVaultEntry: async (entry: unknown, recipients: unknown[]) => ({ ciphertext: JSON.stringify(entry), iv: 'test', accesses: recipients }),
}));

let host: HTMLDivElement;
let root: Root;
const writes: { ciphertext: string; accesses: { userId: number }[] }[] = [];
const updates: { path: string; ciphertext: string; expectedVersion: number; accesses: { userId: number }[] }[] = [];
let failUpdate = '';
const trashedAt = '2026-01-03T00:00:00Z';
const response = (data: unknown) => new Response(JSON.stringify(data));
const type = async (value: string) => {
  const input = document.querySelector<HTMLInputElement>('[placeholder="搜索好友"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const advance = async (ms = 300) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); writes.length = 0; updates.length = 0; failUpdate = '';
  vi.stubGlobal('fetch', vi.fn((path: string, options?: RequestInit) => {
    if (path === '/v1/vault') return Promise.resolve(response({
      userId: 1, canManage: true, keyProfile: { publicKey: {}, encryptedPrivateKey: {} },
      items: [{ id: 'entry', ownerUserId: 1, ownerName: 'Test owner', version: 1, shares: [] }, ...writes.map((write, i) => ({ id: `saved-${i}`, ownerUserId: 1, ownerName: 'Test owner', version: 1, shares: [], ciphertext: write.ciphertext }))],
    }));
    if (path === '/v1/vault/items') {
      writes.push(JSON.parse(options!.body as string));
      return Promise.resolve(response({ id: `saved-${writes.length - 1}`, version: 1, updatedAt: '2026-01-01' }));
    }
    if (path.startsWith('/v1/vault/items/') && options?.method === 'PUT') {
      if (path === failUpdate) return Promise.reject(new Error('item changed in another tab'));
      const body = JSON.parse(options.body as string);
      updates.push({ path, ...body });
      return Promise.resolve(response({ version: body.expectedVersion + 1, updatedAt: '2026-01-02' }));
    }
    if (path === '/v1/vault/users') return Promise.resolve(response({ users: [
      { userId: 2, name: 'Friend with a key', wcaId: '2026TEST01', publicKey: {} },
      { userId: 3, name: 'Friend without a key', wcaId: null, publicKey: null },
    ] }));
    throw new Error(`Unexpected request: ${path}`);
  }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(VaultPage)));
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(host.querySelector('[aria-label="选择好友"]')).not.toBeNull();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('lists friends before searching and adds only an eligible recipient on save', async () => {
  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="选择好友"]')!;
  const options = () => [...document.querySelectorAll<HTMLButtonElement>('.list-select-item')];
  await act(async () => trigger.click());
  expect(options()).toHaveLength(2);
  expect(options()[1].textContent).toContain('尚未启用接收');
  expect(options()[1].disabled).toBe(true);
  const requestCount = vi.mocked(fetch).mock.calls.length;
  await type('2026TEST01');
  expect(options()).toHaveLength(1);
  await act(async () => options()[0].click());
  expect(host.querySelector('.vault-share-list')?.textContent).toContain('Friend with a key');
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(requestCount);
  await clickText('保存');
  expect(updates[0].accesses.map(({ userId }) => userId)).toEqual([1, 2]);
});

it('falls back to accepted friends when the older vault API returns an empty list', async () => {
  const fetchMock = vi.mocked(fetch);
  const originalFetch = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((input, options) => {
    if (input === '/v1/vault/users') return Promise.resolve(response({ users: [] }));
    if (input === '/v1/friends') return Promise.resolve(response({
      friends: [{ userId: 2, name: 'Accepted friend', wcaId: null }],
      incoming: [{ userId: 3, name: 'Pending request', wcaId: null }],
    }));
    if (input === '/v1/vault/users?q=2') return Promise.resolve(response({ users: [
      { userId: 22, name: 'Another user', publicKey: {} },
      { userId: 2, name: 'Accepted friend', publicKey: {} },
    ] }));
    return originalFetch(input, options);
  });
  await clickText('回收站');
  await clickText('返回');
  await clickText('Test entry');
  await clickText('选择好友');
  const options = document.querySelectorAll<HTMLButtonElement>('.list-select-item');
  expect(options).toHaveLength(1);
  expect(options[0].textContent).toContain('Accepted friend');
  await act(async () => options[0].click());
  expect(host.querySelector('.vault-share-list')?.textContent).toContain('Accepted friend');
  await clickText('保存');
  expect(updates[0].accesses.map(({ userId }) => userId)).toEqual([1, 2]);
});

it('creates an owner-only encrypted account entry through the simplified editor', async () => {
  expect(host.querySelector('[aria-label="选择资料库文件"]')).toBeNull();
  expect(host.textContent).not.toContain('导出明文备份');
  const click = async (label: string) => {
    const button = [...host.querySelectorAll('button')].find(item => item.textContent === label)!;
    await act(async () => button.click());
  };
  const fill = async (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => {
      const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  await click('新建');
  await click('保存');
  expect(writes).toHaveLength(0);
  expect(host.textContent).toContain('请填写标题');
  await fill(host.querySelector<HTMLInputElement>('.vault-title-input')!, 'Account one');
  const fields = host.querySelectorAll<HTMLTextAreaElement>('textarea.vault-value-input');
  expect(fields).toHaveLength(2);
  expect(fields[1].placeholder).toBe('密码');
  await fill(fields[0], 'test-owner@example.com');
  await fill(fields[1], 'test-secret');
  await click('保存');
  expect(writes).toHaveLength(1);
  expect(writes[0].accesses.map(access => access.userId)).toEqual([1]);
  expect(JSON.parse(writes[0].ciphertext)).toMatchObject({
    title: 'Account one', category: 'accounts', fields: [
      { label: '账号', value: 'test-owner@example.com', secret: false },
      { label: '密码', value: 'test-secret', secret: true },
    ],
  });
  expect([...host.querySelectorAll('button')].find(item => item.textContent === '保存')?.disabled).toBe(true);
  const search = host.querySelector<HTMLInputElement>('[placeholder="搜索资料"]')!;
  const requestCount = vi.mocked(fetch).mock.calls.length;
  await fill(search, 'TEST-OWNER@example.com');
  expect(host.querySelector('.vault-list')?.textContent).toContain('Account one');
  expect(host.querySelector('.vault-list')?.textContent).not.toContain('Test entry');
  await fill(search, ' SECRET ');
  expect(host.querySelector('.vault-list')?.textContent).toContain('Account one');
  expect(host.querySelector('.vault-list')?.textContent).not.toContain('Test entry');
  await fill(search, 'no matching value');
  expect(host.querySelector('.vault-list')?.textContent).toContain('没有内容');
  await advance();
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(requestCount);
});

it('removes a single field only on save and does not recreate it when reopening the entry', async () => {
  const click = async (label: string) => {
    const button = [...host.querySelectorAll('button')].find(item => item.textContent === label || item.querySelector('strong')?.textContent === label)!;
    await act(async () => button.click());
  };
  await click('新建');
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>('.vault-title-input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Single field');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const remainingFieldId = host.querySelector<HTMLTextAreaElement>('textarea.vault-value-input')!.id;
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="删除字段：密码"]')!.click());
  expect(writes).toHaveLength(0);
  expect(host.querySelectorAll('textarea.vault-value-input')).toHaveLength(1);
  expect(host.querySelector<HTMLTextAreaElement>('textarea.vault-value-input')!.id).toBe(remainingFieldId);
  await click('保存');
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0].ciphertext).fields).toEqual([
    expect.objectContaining({ label: '账号', value: '', secret: false }),
  ]);
  await click('Test entry');
  await click('Single field');
  expect(host.querySelectorAll('textarea.vault-value-input')).toHaveLength(1);
  expect(host.querySelector('[aria-label="删除字段：密码"]')).toBeNull();
});

const clickText = async (label: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label || item.querySelector('strong')?.textContent === label)!;
  await act(async () => button.click());
};

it('shows the email above the password in an existing account entry', async () => {
  writes.push({ accesses: [{ userId: 1 }], ciphertext: JSON.stringify({
    id: 'old-account',
    title: 'Old account',
    category: 'accounts',
    notes: '',
    fields: [
      { id: 'pass', label: '密码', value: 'fixture', secret: true },
      { id: 'email', label: '邮箱', value: 'example@example.com', secret: false },
      { id: 'site', label: '网站', value: 'example.com', secret: false },
    ],
  }) });
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(createElement(VaultPage)));
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await clickText('Old account');
  expect([...host.querySelectorAll('.vault-field-label')].map((label) => label.textContent)).toEqual(['邮箱', '密码', '网站']);
  expect(updates).toHaveLength(0);
});
const choose = async (label: string, option: string) => {
  await act(async () => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  const item = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent === option)!;
  await act(async () => item.click());
};
const prepareMerge = async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await clickText('新建');
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>('.vault-title-input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Source');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await clickText('保存');
  await choose('合并目标', 'Test entry');
};

it('saves the encrypted target before archiving the source and can restore the original', async () => {
  await prepareMerge();
  await clickText('合并');
  expect(updates.map(({ path }) => path)).toEqual(['/v1/vault/items/entry', '/v1/vault/items/saved-0']);
  expect(updates.every(({ expectedVersion, accesses }) => expectedVersion === 1 && accesses.length === 1 && accesses[0].userId === 1)).toBe(true);
  expect(JSON.parse(updates[0].ciphertext).fields).toHaveLength(2);
  const archived = JSON.parse(updates[1].ciphertext);
  expect(archived).toMatchObject({ ...JSON.parse(writes[0].ciphertext), mergedInto: { id: 'entry', title: 'Test entry' } });
  expect(host.querySelector('[aria-label="查看内容"]')).toBeNull();
  const source = [...host.querySelectorAll('.vault-list-item')].find(item => item.querySelector('strong')?.textContent === 'Source');
  expect(source?.textContent).toContain('已合并');
  await act(async () => {
    const search = host.querySelector<HTMLInputElement>('[placeholder="搜索资料"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Source');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.querySelector('.vault-list')?.textContent).toContain('Source');
  expect(host.querySelector('.vault-list')?.textContent).not.toContain('Test entry');
  await clickText('Source');
  await clickText('恢复原条目');
  expect(JSON.parse(updates[2].ciphertext)).toEqual(JSON.parse(writes[0].ciphertext));
  expect(updates[2].expectedVersion).toBe(2);
  expect(host.querySelector('.vault-list')?.textContent).toContain('Source');
  expect(host.querySelector('.vault-list')?.textContent).not.toContain('已合并');
});

it.each(['/v1/vault/items/entry', '/v1/vault/items/saved-0'])('keeps the original visible after a failed merge write to %s', async (path) => {
  await prepareMerge();
  failUpdate = path;
  await clickText('合并');
  expect(host.querySelector('.vault-list')!.textContent).toContain('Source');
  expect(updates).toHaveLength(path.endsWith('/entry') ? 0 : 1);
  expect(updates.every(({ ciphertext }) => !JSON.parse(ciphertext).mergedInto)).toBe(true);
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});

it('moves a saved item to Trash, restores it, and only empties Trash after confirmation', async () => {
  const fetchMock = vi.mocked(fetch);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const trashPath = '/v1/vault/items/entry/trash';
  fetchMock.mockResolvedValueOnce(response({ version: 2, updatedAt: trashedAt, trashedAt }));
  await clickText('移入回收站');
  const [path, request] = fetchMock.mock.lastCall!;
  expect(path).toBe(trashPath);
  expect(request?.method).toBe('PUT');
  expect(JSON.parse(request?.body as string)).toEqual({ trashed: true, expectedVersion: 1 });
  expect(host.querySelector('.vault-list')?.textContent).not.toContain('Test entry');

  await clickText('回收站');
  await clickText('Test entry');
  expect(host.querySelector<HTMLInputElement>('.vault-title-input')?.readOnly).toBe(true);
  fetchMock.mockResolvedValueOnce(response({ version: 3, updatedAt: trashedAt, trashedAt: null }));
  await clickText('恢复');
  expect(JSON.parse(fetchMock.mock.lastCall?.[1]?.body as string)).toEqual({ trashed: false, expectedVersion: 2 });
  expect(host.querySelector('.vault-list')?.textContent).toContain('回收站为空');

  await clickText('返回');
  await clickText('Test entry');
  fetchMock.mockResolvedValueOnce(response({ version: 4, updatedAt: trashedAt, trashedAt }));
  await clickText('移入回收站');
  await clickText('回收站');
  const requestCount = fetchMock.mock.calls.length;
  await clickText('清空回收站');
  expect(fetchMock).toHaveBeenCalledTimes(requestCount);
  expect(host.querySelector('.vault-list')?.textContent).toContain('Test entry');

  confirm.mockReturnValue(true);
  fetchMock.mockResolvedValueOnce(response({ ok: true }));
  await clickText('清空回收站');
  expect(fetchMock).toHaveBeenLastCalledWith('/v1/vault/trash', expect.objectContaining({ method: 'DELETE' }));
  expect(host.querySelector('.vault-list')?.textContent).toContain('回收站为空');
});
