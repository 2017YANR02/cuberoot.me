import { COMP_STEP_STAGES, fetchCompSteps, normScramble, type CompStepsVariant } from '@/lib/comp-steps';
import { fetchWcaScrambles, type WcaScrambleRow } from '@/lib/wca-results-api';

export interface ScrambleStatisticsData {
  steps: Partial<Record<CompStepsVariant, number[]>>;
  optimalScramble?: string;
  failed: boolean;
}

/** Match the actual scramble, including the API's proven optimal equivalent.
 * Competition/round/attempt metadata alone is not evidence of the same state. */
export function findStatisticsScramble(rows: readonly WcaScrambleRow[], scramble: string): WcaScrambleRow | undefined {
  const key = normScramble(scramble);
  if (!key) return undefined;
  return rows.find(row => normScramble(row.scramble) === key
    || (row.optimal_scramble && normScramble(row.optimal_scramble) === key));
}

export async function fetchScrambleStatistics(compId: string, scramble: string, resolveOriginal: boolean): Promise<ScrambleStatisticsData> {
  const variants = Object.keys(COMP_STEP_STAGES) as CompStepsVariant[];
  const [tables, official] = await Promise.all([
    Promise.allSettled(variants.map(variant => fetchCompSteps(compId, variant))),
    resolveOriginal ? fetchWcaScrambles(compId) : Promise.resolve([]),
  ]);
  const match = findStatisticsScramble(official ?? [], scramble);
  const key = normScramble(match?.scramble ?? scramble);
  const steps: ScrambleStatisticsData['steps'] = {};
  tables.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const row = result.value?.get(key);
      if (row) steps[variants[index]] = row;
    }
  });
  return {
    steps,
    optimalScramble: match?.optimal_scramble ?? undefined,
    failed: tables.some(result => result.status === 'rejected') || (resolveOriginal && official === null),
  };
}
