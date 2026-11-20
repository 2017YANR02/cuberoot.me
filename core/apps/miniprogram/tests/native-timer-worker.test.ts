import { describe, expect, it, vi } from 'vitest';
import { createTimerWorkerRpc } from '@cuberoot/shared/timer/worker-rpc';
import {
  createNativeTimerWorkerHost,
  type NativeTimerWorkerChannel,
  type NativeTimerWorkerEnvelope,
  type NativeWorker,
} from '../src/lib/native-timer-worker';

class WorkerFixture implements NativeWorker {
  received: NativeTimerWorkerEnvelope[] = [];
  private listener?: (message: unknown) => void;
  terminate = vi.fn();

  onMessage(listener: (message: unknown) => void): void { this.listener = listener; }
  postMessage(envelope: NativeTimerWorkerEnvelope): void { this.received.push(envelope); }
  answer(index: number, value: string): void {
    const job = this.received[index]!;
    const { id } = job.payload as { id: number };
    this.listener?.({ ...job, payload: { id, ok: true, value } });
  }
  intermediate(index: number, payload: unknown): void {
    this.listener?.({ ...this.received[index], intermediate: true, payload });
  }
}

function fixture() {
  const workers: WorkerFixture[] = [];
  const open = createNativeTimerWorkerHost(() => {
    const worker = new WorkerFixture();
    workers.push(worker);
    return worker;
  });
  const rpc = (channel: NativeTimerWorkerChannel) => createTimerWorkerRpc<string, string>({
    createWorker: () => open(channel), makeRequest: (id, request) => ({ id, request }), label: channel,
  });
  return { workers, open, rpc };
}

describe('native timer shared worker host', () => {
  it('keeps a streaming analysis active while it requests a library', async () => {
    const { workers, open, rpc } = fixture();
    const analysis = open('live-analysis');
    const results: unknown[] = [];
    analysis.addEventListener('message', event => {
      results.push(event.data);
      if (event.data === 'load-library') analysis.respond('library-data');
    });
    analysis.postMessage({ id: 1 });
    const trainer = rpc('trainer');
    const hint = trainer.request('next');
    const worker = workers[0]!;
    worker.intermediate(0, 'load-library');
    expect(results).toEqual(['load-library']);
    expect(worker.received.map(job => job.channel)).toEqual(['live-analysis', 'live-analysis']);
    expect(worker.received[1]).toMatchObject({ sequence: worker.received[0]!.sequence, intermediate: true, payload: 'library-data' });
    worker.answer(0, 'analysis-complete');
    expect(worker.received[2]!.channel).toBe('trainer');
    worker.answer(2, 'scramble');
    expect(await hint).toBe('scramble');
    analysis.terminate();
    trainer.dispose();
  });

  it('runs independent RPC clients without opening a second native worker', async () => {
    const { workers, rpc } = fixture();
    const trainer = rpc('trainer');
    const solver = rpc('stage-solver');
    const first = trainer.request('generate');
    const second = solver.request('hint');
    expect(workers).toHaveLength(1);
    expect(workers[0]!.received.map(job => job.channel)).toEqual(['trainer']);
    workers[0]!.answer(0, 'scramble');
    expect(await first).toBe('scramble');
    expect(workers[0]!.received.map(job => job.channel)).toEqual(['trainer', 'stage-solver']);
    workers[0]!.answer(1, 'solution');
    expect(await second).toBe('solution');
    trainer.dispose();
    expect(workers[0]!.terminate).not.toHaveBeenCalled();
    solver.dispose();
    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
  });

  it('restarts after an executing task is cancelled while keeping another current request', async () => {
    const { workers, rpc } = fixture();
    const trainer = rpc('trainer');
    const solver = rpc('stage-solver');
    const abort = new AbortController();
    const first = trainer.request('generate', abort.signal).catch(error => (error as Error).message);
    const second = solver.request('hint');
    abort.abort();
    expect(await first).toBe('trainer request aborted');
    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
    expect(workers).toHaveLength(2);
    expect(workers[1]!.received.map(job => job.channel)).toEqual(['stage-solver']);
    workers[0]!.answer(0, 'stale');
    workers[1]!.answer(0, 'current');
    expect(await second).toBe('current');
    trainer.dispose();
    solver.dispose();
  });

  it('drops a cancelled queued request without interrupting the active thread', async () => {
    const { workers, rpc } = fixture();
    const trainer = rpc('trainer');
    const solver = rpc('stage-solver');
    const abort = new AbortController();
    const first = trainer.request('generate');
    const second = solver.request('hint', abort.signal).catch(error => (error as Error).message);
    abort.abort();
    expect(await second).toBe('stage-solver request aborted');
    expect(workers).toHaveLength(1);
    expect(workers[0]!.terminate).not.toHaveBeenCalled();
    workers[0]!.answer(0, 'scramble');
    expect(await first).toBe('scramble');
    expect(workers[0]!.received).toHaveLength(1);
    trainer.dispose();
    solver.dispose();
  });
});
