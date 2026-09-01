import { stageSegmentsFor } from './stage-segments-producer';
import type { Solve } from './types';

export type TimerManualStage = 'cross' | 'f2l' | 'oll';

export interface TimerAttemptSplitState {
  stages: Partial<Record<TimerManualStage, number>>;
  memoMs?: number;
}

export interface TimerAttemptSplitOptions {
  bldMemo: boolean;
  multiStage: boolean;
}

export const DEFAULT_TIMER_ATTEMPT_SPLIT_SETTINGS: TimerAttemptSplitOptions = {
  bldMemo: true,
  multiStage: false,
};

export function normalizeTimerAttemptSplitSettings(
  value: Partial<Record<keyof TimerAttemptSplitOptions, unknown>>,
): TimerAttemptSplitOptions {
  return {
    bldMemo: typeof value.bldMemo === 'boolean'
      ? value.bldMemo
      : DEFAULT_TIMER_ATTEMPT_SPLIT_SETTINGS.bldMemo,
    multiStage: typeof value.multiStage === 'boolean'
      ? value.multiStage
      : DEFAULT_TIMER_ATTEMPT_SPLIT_SETTINGS.multiStage,
  };
}

export type TimerAttemptSplitResult = Pick<Solve, 'bld' | 'stages'>;

const MANUAL_STAGES: readonly TimerManualStage[] = ['cross', 'f2l', 'oll'];

function validElapsed(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Runtime-neutral first-sample-wins recorder shared by Web and installed clients. */
export class TimerAttemptSplitRecorder {
  private active = false;
  private manualStages = new Set<TimerManualStage>();
  private options: TimerAttemptSplitOptions = { bldMemo: false, multiStage: false };
  private state: TimerAttemptSplitState = { stages: {} };

  constructor(private readonly onChange?: (state: TimerAttemptSplitState) => void) {}

  begin(options: TimerAttemptSplitOptions): void {
    this.active = true;
    this.options = options;
    this.manualStages.clear();
    this.setState({ stages: {} });
  }

  cancel(): void {
    this.active = false;
    this.manualStages.clear();
    this.setState({ stages: {} });
  }

  markStage(stage: TimerManualStage, elapsedMs: number): void {
    const elapsed = validElapsed(elapsedMs);
    if (!this.active || !this.options.multiStage || elapsed === null) return;
    if (this.state.stages[stage] !== undefined) return;
    this.manualStages.add(stage);
    this.setState({ ...this.state, stages: { ...this.state.stages, [stage]: elapsed } });
  }

  observeMoves(
    solve: Pick<Solve, 'event' | 'moves' | 'scramble' | 'timeMs'>,
  ): void {
    if (!this.active || !this.options.multiStage) return;
    if (validElapsed(solve.timeMs) === null) return;
    const segments = stageSegmentsFor(solve);
    if (!segments) return;
    if (segments.crossDoneMs !== null) this.setAutomaticStage('cross', segments.crossDoneMs);
    if (segments.f2lDoneMs !== null) this.setAutomaticStage('f2l', segments.f2lDoneMs);
    if (segments.ollDoneMs !== null) this.setAutomaticStage('oll', segments.ollDoneMs);
  }

  markMemo(elapsedMs: number): void {
    const elapsed = validElapsed(elapsedMs);
    if (!this.active || !this.options.bldMemo || elapsed === null || this.state.memoMs !== undefined) return;
    this.setState({ ...this.state, memoMs: elapsed });
  }

  finish(finalMs: number): TimerAttemptSplitResult {
    const final = validElapsed(finalMs);
    const result: TimerAttemptSplitResult = {};
    if (final === null) {
      this.cancel();
      return result;
    }
    if (this.active && this.options.multiStage) {
      let previous = 0;
      const stages: Partial<Record<TimerManualStage, number>> = {};
      for (const stage of MANUAL_STAGES) {
        const marked = this.state.stages[stage];
        if (marked === undefined) continue;
        const normalized = Math.max(previous, Math.min(marked, final));
        stages[stage] = normalized;
        previous = normalized;
      }
      result.stages = { ...stages, pll: final };
    }
    if (this.active && this.options.bldMemo && this.state.memoMs !== undefined) {
      result.bld = { memoMs: Math.min(this.state.memoMs, final) };
    }
    this.cancel();
    return result;
  }

  snapshot(): TimerAttemptSplitState {
    return { ...this.state, stages: { ...this.state.stages } };
  }

  private setState(state: TimerAttemptSplitState): void {
    this.state = state;
    this.onChange?.(this.snapshot());
  }

  private setAutomaticStage(stage: TimerManualStage, elapsedMs: number): void {
    if (this.manualStages.has(stage) || this.state.stages[stage] === elapsedMs) return;
    this.setState({ ...this.state, stages: { ...this.state.stages, [stage]: elapsedMs } });
  }
}
