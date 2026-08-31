/**
 * Bounded history for scrambles shown by a timer or trainer.
 *
 * Hosts own scramble generation. Moving forward at the newest entry returns
 * `null`, which is the signal to generate and push a fresh entry. Keeping that
 * policy here makes Web, Android and future iOS navigation behave identically.
 */
export interface ScrambleHistory<T> {
  list: T[];
  idx: number;
}

/** Backwards-compatible name used by the existing Web trainer. */
export type ScrambleHist<T> = ScrambleHistory<T>;

export const SCRAMBLE_HISTORY_CAP = 50;

/** Append at the tip, discard the oldest overflow and select the new entry. */
export function histPush<T>(
  current: ScrambleHistory<T>,
  entry: T,
  cap = SCRAMBLE_HISTORY_CAP,
): ScrambleHistory<T> {
  let list = [...current.list, entry];
  if (list.length > cap) list = list.slice(1);
  return { list, idx: list.length - 1 };
}

/** Select the previous entry, or return `null` at the oldest entry. */
export function histBack<T>(current: ScrambleHistory<T>): ScrambleHistory<T> | null {
  if (current.idx <= 0) return null;
  return { list: current.list, idx: current.idx - 1 };
}

/** Select the next retained entry, or return `null` at the newest entry. */
export function histForward<T>(current: ScrambleHistory<T>): ScrambleHistory<T> | null {
  if (current.idx >= current.list.length - 1) return null;
  return { list: current.list, idx: current.idx + 1 };
}
