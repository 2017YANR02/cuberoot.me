// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { reconTestScrambleSource, reconTestSource, showReconTestEntry } from '@/lib/recon-test-source';
import ReconTestPicker from '@/app/[lang]/timer/_components/ReconTestPicker';
import { decodeTimerSolve } from '@cuberoot/shared/timer/persistence';

const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/recon-intake-api', () => ({ intakeRequest: api.request }));
vi.mock('@/i18n/tr', () => ({ tr: (text: { en: string }) => text.en }));
vi.mock('@/components/AppLink', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => createElement('a', { href }, children) }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

it('shows the test entry only to an administrator with a connected 3×3 cube outside competition', () => {
  expect(showReconTestEntry(true, true, '333', false)).toBe(true);
  expect(showReconTestEntry(false, true, '333', false)).toBe(false);
  expect(showReconTestEntry(true, false, '333', false)).toBe(false);
  expect(showReconTestEntry(true, true, '222', false)).toBe(false);
  expect(showReconTestEntry(true, true, '333', true)).toBe(false);
});

it('preserves only valid source identities for 3×3 solves', () => {
  const source = reconTestScrambleSource(123, 'a'.repeat(32));
  const solve = { id: 's', event: '333' as const, ts: 0, timeMs: 1000, penalty: 'ok' as const, scramble: 'R', scrambleSource: source };
  expect(reconTestSource(solve)).toEqual({ sourceReconId: 123, sourceReconHash: 'a'.repeat(32) });
  expect(reconTestSource(decodeTimerSolve(solve, '333')!)).toEqual({ sourceReconId: 123, sourceReconHash: 'a'.repeat(32) });
  expect(reconTestSource({ ...solve, event: '222' })).toBeUndefined();
  expect(reconTestSource({ ...solve, scrambleSource: { ...source, identity: 'recon-test:123' } })).toBeUndefined();
});

it('loads uncollected sources, selects the exact scramble and can choose the next source', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const items = [1, 2].map(id => ({ id, scramble: `R${id}`, solution: `U${id}`, competition: 'Test', date: null, value: '4.00',
    intakeId: null, intakeStatus: null, truthStatus: null, sourceChanged: false, sourceHash: 'a'.repeat(32) }));
  api.request.mockResolvedValue({ items, hasMore: false });
  const select = vi.fn(() => true); const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(ReconTestPicker, { canSelect: true, onSelect: select })));
    await act(async () => host.querySelector<HTMLButtonElement>('.recon-test-trigger')!.click());
    await vi.waitFor(() => expect(host.querySelectorAll('.recon-test-item')).toHaveLength(2));
    await act(async () => host.querySelector<HTMLButtonElement>('.recon-test-item')!.click());
    expect(host.querySelector('.recon-test-selected pre')?.textContent).toBe('U1');
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Use scramble')!.click());
    expect(select).toHaveBeenLastCalledWith(items[0]);
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Next uncollected')!.click());
    expect(select).toHaveBeenLastCalledWith(items[1]);
    expect(api.request).toHaveBeenCalledWith('/sources?status=pending&offset=0');
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it('does not load a scramble while timing is unavailable and reports a rejected change', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const item = { id: 1, scramble: 'R', solution: "R'", competition: null, date: null, value: null,
    intakeId: null, intakeStatus: null, truthStatus: null, sourceChanged: false, sourceHash: 'a'.repeat(32) };
  api.request.mockResolvedValue({ items: [item], hasMore: false });
  const select = vi.fn(() => false); const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(ReconTestPicker, { canSelect: false, onSelect: select })));
    await act(async () => host.querySelector<HTMLButtonElement>('.recon-test-trigger')!.click());
    await vi.waitFor(() => expect(host.querySelector('.recon-test-item')).not.toBeNull());
    await act(async () => host.querySelector<HTMLButtonElement>('.recon-test-item')!.click());
    const use = [...host.querySelectorAll('button')].find(button => button.textContent === 'Use scramble')!;
    expect(use.disabled).toBe(true);
    await act(async () => use.click()); expect(select).not.toHaveBeenCalled();
    await act(async () => root.render(createElement(ReconTestPicker, { canSelect: true, onSelect: select })));
    await act(async () => use.click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Cannot change the scramble');
  } finally { await act(async () => root.unmount()); host.remove(); }
});
