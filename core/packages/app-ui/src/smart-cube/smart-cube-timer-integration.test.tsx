// @vitest-environment jsdom
import { createGanV4Cipher } from '@cuberoot/shared/smart-cube/gan-v4';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { activeTimerSolves, TimerSmartCubeMoveRecorder, type TimerPhase, type TimerStoreData } from '@cuberoot/shared/timer';
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerRepository, type TimerStoreDriver } from '../data/timer-repository';
import { useTimerController, type TimerController } from '../hooks/use-timer-controller';
import type { InstalledAppSmartCube } from '../platform';
import type { BleTransport } from './transport';
import { useInstalledSmartCube } from './use-smart-cube';
import { GAN_V4_FIXTURE } from './gan-v4.fixture';

/** Real encrypted GAN driver -> hook -> existing timer machine/recorder -> repository.
 * Only radio delivery, browser clock and durable storage transport are substituted.
 */
describe('installed smart-cube timing and move persistence', () => {
  let root: Root;
  let container: HTMLDivElement;
  let cube: InstalledAppSmartCube;
  let timer: TimerController;
  let repository: TimerRepository;
  let clock: number;
  let recoverTail: boolean;
  let notify: (value: DataView) => void;
  let disconnectRadio: () => void;
  let writes: Promise<unknown>[];
  const cipher = createGanV4Cipher(Uint8Array.of(0xab, 0xcd, 0xef, 0x01, 0x23, 0x45));
  const feed = (frame: readonly number[]) => {
    const encrypted = cipher.encrypt(Uint8Array.from(frame));
    notify(new DataView(encrypted.buffer as ArrayBuffer));
  };

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    clock = 10_000; recoverTail = false; writes = [];
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    let stored: TimerStoreData | undefined;
    const driver: TimerStoreDriver = {
      read: async () => structuredClone(stored), readRecovery: async () => undefined,
      write: async (data) => { stored = structuredClone(data); },
      writeWithRecovery: async (data) => { stored = structuredClone(data); },
    };
    let id = 0;
    repository = new TimerRepository(driver, { now: () => 100, createId: () => `cube-${id++}`, language: () => 'en' });
    const sessionId = (await repository.load()).database.activeSessionId;
    let seeded = false;
    const transport: BleTransport = {
      initialize: async () => undefined,
      requestDevice: async () => ({ id: 'AB:CD:EF:01:23:45', name: 'GAN16ui' }),
      connect: async (_id, callback) => { disconnectRadio = callback; },
      disconnect: async () => undefined,
      getMtu: async () => 517,
      read: async () => new DataView(new ArrayBuffer(0)),
      subscribe: async (_id, _service, _char, callback) => {
        notify = callback; return async () => undefined;
      },
      write: async (_id, _service, _char, value) => {
        const command = cipher.decrypt(value);
        if (command[0] === 0xdd && command[3] === 0xed) {
          if (!seeded) { seeded = true; feed(GAN_V4_FIXTURE.seed); }
          else if (recoverTail) feed(GAN_V4_FIXTURE.solved);
        }
        if (command[0] === 0xd1 && recoverTail) feed(GAN_V4_FIXTURE.history);
      },
    };
    function Harness() {
      const phase = useRef<TimerPhase>('idle');
      const recorder = useRef(new TimerSmartCubeMoveRecorder());
      timer = useTimerController({ holdMs: 550, inspectionSec: 0,
        onStart: (at) => { phase.current = 'running'; recorder.current.begin(at); },
        onComplete: (result) => {
          phase.current = 'stopped';
          writes.push(repository.addSolve({ event: '333', scramble: 'R', penalty: result.autoPenalty,
            timeMs: result.timeMs, moves: recorder.current.take(), device: { model: 'gan-v4', name: 'GAN16ui' } }, sessionId));
        },
      });
      phase.current = timer.machine.phase;
      cube = useInstalledSmartCube(() => transport, { language: 'en',
        onMove: (move, timestamp, facelets) => {
          if (phase.current === 'running' || timer.startFromCube(timestamp)) recorder.current.record(move, timestamp);
          else if (facelets === smartCubeTargetFacelets('R')) timer.armFromCube();
        },
        onSolved: (timestamp) => { timer.stopFromCube(timestamp); },
      });
      return <output>{`${cube.phase}:${timer.machine.phase}`}</output>;
    }
    container = document.createElement('div'); document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
    await act(async () => { await cube.connect(); });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove(); vi.restoreAllMocks(); vi.useRealTimers();
  });

  it('keeps first and final moves and device timing when a whole solve arrives in one batch', async () => {
    await act(async () => feed(GAN_V4_FIXTURE.moves[0]));
    clock = 10_750;
    await act(async () => { for (const move of GAN_V4_FIXTURE.moves.slice(1)) feed(move); });
    expect(timer.machine.phase).toBe('stopped');
    await Promise.all(writes);
    const solves = activeTimerSolves(await repository.load(), '333');
    expect(solves).toHaveLength(1);
    expect(solves[0]).toMatchObject({ timeMs: 500, scramble: 'R', device: { model: 'gan-v4', name: 'GAN16ui' },
      moves: [{ m: 'R', ts: 0 }, { m: 'R', ts: 250 }, { m: 'R', ts: 500 }] });
  });

  it('recovers a missing final move, stops once and saves that move before completion', async () => {
    await act(async () => feed(GAN_V4_FIXTURE.moves[0]));
    clock = 10_500;
    await act(async () => { for (const move of GAN_V4_FIXTURE.moves.slice(1, 3)) feed(move); });
    expect(timer.machine.phase).toBe('running');
    recoverTail = true; clock = 11_150;
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(timer.machine.phase).toBe('stopped');
    await act(async () => { feed(GAN_V4_FIXTURE.moves[3]); feed(GAN_V4_FIXTURE.history); });
    await Promise.all(writes);
    const solves = activeTimerSolves(await repository.load(), '333');
    expect(solves).toHaveLength(1);
    // Tail history has no device timestamp/right neighbour: canonical MoveClock honestly
    // falls back to arrival time, not an invented 1750ms device reading.
    expect(solves[0]).toMatchObject({ timeMs: 900,
      moves: [{ m: 'R', ts: 0 }, { m: 'R', ts: 250 }, { m: 'R', ts: 900 }] });
  });

  it('rejects disconnected late frames but preserves the recorded prefix for a manual stop', async () => {
    await act(async () => feed(GAN_V4_FIXTURE.moves[0]));
    clock = 10_500;
    await act(async () => { for (const move of GAN_V4_FIXTURE.moves.slice(1, 3)) feed(move); });
    await act(async () => disconnectRadio());
    await act(async () => feed(GAN_V4_FIXTURE.moves[3]));
    expect(cube.phase).toBe('idle'); expect(timer.machine.phase).toBe('running');
    clock = 11_000;
    await act(async () => { timer.pressDown(clock); });
    await Promise.all(writes);
    const solves = activeTimerSolves(await repository.load(), '333');
    expect(solves).toHaveLength(1);
    expect(solves[0]).toMatchObject({ timeMs: 750,
      moves: [{ m: 'R', ts: 0 }, { m: 'R', ts: 250 }] });
  });
});
