/**
 * Shared time formatters (Solo + Battle).
 *
 * Two distinct formatting conventions live in this repo and they are NOT
 * interchangeable — keep both surfaces so each engine re-points without any
 * behavior change:
 *
 *   - formatMs (re-exported from timer's stats engine): canonical Solo
 *     formatter. precision is 2|3 (centi/milli), rounds with Math.round,
 *     null -> "-", Infinity -> "DNF", plain text (no markup).
 *
 *   - formatTimeHtml / formatTimePlain: Battle's running-timer formatters.
 *     precision is a *digit count* (0..3), floors with Math.floor (live
 *     readout never rounds up), zero -> "0.000"/"0". formatTimeHtml wraps the
 *     minutes colon in <span class="colon">…</span> for styled display.
 *
 * Behavior here is a 1:1 port of battle/_components/engine/format_time.ts so
 * battle can switch its imports to this module with zero visual diff.
 */

export { formatMs } from '../_lib/stats';

/**
 * Battle running-timer formatter with HTML colon span.
 * e.g. 65432,3 -> '1<span class="colon">:</span>05.432'; 7890,3 -> '7.890'.
 * precision = number of fractional digits (0..3).
 */
export function formatTimeHtml(ms: number, precision: number): string {
  if (ms <= 0) return precision > 0 ? `0.${'0'.repeat(precision)}` : '0';

  const totalMs = Math.floor(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;

  const millisStr = millis.toString().padStart(3, '0').slice(0, precision);
  const frac = precision > 0 ? `.${millisStr}` : '';

  if (minutes > 0) {
    return `${minutes}<span class="colon">:</span>${seconds.toString().padStart(2, '0')}${frac}`;
  }
  return `${seconds}${frac}`;
}

/**
 * Battle plain-text formatter (stats display). Same numeric logic as
 * formatTimeHtml but no markup, and Infinity -> 'DNF'.
 */
export function formatTimePlain(ms: number, precision: number): string {
  if (ms <= 0) return precision > 0 ? `0.${'0'.repeat(precision)}` : '0';
  if (ms === Infinity) return 'DNF';

  const totalMs = Math.floor(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  const millisStr = millis.toString().padStart(3, '0').slice(0, precision);
  const frac = precision > 0 ? `.${millisStr}` : '';

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}${frac}`;
  }
  return `${seconds}${frac}`;
}
