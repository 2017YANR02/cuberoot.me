import { afterEach, describe, expect, it, vi } from 'vitest';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { smartCubeFixupState } from '@cuberoot/shared/smart-cube/scramble-hint';
import { createNativeSmartCubeFixup } from '../src/lib/native-timer-smart-cube-fixup';
import type { NativeTimerWorkerEnvelope } from '../src/lib/native-timer-worker';

afterEach(() => vi.unstubAllGlobals());

describe('native smart cube fixup', () => {
  it('sends the same relative cube state to the shared correction worker', async () => {
    let receive: (reply: unknown) => void = () => {};
    const terminate = vi.fn();
    const postMessage = vi.fn((job: NativeTimerWorkerEnvelope) => {
      const { id } = job.payload as { id: number };
      receive({ ...job, payload: { id, ok: true, value: { kind: 'scramble', scramble: 'U' } } });
    });
    const createWorker = vi.fn(() => ({
      postMessage, terminate, onMessage: (listener: typeof receive) => { receive = listener; },
    }));
    vi.stubGlobal('wx', { createWorker });
    const adapter = createNativeSmartCubeFixup();
    const from = smartCubeTargetFacelets('R')!;
    const target = smartCubeTargetFacelets('R U')!;
    try {
      expect(await adapter.solve(from, target)).toBe('U');
      expect(createWorker).toHaveBeenCalledWith('workers/timer.js');
      expect(postMessage.mock.calls[0][0]).toMatchObject({
        channel: 'trainer', payload: { request: { kind: 'solve-state', state: smartCubeFixupState(from, target) } },
      });
    } finally { adapter.release(); }
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('leaves a matched or invalid physical state alone', async () => {
    const createWorker = vi.fn();
    vi.stubGlobal('wx', { createWorker });
    const adapter = createNativeSmartCubeFixup();
    const from = smartCubeTargetFacelets('R')!;
    expect(await adapter.solve(from, from)).toBeNull();
    expect(await adapter.solve(from, 'invalid')).toBeNull();
    expect(createWorker).not.toHaveBeenCalled();
  });
});
