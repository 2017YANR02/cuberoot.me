import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  TIMER_GESTURE_ACTION_IDS,
  TIMER_HISTORY_QUICK_ACTION_IDS,
  histBack,
  histForward,
  histPush,
  takeManualScramble,
  timerHistoryQuickActionStates,
  timerWcaCompetitionScrambleSlotIdentity,
  type ScrambleHistory,
} from '@cuberoot/shared/timer';

import {
  createMobileScrambleHistoryEntry,
  mobileScrambleAttemptSnapshot,
  planMobileScrambleHistoryDisplay,
  replaceMobileScrambleHistoryEntry,
  type MobileScrambleHistoryEntry,
} from './mobile-scramble-history';
import type { RealScramble } from './data/real-scramble-pool';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

function real(scrambleNumber: number): RealScramble {
  return {
    competitionId: 'BrockportBolt2025',
    competitionName: 'Brockport Bolt 2025',
    eventId: '333',
    groupId: 'A',
    roundTypeId: '1',
    scramble: "R U R'",
    scrambleNumber,
    isExtra: false,
  };
}

function fillReal(
  history: ScrambleHistory<MobileScrambleHistoryEntry>,
  entry: MobileScrambleHistoryEntry,
  row: RealScramble,
) {
  return replaceMobileScrambleHistoryEntry(history, entry.id, entry.sourceIdentity, {
    availability: 'ready',
    currentReal: row,
    scramble: row.scramble,
    sourceSnapshot: {
      kind: 'wca',
      identity: timerWcaCompetitionScrambleSlotIdentity(row),
    },
  });
}

describe('mobile displayed-scramble history', () => {
  it('keeps duplicate-text WCA occurrences separate and saves the reviewed occurrence', () => {
    const firstRow = real(1);
    const secondRow = real(2);
    const first = createMobileScrambleHistoryEntry('333', 'wca', 'wca|context');
    let history = fillReal({ list: [first], idx: 0 }, first, firstRow);
    const second = createMobileScrambleHistoryEntry('333', 'wca', 'wca|context');
    history = histPush(history, second);
    history = fillReal(history, second, secondRow);

    const reviewed = histBack(history)!;
    const displayed = reviewed.list[reviewed.idx]!;
    const attempt = mobileScrambleAttemptSnapshot(displayed);

    expect(firstRow.scramble).toBe(secondRow.scramble);
    expect(displayed.currentReal?.scrambleNumber).toBe(1);
    expect(attempt).toEqual({
      caseId: null,
      event: '333',
      scramble: "R U R'",
      scrambleSource: {
        kind: 'wca',
        identity: timerWcaCompetitionScrambleSlotIdentity(firstRow),
      },
    });
    expect(attempt.scrambleSource.identity).not.toBe(
      timerWcaCompetitionScrambleSlotIdentity(secondRow),
    );
    expect(Object.isFrozen(displayed)).toBe(true);
    expect(Object.isFrozen(displayed.currentReal)).toBe(true);
    expect(Object.isFrozen(attempt)).toBe(true);
    expect(Object.isFrozen(attempt.scrambleSource)).toBe(true);
    expect(histForward(reviewed)?.list[history.idx]?.currentReal?.scrambleNumber).toBe(2);
  });

  it('rejects stale async completions after a source/context reset', () => {
    const oldEntry = createMobileScrambleHistoryEntry('333', 'random', 'random|old');
    const resetEntry = createMobileScrambleHistoryEntry('222', 'random', 'random|new');
    const reset: ScrambleHistory<MobileScrambleHistoryEntry> = { list: [resetEntry], idx: 0 };

    expect(replaceMobileScrambleHistoryEntry(
      reset,
      oldEntry.id,
      oldEntry.sourceIdentity,
      { availability: 'ready', scramble: 'stale' },
    )).toBe(reset);
    expect(replaceMobileScrambleHistoryEntry(
      reset,
      resetEntry.id,
      'random|wrong',
      { availability: 'ready', scramble: 'stale' },
    )).toBe(reset);

    const ready = replaceMobileScrambleHistoryEntry(
      reset,
      resetEntry.id,
      resetEntry.sourceIdentity,
      { availability: 'ready', caseId: 'case-2', scramble: 'R2 F2' },
    );
    expect(ready).not.toBe(reset);
    expect(ready.list[0]).toMatchObject({
      availability: 'ready', caseId: 'case-2', event: '222', scramble: 'R2 F2',
    });
    expect(Object.isFrozen(ready.list[0])).toBe(true);
  });

  it('restarts the exact visible loading slot after fast same-context navigation', () => {
    const first = createMobileScrambleHistoryEntry('333', 'random', 'random|same');
    const second = createMobileScrambleHistoryEntry('333', 'random', 'random|same');
    let history: ScrambleHistory<MobileScrambleHistoryEntry> = {
      list: [first, second],
      idx: 1,
    };
    history = replaceMobileScrambleHistoryEntry(
      history,
      second.id,
      second.sourceIdentity,
      { availability: 'ready', scramble: 'R U' },
    );

    const reviewed = histBack(history)!;
    const plan = planMobileScrambleHistoryDisplay(reviewed);
    expect(plan.refillEntry).toBe(first);
    expect(plan.history.list).toHaveLength(2);
    expect(plan.history.idx).toBe(0);

    const readyPlan = planMobileScrambleHistoryDisplay(histForward(reviewed)!);
    expect(readyPlan.refillEntry).toBeNull();
  });

  it('consumes manual input only at the queue tip, never while browsing retained entries', () => {
    const queue = ['A', 'B', 'C'];
    let cursor = 0;
    const take = () => {
      const result = takeManualScramble(queue, cursor);
      cursor = result.nextCursor;
      return result.scramble;
    };
    let history: ScrambleHistory<string> = { list: [take()], idx: 0 };
    history = histPush(history, take());
    expect(cursor).toBe(2);

    const previous = histBack(history)!;
    expect(previous.list[previous.idx]).toBe('A');
    expect(cursor).toBe(2);
    const forward = histForward(previous)!;
    expect(forward.list[forward.idx]).toBe('B');
    expect(cursor).toBe(2);
    expect(histForward(forward)).toBeNull();
    history = histPush(forward, take());
    expect(history.list[history.idx]).toBe('C');
    expect(cursor).toBe(0);
  });

  it('wires keyboard and the shared eight-way touch wheel to the same cursor', () => {
    expect(app).toContain('histBack(scrambleHistoryRef.current)');
    expect(app).toContain('histForward(scrambleHistoryRef.current)');
    expect(app).toContain('const { wheelRef: gestureWheelRef } = useGestureWheel({');
    expect(app).toMatch(/active: storeLoaded\s+&& view === 'timer'/);
    expect(app).toContain('&& openOverlay === null');
    expect(app).toContain('<GestureWheel ref={gestureWheelRef}');
    for (const actionId of TIMER_GESTURE_ACTION_IDS) {
      expect(app).toContain(`'${actionId}':`);
    }
    expect(app).toContain('timerKeyDownDecision({');
    expect(app).toContain('timerKeyUpDecision({');
    expect(app).toContain('target: timerKeyboardTargetContext(event.target)');
    expect(app).not.toContain("event.code !== 'ArrowLeft' && event.code !== 'ArrowRight'");
    expect(app).toContain('timerCanSwitchScramble(timerPhaseRef.current)');
    expect(app).toContain('planMobileScrambleHistoryDisplay(next)');
    expect(app).not.toContain('invalidateCurrentScramble();\n                          nextScramble(');
  });

  it('keeps the exact arrow-free Web scramble strip inside the 320px layout', () => {
    expect(css).toMatch(/html,[\s\S]*?min-width: 320px/);
    expect(app).toContain('<TimerScrambleStrip');
    expect(app).not.toContain('mobile-scramble-nav-button');
    expect(css).not.toContain('.mobile-scramble {');
    expect(app).toContain("scrambleClickEffect === 'retry' && currentScrambleEntry");
    expect(app).toContain('if (canSwitchScramble()) fillScrambleHistoryEntry(currentScrambleEntry);');
    expect(app).toContain('timerScrambleClickEffect(');
    expect(app).toContain('scramble.length > 0');
    expect(app).toContain("scrambleClickEffect === 'next'");
    expect(app).toContain('? nextDisplayedScramble');
    expect(app).toContain("scrambleClickEffect === 'copy' ? copyCurrentScramble : undefined}");
  });

  it('makes fullscreen a real layout/back state instead of a request-only action', () => {
    expect(app).toContain("fullscreen ? ' app-shell--timer-fullscreen' : ''");
    expect(app).toContain('if (fullscreenRef.current) {');
    expect(app).toContain('document.exitFullscreen()');
    expect(css).toContain('.app-shell--timer-fullscreen .timer-view > .shell-topbar');
    expect(css).toContain('.app-shell--timer-fullscreen > .primary-nav');
    expect(css).toContain('.app-shell--timer-fullscreen .mobile-timer-stage > .shell-stat-rail');
    expect(css).toContain('.app-shell--timer-fullscreen .mobile-timer-stage > .shell-device-actions');
  });

  it('consumes the shared history row/menu/editor and wires filters plus host effects', () => {
    const actions = timerHistoryQuickActionStates({
      menuOpen: true,
      currentPenalty: 'ok',
      canChangePenalty: true,
      canComment: true,
      canDelete: true,
    });
    expect(actions.map((action) => action.id)).toEqual(TIMER_HISTORY_QUICK_ACTION_IDS);
    expect(app).toContain('<TimerHistoryRow');
    expect(app).toContain('<TimerSolveDetailModal');
    expect(app).toContain('<div className="mobile-cube-preview">');
    expect(app).toContain('<TimerCubePreview ariaLabel={copy.cubeState} event={activeEvent} fill scramble={scramble} />');
    expect(app).toContain('TIMER_HISTORY_QUICK_ACTION_IDS.map((actionId)');
    expect(app).toContain('onCopyScramble: onCopy');
    expect(app).toContain('onDelete: onQuickDelete');
    expect(app).toContain('onQuickDelete={quickDeleteSolve}');
    expect(app).toContain('onOpenChange: onQuickMenuOpenChange');
    expect(app).toContain('open: quickMenuOpen');
    expect(app).toContain('message: copy.deletedSolve');
    expect(app).toContain('repository.restoreSolve(sessionId, solve)');
    expect(app).not.toContain('function HistoryRow(');
    expect(app).not.toContain('timerHistoryQuickActionStates({');
    expect(app).toContain('computeTimerHistoryTags(solves)');
    expect(app).toContain('filterTimerHistorySolves(solves, historyFilters, historyTagsById)');
    expect(app).toContain('<TimerHistoryTagBadges');
    expect(app).toContain('<TimerHistoryTagFilter');
    expect(app).toContain('className="mobile-history-match-count" role="status"');
    expect(app).toContain('toggleTimerHistoryTag(current.tags, tagId)');
    expect(app).toContain("updateHistoryFilter('query'");
    expect(app).toContain("updateHistoryFilter('timeMin'");
    expect(app).toContain("updateHistoryFilter('timeMax'");
    expect(app).toContain("updateHistoryFilter('ollCase'");
    expect(app).toContain("updateHistoryFilter('pllCase'");
    expect(app).toContain('toggleTimerHistoryPenalty(current.penalties, penalty)');
    expect(app).toContain('timerHistoryMoveTargets(');
    expect(app).toContain('repository.moveSolveToSession(solve.id, targetSessionId)');
    expect(app).toContain('moveTargets={historyMoveTargets}');
    expect(app).toContain('onChangeComment={(comment) => updateSolve(historyDetailSolve, { comment })}');
    expect(app).toContain('onChangePenalty={(penalty) => updateSolve(historyDetailSolve, { penalty })}');
    expect(app).toContain('if (expected && historyDetailRef.current !== expected) return;');
    expect(app).toContain('if (committed) closeHistorySolveDetail(historyDetail);');
    expect(app).toContain('if (moved) closeHistorySolveDetail(historyDetail);');
    expect(css).toMatch(/\.mobile-history-filter-grid \{[\s\S]*?min-width: 0;[\s\S]*?minmax\(0, 1fr\)/);
    expect(app).toContain('openOverlay === TIMER_OVERLAY_IDS.solveDetail');
  });
});
