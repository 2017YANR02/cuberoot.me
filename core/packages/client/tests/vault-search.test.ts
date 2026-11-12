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
const requests: { query: string; signal: AbortSignal; resolve: (value: Response) => void }[] = [];
const writes: { ciphertext: string; accesses: { userId: number }[] }[] = [];
const updates: { path: string; ciphertext: string; expectedVersion: number; accesses: { userId: number }[] }[] = [];
let failUpdate = '';
const response = (data: unknown) => new Response(JSON.stringify(data));
const type = async (value: string) => {
  const input = host.querySelector<HTMLInputElement>('[placeholder="搜索好友"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const advance = async (ms = 300) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); requests.length = 0; writes.length = 0; updates.length = 0; failUpdate = '';
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
    if (path.startsWith('/v1/vault/users?')) return new Promise<Response>((resolve) => {
      requests.push({ query: new URL(path, 'http://localhost').searchParams.get('q')!, signal: options!.signal as AbortSignal, resolve });
    });
    throw new Error(`Unexpected request: ${path}`);
  }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(createElement(VaultPage)));
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(host.querySelector('[placeholder="搜索好友"]')).not.toBeNull();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('automatically searches valid input, cancels old requests, and ignores late results after clearing', async () => {
  await type('胡'); await advance(); expect(requests).toHaveLength(0);
  await type('胡泽'); await advance(200); await type('胡泽亮'); await advance(299);
  expect(requests).toHaveLength(0);
  await advance(1); expect(requests.map((request) => request.query)).toEqual(['胡泽亮']);
  await type('王小明'); expect(requests[0].signal.aborted).toBe(true);
  await advance();
  await act(async () => requests[1].resolve(response({ users: [{ userId: 2, name: 'New result', publicKey: {} }] })));
  expect(host.querySelector('.vault-user-results')?.textContent).toContain('New result');
  await act(async () => requests[0].resolve(response({ users: [{ userId: 3, name: 'Stale result', publicKey: {} }] })));
  expect(host.textContent).not.toContain('Stale result');
  await type('另一位'); await advance(); await type('');
  expect(requests[2].signal.aborted).toBe(true);
  await act(async () => requests[2].resolve(response({ users: [{ userId: 4, name: 'Late result', publicKey: {} }] })));
  expect(host.querySelector('.vault-user-results')).toBeNull();
  expect(vi.mocked(fetch).mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
});

it('creates an owner-only encrypted account entry through the simplified editor', async () => {
  expect(host.querySelector('[aria-label="选择资料库文件"]')).toBeNull();
  expect(host.textContent).not.toContain('导出明文备份');
  const click = async (label: string) => {
    const button = [...host.querySelectorAll('button')].find(item => item.textContent === label)!;
    await act(async () => button.click());
  };
  const fill = async (input: HTMLInputElement, value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  await click('新建');
  await click('保存');
  expect(writes).toHaveLength(0);
  expect(host.textContent).toContain('请填写标题');
  await fill(host.querySelector<HTMLInputElement>('.vault-title-input')!, 'Account one');
  const fields = host.querySelectorAll<HTMLInputElement>('.vault-value-input');
  expect(fields).toHaveLength(2);
  expect(fields[1].placeholder).toBe('密码');
  await fill(fields[0], 'test-owner');
  await fill(fields[1], 'test-secret');
  await click('保存');
  expect(writes).toHaveLength(1);
  expect(writes[0].accesses.map(access => access.userId)).toEqual([1]);
  expect(JSON.parse(writes[0].ciphertext)).toMatchObject({
    title: 'Account one', category: 'accounts', fields: [
      { label: '账号', value: 'test-owner', secret: false },
      { label: '密码', value: 'test-secret', secret: true },
    ],
  });
  expect([...host.querySelectorAll('button')].find(item => item.textContent === '保存')?.disabled).toBe(true);
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
  const remainingFieldId = host.querySelector<HTMLInputElement>('.vault-value-input')!.id;
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="删除字段：密码"]')!.click());
  expect(writes).toHaveLength(0);
  expect(host.querySelectorAll('.vault-value-input')).toHaveLength(1);
  expect(host.querySelector<HTMLInputElement>('.vault-value-input')!.id).toBe(remainingFieldId);
  await click('保存');
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0].ciphertext).fields).toEqual([
    expect.objectContaining({ label: '账号', value: '', secret: false }),
  ]);
  await click('Test entry');
  await click('Single field');
  expect(host.querySelectorAll('.vault-value-input')).toHaveLength(1);
  expect(host.querySelector('[aria-label="删除字段：密码"]')).toBeNull();
});

const clickText = async (label: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label || item.querySelector('strong')?.textContent === label)!;
  await act(async () => button.click());
};
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
  expect(host.querySelector('.vault-list')!.textContent).not.toContain('Source');
  await choose('查看内容', '已合并');
  await clickText('Source');
  await clickText('恢复原条目');
  expect(JSON.parse(updates[2].ciphertext)).toEqual(JSON.parse(writes[0].ciphertext));
  expect(updates[2].expectedVersion).toBe(2);
  expect(host.querySelector('.vault-list')!.textContent).toContain('Source');
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
