// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MiniProgramAuthPage from '@/app/auth/miniprogram/page';

const mocks = vi.hoisted(() => ({
  applySession: vi.fn(),
  openMiniProgramTab: vi.fn(),
}));
vi.mock('@/lib/auth-store', () => ({ applySession: mocks.applySession, authActions: {} }));
vi.mock('@/lib/miniprogram-bridge', () => ({
  miniProgramTab: () => 'tools',
  openMiniProgramTab: mocks.openMiniProgramTab,
}));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));

const next = '/zh/alg?set=oll#cases';
const fetcher = vi.fn<typeof fetch>();
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fetcher);
  window.history.replaceState(null, '', `/auth/miniprogram#wechat_redirect&ticket=${'A'.repeat(43)}&next=${encodeURIComponent(next)}`);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it('asks the Tools tab for a fresh ticket after exchange fails', async () => {
  fetcher.mockImplementation(async () => new Response(null, { status: 401 }));
  mocks.openMiniProgramTab.mockResolvedValue(true);
  await act(async () => root.render(createElement(MiniProgramAuthPage)));
  await act(async () => host.querySelector('button')?.click());

  expect(mocks.openMiniProgramTab).toHaveBeenCalledExactlyOnceWith('tools', next);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(host.querySelector('a')?.getAttribute('href')).toBe(next);
});

it('retries saving an already exchanged session without requesting a new ticket', async () => {
  fetcher.mockImplementation(async () => Response.json({
    token: 't'.repeat(20),
    user: { uid: 7, wcaId: null, name: 'CubeRoot', avatar: '' },
  }));
  mocks.applySession.mockResolvedValue(false);
  await act(async () => root.render(createElement(MiniProgramAuthPage)));
  await act(async () => host.querySelector('button')?.click());

  expect(mocks.applySession).toHaveBeenCalledTimes(2);
  expect(mocks.openMiniProgramTab).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
