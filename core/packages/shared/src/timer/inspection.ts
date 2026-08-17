/**
 * Inspection overrun → penalty.
 *
 * WCA A4b/A4d: the attempt must start within the inspection limit; up to 2 s
 * over is +2, past that it is a DNF. csTimer applies the same rule with the
 * limit hardcoded to 15 s (`timer/giiker.js:173` — `insTime > 17000 ? -1 :
 * insTime > 15000 ? 2000 : 0`); we read the limit from settings instead, so a
 * user practising with a shorter inspection gets the rule around their own
 * number rather than around 15.
 *
 * A function rather than three lines inline because two callers need the same
 * answer — the space bar and the smart cube — and because the boundaries are
 * exactly where this goes wrong: at 15.000 s there is no penalty, and DNF is
 * decided by the moment the attempt STARTED, not by how long the countdown was
 * left running afterwards.
 */

export type AutoPenalty = 'ok' | '+2' | 'DNF';

/**
 * @param inspectionMs how long inspection ran before the attempt started.
 *                     0 (or absent) when inspection was never entered.
 * @param limitSec     the configured limit in seconds; 0 = inspection off.
 */
export function inspectionPenalty(inspectionMs: number, limitSec: number): AutoPenalty {
  if (limitSec <= 0) return 'ok';
  if (!Number.isFinite(inspectionMs) || inspectionMs <= 0) return 'ok';
  if (inspectionMs > (limitSec + 2) * 1000) return 'DNF';
  if (inspectionMs > limitSec * 1000) return '+2';
  return 'ok';
}

/**
 * Format an active inspection for the timer face.
 *
 * Inspection counts up in whole seconds until the configured limit, then uses
 * the same +2/DNF boundary logic as the recorded solve. Invalid or disabled
 * input is deliberately rendered as zero so no NaN/Infinity reaches the UI.
 */
export function formatInspectionDisplay(inspectionMs: number, limitSec: number): string {
  if (!Number.isFinite(inspectionMs) || inspectionMs <= 0) return '0';
  if (!Number.isFinite(limitSec) || limitSec <= 0) return '0';
  const penalty = inspectionPenalty(inspectionMs, limitSec);
  return penalty === 'ok' ? String(Math.floor(inspectionMs / 1000)) : penalty;
}
