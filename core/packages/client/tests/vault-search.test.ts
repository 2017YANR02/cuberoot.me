// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VaultPage from '@/app/[lang]/vault/page';

const { user } = vi.hoisted(() => ({ user: { uid: 1, name: 'Test owner' } }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => user, useAuthStore: () => vi.fn() }));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/hooks/useCopy', () => ({ useCopy: () => ({ copy: vi.fn(), copiedKey: null }) }));
vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('@/lib/admin-api', () => ({ authHeaders: () => ({}), handleApi: (response: Response) => response.json() }));
vi.mock('@/lib/vault-crypto', () => ({
  isValidVaultPassphrase: () => true,
  unlockVaultPrivateKey: async () => ({}),
  decryptVaultEntry: async () => ({ id: 'entry', title: 'Test entry', fields: [], notes: '' }),
}));

let host: HTMLDivElement;
let root: Root;
const requests: { query: string; signal: AbortSignal; resolve: (value: Response) => void }[] = [];
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
  vi.useFakeTimers(); requests.length = 0;
  vi.stubGlobal('fetch', vi.fn((path: string, options?: RequestInit) => {
    if (path === '/v1/vault') return Promise.resolve(response({
      userId: 1, canManage: true, keyProfile: { publicKey: {}, encryptedPrivateKey: {} },
      items: [{ id: 'entry', ownerUserId: 1, ownerName: 'Test owner', version: 1, shares: [] }],
    }));
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
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

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
