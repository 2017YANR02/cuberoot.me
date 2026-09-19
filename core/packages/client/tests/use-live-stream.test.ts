// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyResultPatch, mergeLiveRoundRows, useLiveStream, type LivePatch, type LiveResultRow } from '@/hooks/useLiveStream';

vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));

function resultRow(overrides: Partial<LiveResultRow> = {}): LiveResultRow {
  return {
    i: 7, c: 42, n: 9, e: '333', r: '1', f: 'a',
    b: 1000, a: 1200, v: [1000, 1200, 1400], sr: '', ar: '',
    ...overrides,
  };
}

describe('applyResultPatch', () => {
  it('preserves server PR ranks across a cubing.com result.all snapshot', () => {
    const previous = resultRow({ pS: 42, pA: 8 });
    const [updated] = mergeLiveRoundRows([previous], [resultRow()]);

    expect(updated).toMatchObject({ pS: 42, pA: 8 });
  });

  it('preserves server PR ranks when a cubing.com update keeps the scores unchanged', () => {
    const previous = resultRow({ pS: 42, pA: 8 });
    const [updated] = applyResultPatch([previous], {
      kind: 'result.update',
      result: resultRow({ v: [1000, 1100, 1200, 1300, 1400] }),
      roundFormat: 'a',
    });

    expect(updated).toMatchObject({ pS: 42, pA: 8 });
  });

  it('drops only the stale PR rank when its underlying score changes', () => {
    const previous = resultRow({ pS: 42, pA: 8 });
    const [updated] = applyResultPatch([previous], {
      kind: 'result.update',
      result: resultRow({ b: 900 }),
      roundFormat: 'a',
    });

    expect(updated.pS).toBeUndefined();
    expect(updated.pA).toBe(8);
  });
});

describe('useLiveStream REST refresh', () => {
  let host: HTMLDivElement;
  let root: Root;
  let patches: LivePatch[];
  let request: ReturnType<typeof vi.fn>;
  const snapshot = (roundTypeId = 'f') => ({
    round: { i: roundTypeId, e: 'clock', s: 1, rn: 1 },
    users: { '9': { number: 9, name: 'Competitor', wcaid: '', region: 'CN' } },
    results: [resultRow({ e: 'clock', r: roundTypeId })],
  });
  function Probe({ round = 'f', enabled = true, all = false }: { round?: string; enabled?: boolean; all?: boolean }) {
    const status = useLiveStream({
      cubingSlug: enabled ? 'Xian-One-More-Clock-2026' : null,
      focusRound: { eventId: 'clock', roundTypeId: round, roundNumber: round === 'f' ? 3 : 1 },
      rounds: all ? [{ eventId: 'clock', roundTypeId: '1', roundNumber: 1 }, { eventId: 'clock', roundTypeId: 'f', roundNumber: 3 }] : undefined,
      applyPatch: patch => patches.push(patch),
    });
    return createElement('span', null, status);
  }
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    patches = [];
    request = vi.fn(async () => ({ ok: true, json: async () => snapshot() }));
    vi.stubGlobal('fetch', request);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('fetches the final via our API, updates users before scores, and refreshes every 15s', async () => {
    await act(async () => root.render(createElement(Probe)));
    expect(request.mock.calls[0][0]).toBe('/v1/cubing-live/Xian-One-More-Clock-2026/round/clock/3?roundTypeId=f&v=5');
    expect(patches.map(patch => patch.kind)).toEqual(['users', 'round.update', 'result.all']);
    expect(host.textContent).toBe('open');
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('retries errors without clearing the displayed data', async () => {
    request.mockRejectedValueOnce(new Error('offline'));
    await act(async () => root.render(createElement(Probe)));
    expect(patches).toEqual([]);
    expect(host.textContent).toBe('error');
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(host.textContent).toBe('open');
    expect(patches).toHaveLength(3);
  });
  it('aborts the previous round and ignores its late response', async () => {
    let resolve!: (value: unknown) => void;
    request.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await act(async () => root.render(createElement(Probe)));
    const signal = request.mock.calls[0][1].signal as AbortSignal;
    request.mockResolvedValue({ ok: true, json: async () => snapshot('1') });
    await act(async () => root.render(createElement(Probe, { round: '1' })));
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ ok: true, json: async () => snapshot() }));
    expect(patches.filter(patch => patch.kind === 'result.all').map(patch => patch.roundTypeId)).toEqual(['1']);
  });
  it('pauses while hidden and refreshes when visible', async () => {
    const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => root.render(createElement(Probe)));
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(request).not.toHaveBeenCalled();
    visible.mockReturnValue('visible');
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('does not fetch when disabled and rejects mismatched snapshots', async () => {
    await act(async () => root.render(createElement(Probe, { enabled: false })));
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue({ ok: true, json: async () => snapshot('1') });
    await act(async () => root.render(createElement(Probe)));
    expect(host.textContent).toBe('error');
    expect(patches).toEqual([]);
  });
  it('refreshes affected rounds on SSE, restores all rounds on reconnect, and applies deletions', async () => {
    class Stream extends EventTarget {
      static instance: Stream;
      onopen?: () => void;
      onerror?: () => void;
      onmessage?: (event: MessageEvent) => void;
      close = vi.fn();
      constructor(public url: string) { super(); Stream.instance = this; }
    }
    vi.stubGlobal('EventSource', Stream);
    request.mockImplementation(async (url: string) => ({ ok: true, json: async () => snapshot(url.includes('roundTypeId=1') ? '1' : 'f') }));
    await act(async () => root.render(createElement(Probe, { all: true })));
    expect(request).toHaveBeenCalledTimes(2);
    expect(Stream.instance.url).toBe('/v1/cubing-live/Xian-One-More-Clock-2026/stream?v=5');
    request.mockImplementation(async () => ({ ok: true, json: async () => ({ ...snapshot('1'), results: [] }) }));
    await act(async () => {
      Stream.instance.dispatchEvent(new MessageEvent('result.updated', { data: JSON.stringify({ payload: { round: { eventId: 'clock', roundNumber: 1 } } }) }));
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(request).toHaveBeenCalledTimes(3);
    expect(patches.at(-1)).toEqual({ kind: 'result.all', eventId: 'clock', roundTypeId: '1', results: [] });
    request.mockImplementation(async (url: string) => ({ ok: true, json: async () => snapshot(url.includes('roundTypeId=1') ? '1' : 'f') }));
    await act(async () => { Stream.instance.onopen?.(); await vi.advanceTimersByTimeAsync(500); });
    expect(request).toHaveBeenCalledTimes(5);
    await act(async () => { Stream.instance.onerror?.(); await vi.advanceTimersByTimeAsync(15_000); });
    expect(request).toHaveBeenCalledTimes(6);
    const stream = Stream.instance;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(stream.close).toHaveBeenCalledTimes(1);
  });
});
