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
 * Storage shape is OVERRIDES, not the resolved map: `{...DEFAULT_KEYMAP,
 * ...overrides}`. That way a binding added in a later release reaches users who
 * already customised something, which a stored full map would not. An explicit
 * `null` means "unbound" and survives the merge — this is why the stored value
 * type is nullable while the resolved one is not.
 */

import { keyLabel } from '../../sim/keymap';

export type TimerActionId =
  | 'delete-last'
  | 'toggle-plus2'
  | 'toggle-dnf'
  | 'toggle-dns'
  | 'next-scramble'
  | 'prev-scramble'
  | 'toggle-fullscreen';

export interface TimerActionDef {
  id: TimerActionId;
  zh: string;
  en: string;
}

/** Display order in the settings UI; also the canonical action list. */
export const TIMER_ACTIONS: readonly TimerActionDef[] = [
  { id: 'delete-last', zh: '删除最后一次成绩', en: 'Delete last solve' },
  { id: 'toggle-plus2', zh: '切换 +2', en: 'Toggle +2' },
  { id: 'toggle-dnf', zh: '切换 DNF', en: 'Toggle DNF' },
  { id: 'toggle-dns', zh: '切换 DNS', en: 'Toggle DNS' },
  { id: 'next-scramble', zh: '下一个打乱', en: 'Next scramble' },
  { id: 'prev-scramble', zh: '上一个打乱', en: 'Previous scramble' },
  { id: 'toggle-fullscreen', zh: '全屏', en: 'Fullscreen' },
] as const;

/** Reproduces the bindings that used to be hardcoded in SoloView, verbatim. */
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

/**
 * Bindings the timer refuses to hand out, because the handler above the
 * rebindable tail already owns them and would swallow the rebound action.
 * Rejecting at the point of binding beats silently accepting a key that then
 * does nothing.
 */
export const RESERVED_BINDINGS: ReadonlySet<string> = new Set([
  'Space', 'Shift+Space',   // hold / start / stop
  'Escape', 'Shift+Escape', // reset
  'Enter', 'Shift+Enter',   // BLD memo split
]);

/**
 * Digit1..Digit9 open the Nth-from-last solve. It is a family rather than a
 * single action, so it is not in TIMER_ACTIONS — but Digit2's +2 binding runs
 * first and shadows "open the 2nd-last solve", which is the pre-existing
 * behaviour and is preserved deliberately.
 */
export const DIGIT_OPENS_SOLVE = /^Digit([1-9])$/;

/** The binding string for a keyboard event, or null if it can't be one. */
export function bindingForEvent(e: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (!e.code) return null;
  return e.shiftKey ? `Shift+${e.code}` : e.code;
}

/** Defaults with the user's overrides applied; explicit nulls drop out. */
export function resolveKeymap(overrides: Readonly<Record<string, TimerActionId | null>> | undefined): Record<string, TimerActionId> {
  const out: Record<string, TimerActionId> = { ...DEFAULT_KEYMAP };
  for (const [binding, action] of Object.entries(overrides ?? {})) {
    if (action === null) delete out[binding];
    else out[binding] = action;
  }
  return out;
}

/** Every binding currently pointing at an action, in DEFAULT_KEYMAP order. */
export function bindingsForAction(km: Readonly<Record<string, TimerActionId>>, id: TimerActionId): string[] {
  return Object.keys(km).filter(b => km[b] === id);
}

/** Human-readable binding, e.g. `Shift+KeyD` → `Shift + D`. */
export function formatBinding(binding: string): string {
  if (binding.startsWith('Shift+')) return `Shift + ${keyLabel(binding.slice(6))}`;
  return keyLabel(binding);
}
