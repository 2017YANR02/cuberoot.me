// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getRecon } from '@/lib/recon-api';
import { useReconDetailData } from '@/app/[lang]/recon/[id]/useReconDetailData';

type ReconSolve = Awaited<ReturnType<typeof getRecon>>;
vi.mock('@/lib/recon-api', () => ({ getRecon: vi.fn() }));
const old = { id: 2796, solution: 'old combined F2L' } as ReconSolve;
const fresh = { ...old, solution: 'new separate F2L' };
let current: ReturnType<typeof useReconDetailData>;
let root: Root;
let host: HTMLDivElement;
function Probe({ id = '2796', seed = old }: { id?: string; seed?: ReconSolve }) {
  current = useReconDetailData(id, seed);
  return createElement('div', null, current.solve?.solution ?? current.error);
}
function pending() {
  let resolve!: (value: ReconSolve) => void;
  const promise = new Promise<ReconSolve>(r => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(getRecon).mockReset();
  host = document.createElement('div');
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); });

it('renders the ISR seed immediately, then replaces it with fresh API data', async () => {
  const next = pending();
  vi.mocked(getRecon).mockReturnValue(next.promise);
  await act(async () => root.render(createElement(Probe)));
  expect(host.textContent).toBe(old.solution);
  expect(current.loading).toBe(false);
  expect(getRecon).toHaveBeenCalledWith(2796);
  await act(async () => next.resolve(fresh));
  expect(host.textContent).toBe(fresh.solution);
});
it('checks again when returning to the tab and ignores an older in-flight response', async () => {
  const first = pending();
  vi.mocked(getRecon).mockReturnValueOnce(first.promise).mockResolvedValueOnce(fresh);
  await act(async () => root.render(createElement(Probe)));
  await act(async () => window.dispatchEvent(new Event('focus')));
  await act(async () => first.resolve(old));
  expect(host.textContent).toBe(fresh.solution);
});
it('discards a pending response from the previous recon after navigation', async () => {
  const first = pending();
  const other = { id: 2797, solution: 'another recon' } as ReconSolve;
  vi.mocked(getRecon).mockReturnValueOnce(first.promise).mockResolvedValueOnce(other);
  await act(async () => root.render(createElement(Probe)));
  await act(async () => root.render(createElement(Probe, { id: '2797', seed: other })));
  await act(async () => first.resolve(fresh));
  expect(host.textContent).toBe(other.solution);
});
it.each([401, 403, 404])('removes cached content when the API returns %s', async status => {
  vi.mocked(getRecon).mockRejectedValue(Object.assign(new Error('unavailable'), { status }));
  await act(async () => root.render(createElement(Probe)));
  expect(current.solve).toBeNull();
  expect(current.error).toBe('unavailable');
});
it('retains the first paint during transient failure and recovers on focus', async () => {
  vi.mocked(getRecon).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(fresh);
  await act(async () => root.render(createElement(Probe)));
  expect(host.textContent).toBe(old.solution);
  expect(current.error).toBeNull();
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(host.textContent).toBe(fresh.solution);
});
