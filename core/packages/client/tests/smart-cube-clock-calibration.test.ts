import { describe, expect, it } from 'vitest';
import { MoveClock, type MoveClockSample } from '@cuberoot/shared/smart-cube/move-clock';
import { SmartCubeSessionController } from '@cuberoot/shared/smart-cube/session';
import { SmartCubeSoloTimerController, type SmartCubeSoloMoveMetadata } from '@cuberoot/shared/smart-cube/solo-timer';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { initialTimerMachineState, transitionTimer, type TimerMachineAction, type TimerMachineConfig } from '@cuberoot/shared/timer/machine';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import { initialLocalBattleState, transitionLocalBattle } from '@cuberoot/shared/timer';

function attempt(config: TimerMachineConfig = { inspectionSec: 0 }) {
  const clock = new MoveClock();
  const producer = new SmartCubeAttemptProducer();
  let machine = initialTimerMachineState();
  let result: number | undefined;
  function dispatch(action: TimerMachineAction) {
    const step = transitionTimer(machine, action, config);
    machine = step.state;
    if (step.effects.includes('run-started')) producer.begin(machine.startedAtMs!, undefined, undefined, machine.cubeStart);
    if (step.solve) result = step.solve.timeMs;
    return step.accepted === true;
  }
  return { clock, producer, dispatch, state: () => machine, result: () => result };
}

describe('calibrated smart-cube timing through production controllers', () => {
  it.each([0.95, 0.993, 1.007, 1.05])('corrects a cold first solve with device rate %s and preserves its saved timeline', rate => {
    const h = attempt();
    let now = 20;
    const solo = new SmartCubeSoloTimerController({
      armFromCube: (atMs, clock) => h.dispatch({ type: 'arm-from-cube', nowMs: now, atMs, clock }),
      autoReadyOnScramble: () => true, canStartAttempt: () => true, isTimingEnabled: () => true,
      getPhase: () => h.state().phase, solve: async () => null,
      startFromCube: (atMs, clock) => h.dispatch({ type: 'start-from-cube', nowMs: now, atMs, clock }),
      stopFromCube: (atMs, clock) => h.dispatch({ type: 'stop-from-cube', nowMs: now, atMs, clock }),
      recordMove: event => { h.producer.recordMove(event.move, event.timestamp, event.clock); },
    });
    const session = new SmartCubeSessionController<SmartCubeSoloMoveMetadata>({ now: () => now,
      onMove: event => { solo.move(event); }, onSolved: (atMs, clock) => { solo.solved(atMs, clock); } });
    const lease = session.open();
    const facelets = smartCubeTargetFacelets('F')!;
    solo.setContext({ event: '333', id: 1, scramble: 'F', targetFacelets: facelets });
    solo.setConnected(true);
    lease.adoptFacelets(facelets);
    h.dispatch({ type: 'arm-from-cube', nowMs: now });
    for (let i = 0; i <= 100; i++) {
      // Four turns share one callback arrival; the last batch has one turn.
      now = Math.min(100, Math.floor(i / 4) * 4 + 3) * 100 + 20;
      lease.move(i < 100 ? 'R' : "F'", 1_000_000 + Math.round(i * 100 * rate));
    }
    expect(h.state().phase).toBe('stopped');
    // Input device ticks are rounded to whole milliseconds.
    expect(Math.abs(h.result()! - 10_000)).toBeLessThan(0.1);
    const saved = h.producer.finish();
    expect(saved.moves).toHaveLength(101);
    expect(saved.moves[0].ts).toBe(0);
    expect(saved.moves.at(-1)!.ts).toBeCloseTo(h.result()!, 8);
    solo.dispose();
  });

  it.each(['manual', 'scrambled'] as const)('retains %s observation without freezing a first-batch offset', trainingStartMode => {
    const h = attempt({ inspectionSec: 15, trainingStartMode });
    for (let real = 0; real <= 25_000; real += 100) {
      const now = Math.min(25_000, Math.floor(real / 400) * 400 + 300) + 20;
      const atMs = h.clock.stamp(1_000_000 + real, now);
      const clock = h.clock.sample;
      if (real === 10_000) h.dispatch({ type: 'arm-from-cube', nowMs: trainingStartMode === 'manual' ? 10_020 : now,
        ...(trainingStartMode === 'scrambled' ? { atMs, clock } : {}) });
      if (real === 15_000) h.dispatch({ type: 'start-from-cube', nowMs: now, atMs, clock });
      if (real >= 15_000) h.producer.recordMove('R', atMs, clock);
      if (real === 25_000) h.dispatch({ type: 'stop-from-cube', nowMs: now, atMs, clock });
    }
    expect(h.result()).toBeCloseTo(15_000, 8);
    const moves = h.producer.finish().moves;
    expect(moves[0].ts).toBeCloseTo(5_000, 8);
    expect(moves.at(-1)!.ts).toBeCloseTo(15_000, 8);
  });

  it('keeps untimed recovered history in the corrected time domain', () => {
    const h = attempt();
    for (let real = 0; real <= 10_000; real += 50) {
      const nowMs = real + 20;
      const atMs = h.clock.stamp(1_000_000 + real * 1.05, nowMs);
      const clock = h.clock.sample;
      if (real === 0) {
        h.dispatch({ type: 'arm-from-cube', nowMs });
        h.dispatch({ type: 'start-from-cube', nowMs, atMs, clock });
      }
      h.producer.recordMove('R', atMs, clock);
      if (real === 9950) {
        const delayed = h.clock.stamp(undefined, 10_020, { delayed: true });
        h.producer.recordMove('U', delayed, h.clock.sample);
      }
      if (real === 10_000) h.dispatch({ type: 'stop-from-cube', nowMs, atMs, clock });
    }
    expect(h.result()).toBeCloseTo(10_000, 8);
    const last = h.producer.finish().moves.slice(-3).map(move => move.ts);
    [9950, 9950, 10_000].forEach((expected, i) => expect(last[i]).toBeCloseTo(expected, 8));
  });

  it('measures a whole short solve delivered in one packet without an arrival-time clamp', () => {
    const h = attempt();
    h.dispatch({ type: 'arm-from-cube', nowMs: 500 });
    for (let device = 0; device <= 300; device += 100) {
      const atMs = h.clock.stamp(device, 500);
      const clock = h.clock.sample;
      if (device === 0) h.dispatch({ type: 'start-from-cube', nowMs: 500, atMs, clock });
      h.producer.recordMove('R', atMs, clock);
      if (device === 300) h.dispatch({ type: 'stop-from-cube', nowMs: 500, atMs, clock });
    }
    expect(h.result()).toBe(300);
    expect(h.producer.finish().moves.map(move => move.ts)).toEqual([0, 100, 200, 300]);
  });

  it('does not calibrate manual/BLD memo time as a first-turn start', () => {
    const h = attempt();
    h.dispatch({ type: 'start-now', nowMs: 100 });
    const atMs = h.clock.stamp(3000, 10_100);
    h.dispatch({ type: 'stop-from-cube', nowMs: 10_100, atMs, clock: h.clock.sample });
    expect(h.state().cubeStart).toBeUndefined();
    expect(h.result()).toBe(10_000);
  });

  it('applies the multiplayer minimum-duration guard to calibrated time even in one packet', () => {
    let state = initialLocalBattleState();
    state.players[0].scramble = 'F';
    const config = { inspectionSec: 0, minSolveMs: 100 };
    const start: MoveClockSample = { epoch: 100, deviceTime: 0, timestamp: 500, hostTime: 500, rate: 1 };
    for (const action of [
      { type: 'arm-from-cube', nowMs: 500 },
      { type: 'start-from-cube', nowMs: 500, atMs: 500, clock: start },
    ] as TimerMachineAction[]) state = transitionLocalBattle(state, { type: 'player-timer', playerId: 0, action }, config).state;
    const result = transitionLocalBattle(state, { type: 'player-timer', playerId: 0,
      action: { type: 'stop-from-cube', nowMs: 500, atMs: 800,
        clock: { ...start, deviceTime: 300, timestamp: 800, hostTime: 800 } } }, config);
    expect(result.accepted).toBe(true);
    expect(result.state.players[0].result?.timeMs).toBe(300);
  });

  it.each(['restart', 'different-device', 'mismatched-callback', 'untimed'] as const)('uses the host fallback after %s', reason => {
    const h = attempt();
    h.dispatch({ type: 'arm-from-cube', nowMs: 100 });
    const first = h.clock.stamp(1000, 100);
    h.dispatch({ type: 'start-from-cube', nowMs: 100, atMs: first, clock: h.clock.sample });
    const other = reason === 'different-device' ? new MoveClock() : h.clock;
    if (reason === 'restart') other.reset();
    const atMs = other.stamp(reason === 'untimed' ? undefined : 3000, 10_100);
    const clock = reason === 'mismatched-callback' ? { ...other.sample!, timestamp: atMs + 1 } : other.sample;
    h.dispatch({ type: 'stop-from-cube', nowMs: 10_100, atMs, clock });
    expect(h.result()).toBe(atMs - 100);
  });

  it('shifts host gyro to the corrected origin without scaling it or changing earlier snapshots', () => {
    const producer = new SmartCubeAttemptProducer();
    const q = { w: 1, x: 0, y: 0, z: 0 };
    const first: MoveClockSample = { epoch: 1, deviceTime: 0, timestamp: 320, hostTime: 320, rate: 1 };
    producer.begin(320, undefined, { reference: q, initial: q }, { sample: first });
    producer.recordMove('R', 320, first);
    producer.recordGyro({ w: 0, x: 1, y: 0, z: 0 }, 100);
    const before = producer.snapshotLive();
    const original = structuredClone(before);
    producer.recordMove('U', 10_500, { epoch: 1, deviceTime: 10_500, timestamp: 10_500, hostTime: 10_020, rate: 1 / 1.05 });
    expect(before).toEqual(original);
    expect(producer.snapshotLive().gyroSamples.map(sample => sample.tMs)).toEqual([0, 400]);
    const saved = producer.finish();
    expect(saved.moves.at(-1)!.ts).toBe(10_000);
    expect(decodeGyroTrack(saved.gyro).map(sample => sample.tMs)).toEqual([0, 400]);
  });
});
