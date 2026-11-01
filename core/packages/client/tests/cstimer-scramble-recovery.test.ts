import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class WorkerFake {
  static instances: WorkerFake[] = [];
  listeners = new Map<string, (event: unknown) => void>();
  messages: { id: number; key: string }[] = [];
  terminate = vi.fn();
  constructor() { WorkerFake.instances.push(this); }
  addEventListener(type: string, listener: (event: unknown) => void) { this.listeners.set(type, listener); }
  postMessage(message: { id: number; key: string }) { this.messages.push(message); }
  reply(result: string, error?: string) {
    this.listeners.get('message')?.({ data: { id: this.messages.at(-1)!.id, result, error } });
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  WorkerFake.instances = [];
  vi.stubGlobal('Worker', WorkerFake);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('csTimer queue recovery', () => {
  it('terminates a hung computation and runs a queued different event on a fresh worker', async () => {
    const { cstimerScramble } = await import('@/lib/cstimer-scramble');
    const stuck = cstimerScramble('gear');
    const failure = expect(stuck).rejects.toThrow('aborted');
    const next = cstimerScramble('133');
    await vi.advanceTimersByTimeAsync(0);
    const old = WorkerFake.instances[0];
    expect(old.messages).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60_000);
    await failure;
    expect(old.terminate).toHaveBeenCalledTimes(1);
    const fresh = WorkerFake.instances[1];
    expect(fresh.messages[0].key).toBe('133');
    old.reply('stale');
    fresh.reply('R U');
    await expect(next).resolves.toBe('R U');
  });

  it('recovers after worker load errors without rejecting unrelated queued work', async () => {
    const { cstimerScramble } = await import('@/lib/cstimer-scramble');
    const failure = expect(cstimerScramble('gear')).rejects.toThrow('load failed');
    const next = cstimerScramble('133');
    await vi.advanceTimersByTimeAsync(0);
    WorkerFake.instances[0].listeners.get('error')?.({ message: 'load failed' });
    await vi.advanceTimersByTimeAsync(0);
    await failure;
    WorkerFake.instances[1].reply('U');
    await expect(next).resolves.toBe('U');
  });

  it('rejects empty scrambles but permits an empty solution for an already solved state', async () => {
    const { cstimerScramble, cstimerSolveByKey } = await import('@/lib/cstimer-scramble');
    const failure = expect(cstimerScramble('gear')).rejects.toThrow('Empty');
    const solve = cstimerSolveByKey('sqrs', '');
    await vi.advanceTimersByTimeAsync(0);
    WorkerFake.instances[0].reply('');
    await vi.advanceTimersByTimeAsync(0);
    await failure;
    WorkerFake.instances[0].reply('');
    await expect(solve).resolves.toBe('');
  });
});
