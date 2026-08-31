/**
 * CubeRoot Timer's shared csTimer random-state providers for the two heavy
 * non-WCA puzzles that cubing.js cannot serve within the Timer's latency and
 * memory budget.
 *
 * This is deliberately a tiny adapter over the official `cstimer_module`
 * package (GPL-3.0, cs0x7f/cstimer). The same functions run inside Web and
 * Capacitor/Vite workers; neither host owns a second puzzle implementation.
 * Host code is responsible only for scheduling and buffering these synchronous
 * CPU-heavy calls away from the timing/input thread.
 */

import cstimer from 'cstimer_module';

export type CstimerNonWcaTimerEvent = 'kilominx' | 'mpyram';

export const CSTIMER_NONWCA_TIMER_EVENTS = Object.freeze([
  'kilominx',
  'mpyram',
] as const satisfies readonly CstimerNonWcaTimerEvent[]);

/** Exact upstream scrambler identities; also used by csTimer import/export. */
export const CSTIMER_NONWCA_TIMER_KEYS = Object.freeze({
  kilominx: 'klmso',
  mpyram: 'mpyrso',
} as const satisfies Readonly<Record<CstimerNonWcaTimerEvent, string>>);

export function isCstimerNonWcaTimerEvent(
  event: string,
): event is CstimerNonWcaTimerEvent {
  return Object.prototype.hasOwnProperty.call(CSTIMER_NONWCA_TIMER_KEYS, event);
}

/**
 * Generate one real random-state scramble with csTimer's canonical provider.
 *
 * Throws on an unknown identity or empty provider result. Callers must expose
 * that failure/retry state; substituting a 3x3 or another source is forbidden.
 */
export function generateCstimerNonWcaTimerScramble(
  event: CstimerNonWcaTimerEvent,
): string {
  if (!isCstimerNonWcaTimerEvent(event)) {
    throw new Error(`csTimer non-WCA provider cannot generate event: ${String(event)}`);
  }
  const key = CSTIMER_NONWCA_TIMER_KEYS[event];
  const generated = cstimer.getScramble(key, 0);
  const scramble = typeof generated === 'string' ? generated.trim() : '';
  if (!scramble) {
    throw new Error(`csTimer non-WCA provider returned empty: ${event} (${key})`);
  }
  return scramble;
}
