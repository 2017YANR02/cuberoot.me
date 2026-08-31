import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as shared from '@cuberoot/shared/timer';
import * as webKeymap from '@/app/[lang]/timer/_lib/keymap';
import type {
  TimerKeyDownContext,
  TimerKeyboardInput,
  TimerKeyboardTargetContext,
  TimerPhase,
} from '@cuberoot/shared/timer';

const PLAIN_TARGET: TimerKeyboardTargetContext = {
  textEntry: false,
  select: false,
  noTimerRegion: false,
};

function key(
  code: string,
  modifiers: Partial<TimerKeyboardInput> = {},
): TimerKeyboardInput {
  return { code, ...modifiers };
}

function down(
  input: TimerKeyboardInput,
  overrides: Partial<Omit<TimerKeyDownContext, 'input'>> = {},
) {
  return shared.timerKeyDownDecision({
    input,
    target: PLAIN_TARGET,
    modal: 'none',
    phase: 'idle',
    timingEnabled: true,
    multiStageActive: false,
    bldMemoActive: false,
    keymap: shared.resolveKeymap({}),
    solveCount: 9,
    ...overrides,
  });
}

describe('shared timer keyboard manifest', () => {
  it('locks the exact action set, display order, and default bindings', () => {
    expect(shared.TIMER_ACTION_IDS).toEqual([
      'delete-last',
      'toggle-plus2',
      'toggle-dnf',
      'toggle-dns',
      'next-scramble',
      'prev-scramble',
      'toggle-fullscreen',
    ]);
    expect(shared.TIMER_ACTIONS.map((action) => action.id)).toEqual(shared.TIMER_ACTION_IDS);
    expect(shared.DEFAULT_KEYMAP).toEqual({
      KeyZ: 'delete-last',
      Digit2: 'toggle-plus2',
      KeyD: 'toggle-dnf',
      'Shift+KeyD': 'toggle-dns',
      Comma: 'next-scramble',
      ArrowRight: 'next-scramble',
      ArrowLeft: 'prev-scramble',
      KeyF: 'toggle-fullscreen',
    });
    expect([...shared.RESERVED_BINDINGS]).toEqual([
      'Space', 'Shift+Space',
      'Escape', 'Shift+Escape',
      'Enter', 'Shift+Enter',
    ]);
  });

  it('keeps override/null semantics and moves a rebound action instead of duplicating it', () => {
    const resolved = shared.resolveKeymap({ KeyF: null, KeyG: 'toggle-fullscreen' });
    expect(resolved.KeyF).toBeUndefined();
    expect(resolved.KeyG).toBe('toggle-fullscreen');
    expect(resolved.KeyD).toBe('toggle-dnf');

    const rebound = shared.rebindTimerAction(
      {},
      shared.resolveKeymap({}),
      'next-scramble',
      'KeyN',
    );
    expect(rebound).toEqual({ Comma: null, ArrowRight: null, KeyN: 'next-scramble' });
    expect(shared.resolveKeymap(rebound)).toMatchObject({ KeyN: 'next-scramble' });
    expect(shared.bindingsForAction(shared.resolveKeymap(rebound), 'next-scramble')).toEqual(['KeyN']);

    expect(shared.unbindTimerAction({}, shared.resolveKeymap({}), 'toggle-dns'))
      .toEqual({ 'Shift+KeyD': null });
  });

  it('pins capture priority and forbidden browser/timer chords', () => {
    expect(shared.timerRebindCaptureDecision(key('Escape'))).toEqual({ kind: 'cancel' });
    expect(shared.timerRebindCaptureDecision(key('ShiftLeft', { shiftKey: true })))
      .toEqual({ kind: 'wait-for-key' });
    expect(shared.timerRebindCaptureDecision(key('KeyD', { ctrlKey: true })))
      .toEqual({ kind: 'reject', reason: 'browser-modifier', binding: null });
    expect(shared.timerRebindCaptureDecision(key('Space')))
      .toEqual({ kind: 'reject', reason: 'reserved', binding: 'Space' });
    expect(shared.timerRebindCaptureDecision(key('KeyN', { shiftKey: true })))
      .toEqual({ kind: 'bind', binding: 'Shift+KeyN' });
  });
});

describe('shared timer keydown priority golden matrix', () => {
  it('blocks every normal timer key behind a modal', () => {
    expect(down(key('Space'), { modal: 'blocking' })).toEqual({
      command: { id: 'none' }, preventDefault: false, blurActiveElement: false,
    });
    expect(down(key('KeyD'), { modal: 'blocking' }).command).toEqual({ id: 'none' });
  });

  it('lets a hints-only sheet use only rebound previous/next commands', () => {
    expect(down(key('ArrowLeft'), { modal: 'hints-only' })).toEqual({
      command: { id: 'prev-scramble' }, preventDefault: true, blurActiveElement: false,
    });
    expect(down(key('KeyF'), { modal: 'hints-only' }).command).toEqual({ id: 'none' });
    expect(down(key('ArrowLeft', { repeat: true }), { modal: 'hints-only' }).command)
      .toEqual({ id: 'none' });
    expect(down(key('ArrowLeft'), {
      modal: 'hints-only',
      target: { ...PLAIN_TARGET, select: true },
    }).command).toEqual({ id: 'none' });

    const busy = down(key('ArrowRight'), { modal: 'hints-only', phase: 'running' });
    expect(busy.command).toEqual({ id: 'none' });
    expect(busy.preventDefault).toBe(true);
  });

  it('blocks text entry and data-no-timer controls, with the exact arrow exception', () => {
    expect(down(key('Space'), {
      target: { ...PLAIN_TARGET, textEntry: true },
    }).command).toEqual({ id: 'none' });

    const noTimer = { ...PLAIN_TARGET, noTimerRegion: true };
    expect(down(key('ArrowRight', { shiftKey: true }), { target: noTimer })).toEqual({
      command: { id: 'next-scramble' }, preventDefault: true, blurActiveElement: false,
    });
    expect(down(key('KeyF'), { target: noTimer }).command).toEqual({ id: 'none' });
    expect(down(key('ArrowRight'), {
      target: { ...noTimer, select: true },
    }).command).toEqual({ id: 'none' });
    expect(down(key('ArrowRight'), { target: noTimer, phase: 'holding' }).command)
      .toEqual({ id: 'none' });
  });

  it('keeps Space and Escape fixed ahead of the editable map', () => {
    expect(down(key('Space'))).toEqual({
      command: { id: 'press-down', warmupSound: true },
      preventDefault: true,
      blurActiveElement: true,
    });
    expect(down(key('Space', { repeat: true }))).toEqual({
      command: { id: 'none' }, preventDefault: true, blurActiveElement: false,
    });
    expect(down(key('Space'), { timingEnabled: false })).toEqual({
      command: { id: 'next-scramble' }, preventDefault: true, blurActiveElement: true,
    });
    expect(down(key('Escape'), {
      keymap: { Escape: 'next-scramble' },
    }).command).toEqual({ id: 'reset' });
  });

  it('resolves stage/memo controls before the running any-key stop', () => {
    expect(down(key('Digit2'), { phase: 'running', multiStageActive: true })).toEqual({
      command: { id: 'mark-stage', stage: 'f2l' },
      preventDefault: false,
      blurActiveElement: false,
    });
    // Historical Web behavior: Alt is not excluded from stage and memo chords.
    expect(down(key('Digit1', { altKey: true }), {
      phase: 'running', multiStageActive: true,
    }).command).toEqual({ id: 'mark-stage', stage: 'cross' });
    expect(down(key('Enter'), { phase: 'running', bldMemoActive: true })).toEqual({
      command: { id: 'mark-bld-memo' }, preventDefault: true, blurActiveElement: false,
    });
    expect(down(key('KeyQ'), { phase: 'running' })).toEqual({
      command: { id: 'press-down', warmupSound: false },
      preventDefault: true,
      blurActiveElement: false,
    });
    expect(down(key('Digit1', { shiftKey: true }), {
      phase: 'running', multiStageActive: true,
    }).command).toEqual({ id: 'press-down', warmupSound: false });
  });

  it('blocks editable/history actions while holding, ready, or inspecting', () => {
    for (const phase of ['holding', 'ready', 'inspecting'] as const) {
      expect(down(key('KeyD'), { phase }).command).toEqual({ id: 'none' });
      expect(down(key('Digit1'), { phase }).command).toEqual({ id: 'none' });
    }
  });

  it('keeps editable actions ahead of Digit1..9 history selection', () => {
    expect(down(key('KeyD')).command).toEqual({ id: 'toggle-dnf' });
    expect(down(key('ArrowRight'))).toEqual({
      command: { id: 'next-scramble' }, preventDefault: true, blurActiveElement: false,
    });
    // Digit2 remains +2 even when there is a second-last solve to open.
    expect(down(key('Digit2'), { solveCount: 4 }).command).toEqual({ id: 'toggle-plus2' });

    const withoutDigit2 = shared.resolveKeymap({ Digit2: null });
    expect(down(key('Digit2'), { keymap: withoutDigit2, solveCount: 4 }).command)
      .toEqual({ id: 'open-solve', offsetFromLast: 2 });
    // A newly rebound digit shadows history even when its solve-edit effect is absent.
    expect(down(key('Digit1'), {
      keymap: { Digit1: 'delete-last' }, solveCount: 0,
    }).command).toEqual({ id: 'delete-last' });
    expect(down(key('Digit9'), { keymap: {}, solveCount: 8 }).command).toEqual({ id: 'none' });
    // Historical Web behavior also permits Alt+Digit history selection.
    expect(down(key('Digit1', { altKey: true }), { keymap: {}, solveCount: 1 }).command)
      .toEqual({ id: 'open-solve', offsetFromLast: 1 });
  });
});

describe('keyup, phase, and external pointer policy', () => {
  it('fails closed for loading, unavailable, stale, and unauthorized empty slots', () => {
    const ready = {
      availability: 'ready' as const,
      emptyScrambleAllowed: false,
      scramble: "R U R'",
      sourceMatches: true,
    };

    expect(shared.timerCanStartAttempt(ready)).toBe(true);
    expect(shared.timerCanStartAttempt({ ...ready, availability: 'loading' })).toBe(false);
    expect(shared.timerCanStartAttempt({ ...ready, availability: 'unavailable' })).toBe(false);
    expect(shared.timerCanStartAttempt({ ...ready, sourceMatches: false })).toBe(false);
    expect(shared.timerCanStartAttempt({ ...ready, scramble: '' })).toBe(false);
    expect(shared.timerCanStartAttempt({
      ...ready,
      emptyScrambleAllowed: true,
      scramble: '',
    })).toBe(true);
    expect(shared.timerCanStartAttempt({
      ...ready,
      availability: 'loading',
      emptyScrambleAllowed: true,
      scramble: '',
    })).toBe(false);
  });

  it('allows a closed start gate to stop running, but never to arm another phase', () => {
    for (const phase of ['idle', 'holding', 'ready', 'inspecting', 'stopped'] as TimerPhase[]) {
      expect(shared.timerCanHandleAttemptPress(phase, false)).toBe(false);
      expect(shared.timerCanHandleAttemptPress(phase, true)).toBe(true);
    }
    expect(shared.timerCanHandleAttemptPress('running', false)).toBe(true);
    expect(shared.timerCanHandleAttemptPress('running', true)).toBe(true);
  });

  it('owns only an eligible Space release', () => {
    const base = {
      input: key('Space'),
      target: PLAIN_TARGET,
      modalOpen: false,
      timingEnabled: true,
    };
    expect(shared.timerKeyUpDecision(base)).toEqual({
      command: { id: 'press-up' }, preventDefault: true, blurActiveElement: false,
    });
    expect(shared.timerKeyUpDecision({ ...base, timingEnabled: false })).toEqual({
      command: { id: 'none' }, preventDefault: true, blurActiveElement: false,
    });
    expect(shared.timerKeyUpDecision({ ...base, modalOpen: true }).command).toEqual({ id: 'none' });
    expect(shared.timerKeyUpDecision({
      ...base, target: { ...PLAIN_TARGET, noTimerRegion: true },
    }).command).toEqual({ id: 'none' });
    expect(shared.timerKeyUpDecision({ ...base, input: key('KeyD') }).command).toEqual({ id: 'none' });
  });

  it('locks busy phases and external running-pointer behavior', () => {
    expect(shared.TIMER_INPUT_BUSY_PHASES).toEqual(['inspecting', 'holding', 'ready', 'running']);
    for (const phase of ['idle', 'stopped'] as TimerPhase[]) {
      expect(shared.timerCanSwitchScramble(phase)).toBe(true);
      expect(shared.timerCanUseGestureWheel(phase)).toBe(true);
    }
    for (const phase of shared.TIMER_INPUT_BUSY_PHASES) {
      expect(shared.timerCanSwitchScramble(phase)).toBe(false);
      expect(shared.timerCanUseGestureWheel(phase)).toBe(false);
    }
    expect(shared.timerShouldStopFromExternalPointer('running', false)).toBe(true);
    expect(shared.timerShouldStopFromExternalPointer('running', true)).toBe(false);
    expect(shared.timerShouldStopFromExternalPointer('stopped', false)).toBe(false);
  });
});

describe('shared eight-way gesture contract', () => {
  it('locks every direction, ID, copy, and enabled rule', () => {
    expect(shared.TIMER_GESTURE_ACTION_IDS).toEqual([
      'next-scramble',
      'penalty-ok',
      'toggle-plus2',
      'toggle-dnf',
      'prev-scramble',
      'comment-last',
      'delete-last',
      'copy-scramble',
    ]);
    expect(shared.TIMER_GESTURE_ACTION_CONTRACTS.map((action) => ({
      direction: action.direction,
      id: action.id,
      enabledWhen: action.enabledWhen,
    }))).toEqual([
      { direction: 0, id: 'next-scramble', enabledWhen: 'always' },
      { direction: 1, id: 'penalty-ok', enabledWhen: 'has-last-solve' },
      { direction: 2, id: 'toggle-plus2', enabledWhen: 'has-last-solve' },
      { direction: 3, id: 'toggle-dnf', enabledWhen: 'has-last-solve' },
      { direction: 4, id: 'prev-scramble', enabledWhen: 'has-previous-scramble' },
      { direction: 5, id: 'comment-last', enabledWhen: 'has-last-solve' },
      { direction: 6, id: 'delete-last', enabledWhen: 'has-last-solve' },
      { direction: 7, id: 'copy-scramble', enabledWhen: 'always' },
    ]);
    expect(shared.timerGestureActionLabels(false)).toEqual([
      'Next', 'OK', '+2', 'DNF', 'Prev', 'Note', 'Del', 'Copy',
    ]);
    expect(shared.timerGestureActionLabels(true)).toEqual([
      '下一个', 'OK', '+2', 'DNF', '上一个', '注释', '删除', '复制',
    ]);
  });

  it('resolves availability without changing the direction set', () => {
    expect(shared.timerGestureActionStates({
      hasLastSolve: false,
      hasPreviousScramble: false,
    }).map((action) => action.enabled)).toEqual([
      true, false, false, false, false, false, false, true,
    ]);
    expect(shared.timerGestureActionStates({
      hasLastSolve: true,
      hasPreviousScramble: true,
    }).map((action) => action.enabled)).toEqual([
      true, true, true, true, true, true, true, true,
    ]);
    expect(shared.timerGestureActionAt(0)?.id).toBe('next-scramble');
    expect(shared.timerGestureActionAt(7)?.id).toBe('copy-scramble');
    expect(shared.timerGestureActionAt(-1)).toBeNull();
    expect(shared.timerGestureActionAt(8)).toBeNull();
  });

  it('pins mouse/touch slop, grace, dead-zone, and all eight directions', () => {
    expect(shared.TIMER_RADIAL_POINTER_PROFILES).toEqual({
      mouse: { tapSlopPx: 10, deadZonePx: 44, quickFlickGraceMs: null },
      touch: { tapSlopPx: 18, deadZonePx: 90, quickFlickGraceMs: 200 },
    });
    const mouse = shared.timerRadialPointerProfile('mouse');
    const touch = shared.timerRadialPointerProfile('touch');
    expect(shared.timerRadialGestureStarts(10, 1, mouse)).toBe(false);
    expect(shared.timerRadialGestureStarts(10.01, 10_000, mouse)).toBe(true);
    expect(shared.timerRadialGestureStarts(18, 100, touch)).toBe(false);
    expect(shared.timerRadialGestureStarts(18.01, 200, touch)).toBe(true);
    expect(shared.timerRadialGestureStarts(18.01, 201, touch)).toBe(false);
    expect(shared.timerRadialGestureStarts(90, 1_000, touch)).toBe(true);

    const d = 100;
    expect([
      shared.timerRadialGestureDirection(d, 0, 44),
      shared.timerRadialGestureDirection(d, -d, 44),
      shared.timerRadialGestureDirection(0, -d, 44),
      shared.timerRadialGestureDirection(-d, -d, 44),
      shared.timerRadialGestureDirection(-d, 0, 44),
      shared.timerRadialGestureDirection(-d, d, 44),
      shared.timerRadialGestureDirection(0, d, 44),
      shared.timerRadialGestureDirection(d, d, 44),
    ]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(shared.timerRadialGestureDirection(43.99, 0, 44)).toBe(-1);
    expect(shared.timerRadialGestureDirection(44, 0, 44)).toBe(0);
    expect(shared.timerRadialGestureDirection(Number.NaN, 0, 44)).toBe(-1);
  });
});

describe('Web migration consumes the shared contract', () => {
  it('keeps the compatibility keymap path as identity re-exports', () => {
    expect(webKeymap.DEFAULT_KEYMAP).toBe(shared.DEFAULT_KEYMAP);
    expect(webKeymap.TIMER_ACTIONS).toBe(shared.TIMER_ACTIONS);
    expect(webKeymap.bindingForEvent).toBe(shared.bindingForEvent);
    expect(webKeymap.resolveKeymap).toBe(shared.resolveKeymap);
    expect(webKeymap.timerKeyDownDecision).toBe(shared.timerKeyDownDecision);
    expect(webKeymap.timerRebindCaptureDecision).toBe(shared.timerRebindCaptureDecision);
  });

  it('has no second Web action map, priority tree, labels, or gesture thresholds', () => {
    const keymapSource = readFileSync(new URL(
      '../app/[lang]/timer/_lib/keymap.ts', import.meta.url,
    ), 'utf8');
    const soloSource = readFileSync(new URL(
      '../app/[lang]/timer/_shell/SoloView.tsx', import.meta.url,
    ), 'utf8');
    const settingsSource = readFileSync(new URL(
      '../app/[lang]/timer/_components/SettingsPanel.tsx', import.meta.url,
    ), 'utf8');
    const hookWrapper = readFileSync(new URL(
      '../hooks/useGestureWheel.ts', import.meta.url,
    ), 'utf8');
    const wheelWrapper = readFileSync(new URL(
      '../components/GestureWheel.tsx', import.meta.url,
    ), 'utf8');
    const timerUiEntry = new URL(import.meta.resolve('@cuberoot/timer-ui'));
    const hookSource = readFileSync(new URL('./useGestureWheel.ts', timerUiEntry), 'utf8');
    const wheelSource = readFileSync(new URL('./GestureWheel.tsx', timerUiEntry), 'utf8');

    expect(keymapSource).toContain("from '@cuberoot/shared/timer'");
    expect(keymapSource).not.toContain("KeyZ: 'delete-last'");
    expect(soloSource).toContain('timerKeyDownDecision({');
    expect(soloSource).toContain('timerGestureActionStates({');
    expect(soloSource).not.toContain('e.code.match(DIGIT_OPENS_SOLVE)');
    expect(settingsSource).toContain('timerRebindCaptureDecision(e)');
    expect(settingsSource).toContain('rebindTimerAction(s.keymap, keymap, capturing, capture.binding)');
    expect(settingsSource).toContain('unbindTimerAction(s.keymap, keymap, action.id)');
    expect(settingsSource).not.toContain('if (a === capturing) next[b] = null');
    expect(hookSource).toContain('timerRadialGestureStarts(');
    expect(hookSource).toContain('timerRadialGestureDirection(');
    expect(hookSource).not.toContain('MOUSE_SLOP');
    expect(wheelSource).toContain('timerGestureActionLabels(isZh)');
    expect(wheelSource).not.toContain("['Next', 'OK', '+2'");
    expect(hookWrapper).toContain("from '@cuberoot/timer-ui'");
    expect(hookWrapper).not.toContain('addEventListener');
    expect(wheelWrapper).toContain("from '@cuberoot/timer-ui'");
    expect(wheelWrapper).not.toContain('forwardRef');
  });

  it('routes pointer, keyboard, smart-cube, and hardware starts through the shared gate', () => {
    const soloSource = readFileSync(new URL(
      '../app/[lang]/timer/_shell/SoloView.tsx', import.meta.url,
    ), 'utf8');

    expect(soloSource).toContain('const attemptCanStart = timerCanStartAttempt({');
    expect(soloSource).toContain("? 'loading'");
    expect(soloSource).toContain("? 'unavailable'");
    expect(soloSource).toContain(
      'sourceMatches: scrambleGeneratorAtHistoryResetRef.current === genScramble',
    );
    expect(soloSource).toContain('timerCanHandleAttemptPress(');
    expect(soloSource.match(/timer\.onPressDown\(\)/g)).toHaveLength(1);
    expect(soloSource).toMatch(
      /startFromCubeRef\.current[\s\S]*?if \(!attemptCanStartRef\.current\) return;[\s\S]*?timer\.startFromCube/,
    );
    expect(soloSource).toMatch(
      /if \(timerEvent\.state === 'RUNNING'\)[\s\S]*?if \(!attemptCanStartRef\.current\)[\s\S]*?timer\.startNow/,
    );
    expect(soloSource).toMatch(
      /onStart: \(\) => \{[\s\S]*?attemptCanStartRef\.current[\s\S]*?onStop: \(ms\)/,
    );
  });
});
