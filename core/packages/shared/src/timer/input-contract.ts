import type { TimerPhase } from './machine';

/**
 * Runtime-neutral input contract for the solo timer.
 *
 * The browser owns DOM target classification and effect execution. Everything
 * that decides *which* timer command an input means lives here so Web, Android,
 * and the future iOS shell cannot quietly acquire different shortcut priority,
 * modal suppression, or gesture direction maps.
 */

export const TIMER_ACTION_IDS = [
  'delete-last',
  'toggle-plus2',
  'toggle-dnf',
  'toggle-dns',
  'next-scramble',
  'prev-scramble',
  'toggle-fullscreen',
] as const;

export type TimerActionId = (typeof TIMER_ACTION_IDS)[number];

export interface TimerActionDef {
  id: TimerActionId;
  zh: string;
  en: string;
}

/** Display order in the settings UI; also the canonical keyboard action set. */
export const TIMER_ACTIONS: readonly TimerActionDef[] = [
  { id: 'delete-last', zh: '删除最后一次成绩', en: 'Delete last solve' },
  { id: 'toggle-plus2', zh: '切换 +2', en: 'Toggle +2' },
  { id: 'toggle-dnf', zh: '切换 DNF', en: 'Toggle DNF' },
  { id: 'toggle-dns', zh: '切换 DNS', en: 'Toggle DNS' },
  { id: 'next-scramble', zh: '下一个打乱', en: 'Next scramble' },
  { id: 'prev-scramble', zh: '上一个打乱', en: 'Previous scramble' },
  { id: 'toggle-fullscreen', zh: '全屏', en: 'Fullscreen' },
] as const;

/** Exact Web defaults. Stored settings are overrides, never this resolved map. */
export const DEFAULT_KEYMAP: Readonly<Record<string, TimerActionId>> = Object.freeze({
  KeyZ: 'delete-last',
  Digit2: 'toggle-plus2',
  KeyD: 'toggle-dnf',
  'Shift+KeyD': 'toggle-dns',
  Comma: 'next-scramble',
  ArrowRight: 'next-scramble',
  ArrowLeft: 'prev-scramble',
  KeyF: 'toggle-fullscreen',
});

/** Fixed timer controls cannot be reassigned by the editable shortcut tail. */
export const RESERVED_BINDINGS: ReadonlySet<string> = new Set([
  'Space', 'Shift+Space',
  'Escape', 'Shift+Escape',
  'Enter', 'Shift+Enter',
]);

/** Digit1..Digit9 open the Nth-from-last solve after the keymap tail misses. */
export const DIGIT_OPENS_SOLVE = /^Digit([1-9])$/;

export interface TimerKeyboardInput {
  code: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
}

/** `KeyboardEvent.code` plus optional Shift; browser/OS modifier chords stay reserved. */
export function bindingForEvent(input: TimerKeyboardInput): string | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  if (!input.code) return null;
  return input.shiftKey ? `Shift+${input.code}` : input.code;
}

/** Defaults with user overrides applied; an explicit null means unbound. */
export function resolveKeymap(
  overrides: Readonly<Record<string, TimerActionId | null>> | undefined,
): Record<string, TimerActionId> {
  const out: Record<string, TimerActionId> = { ...DEFAULT_KEYMAP };
  for (const [binding, action] of Object.entries(overrides ?? {})) {
    if (action === null) delete out[binding];
    else out[binding] = action;
  }
  return out;
}

/** Every binding currently pointing at one action, in resolved-map order. */
export function bindingsForAction(
  keymap: Readonly<Record<string, TimerActionId>>,
  id: TimerActionId,
): string[] {
  return Object.keys(keymap).filter((binding) => keymap[binding] === id);
}

export type TimerRebindCaptureDecision =
  | { kind: 'cancel' }
  | { kind: 'wait-for-key' }
  | { kind: 'reject'; reason: 'browser-modifier' | 'reserved'; binding: string | null }
  | { kind: 'bind'; binding: string };

/** Exact capture priority used by the shortcut editor. */
export function timerRebindCaptureDecision(
  input: TimerKeyboardInput,
): TimerRebindCaptureDecision {
  if (input.code === 'Escape') return { kind: 'cancel' };
  if (input.code === 'ShiftLeft' || input.code === 'ShiftRight') {
    return { kind: 'wait-for-key' };
  }
  const binding = bindingForEvent(input);
  if (!binding) return { kind: 'reject', reason: 'browser-modifier', binding: null };
  if (RESERVED_BINDINGS.has(binding)) {
    return { kind: 'reject', reason: 'reserved', binding };
  }
  return { kind: 'bind', binding };
}

/**
 * Move an action to one binding. Its old resolved bindings become explicit
 * null overrides so defaults do not spring back after reload.
 */
export function rebindTimerAction(
  overrides: Readonly<Record<string, TimerActionId | null>>,
  resolvedKeymap: Readonly<Record<string, TimerActionId>>,
  action: TimerActionId,
  binding: string,
): Record<string, TimerActionId | null> {
  const next: Record<string, TimerActionId | null> = { ...overrides };
  for (const [oldBinding, oldAction] of Object.entries(resolvedKeymap)) {
    if (oldAction === action) next[oldBinding] = null;
  }
  next[binding] = action;
  return next;
}

/** Explicitly unbind every currently resolved key for one action. */
export function unbindTimerAction(
  overrides: Readonly<Record<string, TimerActionId | null>>,
  resolvedKeymap: Readonly<Record<string, TimerActionId>>,
  action: TimerActionId,
): Record<string, TimerActionId | null> {
  const next: Record<string, TimerActionId | null> = { ...overrides };
  for (const [binding, currentAction] of Object.entries(resolvedKeymap)) {
    if (currentAction === action) next[binding] = null;
  }
  return next;
}

export const TIMER_INPUT_BUSY_PHASES = [
  'inspecting',
  'holding',
  'ready',
  'running',
] as const satisfies readonly TimerPhase[];

const INPUT_BUSY_PHASES: ReadonlySet<TimerPhase> = new Set(TIMER_INPUT_BUSY_PHASES);

/** A scramble cannot change while an attempt is armed, inspected, or running. */
export function timerCanSwitchScramble(phase: TimerPhase): boolean {
  return !INPUT_BUSY_PHASES.has(phase);
}

/** The radial wheel is available only before an attempt or after a result. */
export function timerCanUseGestureWheel(phase: TimerPhase): boolean {
  return phase === 'idle' || phase === 'stopped';
}

/** Outside-surface pointer presses stop a run; surface presses are handled once by the wheel hook. */
export function timerShouldStopFromExternalPointer(
  phase: TimerPhase,
  pointerInsideTimingSurface: boolean,
): boolean {
  return phase === 'running' && !pointerInsideTimingSurface;
}

export type TimerAttemptAvailability = 'ready' | 'loading' | 'unavailable';

export interface TimerAttemptStartContext {
  availability: TimerAttemptAvailability;
  emptyScrambleAllowed: boolean;
  scramble: string;
  sourceMatches: boolean;
}

/**
 * Fail-closed start gate shared by pointer, keyboard and device hosts.
 * A loading/error slot never becomes a solve with an empty or stale scramble;
 * only canonical manual/custom sources may deliberately start empty.
 */
export function timerCanStartAttempt(context: TimerAttemptStartContext): boolean {
  return context.availability === 'ready'
    && context.sourceMatches
    && (context.emptyScrambleAllowed || context.scramble.length > 0);
}

/**
 * A press may always stop an already-running attempt, even if the next
 * scramble became unavailable. Every pre-run phase remains fail-closed behind
 * the same start gate.
 */
export function timerCanHandleAttemptPress(
  phase: TimerPhase,
  attemptCanStart: boolean,
): boolean {
  return phase === 'running' || attemptCanStart;
}

export type TimerKeyboardModalState = 'none' | 'hints-only' | 'blocking';

/** Browser hosts derive these flags from the real event target. */
export interface TimerKeyboardTargetContext {
  /** input, textarea, or contenteditable (the normal handler deliberately excludes select here). */
  textEntry: boolean;
  select: boolean;
  noTimerRegion: boolean;
}

export type TimerKeyboardCommand =
  | { id: 'none' }
  | { id: 'press-down'; warmupSound: boolean }
  | { id: 'press-up' }
  | { id: 'reset' }
  | { id: 'mark-stage'; stage: 'cross' | 'f2l' | 'oll' }
  | { id: 'mark-bld-memo' }
  | { id: TimerActionId }
  | { id: 'open-solve'; offsetFromLast: number };

export interface TimerKeyboardDecision {
  command: TimerKeyboardCommand;
  preventDefault: boolean;
  blurActiveElement: boolean;
}

export interface TimerKeyDownContext {
  input: TimerKeyboardInput;
  target: TimerKeyboardTargetContext;
  modal: TimerKeyboardModalState;
  phase: TimerPhase;
  timingEnabled: boolean;
  multiStageActive: boolean;
  bldMemoActive: boolean;
  keymap: Readonly<Record<string, TimerActionId>>;
  solveCount: number;
}

export interface TimerKeyUpContext {
  input: TimerKeyboardInput;
  target: TimerKeyboardTargetContext;
  modalOpen: boolean;
  timingEnabled: boolean;
}

function decision(
  command: TimerKeyboardCommand = { id: 'none' },
  preventDefault = false,
  blurActiveElement = false,
): TimerKeyboardDecision {
  return { command, preventDefault, blurActiveElement };
}

function hasUnmodifiedStageChord(input: TimerKeyboardInput): boolean {
  // Web historically permits Alt+Digit / Alt+Enter here. Preserve that exact
  // order until a deliberate product change says otherwise.
  return !input.shiftKey && !input.ctrlKey && !input.metaKey;
}

/**
 * Resolve one keydown without touching the DOM or timer state.
 *
 * Priority is the compatibility contract: modal/target guards, fixed Space and
 * Escape controls, running-stage controls, any-key stop, armed-phase blocking,
 * editable actions, then Digit1..9 solve history. A bound digit therefore
 * shadows its history slot even when the action currently has no solve to edit.
 */
export function timerKeyDownDecision(context: TimerKeyDownContext): TimerKeyboardDecision {
  const { input, target, modal, phase, keymap } = context;

  if (modal !== 'none') {
    if (modal !== 'hints-only' || input.repeat) return decision();
    if (target.textEntry || target.select) return decision();
    const binding = bindingForEvent(input);
    const action = binding ? keymap[binding] : undefined;
    if (action !== 'next-scramble' && action !== 'prev-scramble') return decision();
    return decision(
      timerCanSwitchScramble(phase) ? { id: action } : { id: 'none' },
      true,
    );
  }

  if (target.textEntry) return decision();

  if (target.noTimerRegion) {
    const allowed = timerCanSwitchScramble(phase)
      && !input.repeat
      && !target.select;
    if (allowed && input.code === 'ArrowLeft') {
      return decision({ id: 'prev-scramble' }, true);
    }
    if (allowed && input.code === 'ArrowRight') {
      return decision({ id: 'next-scramble' }, true);
    }
    return decision();
  }

  if (input.code === 'Space') {
    if (input.repeat) return decision({ id: 'none' }, true);
    if (!context.timingEnabled) {
      return decision({ id: 'next-scramble' }, true, true);
    }
    return decision({ id: 'press-down', warmupSound: true }, true, true);
  }

  if (input.repeat) return decision();
  if (input.code === 'Escape') return decision({ id: 'reset' });

  if (phase === 'running' && context.multiStageActive && hasUnmodifiedStageChord(input)) {
    if (input.code === 'Digit1') return decision({ id: 'mark-stage', stage: 'cross' });
    if (input.code === 'Digit2') return decision({ id: 'mark-stage', stage: 'f2l' });
    if (input.code === 'Digit3') return decision({ id: 'mark-stage', stage: 'oll' });
  }

  if (phase === 'running'
    && context.bldMemoActive
    && input.code === 'Enter'
    && hasUnmodifiedStageChord(input)) {
    return decision({ id: 'mark-bld-memo' }, true);
  }

  if (phase === 'running') {
    return decision({ id: 'press-down', warmupSound: false }, true);
  }
  if (phase === 'holding' || phase === 'ready' || phase === 'inspecting') {
    return decision();
  }

  const binding = bindingForEvent(input);
  const action = binding ? keymap[binding] : undefined;
  if (action) {
    return decision(
      { id: action },
      action === 'next-scramble' || action === 'prev-scramble',
    );
  }

  const match = input.code.match(DIGIT_OPENS_SOLVE);
  if (match && hasUnmodifiedStageChord(input)) {
    const offsetFromLast = Number(match[1]);
    if (context.solveCount >= offsetFromLast) {
      return decision({ id: 'open-solve', offsetFromLast });
    }
  }

  return decision();
}

/** Keyup owns only Space release; all other actions are keydown-only. */
export function timerKeyUpDecision(context: TimerKeyUpContext): TimerKeyboardDecision {
  if (context.modalOpen || context.target.textEntry || context.target.noTimerRegion) {
    return decision();
  }
  if (context.input.code !== 'Space') return decision();
  if (!context.timingEnabled) return decision({ id: 'none' }, true);
  return decision({ id: 'press-up' }, true);
}

export const TIMER_GESTURE_ACTION_IDS = [
  'next-scramble',
  'penalty-ok',
  'toggle-plus2',
  'toggle-dnf',
  'prev-scramble',
  'comment-last',
  'delete-last',
  'copy-scramble',
] as const;

export type TimerGestureActionId = (typeof TIMER_GESTURE_ACTION_IDS)[number];

export type TimerGestureEnabledWhen = 'always' | 'has-last-solve' | 'has-previous-scramble';

export interface TimerGestureActionContract {
  /** 0=right, then counter-clockwise through 7=down-right. */
  direction: number;
  id: TimerGestureActionId;
  copy: { en: string; zh: string };
  enabledWhen: TimerGestureEnabledWhen;
}

/** Exact eight-direction Web `/timer` action map. */
export const TIMER_GESTURE_ACTION_CONTRACTS: readonly TimerGestureActionContract[] = [
  { direction: 0, id: 'next-scramble', copy: { en: 'Next', zh: '下一个' }, enabledWhen: 'always' },
  { direction: 1, id: 'penalty-ok', copy: { en: 'OK', zh: 'OK' }, enabledWhen: 'has-last-solve' },
  { direction: 2, id: 'toggle-plus2', copy: { en: '+2', zh: '+2' }, enabledWhen: 'has-last-solve' },
  { direction: 3, id: 'toggle-dnf', copy: { en: 'DNF', zh: 'DNF' }, enabledWhen: 'has-last-solve' },
  { direction: 4, id: 'prev-scramble', copy: { en: 'Prev', zh: '上一个' }, enabledWhen: 'has-previous-scramble' },
  { direction: 5, id: 'comment-last', copy: { en: 'Note', zh: '注释' }, enabledWhen: 'has-last-solve' },
  { direction: 6, id: 'delete-last', copy: { en: 'Del', zh: '删除' }, enabledWhen: 'has-last-solve' },
  { direction: 7, id: 'copy-scramble', copy: { en: 'Copy', zh: '复制' }, enabledWhen: 'always' },
] as const;

export interface TimerGestureActionContext {
  hasLastSolve: boolean;
  hasPreviousScramble: boolean;
}

export interface TimerGestureActionState extends TimerGestureActionContract {
  enabled: boolean;
}

export function timerGestureActionStates(
  context: TimerGestureActionContext,
): readonly TimerGestureActionState[] {
  return TIMER_GESTURE_ACTION_CONTRACTS.map((contract) => ({
    ...contract,
    enabled: contract.enabledWhen === 'always'
      || (contract.enabledWhen === 'has-last-solve' && context.hasLastSolve)
      || (contract.enabledWhen === 'has-previous-scramble' && context.hasPreviousScramble),
  }));
}

export function timerGestureActionAt(direction: number): TimerGestureActionContract | null {
  if (!Number.isInteger(direction) || direction < 0 || direction >= TIMER_GESTURE_ACTION_CONTRACTS.length) {
    return null;
  }
  return TIMER_GESTURE_ACTION_CONTRACTS[direction] ?? null;
}

/** Utility-level language selection; UI components do not branch on copy. */
export function timerGestureActionLabels(isZh: boolean): string[] {
  return TIMER_GESTURE_ACTION_CONTRACTS.map((contract) => (
    isZh ? contract.copy.zh : contract.copy.en
  ));
}

export interface TimerRadialPointerProfile {
  tapSlopPx: number;
  deadZonePx: number;
  quickFlickGraceMs: number | null;
}

export const TIMER_RADIAL_POINTER_PROFILES: Readonly<Record<'mouse' | 'touch', TimerRadialPointerProfile>> = {
  mouse: { tapSlopPx: 10, deadZonePx: 44, quickFlickGraceMs: null },
  touch: { tapSlopPx: 18, deadZonePx: 90, quickFlickGraceMs: 200 },
};

export function timerRadialPointerProfile(pointerType: string): TimerRadialPointerProfile {
  return pointerType === 'mouse'
    ? TIMER_RADIAL_POINTER_PROFILES.mouse
    : TIMER_RADIAL_POINTER_PROFILES.touch;
}

/** Whether motion has crossed from a planted timing hold into gesture mode. */
export function timerRadialGestureStarts(
  distancePx: number,
  elapsedMs: number,
  profile: TimerRadialPointerProfile,
): boolean {
  if (!Number.isFinite(distancePx) || !Number.isFinite(elapsedMs)) return false;
  if (profile.quickFlickGraceMs === null) return distancePx > profile.tapSlopPx;
  return (distancePx > profile.tapSlopPx && elapsedMs <= profile.quickFlickGraceMs)
    || distancePx >= profile.deadZonePx;
}

/** Eight-way direction index; -1 inside the dead zone or for invalid deltas. */
export function timerRadialGestureDirection(
  dx: number,
  dy: number,
  deadZonePx: number,
): number {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(deadZonePx)) return -1;
  if (Math.hypot(dx, dy) < deadZonePx) return -1;
  const theta = -Math.atan2(dy, dx);
  return ((Math.floor((theta / Math.PI) * 4 + 8.5) % 8) + 8) % 8;
}
