export type TimerScrambleStatusReason =
  | 'loading-generated'
  | 'loading-optimal'
  | 'loading-real'
  | 'error-generated'
  | 'error-optimal'
  | 'error-real'
  | 'error-steps'
  | 'empty-trainer'
  | 'rare-trainer'
  | 'empty-wca-type'
  | 'empty-wca-steps'
  | 'empty-wca-difficulty-unindexed'
  | 'empty-wca-difficulty-competition'
  | 'empty-wca-difficulty'
  | 'empty-wca-competition-event'
  | 'empty-wca-date'
  | 'unsupported';

export type TimerScrambleStatusKind = 'loading' | 'empty' | 'error' | 'unsupported';

export interface TimerScrambleStatusDescriptor {
  readonly kind: TimerScrambleStatusKind;
  readonly message: Readonly<{ en: string; zh: string }>;
  readonly retryable: boolean;
}

const TIMER_SCRAMBLE_STATUSES = Object.freeze({
  'loading-generated': status('loading', 'Generating scramble', '生成打乱', false),
  'loading-optimal': status('loading', 'Generating optimal scramble', '生成最优打乱', false),
  'loading-real': status('loading', 'Loading real scramble', '加载真实打乱', false),
  'error-generated': status('error', 'Could not generate a scramble.', '打乱生成失败。', true),
  'error-optimal': status('error', 'Could not generate an optimal scramble.', '最优打乱生成失败。', true),
  'error-real': status('error', 'Could not load real competition scrambles.', '无法加载比赛真题。', true),
  'error-steps': status('error', 'Could not generate a move-count scramble.', '按步数打乱生成失败。', true),
  'empty-trainer': status('empty', 'No scramble has this difficulty — widen the step range', '没有任何打乱是这个难度,把步数范围放宽一点', false),
  'rare-trainer': status('empty', 'This difficulty is too rare to find quickly.', '这个难度太稀有,一时找不出来。', true),
  'empty-wca-type': status('empty', 'No WCA scramble of this type matches the range — try another type or range', '该范围没有匹配此类型的 WCA 真题,换个类型或范围试试', false),
  'empty-wca-steps': status('empty', 'No WCA scramble matches this move-count range — try another range', '该步数范围没有匹配的 WCA 真题,换个步数试试', false),
  'empty-wca-difficulty-unindexed': status('empty', 'Difficulty index not updated yet', '难度库待更新', false),
  'empty-wca-difficulty-competition': status('empty', 'This competition has no scramble at this difficulty — try other step counts or colors', '该比赛没有匹配此难度的真题,换个步数或配色试试', false),
  'empty-wca-difficulty': status('empty', 'No WCA scramble matches this difficulty — try other step counts or colors', '该难度组合没有匹配的 WCA 真题,换个步数或配色试试', false),
  'empty-wca-competition-event': status('empty', 'This competition has no scrambles for this event', '该比赛没有此项目的打乱', false),
  'empty-wca-date': status('empty', 'No WCA scrambles in this date range', '该时间段内没有 WCA 真题', false),
  unsupported: status('unsupported', 'Scrambles are unavailable for this event.', '此项目暂时无法生成打乱。', false),
} satisfies Record<TimerScrambleStatusReason, TimerScrambleStatusDescriptor>);

function status(
  kind: TimerScrambleStatusKind,
  en: string,
  zh: string,
  retryable: boolean,
): TimerScrambleStatusDescriptor {
  return Object.freeze({ kind, message: Object.freeze({ en, zh }), retryable });
}

export function timerScrambleStatus(
  reason: TimerScrambleStatusReason,
): TimerScrambleStatusDescriptor {
  return TIMER_SCRAMBLE_STATUSES[reason];
}

export function timerWcaScrambleEmptyReason(input: {
  readonly competitionUnindexed: boolean;
  readonly hasByStepsFilter: boolean;
  readonly hasDifficultyFilter: boolean;
  readonly hasTypeFilter: boolean;
  readonly mode: 'comp' | 'date';
}): TimerScrambleStatusReason {
  if (input.hasTypeFilter) return 'empty-wca-type';
  if (input.hasByStepsFilter) return 'empty-wca-steps';
  if (input.hasDifficultyFilter) {
    if (input.mode !== 'comp') return 'empty-wca-difficulty';
    return input.competitionUnindexed
      ? 'empty-wca-difficulty-unindexed'
      : 'empty-wca-difficulty-competition';
  }
  return input.mode === 'comp' ? 'empty-wca-competition-event' : 'empty-wca-date';
}
