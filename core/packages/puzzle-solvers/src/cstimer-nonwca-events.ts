/** Pure event metadata, safe to import on the browser main thread.
 * Keep the csTimer engine in cstimer-nonwca: importing it installs a worker
 * message handler, which would create a postMessage loop on window. */
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
