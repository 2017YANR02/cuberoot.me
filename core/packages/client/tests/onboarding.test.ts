// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import type { WcaUser } from '@/lib/auth-store';
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));
vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
vi.mock('@/lib/auth-store', () => ({ getSessionToken: () => 'test-session', getWcaToken: () => '' }));
import { isOnboardingGuided, markOnboardingGuided } from '@/lib/onboarding';

const account = (uid: number) => ({ uid, wcaId: '' } as WcaUser);
const request = vi.fn();
beforeEach(() => { localStorage.clear(); request.mockReset(); vi.stubGlobal('fetch', request); });

it('keeps guest progress separate from a first signed-in visit', async () => {
  await markOnboardingGuided(null);
  expect(await isOnboardingGuided(null)).toBe(true);
  request.mockResolvedValue(Response.json({ seen: false }));
  expect(await isOnboardingGuided(account(1))).toBe(false);
});

it('reads seen status on a fresh device without any local marker', async () => {
  request.mockResolvedValue(Response.json({ seen: true }));
  expect(await isOnboardingGuided(account(1))).toBe(true);
  expect(request.mock.calls[0][1].cache).toBe('no-store');
});

it('does not turn lookup failures into a first visit', async () => {
  request.mockRejectedValue(new Error('offline'));
  expect(await isOnboardingGuided(account(1))).toBe(true);
});

it('retries failed saves only for the matching account', async () => {
  request.mockRejectedValueOnce(new Error('offline'));
  await markOnboardingGuided(account(1));
  expect(localStorage.getItem('cuberoot_guided:account:uid:1')).toBe('pending');
  request.mockResolvedValueOnce(Response.json({ seen: false }));
  expect(await isOnboardingGuided(account(2))).toBe(false);
  request.mockResolvedValueOnce(Response.json({ seen: true }));
  expect(await isOnboardingGuided(account(1))).toBe(true);
  expect(request.mock.calls[2][1].method).toBe('PUT');
  expect(localStorage.getItem('cuberoot_guided:account:uid:1')).toBe('true');
});
