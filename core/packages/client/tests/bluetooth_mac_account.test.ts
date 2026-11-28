// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ uid: 1, token: 'one' }));
const fetcher = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-store', () => ({
  useAuthStore: { getState: () => ({ user: auth.uid ? { uid: auth.uid } : null }) },
  getSessionToken: () => auth.token,
}));
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: fetcher }));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('@/lib/admin-api', () => ({
  authHeaders: () => ({ Authorization: auth.token }),
  handleApi: async (r: Response) => { if (!r.ok) throw new Error('offline'); return r.json(); },
}));

import {
  readAccountMac, readLastCubeDeviceId, rememberCubeSelection, writeAccountMac, syncAccountMacs,
} from '@/lib/bluetooth/mac-account';

const mac = '11:22:33:44:55:66';
const response = (items = {}) => new Response(JSON.stringify({ items }), { status: 200 });

beforeEach(() => {
  localStorage.clear();
  auth.uid = 1;
  auth.token = 'one';
  fetcher.mockReset();
});

it('imports existing local addresses once and downloads addresses on another device', async () => {
  localStorage.setItem('cuberoot.timer.ganMacMap', JSON.stringify({ GAN: mac }));
  fetcher.mockImplementation(async () => response({ Other: mac }));
  await syncAccountMacs();
  expect(readAccountMac('GAN')).toBe(mac);
  expect(readAccountMac('Other')).toBe(mac);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ items: { GAN: mac } });
  auth.uid = 2;
  auth.token = 'two';
  expect(readAccountMac('GAN')).toBeNull();
  localStorage.clear();
  fetcher.mockResolvedValue(response({ GAN: mac }));
  await syncAccountMacs();
  expect(readAccountMac('GAN')).toBe(mac);
});

it('retries offline edits without uploading unrelated cloud devices, including deletion', async () => {
  fetcher.mockRejectedValue(new Error('offline'));
  writeAccountMac('GAN', mac);
  await syncAccountMacs();
  expect(readAccountMac('GAN')).toBe(mac);
  fetcher.mockImplementation(async () => response({ Other: mac }));
  await syncAccountMacs();
  expect(JSON.parse(fetcher.mock.calls.at(-1)![1].body)).toEqual({ items: { GAN: mac } });
  writeAccountMac('GAN', null);
  await syncAccountMacs();
  expect(JSON.parse(fetcher.mock.calls.at(-1)![1].body)).toEqual({ items: { GAN: null } });
  expect(readAccountMac('Other')).toBe(mac);
});

it('discards a cloud response after switching accounts', async () => {
  let resolve!: (response: Response) => void;
  fetcher.mockReturnValue(new Promise<Response>(r => { resolve = r; }));
  const pending = syncAccountMacs();
  auth.uid = 2;
  auth.token = 'two';
  resolve(response({ GAN: mac }));
  await pending;
  expect(readAccountMac('GAN')).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('preserves edits made while an upload is in flight', async () => {
  let resolve!: (response: Response) => void;
  fetcher.mockResolvedValueOnce(response())
    .mockImplementationOnce(() => new Promise<Response>(r => { resolve = r; }))
    .mockImplementation(async () => response());
  writeAccountMac('GAN', mac);
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  writeAccountMac('GAN', null);
  resolve(response());
  await syncAccountMacs();
  expect(JSON.parse(fetcher.mock.calls.at(-1)![1].body)).toEqual({ items: { GAN: null } });
  expect(readAccountMac('GAN')).toBeNull();
});

it('remembers anonymous selections in the browser and isolates them from signed-in accounts', () => {
  auth.uid = 0;
  rememberCubeSelection()('guest-cube');
  expect(readLastCubeDeviceId()).toBe('guest-cube');
  expect(fetcher).not.toHaveBeenCalled();

  auth.uid = 1;
  expect(readLastCubeDeviceId()).toBeUndefined();
  auth.uid = 0;
  expect(readLastCubeDeviceId()).toBe('guest-cube');
});

it('retries a signed-in selection and prefers the browser selection over another browser’s ID', async () => {
  fetcher.mockImplementation(async () => response());
  rememberCubeSelection()('local-cube');
  await syncAccountMacs();
  expect(fetcher).toHaveBeenCalledTimes(1);

  fetcher.mockResolvedValueOnce(Response.json({ items: {}, lastDeviceId: 'other-browser-cube' }))
    .mockResolvedValueOnce(Response.json({ ok: true, lastDeviceId: 'local-cube' }));
  await syncAccountMacs();
  expect(readLastCubeDeviceId()).toBe('local-cube');
  expect(JSON.parse(fetcher.mock.calls.at(-1)![1].body)).toEqual({ items: {}, lastDeviceId: 'local-cube' });

  localStorage.clear();
  fetcher.mockResolvedValueOnce(Response.json({ items: {}, lastDeviceId: 'local-cube' }));
  await syncAccountMacs();
  expect(readLastCubeDeviceId()).toBe('local-cube');
});

it('ignores a chooser result after the user switches accounts', () => {
  const remember = rememberCubeSelection();
  auth.uid = 2;
  remember('previous-account-cube');
  expect(readLastCubeDeviceId()).toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
});
