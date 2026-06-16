// Keymap as DATA. The UI stage wires actual listeners; this just declares the
// bindings so the toolbar/help and the listener share one source of truth.

import type { ToolId } from './types';

// Single letters pick a tool (when not typing in an input). One clear letter per
// tool, matching the Toolbar tooltips; no collisions. Modifier combos (ctrl+g =
// group, etc.) are resolved by matchCommand first, so bare g still picks polygon.
export const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  r: 'rect',
  u: 'roundRect',
  o: 'ellipse',
  l: 'line',
  g: 'polygon',
  s: 'star',
  p: 'pen',
  n: 'pencil',
  t: 'text',
  i: 'eyedropper',
  h: 'hand',
};

export type CommandId =
  | 'undo'
  | 'redo'
  | 'group'
  | 'ungroup'
  | 'forward'
  | 'backward'
  | 'toFront'
  | 'toBack'
  | 'duplicate'
  | 'copy'
  | 'paste'
  | 'cut'
  | 'selectAll'
  | 'delete'
  | 'nudgeLeft'
  | 'nudgeRight'
  | 'nudgeUp'
  | 'nudgeDown'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomFit'
  | 'zoom100'
  | 'escape';

export interface KeyBinding {
  command: CommandId;
  key: string; // lowercased event.key (or 'arrowleft' etc.)
  mod?: boolean; // ctrl OR meta
  shift?: boolean;
  // when true, the binding multiplies its effect (e.g. nudge x10) if shift held
  bigWithShift?: boolean;
}

export const COMMAND_KEYS: KeyBinding[] = [
  { command: 'undo', key: 'z', mod: true },
  { command: 'redo', key: 'z', mod: true, shift: true },
  { command: 'redo', key: 'y', mod: true },
  { command: 'group', key: 'g', mod: true },
  { command: 'ungroup', key: 'g', mod: true, shift: true },
  { command: 'forward', key: ']', mod: true },
  { command: 'backward', key: '[', mod: true },
  { command: 'toFront', key: ']', mod: true, shift: true },
  { command: 'toBack', key: '[', mod: true, shift: true },
  { command: 'duplicate', key: 'd', mod: true },
  { command: 'copy', key: 'c', mod: true },
  { command: 'paste', key: 'v', mod: true },
  { command: 'cut', key: 'x', mod: true },
  { command: 'selectAll', key: 'a', mod: true },
  { command: 'delete', key: 'delete' },
  { command: 'delete', key: 'backspace' },
  { command: 'nudgeLeft', key: 'arrowleft', bigWithShift: true },
  { command: 'nudgeRight', key: 'arrowright', bigWithShift: true },
  { command: 'nudgeUp', key: 'arrowup', bigWithShift: true },
  { command: 'nudgeDown', key: 'arrowdown', bigWithShift: true },
  { command: 'zoomIn', key: '=' },
  { command: 'zoomIn', key: '+' },
  { command: 'zoomOut', key: '-' },
  { command: 'zoomFit', key: '0' },
  { command: 'zoom100', key: '1' },
  { command: 'escape', key: 'escape' },
];

export const NUDGE_BIG = 10;
export const NUDGE_SMALL = 1;

// Resolve a keyboard event to a CommandId (mod = ctrl/meta). Returns null if no
// command matches; the UI handles tool keys separately via TOOL_KEYS.
export function matchCommand(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): KeyBinding | null {
  const key = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  // Prefer the most specific (shift-qualified) binding first.
  const matches = COMMAND_KEYS.filter((b) => {
    if (b.key !== key) return false;
    if (!!b.mod !== mod) return false;
    if (b.shift !== undefined && b.shift !== e.shiftKey) return false;
    return true;
  });
  if (!matches.length) return null;
  matches.sort((a, b) => Number(b.shift ?? false) - Number(a.shift ?? false));
  return matches[0];
}

export function matchTool(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
}): ToolId | null {
  if (e.ctrlKey || e.metaKey) return null;
  const t = TOOL_KEYS[e.key.toLowerCase()];
  return t ?? null;
}
