import type { TimerSessionMeta } from './persistence';
import { effectiveMs, type Penalty, type Solve } from './types';

/** Web `/timer` row-menu actions, in the exact order users reach them. */
export const TIMER_HISTORY_QUICK_ACTION_IDS = [
  'history.quick.penalty-ok',
  'history.quick.penalty-plus-two',
  'history.quick.penalty-dnf',
  'history.quick.penalty-dns',
  'history.quick.comment',
  'history.quick.copy-scramble',
  'history.quick.delete',
] as const;

export type TimerHistoryQuickActionId = (typeof TIMER_HISTORY_QUICK_ACTION_IDS)[number];

export type TimerHistoryQuickActionEffect =
  | 'set-penalty'
  | 'open-solve-comment'
  | 'copy-scramble'
  | 'delete-solve';

export type TimerHistoryQuickActionDisabledWhen =
  | 'never'
  | 'penalty-handler-missing'
  | 'comment-handler-missing'
  | 'delete-handler-missing';

export interface TimerHistoryQuickActionContract {
  id: TimerHistoryQuickActionId;
  effect: TimerHistoryQuickActionEffect;
  /** All seven are visible whenever the row quick menu is reachable. */
  visibility: 'quick-menu-open';
  disabledWhen: TimerHistoryQuickActionDisabledWhen;
  danger: boolean;
  penalty?: Penalty;
}

export interface TimerHistoryQuickActionContext {
  menuOpen: boolean;
  currentPenalty: Penalty;
  canChangePenalty: boolean;
  canComment: boolean;
  canDelete: boolean;
}

export interface TimerHistoryQuickActionState extends TimerHistoryQuickActionContract {
  active: boolean;
  disabled: boolean;
  visible: boolean;
}

export interface TimerHistoryLocalizedText {
  en: string;
  zh: string;
}

export const TIMER_HISTORY_QUICK_ACTION_COPY: Readonly<
  Record<TimerHistoryQuickActionId, TimerHistoryLocalizedText>
> = {
  'history.quick.penalty-ok': { en: 'OK', zh: '无罚时' },
  'history.quick.penalty-plus-two': { en: '+2', zh: '+2' },
  'history.quick.penalty-dnf': { en: 'DNF', zh: 'DNF' },
  'history.quick.penalty-dns': { en: 'DNS', zh: 'DNS' },
  'history.quick.comment': { en: 'Comment', zh: '评论' },
  'history.quick.copy-scramble': { en: 'Copy scramble', zh: '复制打乱' },
  'history.quick.delete': { en: 'Delete', zh: '删除' },
};

export const TIMER_HISTORY_QUICK_ACTION_CONTRACTS: readonly TimerHistoryQuickActionContract[] = [
  {
    id: 'history.quick.penalty-ok', effect: 'set-penalty', visibility: 'quick-menu-open',
    disabledWhen: 'penalty-handler-missing', danger: false, penalty: 'ok',
  },
  {
    id: 'history.quick.penalty-plus-two', effect: 'set-penalty', visibility: 'quick-menu-open',
    disabledWhen: 'penalty-handler-missing', danger: false, penalty: '+2',
  },
  {
    id: 'history.quick.penalty-dnf', effect: 'set-penalty', visibility: 'quick-menu-open',
    disabledWhen: 'penalty-handler-missing', danger: false, penalty: 'DNF',
  },
  {
    id: 'history.quick.penalty-dns', effect: 'set-penalty', visibility: 'quick-menu-open',
    disabledWhen: 'penalty-handler-missing', danger: false, penalty: 'DNS',
  },
  {
    id: 'history.quick.comment', effect: 'open-solve-comment', visibility: 'quick-menu-open',
    disabledWhen: 'comment-handler-missing', danger: false,
  },
  {
    id: 'history.quick.copy-scramble', effect: 'copy-scramble', visibility: 'quick-menu-open',
    disabledWhen: 'never', danger: false,
  },
  {
    id: 'history.quick.delete', effect: 'delete-solve', visibility: 'quick-menu-open',
    disabledWhen: 'delete-handler-missing', danger: true,
  },
];

function quickActionDisabled(
  condition: TimerHistoryQuickActionDisabledWhen,
  context: TimerHistoryQuickActionContext,
): boolean {
  switch (condition) {
    case 'never': return false;
    case 'penalty-handler-missing': return !context.canChangePenalty;
    case 'comment-handler-missing': return !context.canComment;
    case 'delete-handler-missing': return !context.canDelete;
  }
}

export function timerHistoryQuickActionStates(
  context: TimerHistoryQuickActionContext,
): readonly TimerHistoryQuickActionState[] {
  return TIMER_HISTORY_QUICK_ACTION_CONTRACTS.map((contract) => ({
    ...contract,
    active: contract.penalty !== undefined && contract.penalty === context.currentPenalty,
    disabled: quickActionDisabled(contract.disabledWhen, context),
    visible: context.menuOpen,
  }));
}

export function timerHistoryQuickActionPenalty(
  actionId: TimerHistoryQuickActionId,
): Penalty | null {
  return TIMER_HISTORY_QUICK_ACTION_CONTRACTS.find((contract) => contract.id === actionId)?.penalty ?? null;
}

export const TIMER_SOLVE_DETAIL_ACTION_IDS = [
  'solve.detail.penalty',
  'solve.detail.comment',
  'solve.detail.move-session',
  'solve.detail.delete',
  'solve.detail.close',
] as const;

export type TimerSolveDetailActionId = (typeof TIMER_SOLVE_DETAIL_ACTION_IDS)[number];

export const TIMER_SOLVE_DETAIL_ACTION_CONTRACTS = [
  {
    id: 'solve.detail.penalty', effect: 'set-penalty',
    visibility: 'always', disabledWhen: 'penalty-handler-missing',
  },
  {
    id: 'solve.detail.comment', effect: 'persist-comment-on-blur',
    visibility: 'always', disabledWhen: 'comment-handler-missing',
  },
  {
    id: 'solve.detail.move-session', effect: 'move-solve-and-close',
    visibility: 'other-session-available', disabledWhen: 'move-handler-missing',
  },
  {
    id: 'solve.detail.delete', effect: 'delete-solve-and-close',
    visibility: 'always', disabledWhen: 'delete-handler-missing',
  },
  {
    id: 'solve.detail.close', effect: 'close-detail',
    visibility: 'always', disabledWhen: 'close-handler-missing',
  },
] as const;

export interface TimerSolveDetailActionContext {
  canChangePenalty: boolean;
  canComment: boolean;
  canMove: boolean;
  canDelete: boolean;
  canClose: boolean;
  moveTargetCount: number;
}

export interface TimerSolveDetailActionState {
  id: TimerSolveDetailActionId;
  effect: (typeof TIMER_SOLVE_DETAIL_ACTION_CONTRACTS)[number]['effect'];
  visibility: (typeof TIMER_SOLVE_DETAIL_ACTION_CONTRACTS)[number]['visibility'];
  disabledWhen: (typeof TIMER_SOLVE_DETAIL_ACTION_CONTRACTS)[number]['disabledWhen'];
  visible: boolean;
  disabled: boolean;
}

export function timerSolveDetailActionStates(
  context: TimerSolveDetailActionContext,
): readonly TimerSolveDetailActionState[] {
  return TIMER_SOLVE_DETAIL_ACTION_CONTRACTS.map((contract) => {
    const visible = contract.visibility === 'always' || context.moveTargetCount > 0;
    let disabled = false;
    switch (contract.disabledWhen) {
      case 'penalty-handler-missing': disabled = !context.canChangePenalty; break;
      case 'comment-handler-missing': disabled = !context.canComment; break;
      case 'move-handler-missing': disabled = !context.canMove; break;
      case 'delete-handler-missing': disabled = !context.canDelete; break;
      case 'close-handler-missing': disabled = !context.canClose; break;
    }
    return { ...contract, visible, disabled };
  });
}

/** Stable filter IDs and effects from the current Web HistoryPanel. */
export const TIMER_HISTORY_FILTER_CONTRACTS = [
  { id: 'history.filter.search', effect: 'match-comment-or-scramble', visibility: 'always', disabledWhen: 'never' },
  { id: 'history.filter.date', effect: 'limit-local-date-range', visibility: 'filters-expanded', disabledWhen: 'never' },
  { id: 'history.filter.time', effect: 'limit-effective-time', visibility: 'filters-expanded', disabledWhen: 'never' },
  { id: 'history.filter.penalty', effect: 'include-selected-penalties', visibility: 'filters-expanded', disabledWhen: 'never' },
  { id: 'history.filter.oll', effect: 'match-oll-case', visibility: 'filters-expanded', disabledWhen: 'never' },
  { id: 'history.filter.pll', effect: 'match-pll-case', visibility: 'filters-expanded', disabledWhen: 'never' },
  { id: 'history.filter.tag', effect: 'match-any-selected-tag', visibility: 'filters-expanded', disabledWhen: 'never' },
  { id: 'history.filter.clear', effect: 'restore-filter-defaults', visibility: 'any-filter-active', disabledWhen: 'never' },
] as const;

export type TimerHistoryFilterId = (typeof TIMER_HISTORY_FILTER_CONTRACTS)[number]['id'];

export const TIMER_HISTORY_PENALTIES: readonly Penalty[] = ['ok', '+2', 'DNF', 'DNS'];

export interface TimerHistoryFilters {
  query: string;
  dateFrom: string;
  dateTo: string;
  timeMin: string;
  timeMax: string;
  penalties: ReadonlySet<Penalty>;
  ollCase: string;
  pllCase: string;
  tags: ReadonlySet<string>;
}

export interface TimerHistoryFilterResult {
  /** Newest first, matching the Web HistoryPanel presentation order. */
  solves: Solve[];
  activeStructuredFilterCount: number;
  hasAnyFilter: boolean;
}

export function createTimerHistoryFilters(): TimerHistoryFilters {
  return {
    query: '',
    dateFrom: '',
    dateTo: '',
    timeMin: '',
    timeMax: '',
    penalties: new Set(TIMER_HISTORY_PENALTIES),
    ollCase: '',
    pllCase: '',
    tags: new Set(),
  };
}

/** Parse the Web HistoryPanel's accepted `5.0` / `1:23.45` syntax. */
export function parseTimerHistorySeconds(input: string): number | null {
  const text = input.trim();
  if (!text) return null;
  const colonMatch = text.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (colonMatch) {
    const minutes = Number.parseInt(colonMatch[1]!, 10);
    const seconds = Number.parseFloat(colonMatch[2]!);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return Math.round((minutes * 60 + seconds) * 1000);
  }
  // Keep the existing Web behavior: parseFloat accepts a numeric prefix.
  const seconds = Number.parseFloat(text);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds * 1000);
}

function parseLocalDateBoundary(input: string, endExclusive: boolean): number | null {
  if (!input) return null;
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]) + (endExclusive ? 1 : 0);
  const date = new Date(year, month, day, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function toggleTimerHistoryPenalty(
  current: ReadonlySet<Penalty>,
  penalty: Penalty,
): Set<Penalty> {
  const next = new Set(current);
  if (next.has(penalty)) {
    // Web never leaves a silently empty filter: removing the last item resets all.
    if (next.size === 1) return new Set(TIMER_HISTORY_PENALTIES);
    next.delete(penalty);
  } else {
    next.add(penalty);
  }
  return next;
}

export function filterTimerHistorySolves(
  solves: readonly Solve[],
  filters: TimerHistoryFilters,
  tagsBySolveId: ReadonlyMap<string, readonly string[]> = new Map(),
): TimerHistoryFilterResult {
  const query = filters.query.trim().toLowerCase();
  const dateFromMs = parseLocalDateBoundary(filters.dateFrom, false);
  const dateToMs = parseLocalDateBoundary(filters.dateTo, true);
  const timeMinMs = parseTimerHistorySeconds(filters.timeMin);
  const timeMaxMs = parseTimerHistorySeconds(filters.timeMax);
  const ollCase = filters.ollCase.trim().toLowerCase();
  const pllCase = filters.pllCase.trim().toLowerCase();

  const activeStructuredFilterCount =
    (dateFromMs !== null ? 1 : 0) +
    (dateToMs !== null ? 1 : 0) +
    (timeMinMs !== null ? 1 : 0) +
    (timeMaxMs !== null ? 1 : 0) +
    (filters.penalties.size !== TIMER_HISTORY_PENALTIES.length ? 1 : 0) +
    (ollCase ? 1 : 0) +
    (pllCase ? 1 : 0) +
    (filters.tags.size > 0 ? 1 : 0);

  const filtered = [...solves].reverse().filter((solve) => {
    if (query) {
      const comment = (solve.comment ?? '').toLowerCase();
      const scramble = (solve.scramble ?? '').toLowerCase();
      if (!comment.includes(query) && !scramble.includes(query)) return false;
    }
    if (dateFromMs !== null && solve.ts < dateFromMs) return false;
    if (dateToMs !== null && solve.ts >= dateToMs) return false;
    if (timeMinMs !== null || timeMaxMs !== null) {
      const value = effectiveMs(solve);
      if (!Number.isFinite(value)) return false;
      if (timeMinMs !== null && value < timeMinMs) return false;
      if (timeMaxMs !== null && value > timeMaxMs) return false;
    }
    if (!filters.penalties.has(solve.penalty)) return false;
    if (ollCase && !(solve.stageSegments?.ollCase ?? '').toLowerCase().includes(ollCase)) return false;
    if (pllCase && !(solve.stageSegments?.pllCase ?? '').toLowerCase().includes(pllCase)) return false;
    if (filters.tags.size > 0) {
      const solveTags = tagsBySolveId.get(solve.id) ?? [];
      if (!solveTags.some((tag) => filters.tags.has(tag))) return false;
    }
    return true;
  });

  return {
    solves: filtered,
    activeStructuredFilterCount,
    hasAnyFilter: query.length > 0 || activeStructuredFilterCount > 0,
  };
}

export type TimerHistorySolvePatch = Partial<Pick<Solve, 'penalty' | 'comment' | 'reconOk'>>;

export interface TimerHistorySolveMutationResult {
  /** Same reference on failure/no-op; a new list on change. */
  solves: readonly Solve[];
  changed: boolean;
  solve: Solve | null;
}

export function updateTimerHistorySolve(
  solves: readonly Solve[],
  solveId: string,
  patch: TimerHistorySolvePatch,
): TimerHistorySolveMutationResult {
  const index = solves.findIndex((solve) => solve.id === solveId);
  if (index < 0) return { solves, changed: false, solve: null };
  const current = solves[index]!;
  const entries = Object.entries(patch) as Array<[keyof TimerHistorySolvePatch, unknown]>;
  if (entries.every(([key, value]) => Object.is(current[key], value))) {
    return { solves, changed: false, solve: current };
  }
  const updated = { ...current, ...patch };
  const next = [...solves];
  next[index] = updated;
  return { solves: next, changed: true, solve: updated };
}

export function deleteTimerHistorySolve(
  solves: readonly Solve[],
  solveId: string,
): TimerHistorySolveMutationResult {
  const index = solves.findIndex((solve) => solve.id === solveId);
  if (index < 0) return { solves, changed: false, solve: null };
  const removed = solves[index]!;
  return {
    solves: [...solves.slice(0, index), ...solves.slice(index + 1)],
    changed: true,
    solve: removed,
  };
}

/** Restore an exact deleted solve for undo without changing its id/timestamp. */
export function restoreTimerHistorySolve(
  solves: readonly Solve[],
  solve: Solve,
): TimerHistorySolveMutationResult {
  const existing = solves.find((candidate) => candidate.id === solve.id);
  if (existing) return { solves, changed: false, solve: existing };
  const restored = [...solves, solve].sort((left, right) => left.ts - right.ts);
  return { solves: restored, changed: true, solve };
}

export function timerHistoryCopyText(solve: Solve): string {
  return solve.scramble ?? '';
}

/** Detail-modal targets: every session except the active one, in stored order. */
export function timerHistoryMoveTargets(
  sessions: readonly TimerSessionMeta[],
  activeSessionId: string,
): Array<{ id: string; name: string }> {
  return sessions
    .filter((session) => session.id !== activeSessionId)
    .map((session) => ({ id: session.id, name: session.name }));
}
