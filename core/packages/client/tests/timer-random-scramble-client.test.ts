import { afterEach, expect, it, vi } from 'vitest';
import { createRandomScrambleClient } from '@cuberoot/timer-ui/random-scramble';
class WorkerFixture {
  static all: WorkerFixture[] = [];
  listeners = new Map<string, (event: { data: unknown }) => void>();
  message: { id: number; request: { event: string; cnMode: string } } | null = null;
  terminate = vi.fn();
  constructor() { WorkerFixture.all.push(this); }
  addEventListener(type: string, callback: (event: { data: unknown }) => void) { this.listeners.set(type, callback); }
  postMessage(message: WorkerFixture['message']) { this.message = message; }
  answer(scramble: string) { this.listeners.get('message')?.({ data: { id: this.message!.id, ok: true, value: { scramble } } }); }
}
afterEach(() => { vi.unstubAllGlobals(); WorkerFixture.all = []; });
it('isolates simultaneous battle transports and releases both cancelled and successful workers', async () => {
  vi.stubGlobal('Worker', WorkerFixture);
  const client = createRandomScrambleClient();
  const abort = new AbortController();
  const first = client.generate({ event: '222' }, abort.signal);
  const second = client.generate({ event: 'kilominx' });
  const [one, two] = WorkerFixture.all;
  expect(WorkerFixture.all).toHaveLength(2);
  expect(one.message!.request).toMatchObject({ event: '222', cnMode: 'none' });
  abort.abort();
  expect(await first).toMatchObject({ ok: false });
  expect(one.terminate).toHaveBeenCalledTimes(1);
  expect(two.terminate).not.toHaveBeenCalled();
  two.answer('R U');
  expect(await second).toMatchObject({ ok: true, event: 'kilominx', scramble: 'R U' });
  expect(two.terminate).toHaveBeenCalledTimes(1);
  one.answer('STALE');
  client.reset();
});
it('does not create a worker for an already cancelled or custom request', async () => {
  vi.stubGlobal('Worker', WorkerFixture);
  const client = createRandomScrambleClient();
  const abort = new AbortController(); abort.abort();
  expect(await client.generate({ event: '222' }, abort.signal)).toMatchObject({ ok: false });
  expect(await client.generate({ event: 'custom' })).toMatchObject({ ok: true, kind: 'manual', scramble: '' });
  expect(WorkerFixture.all).toHaveLength(0);
  client.reset();
});
