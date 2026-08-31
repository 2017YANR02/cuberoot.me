/**
 * Timer keyboard bindings.
 *
 * The timer's keydown handler is load-bearing: modal suppression, the
 * `[data-no-timer]` ancestor check (with its arrow-key exception), Space
 * hold/release, and "any key stops a running timer" all have to happen in a
 * fixed order, and none of that is rebindable — a user who remapped Space to
 * something else would have no way to start the timer. So only the tail of the
 * handler consults this map: the actions that operate on the last solve or on
 * the scramble, which are all safe to move around.
 *
 * A binding is a `KeyboardEvent.code`, optionally prefixed with `Shift+`
 * (e.g. `KeyD`, `Shift+KeyD`). Ctrl/Meta are deliberately not bindable: the
 * browser and the OS own those, and shadowing Ctrl+D or Cmd+F would be hostile.
 * `code` rather than `key` so a binding survives a layout switch and does not
 * change meaning when Shift is held.
 *
 * Runtime-neutral priority, bindings, and rebind rules live in
 * `@cuberoot/shared/timer`. This file is the Web adapter: it preserves the old
 * import path, adds DOM-target classification, and formats browser key codes
 * with the simulator's existing labels.
 */

import { keyLabel } from '../../sim/keymap';
export { timerKeyboardTargetContext } from '@cuberoot/timer-ui';

export {
  DEFAULT_KEYMAP,
  DIGIT_OPENS_SOLVE,
  RESERVED_BINDINGS,
  TIMER_ACTION_IDS,
  TIMER_ACTIONS,
  bindingForEvent,
  bindingsForAction,
  rebindTimerAction,
  resolveKeymap,
  timerCanSwitchScramble,
  timerKeyDownDecision,
  timerKeyUpDecision,
  timerRebindCaptureDecision,
  unbindTimerAction,
} from '@cuberoot/shared/timer';
export type {
  TimerActionDef,
  TimerActionId,
  TimerKeyboardDecision,
  TimerKeyboardModalState,
  TimerRebindCaptureDecision,
} from '@cuberoot/shared/timer';

/** Human-readable binding, e.g. `Shift+KeyD` → `Shift + D`. */
export function formatBinding(binding: string): string {
  if (binding.startsWith('Shift+')) return `Shift + ${keyLabel(binding.slice(6))}`;
  return keyLabel(binding);
}
