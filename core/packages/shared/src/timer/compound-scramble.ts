import type { EventId } from './types';

/** Timer events whose scramble is composed from existing child providers. */
export type TimerCompoundScrambleEventId = Extract<
  EventId,
  '333mbld' | '666bld' | '777bld' | 'r3' | 'r4' | 'r5' | 'magic' | 'mmagic'
>;

/** Atomic Timer events used by the compound recipes below. */
export type TimerCompoundChildEventId = Extract<
  EventId,
  '222' | '333' | '444' | '555' | '666' | '777'
>;

export type TimerRelayScrambleEventId = Extract<EventId, 'r3' | 'r4' | 'r5'>;
export type TimerRelayChildEventId = Extract<
  TimerCompoundChildEventId,
  '222' | '333' | '444' | '555'
>;

/**
 * Canonical child-provider recipes shared by the Web dispatcher and Mobile.
 *
 * These entries only compose existing 2x2/NxN providers; they are not new
 * puzzle solvers. Keeping the child identities here prevents either host from
 * silently substituting 3x3 when a compound event is requested.
 */
export const TIMER_COMPOUND_SCRAMBLE_CHILDREN = Object.freeze({
  '333mbld': ['333', '333', '333'],
  '666bld': ['666'],
  '777bld': ['777'],
  r3: ['222', '333'],
  r4: ['222', '333', '444'],
  r5: ['222', '333', '444', '555'],
  magic: [],
  mmagic: [],
} as const satisfies Readonly<
  Record<TimerCompoundScrambleEventId, readonly TimerCompoundChildEventId[]>
>);

const RELAY_CHILD_LABELS: Readonly<Record<TimerRelayChildEventId, string>> = {
  '222': '2x2',
  '333': '3x3',
  '444': '4x4',
  '555': '5x5',
};

function normalizedChildren(childScrambles: readonly string[]): string[] {
  return childScrambles.map((scramble) => {
    const normalized = scramble.trim();
    if (!normalized) throw new Error('compound scramble child was empty');
    return normalized;
  });
}

/** Canonical MBLD line format. The caller remains responsible for child generation. */
export function formatMultiBlindScrambles(childScrambles: readonly string[]): string {
  const children = normalizedChildren(childScrambles);
  const total = children.length;
  return children
    .map((scramble, index) => `Solve ${index + 1} of ${total}: ${scramble}`)
    .join('\n');
}

/** Canonical 6BLD/7BLD suffix format used by both timer hosts. */
export function formatBigBlindScramble(
  event: Extract<TimerCompoundScrambleEventId, '666bld' | '777bld'>,
  childScramble: string,
): string {
  const [child] = normalizedChildren([childScramble]);
  return event === '666bld'
    ? `${child} 3Rw Uw`
    : `${child} 3Rw 3Uw`;
}

/** Canonical relay labels and line order. */
export function formatRelayScramble(
  event: TimerRelayScrambleEventId,
  childScrambles: readonly string[],
): string {
  const expected = TIMER_COMPOUND_SCRAMBLE_CHILDREN[event];
  if (childScrambles.length !== expected.length) {
    throw new Error(`compound scramble child count mismatch for ${event}`);
  }
  const children = normalizedChildren(childScrambles);
  return expected
    .map((childEvent, index) => `${RELAY_CHILD_LABELS[childEvent]}: ${children[index]}`)
    .join('\n');
}

function magicDirection(random: () => number): 'Forward' | 'Backward' {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error('compound scramble random source must return a value in [0, 1)');
  }
  return sample < 0.5 ? 'Forward' : 'Backward';
}

/**
 * Format one canonical compound Timer event from already generated children.
 * Child count and emptiness are validated so failure stays explicit.
 */
export function formatTimerCompoundScramble(
  event: TimerCompoundScrambleEventId,
  childScrambles: readonly string[],
  random: () => number = Math.random,
): string {
  const expected = TIMER_COMPOUND_SCRAMBLE_CHILDREN[event];
  if (childScrambles.length !== expected.length) {
    throw new Error(`compound scramble child count mismatch for ${event}`);
  }

  switch (event) {
    case '333mbld':
      return formatMultiBlindScrambles(childScrambles);
    case '666bld':
    case '777bld':
      return formatBigBlindScramble(event, childScrambles[0]);
    case 'r3':
    case 'r4':
    case 'r5':
      return formatRelayScramble(event, childScrambles);
    case 'magic':
      return magicDirection(random);
    case 'mmagic':
      return `M ${magicDirection(random)}`;
  }
}
