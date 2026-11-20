import { STAGE_SEGMENT_EVENTS } from './stage-segments-producer';
import { IncrementalCfopProgress } from './reconstruct/orient';
import type { TimerSettingCopy } from './settings-contract';
import type { SolveMove } from './stage-segments';
import { formatMs } from './stats';
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

export const TIMER_ATTEMPT_SPLIT_COPY = {
  cross: { en: 'Cross', zh: '十字' },
  executing: { en: 'Executing…', zh: '执行中…' },
  memo: { en: 'Memo', zh: '记忆' },
  memoAction: { en: 'Memo… press Enter or tap', zh: '记忆中… 按 Enter 或点这里' },
  stageHint: { en: 'Press 1=Cross, 2=F2L, 3=OLL', zh: '按 1=Cross 完成，2=F2L，3=OLL' },
  bldHint: { en: 'Press Enter while running to mark memo complete', zh: '运行中按 Enter 标记记忆完成' },
  touchStageHint: { en: 'Tap a stage while running to mark it complete', zh: '运行中点按阶段按钮，标记该阶段完成' },
  touchBldHint: { en: 'Tap Memo while running to mark memo complete', zh: '运行中点按「记忆中」，标记记忆完成' },
  touchMemoAction: { en: 'Memo… tap here', zh: '记忆中… 点这里' },
} as const satisfies Record<string, TimerSettingCopy>;

export interface TimerAttemptSplitChip {
  key: TimerManualStage | 'memo' | 'executing';
  label: string;
  action: boolean;
  time: string;
}

export function timerAttemptSplitChips(
  state: TimerAttemptSplitState,
  options: TimerAttemptSplitOptions,
  precision: 2 | 3,
  localize: (copy: TimerSettingCopy) => string,
  touchOnly = false,
) {
  const copy = TIMER_ATTEMPT_SPLIT_COPY;
  const stages: TimerAttemptSplitChip[] = options.multiStage ? MANUAL_STAGES.map(key => {
    const ms = state.stages[key];
    return { key, label: key === 'cross' ? localize(copy.cross) : key.toUpperCase(), action: ms === undefined,
      time: ms === undefined ? '' : formatMs(ms, precision) };
  }) : [];
  const memo: TimerAttemptSplitChip[] = [];
  if (options.bldMemo) {
    const marked = state.memoMs !== undefined;
    memo.push({ key: 'memo', label: localize(marked ? copy.memo : touchOnly ? copy.touchMemoAction : copy.memoAction),
      action: !marked, time: state.memoMs === undefined ? '' : formatMs(state.memoMs, precision) });
    if (marked) memo.push({ key: 'executing', label: localize(copy.executing), action: false, time: '' });
  }
  return { stages, memo };
}

function validElapsed(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Runtime-neutral first-sample-wins recorder shared by Web and installed clients. */
export class TimerAttemptSplitRecorder {
  private active = false;
  private manualStages = new Set<TimerManualStage>();
  private options: TimerAttemptSplitOptions = { bldMemo: false, multiStage: false };
  private state: TimerAttemptSplitState = { stages: {} };
  private progress: IncrementalCfopProgress | null = null;
  private observedMoves: SolveMove[] = [];
  private scramble = '';

  constructor(private readonly onChange?: (state: TimerAttemptSplitState) => void) {}

  begin(options: TimerAttemptSplitOptions): void {
    this.active = true;
    this.options = options;
    this.manualStages.clear();
    this.progress = null;
    this.observedMoves = [];
    this.setState({ stages: {} });
  }

  cancel(): void {
    this.active = false;
    this.manualStages.clear();
    this.progress = null;
    this.observedMoves = [];
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
    if (!STAGE_SEGMENT_EVENTS.has(solve.event) || !solve.moves?.length) return;
    // Only replay on an actual rewrite/rewind. No recognition, HTM grouping or
    // repeated scramble normalization belongs in the physical move callback.
    const moves = solve.moves;
    let segments: ReturnType<IncrementalCfopProgress['stages']>;
    try {
      if (!this.progress || this.scramble !== solve.scramble || moves.length < this.observedMoves.length
        || this.observedMoves.some((move, i) => move.m !== moves[i].m || move.ts !== moves[i].ts)) {
        this.progress = new IncrementalCfopProgress(solve.scramble, true);
        this.observedMoves = [];
        this.scramble = solve.scramble;
      }
      for (let i = this.observedMoves.length; i < moves.length; i++) {
        this.progress.push(moves[i]);
        this.observedMoves.push({ ...moves[i] });
      }
      segments = this.progress.stages();
    } catch {
      this.progress = null;
      return;
    }
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
