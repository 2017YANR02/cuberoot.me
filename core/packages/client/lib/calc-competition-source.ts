import { hasEnteredCalcAttempt, wcaAttemptToCalcValue } from '@/lib/calc-link';
import { trimEmptyAttempts } from '@/lib/wca-ao5-brackets';

interface CompetitionUser {
  number?: number;
  wcaid?: string;
}

interface CompetitionResult {
  n?: number;
  v?: number[];
}

export interface CalcCompetitionData {
  users?: Record<string, CompetitionUser>;
  resultsByRound?: Record<string, CompetitionResult[]>;
}

export interface CalcCompetitionLookup {
  eventId: string;
  roundTypeId: string;
  wcaId?: string | null;
  personNumber?: number | null;
}

/** Find one official/live result row and convert it into calculator units. */
export function extractCompetitionCalcAttempts(
  data: CalcCompetitionData,
  lookup: CalcCompetitionLookup,
): number[] | null {
  if (!lookup.eventId || !lookup.roundTypeId) return null;

  let personNumber: number | null = null;
  if (lookup.wcaId) {
    for (const [key, user] of Object.entries(data.users ?? {})) {
      if (user?.wcaid !== lookup.wcaId) continue;
      const candidate = user.number ?? Number(key);
      if (Number.isInteger(candidate) && candidate > 0) personNumber = candidate;
      break;
    }
  }
  if (personNumber == null && Number.isInteger(lookup.personNumber) && lookup.personNumber! > 0) {
    personNumber = lookup.personNumber!;
  }
  if (personNumber == null) return null;

  const result = data.resultsByRound?.[`${lookup.eventId}:${lookup.roundTypeId}`]
    ?.find(row => row.n === personNumber);
  if (!result || !Array.isArray(result.v)) return null;

  const attempts = trimEmptyAttempts(result.v)
    .map(value => wcaAttemptToCalcValue(lookup.eventId, value));
  return hasEnteredCalcAttempt(attempts) ? attempts : null;
}

/**
 * Replace a source row only if it still matches the snapshot taken before fetch.
 * A user edit made while the request was in flight always wins.
 */
export function mergeCompetitionCalcAttempts(
  current: readonly number[],
  requestBaseline: readonly number[],
  incoming: readonly number[],
  solveCount: number,
): number[] | null {
  if (!Number.isInteger(solveCount) || solveCount < 1) return null;
  for (let i = 0; i < solveCount; i++) {
    if ((current[i] ?? 0) !== (requestBaseline[i] ?? 0)) return null;
  }

  const next = new Array<number>(solveCount).fill(0);
  for (let i = 0; i < solveCount && i < incoming.length; i++) {
    const value = incoming[i];
    next[i] = Number.isFinite(value) ? value : 0;
  }
  return next;
}
