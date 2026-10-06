import { describe, expect, it, vi } from 'vitest';
import { createTimerRandomScramblePool } from '@cuberoot/shared/timer/random-scramble-pool';
import type { TimerScrambleRequest, TimerScrambleResult } from '@cuberoot/shared/timer';
const ready = (event: TimerScrambleRequest['event'], scramble: string): TimerScrambleResult => ({
  ok: true, kind: 'generated', event, provider: 'cubing', scramble,
});
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('ordinary random buffer', () => {
  it('bounds prefetch, retains metadata, and consumes each generated slot once', async () => {
    let index = 0;
    const generate = vi.fn(async (request: TimerScrambleRequest) => ({ ...ready(request.event, `R ${++index}`), metadata: { caseId: 'OLL-1' } }));
    const pool = createTimerRandomScramblePool(generate);
    const request = { event: 'oll' as const, trainerCaseIds: ['OLL-1'] };
    const first = await pool.next(request); await tick();
    expect(first).toMatchObject({ scramble: 'R 1', metadata: { caseId: 'OLL-1' } });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(await pool.next(request)).toMatchObject({ scramble: 'R 2' });
    pool.reset();
  });
  it('cancels old waiters without swallowing the next same-context result', async () => {
    const pending: Array<(value: TimerScrambleResult) => void> = [];
    const pool = createTimerRandomScramblePool(() => new Promise(resolve => pending.push(resolve)));
    const abort = new AbortController();
    const old = pool.next({ event: '333' }, abort.signal); abort.abort();
    const current = pool.next({ event: '333' });
    pending[0](ready('333', 'R U'));
    expect(await old).toMatchObject({ ok: false });
    expect(await current).toMatchObject({ scramble: 'R U' });
    pool.reset();
  });
  it('rejects late A through A → B → A and aborts the old provider work', async () => {
    const pending: Array<{ resolve: (value: TimerScrambleResult) => void; signal: AbortSignal }> = [];
    const pool = createTimerRandomScramblePool((_request, signal) => new Promise(resolve => pending.push({ resolve, signal })));
    const a = pool.next({ event: '333' });
    const b = pool.next({ event: '222' });
    const nextA = pool.next({ event: '333' });
    expect(pending[0].signal.aborted).toBe(true);
    expect(pending[2].signal.aborted).toBe(true);
    pending[0].resolve(ready('333', 'OLD'));
    pending[4].resolve(ready('333', 'NEW'));
    expect(await a).toMatchObject({ ok: false });
    expect(await b).toMatchObject({ ok: false });
    expect(await nextA).toMatchObject({ scramble: 'NEW' });
    pool.reset();
  });
  it('isolates color, pocket mode, type and case subset identities', async () => {
    const signals: AbortSignal[] = [];
    const pool = createTimerRandomScramblePool(async (request, signal) => { signals.push(signal); return ready(request.event, 'R'); });
    pool.take({ event: '222', scramble222Mode: 'wca' });
    pool.take({ event: '222', scramble222Mode: 'optimal' });
    pool.take({ event: '222', scramble222Type: 'cll' });
    pool.take({ event: 'oll', trainerCaseIds: ['a'] });
    pool.take({ event: 'oll', trainerCaseIds: ['b'] });
    pool.take({ event: 'oll', trainerCaseIds: ['b'], cnMode: 'six' });
    expect(signals.slice(0, -2).every(signal => signal.aborted)).toBe(true);
    pool.reset();
  });
  it('allows only custom empty slots and retries a failed generator', async () => {
    const generate = vi.fn(async (request: TimerScrambleRequest) => ready(request.event, ''));
    const pool = createTimerRandomScramblePool(generate);
    expect(await pool.next({ event: 'custom' })).toEqual({ ok: true, kind: 'manual', event: 'custom', scramble: '' });
    expect(generate).not.toHaveBeenCalled();
    expect(await pool.next({ event: '333' })).toMatchObject({ ok: false });
    generate.mockImplementation(async request => ready(request.event, 'R U'));
    expect(await pool.next({ event: '333' })).toMatchObject({ scramble: 'R U' });
    pool.reset();
  });
  it('times out stalled generation without automatic retry loops', async () => {
    vi.useFakeTimers();
    const generate = vi.fn(() => new Promise<TimerScrambleResult>(() => {}));
    const pool = createTimerRandomScramblePool(generate);
    const pending = pool.next({ event: '333' });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await pending).toMatchObject({ ok: false, code: 'generation-failed' });
    expect(generate).toHaveBeenCalledTimes(2);
    pool.reset(); vi.useRealTimers();
  });
});
