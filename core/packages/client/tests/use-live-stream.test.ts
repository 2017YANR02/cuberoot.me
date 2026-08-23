// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyResultPatch, mergeLiveRoundRows, useLiveStream, type LivePatch, type LiveResultRow } from '@/hooks/useLiveStream';

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

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(value: string) {
    this.sent.push(value);
  }

  close() {
    this.readyState = 3;
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  serverClose() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }

  message(payload: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }
}

describe('useLiveStream reconnect recovery', () => {
  let host: HTMLDivElement;
  let root: Root;
  let patches: LivePatch[];

  beforeEach(async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    FakeWebSocket.instances = [];
    patches = [];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    function Probe() {
      useLiveStream({
        compId: 42,
        rounds: [
          { eventId: '333', roundTypeId: '1' },
          { eventId: '333', roundTypeId: '2' },
        ],
        focusRound: { eventId: '333', roundTypeId: '1' },
        applyPatch: patch => patches.push(patch),
      });
      return null;
    }

    await act(async () => root.render(createElement(Probe)));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('syncs the focused round initially and resyncs each round after reconnect', async () => {
    const first = FakeWebSocket.instances[0]!;
    await act(async () => first.open());

    expect(first.sent.map(value => JSON.parse(value))).toEqual([
      { type: 'competition', competitionId: 42 },
      { type: 'result', action: 'fetch', params: { event: '333', round: '1', filter: 'all' } },
    ]);

    const row: LiveResultRow = {
      i: 7, c: 42, n: 9, e: '333', r: '1', f: 'a',
      b: 1000, a: 1200, v: [1000, 1200, 1400], sr: '', ar: '',
    };
    first.message({ code: 200, type: 'result.all', data: [row] });
    expect(patches[0]).toEqual({
      kind: 'result.all',
      eventId: '333',
      roundTypeId: '1',
      results: [row],
    });
    expect(first.sent).toHaveLength(2);

    await act(async () => {
      first.serverClose();
      vi.advanceTimersByTime(1000);
    });

    const second = FakeWebSocket.instances[1]!;
    await act(async () => second.open());
    expect(second.sent.slice(0, 2).map(value => JSON.parse(value))).toEqual([
      { type: 'competition', competitionId: 42 },
      { type: 'result', action: 'fetch', params: { event: '333', round: '1', filter: 'all' } },
    ]);

    second.message({ code: 200, type: 'result.all', data: [row] });

    expect(patches[1]).toEqual({
      kind: 'result.all',
      eventId: '333',
      roundTypeId: '1',
      results: [row],
    });
    expect(JSON.parse(second.sent[2]!)).toEqual({
      type: 'result',
      action: 'fetch',
      params: { event: '333', round: '2', filter: 'all' },
    });

    second.message({ code: 200, type: 'result.all', data: [] });
    expect(patches[2]).toEqual({
      kind: 'result.all',
      eventId: '333',
      roundTypeId: '2',
      results: [],
    });
    expect(second.sent).toHaveLength(3);
  });
});
