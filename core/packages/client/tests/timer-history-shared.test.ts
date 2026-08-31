import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  TIMER_HISTORY_FILTER_CONTRACTS,
  TIMER_HISTORY_PENALTIES,
  TIMER_HISTORY_QUICK_ACTION_CONTRACTS,
  TIMER_HISTORY_QUICK_ACTION_IDS,
  TIMER_SOLVE_DETAIL_ACTION_CONTRACTS,
  TIMER_SOLVE_DETAIL_ACTION_IDS,
  createTimerHistoryFilters,
  deleteTimerHistorySolve,
  filterTimerHistorySolves,
  parseTimerHistorySeconds,
  restoreTimerHistorySolve,
  timerHistoryCopyText,
  timerHistoryMoveTargets,
  timerHistoryQuickActionPenalty,
  timerHistoryQuickActionStates,
  timerSolveDetailActionStates,
  toggleTimerHistoryPenalty,
  updateTimerHistorySolve,
  type Penalty,
  type Solve,
} from '@cuberoot/shared/timer';

function makeSolve(
  id: string,
  input: Partial<Solve> & Pick<Solve, 'timeMs' | 'penalty' | 'ts'>,
): Solve {
  return {
    id,
    event: '333',
    scramble: `scramble-${id}`,
    ...input,
  } as Solve;
}

const historySource = readFileSync(
  new URL('../app/[lang]/timer/_components/HistoryPanel.tsx', import.meta.url),
  'utf8',
);
const detailSource = readFileSync(
  new URL('../app/[lang]/timer/_components/SolveModal.tsx', import.meta.url),
  'utf8',
);
const soloSource = readFileSync(
  new URL('../app/[lang]/timer/_shell/SoloView.tsx', import.meta.url),
  'utf8',
);

describe('shared timer history action contracts', () => {
  it('locks the exact quick-action order, effects, visibility and disabled conditions', () => {
    expect(TIMER_HISTORY_QUICK_ACTION_IDS).toEqual([
      'history.quick.penalty-ok',
      'history.quick.penalty-plus-two',
      'history.quick.penalty-dnf',
      'history.quick.penalty-dns',
      'history.quick.comment',
      'history.quick.copy-scramble',
      'history.quick.delete',
    ]);
    expect(TIMER_HISTORY_QUICK_ACTION_CONTRACTS.map((action) => ({
      id: action.id,
      effect: action.effect,
      visibility: action.visibility,
      disabledWhen: action.disabledWhen,
      danger: action.danger,
      penalty: action.penalty ?? null,
    }))).toEqual([
      { id: 'history.quick.penalty-ok', effect: 'set-penalty', visibility: 'quick-menu-open', disabledWhen: 'penalty-handler-missing', danger: false, penalty: 'ok' },
      { id: 'history.quick.penalty-plus-two', effect: 'set-penalty', visibility: 'quick-menu-open', disabledWhen: 'penalty-handler-missing', danger: false, penalty: '+2' },
      { id: 'history.quick.penalty-dnf', effect: 'set-penalty', visibility: 'quick-menu-open', disabledWhen: 'penalty-handler-missing', danger: false, penalty: 'DNF' },
      { id: 'history.quick.penalty-dns', effect: 'set-penalty', visibility: 'quick-menu-open', disabledWhen: 'penalty-handler-missing', danger: false, penalty: 'DNS' },
      { id: 'history.quick.comment', effect: 'open-solve-comment', visibility: 'quick-menu-open', disabledWhen: 'comment-handler-missing', danger: false, penalty: null },
      { id: 'history.quick.copy-scramble', effect: 'copy-scramble', visibility: 'quick-menu-open', disabledWhen: 'never', danger: false, penalty: null },
      { id: 'history.quick.delete', effect: 'delete-solve', visibility: 'quick-menu-open', disabledWhen: 'delete-handler-missing', danger: true, penalty: null },
    ]);

    const states = timerHistoryQuickActionStates({
      menuOpen: true,
      currentPenalty: '+2',
      canChangePenalty: false,
      canComment: true,
      canDelete: false,
    });
    expect(states.map((action) => [action.id, action.visible, action.active, action.disabled])).toEqual([
      ['history.quick.penalty-ok', true, false, true],
      ['history.quick.penalty-plus-two', true, true, true],
      ['history.quick.penalty-dnf', true, false, true],
      ['history.quick.penalty-dns', true, false, true],
      ['history.quick.comment', true, false, false],
      ['history.quick.copy-scramble', true, false, false],
      ['history.quick.delete', true, false, true],
    ]);
    expect(timerHistoryQuickActionPenalty('history.quick.penalty-dns')).toBe('DNS');
    expect(timerHistoryQuickActionPenalty('history.quick.comment')).toBeNull();
  });

  it('locks detail action visibility and real move-target availability', () => {
    expect(TIMER_SOLVE_DETAIL_ACTION_IDS).toEqual([
      'solve.detail.penalty',
      'solve.detail.comment',
      'solve.detail.move-session',
      'solve.detail.delete',
      'solve.detail.close',
    ]);
    expect(TIMER_SOLVE_DETAIL_ACTION_CONTRACTS.map((action) => [
      action.id, action.effect, action.visibility, action.disabledWhen,
    ])).toEqual([
      ['solve.detail.penalty', 'set-penalty', 'always', 'penalty-handler-missing'],
      ['solve.detail.comment', 'persist-comment-on-blur', 'always', 'comment-handler-missing'],
      ['solve.detail.move-session', 'move-solve-and-close', 'other-session-available', 'move-handler-missing'],
      ['solve.detail.delete', 'delete-solve-and-close', 'always', 'delete-handler-missing'],
      ['solve.detail.close', 'close-detail', 'always', 'close-handler-missing'],
    ]);

    const noTarget = timerSolveDetailActionStates({
      canChangePenalty: true, canComment: true, canMove: true,
      canDelete: true, canClose: true, moveTargetCount: 0,
    });
    expect(noTarget.find((action) => action.id === 'solve.detail.move-session')).toMatchObject({
      visible: false, disabled: false,
    });
    const missingMoveHost = timerSolveDetailActionStates({
      canChangePenalty: true, canComment: true, canMove: false,
      canDelete: true, canClose: true, moveTargetCount: 2,
    });
    expect(missingMoveHost.find((action) => action.id === 'solve.detail.move-session')).toMatchObject({
      visible: true, disabled: true,
    });
    expect(timerHistoryMoveTargets([
      { id: 'a', name: 'Active', createdTs: 1 },
      { id: 'b', name: 'Second', createdTs: 2 },
      { id: 'c', name: 'Third', createdTs: 3 },
    ], 'a')).toEqual([{ id: 'b', name: 'Second' }, { id: 'c', name: 'Third' }]);
  });
});

describe('shared timer history filtering', () => {
  const aug29 = new Date(2026, 7, 29, 12).getTime();
  const aug30Morning = new Date(2026, 7, 30, 9).getTime();
  const aug30Evening = new Date(2026, 7, 30, 20).getTime();
  const aug31 = new Date(2026, 7, 31, 12).getTime();
  const solves: Solve[] = [
    makeSolve('a', { timeMs: 5_000, penalty: 'ok', ts: aug29, comment: 'Warmup' }),
    makeSolve('b', {
      timeMs: 8_000,
      penalty: '+2',
      ts: aug30Morning,
      scramble: 'R U special',
      stageSegments: { ollCase: 'OLL 21', pllCase: 'Aa' } as Solve['stageSegments'],
    }),
    makeSolve('c', { timeMs: 4_000, penalty: 'DNF', ts: aug30Evening, comment: 'missed PLL' }),
    makeSolve('d', { timeMs: 0, penalty: 'DNS', ts: aug31 }),
  ];
  const tags = new Map<string, readonly string[]>([
    ['a', ['pb-single']],
    ['b', ['plus2', 'lucky']],
    ['c', ['dnf']],
  ]);

  it('locks the exact filter manifest and default newest-first result', () => {
    expect(TIMER_HISTORY_FILTER_CONTRACTS).toEqual([
      { id: 'history.filter.search', effect: 'match-comment-or-scramble', visibility: 'always', disabledWhen: 'never' },
      { id: 'history.filter.date', effect: 'limit-local-date-range', visibility: 'filters-expanded', disabledWhen: 'never' },
      { id: 'history.filter.time', effect: 'limit-effective-time', visibility: 'filters-expanded', disabledWhen: 'never' },
      { id: 'history.filter.penalty', effect: 'include-selected-penalties', visibility: 'filters-expanded', disabledWhen: 'never' },
      { id: 'history.filter.oll', effect: 'match-oll-case', visibility: 'filters-expanded', disabledWhen: 'never' },
      { id: 'history.filter.pll', effect: 'match-pll-case', visibility: 'filters-expanded', disabledWhen: 'never' },
      { id: 'history.filter.tag', effect: 'match-any-selected-tag', visibility: 'filters-expanded', disabledWhen: 'never' },
      { id: 'history.filter.clear', effect: 'restore-filter-defaults', visibility: 'any-filter-active', disabledWhen: 'never' },
    ]);
    const result = filterTimerHistorySolves(solves, createTimerHistoryFilters(), tags);
    expect(result).toMatchObject({ activeStructuredFilterCount: 0, hasAnyFilter: false });
    expect(result.solves.map((solve) => solve.id)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('matches query, inclusive local dates, effective time, penalties, cases and OR-tags exactly', () => {
    const defaults = createTimerHistoryFilters();
    expect(filterTimerHistorySolves(solves, { ...defaults, query: 'SPECIAL' }, tags).solves.map((s) => s.id)).toEqual(['b']);
    expect(filterTimerHistorySolves(solves, { ...defaults, query: 'warm' }, tags).solves.map((s) => s.id)).toEqual(['a']);
    expect(filterTimerHistorySolves(solves, {
      ...defaults, dateFrom: '2026-08-30', dateTo: '2026-08-30',
    }, tags).solves.map((s) => s.id)).toEqual(['c', 'b']);
    // +2 uses its effective 10 seconds; DNF/DNS are excluded whenever a time bound exists.
    expect(filterTimerHistorySolves(solves, {
      ...defaults, timeMin: '9', timeMax: '11',
    }, tags).solves.map((s) => s.id)).toEqual(['b']);
    expect(filterTimerHistorySolves(solves, {
      ...defaults, penalties: new Set<Penalty>(['DNF', 'DNS']),
    }, tags).solves.map((s) => s.id)).toEqual(['d', 'c']);
    expect(filterTimerHistorySolves(solves, { ...defaults, ollCase: 'oll 21' }, tags).solves.map((s) => s.id)).toEqual(['b']);
    expect(filterTimerHistorySolves(solves, { ...defaults, pllCase: 'aA' }, tags).solves.map((s) => s.id)).toEqual(['b']);
    expect(filterTimerHistorySolves(solves, {
      ...defaults, tags: new Set(['pb-single', 'dnf']),
    }, tags).solves.map((s) => s.id)).toEqual(['c', 'a']);
  });

  it('preserves the Web parser and never leaves a silently empty penalty set', () => {
    expect(parseTimerHistorySeconds('1:23.45')).toBe(83_450);
    expect(parseTimerHistorySeconds(' 5.004 ')).toBe(5_004);
    expect(parseTimerHistorySeconds('5seconds')).toBe(5_000);
    expect(parseTimerHistorySeconds('-1')).toBeNull();
    expect(parseTimerHistorySeconds('')).toBeNull();

    const one = new Set<Penalty>(['DNS']);
    expect([...toggleTimerHistoryPenalty(one, 'DNS')]).toEqual(TIMER_HISTORY_PENALTIES);
    const removed = toggleTimerHistoryPenalty(new Set(TIMER_HISTORY_PENALTIES), '+2');
    expect([...removed]).toEqual(['ok', 'DNF', 'DNS']);
    expect([...one]).toEqual(['DNS']);
  });
});

describe('shared timer history mutations and Web consumers', () => {
  it('updates penalty/comment and deletes immutably without changing the shared Solve schema', () => {
    const original = makeSolve('x', {
      timeMs: 7_000, penalty: 'ok', ts: 1, comment: 'old', scramble: 'R U',
    });
    const input = Object.freeze([Object.freeze(original)]) as readonly Solve[];

    const penalized = updateTimerHistorySolve(input, 'x', { penalty: 'DNS' });
    expect(penalized).toMatchObject({ changed: true });
    expect(penalized.solve).toMatchObject({ id: 'x', penalty: 'DNS', comment: 'old' });
    expect(input[0]).toBe(original);
    expect(original.penalty).toBe('ok');

    const commented = updateTimerHistorySolve(penalized.solves, 'x', { comment: '  two\nlines  ' });
    expect(commented.solve?.comment).toBe('  two\nlines  ');
    expect(timerHistoryCopyText(commented.solve!)).toBe('R U');

    const deleted = deleteTimerHistorySolve(commented.solves, 'x');
    expect(deleted).toMatchObject({ changed: true, solve: commented.solve });
    expect(deleted.solves).toEqual([]);
    expect(deleteTimerHistorySolve(input, 'missing')).toMatchObject({ changed: false, solve: null });
    expect(updateTimerHistorySolve(input, 'missing', { penalty: '+2' })).toMatchObject({ changed: false, solve: null });

    const restored = restoreTimerHistorySolve([
      makeSolve('later', { timeMs: 8_000, penalty: 'ok', ts: 2 }),
    ], original);
    expect(restored).toMatchObject({ changed: true, solve: original });
    expect(restored.solves.map((solve) => solve.id)).toEqual(['x', 'later']);
    expect(restoreTimerHistorySolve(restored.solves, original)).toMatchObject({ changed: false });
  });

  it('proves Web delegates filtering, mutation, move-target and action-state rules to shared', () => {
    expect(historySource).toContain("from '../_lib/history'");
    expect(historySource).toContain("from '@cuberoot/timer-ui'");
    expect(historySource).toContain('<TimerHistoryRow');
    expect(historySource).toContain('filterTimerHistorySolves(solves');
    expect(historySource).toContain('toggleTimerHistoryPenalty(prev, p)');
    expect(historySource).toContain('timerHistoryCopyText(solve)');
    expect(historySource).not.toContain('timerHistoryQuickActionStates({');
    expect(historySource).not.toContain('timerHistoryQuickActionPenalty(');
    expect(historySource).not.toContain('LONG_PRESS_MS');
    expect(historySource).not.toContain('row-quick-');
    expect(historySource).not.toContain('function parseTimeSeconds');
    expect(historySource).not.toContain("const ALL_PENALTIES: Penalty[]");

    expect(soloSource).toContain('updateTimerHistorySolve(prev[event] ?? [], solveId, patch)');
    expect(soloSource).toContain('deleteTimerHistorySolve(prev[event] ?? [], solveId)');
    expect(soloSource).toContain('restoreTimerHistorySolve(prev[ev] ?? [], last)');
    expect(soloSource).toContain('timerHistoryMoveTargets(listSessions(), getActiveSessionId())');
    expect(soloSource).toContain('<TimerInfoToast');
    expect(soloSource).not.toContain('shell-info-toast');
    expect(detailSource).toContain('timerSolveDetailActionStates({');
    expect(detailSource).toContain('<TimerHistoryCommentEditor');
    expect(detailSource).not.toContain('<textarea');

    const detailIds = new Set(detailSource.match(/solve\.detail\.[a-z-]+/g) ?? []);
    expect([...detailIds].sort()).toEqual([...TIMER_SOLVE_DETAIL_ACTION_IDS].sort());
  });
});
