import { afterEach, expect, it, vi } from 'vitest';
import { formatTimerCompoundScramble, TIMER_COMPOUND_SCRAMBLE_CHILDREN } from '@cuberoot/shared/timer/compound-scramble';
import { generateSeededBasicWcaScramble, generateTimedWcaScramble } from '@cuberoot/shared/timer/seeded/wca';
import { rngFor } from '@cuberoot/shared/timer/seeded/seeded_rng';
import { createTimerStoreSettings } from '@cuberoot/shared/timer/persistence';
import { createNativeWcaRandomScramble } from '../src/lib/native-timer-random-scramble';
import { nativeTimerSettingsModel, nativeTimerSyncSeedPatch } from '../src/lib/native-timer-settings';
import type { NativeTimerWorkerEnvelope, NativeWorker } from '../src/lib/native-timer-worker';

afterEach(() => vi.unstubAllGlobals());

it('preserves the seeded sequence for regular, fewest-moves, and multi-blind scrambles', () => {
  const ticket = { seed: '相同试题', index: 4, revision: 1 };
  const sequential = rngFor(ticket.seed, ticket.index);
  const expected = generateTimedWcaScramble('333', sequential);
  expect(generateSeededBasicWcaScramble({ event: '333', ticket })).toBe(expected);
  expect(generateSeededBasicWcaScramble({ event: '333fm', ticket })).toBe(expected);
  const multi = rngFor(ticket.seed, ticket.index);
  const children = TIMER_COMPOUND_SCRAMBLE_CHILDREN['333mbld'].map(event => generateTimedWcaScramble(event, multi));
  expect(generateSeededBasicWcaScramble({ event: '333mbld', ticket })).toBe(formatTimerCompoundScramble('333mbld', children));
});

it('sends the exact recorded seed position over the existing native WCA worker channel without requesting entropy', async () => {
  let deliver!: (message: unknown) => void;
  const worker: NativeWorker = {
    onMessage(listener) { deliver = listener; },
    postMessage: vi.fn(),
    terminate: vi.fn(),
  };
  const entropy = vi.fn();
  vi.stubGlobal('wx', { createWorker: () => worker, getRandomValues: entropy });
  const native = createNativeWcaRandomScramble();
  try {
    const request = { event: '333' as const, ticket: { seed: 'abc', index: 1, revision: 2 } };
    const generating = native.generateSeeded(request);
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'wca-scramble', payload: { id: 1, request },
    }));
    expect(entropy).not.toHaveBeenCalled();
    const envelope = vi.mocked(worker.postMessage).mock.calls[0]![0] as NativeTimerWorkerEnvelope;
    deliver({ ...envelope, payload: { id: 1, ok: true, value: "R U R'" } });
    await expect(generating).resolves.toBe("R U R'");
  } finally { native.dispose(); }
});

it('shares seed guards and revision behavior across apply, reset, and turn off', () => {
  const timer = { event: '333' as const, settings: createTimerStoreSettings(), currentSource: 'random' as const, busy: false, solves: [] };
  expect(nativeTimerSettingsModel(timer).syncSeed).toBeUndefined();
  const context = { syncSeedAvailable: true, syncSeedDraft: '世界 seed' };
  expect(nativeTimerSettingsModel(timer, context, 'zh').syncSeed).toMatchObject({
    label: '种子', draft: '世界 seed', applyDisabled: false, counterDisabled: true,
  });
  expect(nativeTimerSyncSeedPatch(timer, context, 'reset-counter')).toBeUndefined();
  Object.assign(timer.settings, nativeTimerSyncSeedPatch(timer, context, 'apply'));
  timer.settings.syncSeedCounter = 7;
  expect(nativeTimerSyncSeedPatch(timer, context, 'apply')).toBeUndefined();
  expect(nativeTimerSettingsModel(timer, context, 'zh').syncSeed?.counterText).toBe('seed=世界 seed，第 7 个打乱');
  expect(nativeTimerSyncSeedPatch(timer, context, 'reset-counter')).toEqual({ syncSeed: '世界 seed', syncSeedCounter: 0, syncSeedRevision: 2 });
  expect(nativeTimerSyncSeedPatch(timer, context, 'disable')).toEqual({ syncSeed: null, syncSeedCounter: 0, syncSeedRevision: 2 });
});
