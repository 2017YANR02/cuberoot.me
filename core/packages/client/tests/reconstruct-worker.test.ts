import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLiveReconstructionStream, createReconstructionAnalyzer } from '@cuberoot/timer-ui/reconstruct-analysis';
import { computeStageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import type { AnalysisInput, AnalysisRequest, AnalysisResponse, AnalysisSnapshot } from '@cuberoot/timer-ui/reconstruct-analysis';

class FakeWorker {
  onmessage: ((event: MessageEvent<AnalysisResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  requests: AnalysisRequest[] = [];
  terminate = vi.fn();
  warmups = 0;
  postMessage(request: AnalysisRequest | { type: 'warmup' }) {
    if ('type' in request) this.warmups++;
    else this.requests.push(request);
  }
  reply(response: Omit<AnalysisResponse, 'id'>, id = this.requests.at(-1)!.id) {
    this.onmessage?.({ data: { id, ...response } } as MessageEvent<AnalysisResponse>);
  }
}
const input = (scramble = 'R'): AnalysisInput => ({
  scoreable: true,
  text: {
    scramble, moves: [{ m: "R'", ts: 1000 }], totalMs: 1000,
    segs: computeStageSegments('R', [{ m: "R'", ts: 1000 }], 1000)!, metrics: null, slots: null,
  },
});
const disposers: Array<() => void> = [];
const recognizedText = {
  scramble: 'R', inspection: '', lines: [], turns: 1, stm: 1,
  seconds: 1, tps: 1, text: "R'", rotations: [], blindPairs: 0,
};
function setup() {
  vi.useFakeTimers();
  const workers: FakeWorker[] = [];
  const analyzer = createReconstructionAnalyzer(() => {
    const worker = new FakeWorker(); workers.push(worker); return worker;
  });
  disposers.push(() => analyzer.dispose());
  return { analyzer, workers };
}
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.useRealTimers();
});

describe('reconstruction worker lifecycle', () => {
  it('hands the same attempt prefix to a remounted final report before any worker reply', () => {
    const { analyzer, workers } = setup();
    const live = { ...input(), scoreable: false };
    analyzer.rememberLive('live-1', live, { text: recognizedText, reference: null, slotReference: null, status: 'complete' });
    analyzer.handoff('live-1', 'saved-1');
    const final = input();
    final.text = { ...final.text, moves: [...final.text.moves, { m: 'U', ts: 1200 }], totalMs: 1200 };
    const listener = vi.fn();
    analyzer.subscribe(final, listener, 'saved-1');
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ text: recognizedText, provisional: true, status: 'pending' }));
    expect(workers).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(workers[0].requests[0].skipText).toBe(false);
    const completed = { ...recognizedText, text: "R' U", turns: 2 };
    workers[0].reply({ patch: { text: completed } });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ text: completed, provisional: false }));
    expect(analyzer.peek(final, 'other-solve').provisional).not.toBe(true);
    const corrected = { ...final, text: { ...final.text, totalMs: 1500 } };
    expect(analyzer.peek(corrected, 'saved-1').text).toBeNull();
  });

  it.each(['scramble', 'timestamp', 'move', 'orientation', 'attempt', 'method', 'language'] as const)('rejects unrelated live steps (%s)', change => {
    const { analyzer } = setup();
    const live = { ...input(), scoreable: false };
    analyzer.rememberLive('live-1', live, { text: recognizedText, reference: null, slotReference: null, status: 'complete' });
    analyzer.handoff('live-1', 'saved-1');
    const final = input();
    if (change === 'scramble') final.text.scramble = 'F';
    if (change === 'timestamp') final.text.moves[0].ts++;
    if (change === 'move') final.text.moves[0].m = 'F';
    if (change === 'orientation') final.text.viewRotation = 'x';
    if (change === 'method') final.text.method = 'roux';
    if (change === 'language') final.text.language = 'zh';
    expect(analyzer.peek(final, change === 'attempt' ? 'saved-2' : 'saved-1').text).toBeNull();
  });

  it('reuses exact recognized text when only final reference scoring changes', () => {
    const { analyzer, workers } = setup();
    const live = { ...input(), scoreable: false };
    analyzer.subscribe(live, () => {});
    vi.advanceTimersByTime(1);
    workers[0].reply({ patch: { text: recognizedText }, done: true });
    const listener = vi.fn();
    analyzer.subscribe(input(), listener);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ text: recognizedText, reference: null, status: 'pending' }));
    vi.advanceTimersByTime(1);
    expect(workers[0].requests.at(-1)?.skipText).toBe(true);
    workers[0].reply({ patch: { reference: { stages: [], refTurns: 1, userTurns: 1, delta: 0 } }, done: true });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ text: recognizedText, status: 'complete' }));
  });

  it('coalesces live turns without cancelling active recognition and cancels on attempt exit', () => {
    const { analyzer, workers } = setup();
    const listener = vi.fn();
    const stream = createLiveReconstructionStream(listener, analyzer);
    const first = input('R'), skipped = input('U'), latest = input('F');
    stream.update(first);
    vi.advanceTimersByTime(1);
    stream.update(skipped);
    stream.update(latest);
    expect(workers[0].terminate).not.toHaveBeenCalled();
    expect(workers[0].requests).toHaveLength(1);
    workers[0].reply({ done: true });
    expect(listener).toHaveBeenLastCalledWith(first, expect.objectContaining({ status: 'complete' }));
    vi.advanceTimersByTime(5);
    expect(workers[0].requests.map(request => request.input)).toEqual([first, latest]);
    stream.dispose();
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    const count = listener.mock.calls.length;
    workers[0].reply({ done: true });
    expect(listener).toHaveBeenCalledTimes(count);
  });

  it('shares work, publishes partial results, and caches by content', () => {
    const { analyzer, workers } = setup();
    const a: AnalysisSnapshot[] = [], b: AnalysisSnapshot[] = [];
    const off = analyzer.subscribe(input(), value => a.push(value));
    analyzer.subscribe(input(), value => b.push(value));
    vi.advanceTimersByTime(1);
    expect(workers).toHaveLength(1);
    expect(workers[0].requests).toHaveLength(1);
    const reference = { stages: [], refTurns: 1, userTurns: 2, delta: 1 };
    workers[0].reply({ patch: { reference } });
    expect(a.at(-1)?.reference).toEqual(reference);
    expect(b.at(-1)?.status).toBe('pending');
    off();
    expect(workers[0].terminate).not.toHaveBeenCalled();
    workers[0].reply({ done: true });
    expect(b.at(-1)?.status).toBe('complete');
    const cached = vi.fn();
    analyzer.subscribe(input(), cached);
    expect(cached).toHaveBeenCalledWith(expect.objectContaining({ reference, status: 'complete' }));
    analyzer.subscribe(input('F'), () => {});
    vi.advanceTimersByTime(1);
    expect(workers).toHaveLength(1);
    expect(workers[0].requests).toHaveLength(2);
  });
  it('terminates cancelled work and ignores stale replies while starting the next solve', () => {
    const { analyzer, workers } = setup();
    const stale = vi.fn(), next = vi.fn();
    const off = analyzer.subscribe(input(), stale);
    vi.advanceTimersByTime(1);
    const late = workers[0].onmessage!;
    const id = workers[0].requests[0].id;
    analyzer.subscribe(input('F'), next);
    off();
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1);
    expect(workers).toHaveLength(2);
    late({ data: { id, done: true } } as MessageEvent<AnalysisResponse>);
    expect(stale).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    workers[1].reply({ done: true });
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'complete' }));
  });
  it('does not create a worker for a StrictMode discarded subscription', () => {
    const { analyzer, workers } = setup();
    analyzer.subscribe(input(), () => {})();
    analyzer.subscribe(input(), () => {});
    vi.advanceTimersByTime(1);
    expect(workers).toHaveLength(1);
    expect(workers[0].requests).toHaveLength(1);
  });
  it.each(['error', 'messageerror', 'timeout'] as const)('settles %s without caching failure and can retry', kind => {
    const { analyzer, workers } = setup();
    const result = vi.fn();
    analyzer.subscribe(input(), result);
    vi.advanceTimersByTime(1);
    if (kind === 'error') workers[0].onerror?.({} as ErrorEvent);
    if (kind === 'messageerror') workers[0].onmessageerror?.({} as MessageEvent);
    if (kind === 'timeout') vi.advanceTimersByTime(60_000);
    expect(result).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }));
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    analyzer.subscribe(input(), result);
    vi.advanceTimersByTime(1);
    expect(workers).toHaveLength(2);
  });
  it('reports unavailable Workers without main-thread fallback', () => {
    vi.useFakeTimers();
    const analyzer = createReconstructionAnalyzer(() => { throw new Error('unavailable'); });
    disposers.push(() => analyzer.dispose());
    const result = vi.fn();
    analyzer.subscribe(input(), result);
    vi.advanceTimersByTime(1);
    expect(result).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }));
  });
  it('bounds the cache and releases idle worker memory', () => {
    const { analyzer, workers } = setup();
    for (let i = 0; i < 9; i++) {
      analyzer.subscribe(input(String(i)), () => {});
      vi.advanceTimersByTime(1);
      workers[0].reply({ done: true });
    }
    vi.advanceTimersByTime(60_001);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    const cached = vi.fn();
    analyzer.subscribe(input('8'), cached);
    expect(cached).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'complete' }));
    analyzer.subscribe(input('0'), () => {});
    vi.advanceTimersByTime(1);
    expect(workers).toHaveLength(2);
  });
});


it('reuses a prewarmed worker for the next report and recovers a failed preload worker', async () => {
  const { analyzer, workers } = setup();
  analyzer.warmup();
  expect(workers[0].warmups).toBe(1);
  expect(workers[0].requests).toHaveLength(0);
  workers[0].onerror?.({} as ErrorEvent);
  expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  analyzer.warmup();
  const unsubscribe = analyzer.subscribe(input(), () => {});
  await vi.advanceTimersByTimeAsync(0);
  expect(workers).toHaveLength(2);
  expect(workers[1].requests).toHaveLength(1);
  unsubscribe();
});

it('publishes corrected live stages once and carries their confirmation through final handoff', () => {
  const { analyzer, workers } = setup();
  const listener = vi.fn((request: AnalysisInput, snapshot: AnalysisSnapshot) => analyzer.rememberLive('live', request, snapshot));
  const stream = createLiveReconstructionStream(listener, analyzer);
  disposers.push(() => stream.dispose());
  const first = input();
  first.text.moves = [{ m: "R'", ts: 1000 }, { m: 'U', ts: 1400 }];
  first.text.totalMs = 1400;
  const line = { kind: 'cross' as const, key: 'cross', moves: ["R'"], fromIdx: 0, toIdx: 0,
    label: 'draft', recognitionMs: 0, executionMs: 1000, stepMs: 1000 };
  const draft = { ...recognizedText, lines: [line] };
  const corrected = { ...draft, lines: [{ ...line, label: 'confirmed' }] };
  stream.update(first);
  vi.advanceTimersByTime(1);
  workers[0].reply({ patch: { text: draft } });
  expect(listener.mock.calls.filter(([, value]) => value.text)).toHaveLength(0);
  workers[0].reply({ patch: { text: corrected }, done: true });
  expect(listener.mock.calls.filter(([, value]) => value.text)).toHaveLength(1);
  const next = { ...first, text: { ...first.text, moves: [...first.text.moves, { m: "U'", ts: 1700 }], totalMs: 1700 } };
  stream.update(next);
  vi.advanceTimersByTime(5);
  expect(workers[0].requests.at(-1)!.input.text.confirmed!.lines).toEqual(corrected.lines);
  analyzer.handoff('live', 'saved');
  stream.dispose();
  const finalListener = vi.fn();
  analyzer.subscribe(next, finalListener, 'saved');
  expect(finalListener).toHaveBeenLastCalledWith(expect.objectContaining({ text: corrected, provisional: true }));
  vi.advanceTimersByTime(5);
  expect(workers.at(-1)!.requests.at(-1)!.input.text.confirmed!.lines).toEqual(corrected.lines);
  workers.at(-1)!.reply({ patch: { text: corrected }, done: true });
  expect(analyzer.peek(next, 'saved').text).toBe(corrected);
});
