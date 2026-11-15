import { isMbldEvent } from './mbf-average';

interface AoxrRound {
  round_type_id: string;
  average: number;
}

/** Same eligibility and rounding as the AoXR standings: finish the final with valid averages in every round. */
export function summarizeAoxr(
  eventId: string,
  rounds: readonly AoxrRound[],
  scheduledRoundIds?: readonly string[],
) {
  // Missing scheduled rounds must not turn a partial live snapshot into a lower
  // tier. B finals are a separate eliminated branch, not a prerequisite for A finals.
  const completedIds = new Set(rounds.map(r => r.round_type_id));
  if (scheduledRoundIds?.some(id => id !== 'b' && !completedIds.has(id))) return null;
  if (isMbldEvent(eventId) || rounds.length < 1 || rounds.length > 4
    || !rounds.some(r => r.round_type_id === 'f' || r.round_type_id === 'c')
    || rounds.some(r => !Number.isFinite(r.average) || r.average <= 0)
    || completedIds.size !== rounds.length) return null;
  const sum = rounds.reduce((total, r) => total + r.average, 0);
  return { x: rounds.length, sum, value: Math.round(sum / rounds.length) };
}
