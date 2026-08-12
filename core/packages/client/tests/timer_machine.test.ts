import { describe, expect, it } from 'vitest';

import {
  initialTimerMachineState,
  transitionTimer,
  type TimerMachineConfig,
  type TimerMachineState,
} from '@cuberoot/shared/timer';

const noInspection: TimerMachineConfig = {
  inspectionSec: 0,
  inspectionTrigger: 'down',
};

const inspection: TimerMachineConfig = {
  inspectionSec: 15,
  inspectionTrigger: 'down',
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

  it('supports inspection starting on release', () => {
    const config = { ...inspection, inspectionTrigger: 'up' as const };
    const pressed = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 10 }, config);
    expect(pressed.state.phase).toBe('idle');
    expect(pressed.state.pendingInspectionStart).toBe(true);

    const released = apply(pressed.state, { type: 'press-up', nowMs: 20 }, config);
    expect(released.state.phase).toBe('inspecting');
    expect(released.state.inspectionStartedAtMs).toBe(20);
  });

  it('clears a pending release-triggered inspection when the press is cancelled', () => {
    const config = { ...inspection, inspectionTrigger: 'up' as const };
    const pending = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 10 }, config).state;
    const cancelled = apply(pending, { type: 'cancel-press' }, config);
    expect(cancelled.state).toEqual(initialTimerMachineState());
    expect(cancelled.effects).toEqual(['hold-cancelled']);
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

  it('starts from a cube only while armed and clamps its timestamp', () => {
    const idle = initialTimerMachineState();
    expect(apply(idle, { type: 'start-from-cube', nowMs: 10_000, atMs: 5_000 }).accepted).toBe(false);

    const armed = apply(idle, { type: 'press-down', nowMs: 8_000 }, inspection).state;
    const started = apply(armed, { type: 'start-from-cube', nowMs: 10_000, atMs: 5_000 }, inspection);
    expect(started.accepted).toBe(true);
    expect(started.state.startedAtMs).toBe(8_000);
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

  it('reset and cancel clear pending inspection state', () => {
    const config = { ...inspection, inspectionTrigger: 'up' as const };
    const pending = apply(initialTimerMachineState(), { type: 'press-down', nowMs: 0 }, config).state;
    expect(apply(pending, { type: 'cancel-arm' }, config).state).toEqual(initialTimerMachineState());
    expect(apply(pending, { type: 'reset' }, config).state).toEqual(initialTimerMachineState());
  });
});
