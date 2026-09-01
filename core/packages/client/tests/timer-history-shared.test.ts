import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  TIMER_HISTORY_FILTER_CONTRACTS,
  TIMER_HISTORY_PENALTIES,
  TIMER_HISTORY_QUICK_ACTION_CONTRACTS,
  TIMER_HISTORY_QUICK_ACTION_IDS,
  TIMER_HISTORY_TAG_DEFS,
  TIMER_HISTORY_TAG_IDS,
  TIMER_SOLVE_DETAIL_ACTION_CONTRACTS,
  TIMER_SOLVE_DETAIL_ACTION_IDS,
  createTimerHistoryFilters,
  computeTimerHistoryTags,
  deleteTimerHistorySolve,
  filterTimerHistorySolves,
  buildTimerHistoryComparison,
  parseTimerHistorySeconds,
  pruneTimerHistoryCompareSelection,
  restoreTimerHistorySolve,
  resolveTimerHistoryComparePair,
  timerHistoryCopyText,
  timerHistoryMoveTargets,
  timerHistoryQuickActionPenalty,
  timerHistoryQuickActionStates,
  timerSolveDetailActionStates,
  toggleTimerHistoryTag,
  toggleTimerHistoryPenalty,
  toggleTimerHistoryCompareSelection,
  updateTimerHistorySolve,
  type Penalty,
  type Solve,
  type TimerHistoryTagId,
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
  const tags = new Map<string, readonly TimerHistoryTagId[]>([
    ['a', ['pb-single']],
    ['b', ['plus2']],
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

describe('shared derived timer history tags', () => {
  it('locks the exact catalog and toggles immutable tag filters', () => {
    expect(TIMER_HISTORY_TAG_IDS).toEqual([
      'pb-single', 'pb-ao5', 'pb-ao12', 'oll-skip', 'pll-skip', 'dnf', 'dns', 'plus2',
    ]);
    expect(TIMER_HISTORY_TAG_IDS.map((id) => TIMER_HISTORY_TAG_DEFS[id])).toEqual([
      { id: 'pb-single', tone: 'gold', label: { en: 'PB', zh: 'PB' } },
      { id: 'pb-ao5', tone: 'gold', label: { en: 'PB ao5', zh: 'PB ao5' } },
      { id: 'pb-ao12', tone: 'gold', label: { en: 'PB ao12', zh: 'PB ao12' } },
      { id: 'oll-skip', tone: 'gold', label: { en: 'OLL skip', zh: '跳O' } },
      { id: 'pll-skip', tone: 'gold', label: { en: 'PLL skip', zh: '跳P' } },
      { id: 'dnf', tone: 'muted', label: { en: 'DNF', zh: 'DNF' } },
      { id: 'dns', tone: 'muted', label: { en: 'DNS', zh: 'DNS' } },
      { id: 'plus2', tone: 'muted', label: { en: '+2', zh: '+2' } },
    ]);

    const initial = new Set<TimerHistoryTagId>(['pb-single']);
    expect([...toggleTimerHistoryTag(initial, 'dnf')]).toEqual(['pb-single', 'dnf']);
    expect([...toggleTimerHistoryTag(initial, 'pb-single')]).toEqual([]);
    expect([...initial]).toEqual(['pb-single']);
  });

  it('derives penalties, skips and strict running PBs from current solve truth', () => {
    const history = [
      makeSolve('a', { timeMs: 10_000, penalty: 'ok', ts: 1 }),
      makeSolve('b', { timeMs: 10_000, penalty: '+2', ts: 2 }),
      makeSolve('c', { timeMs: 9_000, penalty: 'DNF', ts: 3 }),
      makeSolve('d', { timeMs: 0, penalty: 'DNS', ts: 4 }),
      makeSolve('e', {
        timeMs: 9_990,
        penalty: 'ok',
        ts: 5,
        stageSegments: { ollCase: 'OLL skip', pllCase: 'PLL skip' } as Solve['stageSegments'],
        tags: ['pb-single'],
      }),
    ];
    const tags = computeTimerHistoryTags(history);
    expect(tags.get('a')).toEqual(['pb-single']);
    expect(tags.get('b')).toEqual(['plus2']);
    expect(tags.get('c')).toEqual(['dnf']);
    expect(tags.get('d')).toEqual(['dns']);
    expect(tags.get('e')).toEqual(['oll-skip', 'pll-skip', 'pb-single']);
  });

  it('uses canonical centisecond averages and rejects invalid DNF windows', () => {
    const tiedWindow = Array.from({ length: 5 }, (_, index) => makeSolve(`t${index}`, {
      timeMs: 10_000,
      penalty: 'ok',
      ts: index,
    }));
    tiedWindow.push(makeSolve('same-cs', { timeMs: 9_999, penalty: 'ok', ts: 6 }));
    const tiedTags = computeTimerHistoryTags(tiedWindow);
    expect(tiedTags.get('t4')).toContain('pb-ao5');
    expect(tiedTags.get('same-cs')).not.toContain('pb-ao5');

    const oneDnf = tiedWindow.slice(0, 4).concat(
      makeSolve('one-dnf', { timeMs: 10_000, penalty: 'DNF', ts: 7 }),
    );
    expect(computeTimerHistoryTags(oneDnf).get('one-dnf')).toContain('pb-ao5');
    const twoDnfs = oneDnf.slice(1).concat(
      makeSolve('two-dnf', { timeMs: 10_000, penalty: 'DNS', ts: 8 }),
    );
    expect(computeTimerHistoryTags(twoDnfs).get('two-dnf')).not.toContain('pb-ao5');
  });

  it('ranks MBLD singles canonically and never creates rolling-average tags', () => {
    const mbld = (id: string, solved: number, attempted: number, timeMs: number, penalty: Penalty = 'ok') => (
      makeSolve(id, { event: '333mbld', mbld: { solved, attempted }, penalty, timeMs, ts: Number(id.slice(1)) })
    );
    const history = [
      mbld('m1', 8, 10, 600_000),
      mbld('m2', 10, 14, 500_000),
      mbld('m3', 9, 11, 700_000),
      mbld('m4', 1, 2, 300_000),
      ...Array.from({ length: 8 }, (_, index) => mbld(`m${index + 5}`, 8, 10, 600_000)),
    ];
    const tags = computeTimerHistoryTags(history);
    expect(tags.get('m1')).toContain('pb-single');
    expect(tags.get('m2')).toContain('pb-single');
    expect(tags.get('m3')).toContain('pb-single');
    expect(tags.get('m4')).not.toContain('pb-single');
    for (const solveTags of tags.values()) {
      expect(solveTags).not.toContain('pb-ao5');
      expect(solveTags).not.toContain('pb-ao12');
    }
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
    expect(historySource).toContain('computeTimerHistoryTags(solves)');
    expect(historySource).toContain('<TimerHistoryTagBadges');
    expect(historySource).toContain('<TimerHistoryTagFilter');
    expect(historySource).toContain('toggleTimerHistoryTag(current, tagId)');
    expect(historySource).toContain('toggleTimerHistoryPenalty(prev, p)');
    expect(historySource).toContain('timerHistoryCopyText(solve)');
    expect(historySource).not.toContain('timerHistoryQuickActionStates({');
    expect(historySource).not.toContain('timerHistoryQuickActionPenalty(');
    expect(historySource).not.toContain('LONG_PRESS_MS');
    expect(historySource).not.toContain('row-quick-');
    expect(historySource).not.toContain('function parseTimeSeconds');
    expect(historySource).not.toContain("const ALL_PENALTIES: Penalty[]");
    expect(historySource).not.toContain("from '../_lib/storage/auto_tag'");

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

describe('shared timer history comparison', () => {
  const segments: NonNullable<Solve['stageSegments']> = {
    crossDoneMs: 1_000,
    f2lDoneMs: 6_000,
    ollDoneMs: 7_000,
    solvedMs: 10_000,
    crossMs: 1_000,
    f2lMs: 5_000,
    ollMs: 1_000,
    pllMs: 3_000,
    crossHtm: 6,
    f2lHtm: 24,
    ollHtm: null,
    pllHtm: 10,
    crossSide: 'D-cross',
    ollCase: 'OLL 21',
    pllCase: 'PLL T',
  };

  it('selects, deselects, evicts the oldest third choice, and resolves hidden-but-existing solves', () => {
    expect(toggleTimerHistoryCompareSelection([], 'a')).toEqual(['a']);
    expect(toggleTimerHistoryCompareSelection(['a'], 'a')).toEqual([]);
    expect(toggleTimerHistoryCompareSelection(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleTimerHistoryCompareSelection(['a', 'b'], 'c')).toEqual(['b', 'c']);

    const solves = [
      makeSolve('a', { timeMs: 1_000, penalty: 'ok', ts: 1 }),
      makeSolve('b', { timeMs: 2_000, penalty: 'ok', ts: 2 }),
    ];
    expect(resolveTimerHistoryComparePair(solves, ['a', 'b'])?.map((solve) => solve.id))
      .toEqual(['a', 'b']);
    expect(resolveTimerHistoryComparePair([solves[0]], ['a', 'b'])).toBeNull();
    expect(resolveTimerHistoryComparePair(solves, ['a', 'a'])).toBeNull();
    expect(pruneTimerHistoryCompareSelection([solves[0]], ['a', 'b'])).toEqual(['a']);
  });

  it('prefers stored segments, totals partial HTM, and computes TPS from raw time', () => {
    const a = makeSolve('a', {
      timeMs: 10_000,
      penalty: '+2',
      ts: 1,
      stageSegments: segments,
      moves: [{ m: 'R', ts: 100 }],
    });
    const b = makeSolve('b', { timeMs: 0, penalty: 'DNS', ts: 2 });
    const comparison = buildTimerHistoryComparison(a, b);
    expect(comparison.a.stageSegments).toBe(segments);
    expect(comparison.a.result).toBe('12.00');
    expect(comparison.a.totalHtm).toBe(40);
    expect(comparison.a.totalTps).toBe(4);
    expect(comparison.stages.map((stage) => [stage.key, stage.a.htm, stage.a.caseLabel]))
      .toEqual([
        ['cross', 6, 'D-cross'],
        ['f2l', 24, null],
        ['oll', null, 'OLL 21'],
        ['pll', 10, 'PLL T'],
      ]);
    expect(comparison.b.result).toBe('DNS');
    expect(comparison.b.stageSegments).toBeNull();
    expect(comparison.b.totalHtm).toBeNull();
    expect(comparison.b.totalTps).toBeNull();
  });

  it('uses canonical FMC, DNF and MBLD result formatting', () => {
    const fmc = makeSolve('fmc', { event: '333fm', timeMs: 27_000, penalty: 'ok', ts: 1 });
    const dnf = makeSolve('dnf', { timeMs: 4_000, penalty: 'DNF', ts: 2 });
    const mbld = makeSolve('mbld', {
      event: '333mbld',
      timeMs: 3_482_000,
      penalty: 'ok',
      ts: 3,
      mbld: { solved: 11, attempted: 13 },
    });
    expect(buildTimerHistoryComparison(fmc, dnf).a.result).toBe('27');
    expect(buildTimerHistoryComparison(fmc, dnf).b.result).toBe('DNF');
    expect(buildTimerHistoryComparison(mbld, fmc).a.result).toBe('11/13 58:02');
  });

  it('falls back to the shared stage producer when stored segments are absent', () => {
    const solve = makeSolve('moves', {
      timeMs: 1_000,
      penalty: 'ok',
      ts: 1,
      scramble: 'R',
      moves: [{ m: "R'", ts: 1_000 }],
    });
    expect(buildTimerHistoryComparison(solve, solve).a.stageSegments).not.toBeNull();
  });

  it('keeps Web on the shared selection/model/modal and removes its private modal', () => {
    expect(historySource).toContain('toggleTimerHistoryCompareSelection(current, s.id)');
    expect(historySource).toContain('resolveTimerHistoryComparePair(solves, visibleSelectedIds)');
    expect(historySource).toContain('const compareContextMatches = compareSelectionContext === historyContextKey');
    expect(historySource).toContain('<TimerHistoryCompareModal');
    expect(historySource).not.toContain('CompareSolvesModal');
  });
});
