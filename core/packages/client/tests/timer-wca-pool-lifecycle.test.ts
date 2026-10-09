import { afterEach, expect, it, vi } from 'vitest';
import { createWcaScramblePool, type WcaPoolDependencies, type WcaSourceSpec } from '@cuberoot/timer-ui/wca-scramble-pool';
const spec: WcaSourceSpec = { event: '333', mode: 'date', comp: '', compName: '', round: '', group: '', from: '', to: '', optimal: false };
const item = (n: number) => ({ scramble: 'R U', ci: 'Same2026', cn: 'Same', e: '333', r: '1', g: 'A', n, x: 0 });
const response = (rows: unknown[]) => new Response(JSON.stringify({ scrambles: rows }), { status: 200 });
const difficulty = { getCompetitionCoverage: () => null, probeCompetitionCoverage: async () => null } as unknown as WcaPoolDependencies['difficulty'];
const pools: ReturnType<typeof createWcaScramblePool>[] = [];
function pool(fetcher: typeof fetch, extra: Partial<WcaPoolDependencies> = {}) {
  const value = createWcaScramblePool({ apiUrl: p => p, fetcher, loadCompetition: async () => [], loadExamples: async () => null, difficulty, storage: () => null, ...extra });
  pools.push(value); return value;
}
afterEach(() => { pools.splice(0).forEach(p => p.dispose()); vi.useRealTimers(); });
it('a cancelled waiter cannot eat an official slot or abort another waiter sharing its fill', async () => {
  let deliver!: (value: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { deliver = resolve; }));
  const p = pool(fetcher);
  const abort = new AbortController();
  const first = p.nextWcaRow(spec, abort.signal);
  const second = p.nextWcaRow(spec);
  abort.abort();
  deliver(response([item(1), item(2)]));
  expect(await first).toBeNull();
  expect((await second)?.meta?.n).toBe(1);
  expect((await p.nextWcaRow(spec))?.meta?.n).toBe(2);
  expect(p.wcaPoolProgress(spec)).toEqual({ total: 2, seen: 2 });
  await p.nextWcaRow(spec);
  expect(fetcher).toHaveBeenCalledOnce();
});
it('bounds a fetch that ignores abort and rejects its late results after a replacement fill', async () => {
  vi.useFakeTimers();
  let late!: (value: Response) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { late = resolve; })).mockResolvedValue(response([item(2)]));
  const p = pool(fetcher, { requestTimeoutMs: 20 });
  const first = p.nextWcaRow(spec);
  await vi.advanceTimersByTimeAsync(20);
  expect(await first).toBeNull();
  expect(p.isWcaSourceEmpty(spec)).toBe(false);
  expect((await p.nextWcaRow(spec))?.meta?.n).toBe(2);
  late(response([item(1)]));
  await vi.advanceTimersByTimeAsync(1);
  expect((await p.nextWcaRow(spec))?.meta?.n).toBe(2);
});
it('200 empty is retryable and a bounded date sample is never declared a closed set', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response([])).mockImplementation(() => Promise.resolve(response([item(1)])));
  const p = pool(fetcher);
  const dated = { ...spec, from: '2026-01-01' };
  expect(await p.nextWcaRow(dated)).toBeNull();
  expect(p.isWcaSourceEmpty(dated)).toBe(false);
  expect((await p.nextWcaRow(dated))?.meta?.n).toBe(1);
  expect(p.wcaPoolProgress(dated)).toBeNull();
  await p.nextWcaRow(dated);
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('source cancellation settles promptly and cannot overwrite the new same-source queue', async () => {
  let late!: (value: Response) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { late = resolve; })).mockResolvedValue(response([item(3)]));
  const p = pool(fetcher);
  const abort = new AbortController();
  const old = p.nextWcaRow(spec, abort.signal);
  abort.abort(); p.cancelSource(spec);
  const current = p.nextWcaRow(spec);
  expect(await old).toBeNull();
  expect((await current)?.meta?.n).toBe(3);
  late(response([item(1)]));
  await Promise.resolve();
  expect((await p.nextWcaRow(spec))?.meta?.n).toBe(3);
});
it('recovers after an examples loader ignores cancellation and never settles', async () => {
  vi.useFakeTimers();
  const loadExamples = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(null);
  const fetcher = vi.fn(async () => response([{ ...item(1), e: '222', scramble: "R' U' F U F R' U2 F U2" }]));
  const p = pool(fetcher, { loadExamples, requestTimeoutMs: 20 });
  const filtered: WcaSourceSpec = { ...spec, event: '222', typeFilter: 'nobar' };
  const first = p.nextWcaRow(filtered);
  await vi.advanceTimersByTimeAsync(20);
  expect(await first).toBeNull();
  expect((await p.nextWcaRow(filtered))?.meta?.n).toBe(1);
  expect(loadExamples).toHaveBeenCalledTimes(2);
  expect(p.isWcaSourceEmpty(filtered)).toBe(false);
});
it('migrates a legacy source only once across factory restarts after consuming its queue', async () => {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  const storage: Storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
    get length() { return values.size; }, clear: () => values.clear(), key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key); } };
  const { scramble, ...meta } = item(1);
  const restoreSource = vi.fn(() => [{ scramble, meta: { ...meta, x: 0 as const }, slot: null }]);
  const deps = { storage: () => storage, restoreSource };
  const fetcher = vi.fn(async () => response([]));
  const first = pool(fetcher, deps);
  expect(first.peekWcaRow(spec)?.meta?.n).toBe(1);
  await vi.advanceTimersByTimeAsync(601);
  first.dispose();
  const second = pool(fetcher, deps);
  expect(await second.nextWcaRow(spec)).toBeNull();
  expect(restoreSource).toHaveBeenCalledOnce();
});
it('keeps one competition queue when coverage changes from unknown to unindexed', async () => {
  let coverage: boolean | null = null;
  const adapter = { ...difficulty, getCompetitionCoverage: () => coverage,
    probeCompetitionCoverage: async () => { coverage = false; return false; } };
  const loadCompetition = vi.fn(async () => [1, 2, 3].map(n => ({ eventId: '333', roundTypeId: '1', groupId: 'A', scrambleNumber: n, isExtra: false, scramble: 'R U', optimalScramble: null })));
  const p = pool(vi.fn(), { difficulty: adapter, loadCompetition });
  const filtered: WcaSourceSpec = { ...spec, mode: 'comp', comp: 'Same2026', optimal: true,
    diff: { variant: 'std', stage: 'cross', colors: 'WY', steps: [3], merged: false } };
  const identity = p.sourceKey(filtered);
  expect((await p.nextWcaRow(filtered))?.meta?.n).toBe(1);
  expect(coverage).toBe(false);
  expect(p.sourceKey(filtered)).toBe(identity);
  expect((await p.nextWcaRow(filtered))?.meta?.n).toBe(2);
  expect((await p.nextWcaRow(filtered))?.meta?.n).toBe(3);
  expect(loadCompetition).toHaveBeenCalledOnce();
});
