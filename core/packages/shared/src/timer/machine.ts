import { inspectionPenalty, type AutoPenalty } from './inspection';

export type TimerPhase = 'idle' | 'inspecting' | 'holding' | 'ready' | 'running' | 'stopped';

export interface SolveResult {
  timeMs: number;
  inspectionMs: number;
  autoPenalty: AutoPenalty;
}

export interface TimerMachineState {
  phase: TimerPhase;
  lastMs: number | null;
  startedAtMs: number | null;
  inspectionStartedAtMs: number | null;
  pendingInspectionStart: boolean;
}

export interface TimerMachineConfig {
  inspectionSec: number;
  inspectionTrigger: 'down' | 'up';
  maxCubeBackdateMs?: number;
}

export type TimerMachineAction =
  | { type: 'press-down'; nowMs: number }
  | { type: 'press-up'; nowMs: number }
  | { type: 'cancel-press' }
  | { type: 'hold-ready' }
  | { type: 'start-now'; nowMs: number; elapsedMs?: number }
  | { type: 'start-from-cube'; nowMs: number; atMs?: number }
  | { type: 'cancel-arm' }
  | { type: 'reset' };

export type TimerMachineEffect =
  | 'inspection-started'
  | 'hold-started'
  | 'hold-cancelled'
  | 'run-started'
  | 'run-stopped'
  | 'arm-cancelled'
  | 'reset';

export interface TimerMachineTransition {
  state: TimerMachineState;
  effects: TimerMachineEffect[];
  solve?: SolveResult;
  accepted?: boolean;
}

const DEFAULT_MAX_CUBE_BACKDATE_MS = 2000;

export function initialTimerMachineState(): TimerMachineState {
  return {
    phase: 'idle',
    lastMs: null,
    startedAtMs: null,
    inspectionStartedAtMs: null,
    pendingInspectionStart: false,
  };
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizedNow(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function startInspection(state: TimerMachineState, nowMs: number): TimerMachineTransition {
  return {
    state: {
      ...state,
      phase: 'inspecting',
      inspectionStartedAtMs: normalizedNow(nowMs),
      pendingInspectionStart: false,
    },
    effects: ['inspection-started'],
  };
}

function startRunning(
  state: TimerMachineState,
  startedAtMs: number,
  effects: TimerMachineEffect[] = ['run-started'],
): TimerMachineTransition {
  return {
    state: {
      ...state,
      phase: 'running',
      lastMs: null,
      startedAtMs: normalizedNow(startedAtMs),
      pendingInspectionStart: false,
    },
    effects,
  };
}

/**
 * Pure timing transition shared by website and native shells.
 *
 * Boundary contract:
 * - Non-finite clocks are normalized instead of leaking NaN into persisted solves.
 * - Negative elapsed values clamp to zero.
 * - Cube turns start only an armed attempt and can backdate by at most the configured limit.
 * - Early release returns to inspection when inspection is active, otherwise idle/stopped.
 * - Inspection penalty is decided at the start instant, never at stop time.
 */
export function transitionTimer(
  state: TimerMachineState,
  action: TimerMachineAction,
  config: TimerMachineConfig,
): TimerMachineTransition {
  if (action.type === 'reset') {
    return { state: initialTimerMachineState(), effects: ['reset'] };
  }

  if (action.type === 'cancel-arm') {
    if (state.phase === 'running') return { state, effects: [], accepted: false };
    return {
      state: {
        ...state,
        phase: state.lastMs === null ? 'idle' : 'stopped',
        inspectionStartedAtMs: null,
        pendingInspectionStart: false,
      },
      effects: ['arm-cancelled'],
      accepted: true,
    };
  }

  if (action.type === 'hold-ready') {
    if (state.phase !== 'holding') return { state, effects: [], accepted: false };
    return { state: { ...state, phase: 'ready' }, effects: [], accepted: true };
  }

  if (action.type === 'cancel-press') {
    if (state.phase === 'holding' || state.phase === 'ready') {
      return {
        state: {
          ...state,
          phase: state.inspectionStartedAtMs === null
            ? (state.lastMs === null ? 'idle' : 'stopped')
            : 'inspecting',
          pendingInspectionStart: false,
        },
        effects: ['hold-cancelled'],
        accepted: true,
      };
    }
    if (state.pendingInspectionStart) {
      return {
        state: { ...state, pendingInspectionStart: false },
        effects: ['hold-cancelled'],
        accepted: true,
      };
    }
    return { state, effects: [], accepted: false };
  }

  if (action.type === 'start-now') {
    const nowMs = normalizedNow(action.nowMs);
    const elapsedMs = finiteNonNegative(action.elapsedMs ?? 0);
    return startRunning(
      { ...state, inspectionStartedAtMs: null },
      nowMs - elapsedMs,
    );
  }

  if (action.type === 'start-from-cube') {
    const armed = state.phase === 'inspecting' || state.phase === 'holding' || state.phase === 'ready';
    if (!armed) return { state, effects: [], accepted: false };

    const nowMs = normalizedNow(action.nowMs);
    const requestedAt = action.atMs === undefined || !Number.isFinite(action.atMs)
      ? nowMs
      : action.atMs;
    const maxBackdateMs = finiteNonNegative(
      config.maxCubeBackdateMs ?? DEFAULT_MAX_CUBE_BACKDATE_MS,
    );
    const startedAtMs = Math.min(nowMs, Math.max(nowMs - maxBackdateMs, requestedAt));
    return { ...startRunning(state, startedAtMs), accepted: true };
  }

  if (action.type === 'press-up') {
    if (state.pendingInspectionStart && (state.phase === 'idle' || state.phase === 'stopped')) {
      return startInspection(state, action.nowMs);
    }
    if (state.phase === 'ready') return startRunning(state, action.nowMs);
    if (state.phase === 'holding') {
      return {
        state: {
          ...state,
          phase: state.inspectionStartedAtMs === null
            ? (state.lastMs === null ? 'idle' : 'stopped')
            : 'inspecting',
        },
        effects: ['hold-cancelled'],
      };
    }
    return { state, effects: [] };
  }

  const nowMs = normalizedNow(action.nowMs);
  if (state.phase === 'running') {
    const startedAtMs = state.startedAtMs ?? nowMs;
    const timeMs = finiteNonNegative(nowMs - startedAtMs);
    const inspectionMs = state.inspectionStartedAtMs === null
      ? 0
      : finiteNonNegative(startedAtMs - state.inspectionStartedAtMs);
    const solve: SolveResult = {
      timeMs,
      inspectionMs,
      autoPenalty: inspectionPenalty(inspectionMs, config.inspectionSec),
    };
    return {
      state: {
        ...state,
        phase: 'stopped',
        lastMs: timeMs,
        startedAtMs: null,
        inspectionStartedAtMs: null,
        pendingInspectionStart: false,
      },
      effects: ['run-stopped'],
      solve,
    };
  }

  if (state.phase === 'idle' || state.phase === 'stopped') {
    if (config.inspectionSec > 0) {
      if (config.inspectionTrigger === 'up') {
        return {
          state: { ...state, pendingInspectionStart: true },
          effects: [],
        };
      }
      return startInspection(state, nowMs);
    }
    return {
      state: { ...state, phase: 'holding', pendingInspectionStart: false },
      effects: ['hold-started'],
    };
  }

  if (state.phase === 'inspecting') {
    return {
      state: { ...state, phase: 'holding' },
      effects: ['hold-started'],
    };
  }

  return { state, effects: [] };
}
