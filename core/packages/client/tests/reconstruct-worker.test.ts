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
  postMessage(request: AnalysisRequest) { this.requests.push(request); }
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
