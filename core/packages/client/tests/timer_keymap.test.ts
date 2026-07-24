/**
 * Timer keyboard bindings.
 *
 * The point of interest is the OVERRIDE storage shape. Settings persist only
 * the difference from `DEFAULT_KEYMAP`, so that a binding introduced in a later
 * release still reaches a user who once customised a key — a stored full map
 * would freeze them on the old set forever. That only works if `null` survives
 * the merge as "explicitly unbound", which is what most of these pin.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_KEYMAP,
  DIGIT_OPENS_SOLVE,
  RESERVED_BINDINGS,
  TIMER_ACTIONS,
  bindingForEvent,
  bindingsForAction,
  formatBinding,
  resolveKeymap,
  type TimerActionId,
} from '@/app/[lang]/timer/_lib/keymap';

/** Minimal stand-in for the fields bindingForEvent reads. */
function ev(code: string, mods: Partial<Record<'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}) {
  return {
    code,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...mods,
  };
}

describe('bindingForEvent', () => {
  it('encodes a bare code as itself and Shift as a prefix', () => {
    expect(bindingForEvent(ev('KeyD'))).toBe('KeyD');
    expect(bindingForEvent(ev('KeyD', { shiftKey: true }))).toBe('Shift+KeyD');
  });

  it('refuses Ctrl / Meta / Alt — those belong to the browser and the OS', () => {
    expect(bindingForEvent(ev('KeyD', { ctrlKey: true }))).toBeNull();
    expect(bindingForEvent(ev('KeyD', { metaKey: true }))).toBeNull();
    expect(bindingForEvent(ev('KeyD', { altKey: true }))).toBeNull();
    // Shift together with a forbidden modifier is still forbidden.
    expect(bindingForEvent(ev('KeyD', { shiftKey: true, ctrlKey: true }))).toBeNull();
  });

  it('returns null for an event with no code', () => {
    expect(bindingForEvent(ev(''))).toBeNull();
  });
});

describe('resolveKeymap', () => {
  it('is the defaults when there are no overrides', () => {
    expect(resolveKeymap(undefined)).toEqual({ ...DEFAULT_KEYMAP });
    expect(resolveKeymap({})).toEqual({ ...DEFAULT_KEYMAP });
  });

  it('does not mutate DEFAULT_KEYMAP', () => {
    const before = { ...DEFAULT_KEYMAP };
    const km = resolveKeymap({ KeyQ: 'toggle-dnf' });
    km.KeyZ = 'toggle-dns';
    expect({ ...DEFAULT_KEYMAP }).toEqual(before);
  });

  it('adds a binding without disturbing the defaults', () => {
    const km = resolveKeymap({ KeyQ: 'toggle-dnf' });
    expect(km.KeyQ).toBe('toggle-dnf');
    expect(km.KeyD).toBe('toggle-dnf'); // the default one is still there
  });

  it('treats an explicit null as "unbound" rather than "no override"', () => {
    const km = resolveKeymap({ KeyD: null });
    expect('KeyD' in km).toBe(false);
    expect(km.KeyZ).toBe('delete-last'); // everything else untouched
  });

  it('lets a later release add a default that an existing override never saw', () => {
    // A user who only ever remapped fullscreen still gets every other default,
    // which is the entire reason overrides are stored instead of a full map.
    const stored: Record<string, TimerActionId | null> = { KeyF: null, KeyG: 'toggle-fullscreen' };
    const km = resolveKeymap(stored);
    expect(km.KeyG).toBe('toggle-fullscreen');
    expect('KeyF' in km).toBe(false);
    expect(km.KeyD).toBe('toggle-dnf');
    expect(km['Shift+KeyD']).toBe('toggle-dns');
  });
});

describe('bindingsForAction', () => {
  it('finds every key pointing at an action', () => {
    const km = resolveKeymap({});
    // next-scramble ships with two keys by default.
    expect(bindingsForAction(km, 'next-scramble').sort()).toEqual(['ArrowRight', 'Comma']);
    expect(bindingsForAction(km, 'toggle-dns')).toEqual(['Shift+KeyD']);
  });

  it('returns empty for an unbound action', () => {
    const km = resolveKeymap({ KeyF: null });
    expect(bindingsForAction(km, 'toggle-fullscreen')).toEqual([]);
  });
});

describe('formatBinding', () => {
  it('renders codes the way a keyboard is labelled', () => {
    expect(formatBinding('KeyD')).toBe('D');
    expect(formatBinding('Digit2')).toBe('2');
    expect(formatBinding('Comma')).toBe(',');
    expect(formatBinding('ArrowLeft')).toBe('←');
    expect(formatBinding('Shift+KeyD')).toBe('Shift + D');
  });
});

describe('invariants', () => {
  it('every default binding names a real action', () => {
    const ids = new Set<string>(TIMER_ACTIONS.map(a => a.id));
    for (const action of Object.values(DEFAULT_KEYMAP)) {
      expect(ids.has(action)).toBe(true);
    }
  });

  it('every action has at least one default binding', () => {
    const km = { ...DEFAULT_KEYMAP };
    for (const a of TIMER_ACTIONS) {
      expect(bindingsForAction(km, a.id).length).toBeGreaterThan(0);
    }
  });

  it('no default binding collides with a key the timer reserves', () => {
    // Space / Escape / Enter are handled before the rebindable tail, so a
    // default that used one would simply never fire.
    for (const binding of Object.keys(DEFAULT_KEYMAP)) {
      expect(RESERVED_BINDINGS.has(binding)).toBe(false);
    }
  });

  it('Digit2 shadows "open the 2nd-last solve", as it always has', () => {
    // Not a bug to fix — pinned so a future keymap change has to face it.
    expect(DEFAULT_KEYMAP.Digit2).toBe('toggle-plus2');
    expect(DIGIT_OPENS_SOLVE.test('Digit2')).toBe(true);
  });

  it('DIGIT_OPENS_SOLVE matches 1-9 and not 0', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(DIGIT_OPENS_SOLVE.test(`Digit${n}`)).toBe(true);
    }
    expect(DIGIT_OPENS_SOLVE.test('Digit0')).toBe(false);
    expect(DIGIT_OPENS_SOLVE.test('KeyD')).toBe(false);
  });
});
