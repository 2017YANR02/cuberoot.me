import { describe, expect, it } from 'vitest';

import {
  initialTimerMachineState,
  transitionTimer,
  type TimerMachineConfig,
  type TimerMachineState,
} from '@cuberoot/shared/timer';

const noInspection: TimerMachineConfig = {
  inspectionSec: 0,
};

const inspection: TimerMachineConfig = {
  inspectionSec: 15,
};

function apply(
  state: TimerMachineState,
  action: Parameters<typeof transitionTimer>[1],
  config = noInspection,
) {
  return transitionTimer(state, action, config);
}

describe('shared timer machine', () => {
  it('runs the hold, ready, start and stop cycle without inspection', () => {
    let state = initialTimerMachineState();
    let step = apply(state, { type: 'press-down', nowMs: 100 });
    expect(step.state.phase).toBe('holding');
    expect(step.effects).toEqual(['hold-started']);

    step = apply(step.state, { type: 'hold-ready' });
    expect(step.state.phase).toBe('ready');

    step = apply(step.state, { type: 'press-up', nowMs: 500 });
    expect(step.state.phase).toBe('running');
    expect(step.state.startedAtMs).toBe(500);

    step = apply(step.state, { type: 'press-down', nowMs: 2_000 });
    expect(step.state.phase).toBe('stopped');
    expect(step.solve).toEqual({ timeMs: 1_500, inspectionMs: 0, autoPenalty: 'ok' });
  });

  it('returns an early release to its correct idle or stopped phase', () => {
    const holding = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 0 }).state;
    expect(apply(holding, { type: 'press-up', nowMs: 100 }).state.phase).toBe('idle');

    const stopped = { ...holding, lastMs: 1234 };
    expect(apply(stopped, { type: 'press-up', nowMs: 100 }).state.phase).toBe('stopped');
  });

  it('keeps inspection active after an early release', () => {
    const inspecting = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 0 }, inspection).state;
    const holding = apply(inspecting, { type: 'press-down', nowMs: 2_000 }, inspection).state;
    const released = apply(holding, { type: 'press-up', nowMs: 2_100 }, inspection);
    expect(released.state.phase).toBe('inspecting');
    expect(released.state.inspectionStartedAtMs).toBe(0);
  });

  it('cancels an armed press without accidentally starting', () => {
    const holding = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 0 }).state;
    const ready = apply(holding, { type: 'hold-ready' }).state;
    const cancelled = apply(ready, { type: 'cancel-press' });
    expect(cancelled.state.phase).toBe('idle');
    expect(cancelled.effects).toEqual(['hold-cancelled']);

    const inspecting = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 0 }, inspection).state;
    const inspectionReady = apply(
      apply(inspecting, { type: 'press-down', nowMs: 2_000 }, inspection).state,
      { type: 'hold-ready' },
      inspection,
    ).state;
    const inspectionCancelled = apply(inspectionReady, { type: 'cancel-press' }, inspection);
    expect(inspectionCancelled.state.phase).toBe('inspecting');
    expect(inspectionCancelled.state.inspectionStartedAtMs).toBe(0);
  });

  it('starts inspection immediately on press-down', () => {
    const pressed = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 10 }, inspection);
    expect(pressed.state.phase).toBe('inspecting');
    expect(pressed.state.inspectionStartedAtMs).toBe(10);
    expect(pressed.effects).toEqual(['inspection-started']);
  });

  it('locks inspection penalties to the start instant boundaries', () => {
    const begin = (startAt: number) => {
      let state = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 1_000 }, inspection).state;
      state = apply(state, { type: 'press-down', nowMs: startAt - 100 }, inspection).state;
      state = apply(state, { type: 'hold-ready' }, inspection).state;
      return apply(state, { type: 'press-up', nowMs: startAt }, inspection).state;
    };

    expect(apply(begin(16_000), { type: 'press-down', nowMs: 17_000 }, inspection).solve?.autoPenalty).toBe('ok');
    expect(apply(begin(16_001), { type: 'press-down', nowMs: 17_001 }, inspection).solve?.autoPenalty).toBe('+2');
    expect(apply(begin(18_000), { type: 'press-down', nowMs: 19_000 }, inspection).solve?.autoPenalty).toBe('+2');
    expect(apply(begin(18_001), { type: 'press-down', nowMs: 19_001 }, inspection).solve?.autoPenalty).toBe('DNF');
  });

  it('keeps the start-time inspection penalty after settings change mid-run', () => {
    const changedSettings = { ...inspection, inspectionSec: 0 };
    let state = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 0 }, inspection).state;
    state = apply(state, { type: 'press-down', nowMs: 15_701 }, inspection).state;
    state = apply(state, { type: 'hold-ready' }, inspection).state;
    state = apply(state, { type: 'press-up', nowMs: 16_001 }, inspection).state;

    const stopped = apply(state, { type: 'press-down', nowMs: 17_001 }, changedSettings);
    expect(stopped.solve).toEqual({ timeMs: 1_000, inspectionMs: 16_001, autoPenalty: '+2' });
  });

  it('freezes inspection settings when inspection starts', () => {
    const disabled = { ...inspection, inspectionSec: 0 };
    let state = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 0 }, inspection).state;
    expect(state.inspectionSec).toBe(15);
    state = apply(state, { type: 'press-down', nowMs: 15_701 }, disabled).state;
    state = apply(state, { type: 'hold-ready' }, disabled).state;
    const started = apply(state, { type: 'press-up', nowMs: 16_001 }, disabled).state;
    expect(started.autoPenalty).toBe('+2');

    const holding = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 0 }, disabled).state;
    const ready = apply(holding, { type: 'hold-ready' }, inspection).state;
    const noInspectionRun = apply(ready, { type: 'press-up', nowMs: 1_000 }, inspection).state;
    expect(noInspectionRun.autoPenalty).toBe('ok');
  });

  it('starts from a cube only while armed and clamps its timestamp', () => {
    const idle = initialTimerMachineState();
    expect(apply(idle, { type: 'start-from-cube', nowMs: 10_000, atMs: 5_000 }).accepted).toBe(false);

    const armed = apply(idle, { type: 'press-down', nowMs: 8_000 }, inspection).state;
    const started = apply(armed, { type: 'start-from-cube', nowMs: 10_000, atMs: 5_000 }, inspection);
    expect(started.accepted).toBe(true);
    expect(started.state.startedAtMs).toBe(8_000);
  });

  it('stops at the calibrated cube timestamp without counting delivery delay', () => {
    const running: TimerMachineState = {
      phase: 'running',
      lastMs: null,
      startedAtMs: 20_000,
      inspectionStartedAtMs: 3_999,
      inspectionSec: 15,
      autoPenalty: '+2',
    };
    const stopped = apply(running, {
      type: 'stop-from-cube',
      nowMs: 25_120,
      atMs: 25_000,
    }, inspection);

    expect(stopped.accepted).toBe(true);
    expect(stopped.solve).toEqual({
      timeMs: 5_000,
      inspectionMs: 16_001,
      autoPenalty: '+2',
    });
  });

  it('clamps future cube stop timestamps to arrival and falls back when absent', () => {
    const running = apply(initialTimerMachineState(), {
      type: 'start-now',
      nowMs: 10_000,
    }).state;

    const future = apply(running, {
      type: 'stop-from-cube',
      nowMs: 12_000,
      atMs: 12_500,
    });
    expect(future.solve?.timeMs).toBe(2_000);

    const absent = apply(running, {
      type: 'stop-from-cube',
      nowMs: 12_100,
    });
    expect(absent.solve?.timeMs).toBe(2_100);

    const invalid = apply(running, {
      type: 'stop-from-cube',
      nowMs: 12_200,
      atMs: Number.NaN,
    });
    expect(invalid.solve?.timeMs).toBe(2_200);
  });

  it('rejects stale cube stops and cube stops outside a running attempt', () => {
    const running = apply(initialTimerMachineState(), {
      type: 'start-now',
      nowMs: 10_000,
    }).state;
    const stale = apply(running, {
      type: 'stop-from-cube',
      nowMs: 12_000,
      atMs: 9_999,
    });
    expect(stale.accepted).toBe(false);
    expect(stale.state).toBe(running);
    expect(stale.solve).toBeUndefined();

    const idle = initialTimerMachineState();
    const outsideRun = apply(idle, {
      type: 'stop-from-cube',
      nowMs: 12_000,
      atMs: 11_900,
    });
    expect(outsideRun.accepted).toBe(false);
    expect(outsideRun.state).toBe(idle);
  });

  it('normalizes invalid and negative elapsed inputs', () => {
    const started = apply(initialTimerMachineState(), {
      type: 'start-now',
      nowMs: Number.NaN,
      elapsedMs: -10,
    });
    const stopped = apply(started.state, { type: 'press-down', nowMs: Number.NaN });
    expect(stopped.solve?.timeMs).toBe(0);
  });

  it('uses the exact external-timer reading when stopping', () => {
    const running = apply(initialTimerMachineState(), {
      type: 'start-now',
      nowMs: 10_000,
      elapsedMs: 321,
    }).state;
    const stopped = apply(running, {
      type: 'stop-external',
      timeMs: 12_345,
      inspectionMs: 8_123,
    });

    expect(stopped.state.phase).toBe('stopped');
    expect(stopped.state.lastMs).toBe(12_345);
    expect(stopped.solve).toEqual({
      timeMs: 12_345,
      inspectionMs: 8_123,
      autoPenalty: 'ok',
    });
    expect(stopped.effects).toEqual(['run-stopped']);
  });

  it('still records an external stop when its RUNNING notification was missed', () => {
    const stopped = apply(initialTimerMachineState(), {
      type: 'stop-external',
      timeMs: 9876,
    });

    expect(stopped.state.phase).toBe('stopped');
    expect(stopped.solve?.timeMs).toBe(9876);
  });

  it('cancel-arm clears every pre-run phase when a scramble identity changes', () => {
    const inspecting = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 0 }, inspection).state;
    const holding = apply(inspecting, { type: 'press-down', nowMs: 100 }, inspection).state;
    const ready = apply(holding, { type: 'hold-ready' }, inspection).state;

    expect(inspecting.phase).toBe('inspecting');
    expect(holding.phase).toBe('holding');
    expect(ready.phase).toBe('ready');
    for (const state of [inspecting, holding, ready]) {
      const cancelled = apply(state, { type: 'cancel-arm' }, inspection);
      expect(cancelled.accepted).toBe(true);
      expect(cancelled.state).toEqual(initialTimerMachineState());
      expect(cancelled.effects).toEqual(['arm-cancelled']);
    }
  });

  it('reset clears active inspection state', () => {
    const inspecting = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 0 }, inspection).state;
    expect(apply(inspecting, { type: 'reset' }, inspection).state).toEqual(initialTimerMachineState());
  });
});
