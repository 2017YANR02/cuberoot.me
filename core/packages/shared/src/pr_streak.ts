export interface PersonalRecordStreakInput {
  competitionId: string;
  competitionDate?: string;
  eventId: string;
  single: number;
  average: number;
}

export interface PersonalRecordStreakResult {
  current: string[];
  longest: string[];
}

/**
 * Consecutive competitions containing at least one new or tied PB.
 * A competition is counted once even when several events/rounds improve. Zero,
 * DNF and DNS values are ignored. Equal results continue the streak, matching
 * the original Kinch/CubingApp definition.
 */
export function calculatePersonalRecordStreak(
  input: readonly PersonalRecordStreakInput[],
): PersonalRecordStreakResult {
  const competitions = new Map<string, { date: string; order: number; rows: PersonalRecordStreakInput[] }>();
  input.forEach((row, order) => {
    let competition = competitions.get(row.competitionId);
    if (!competition) {
      competition = { date: row.competitionDate ?? '', order, rows: [] };
      competitions.set(row.competitionId, competition);
    }
    competition.rows.push(row);
  });

  const ordered = [...competitions.entries()].sort((a, b) => {
    const dateOrder = a[1].date.localeCompare(b[1].date);
    return dateOrder || a[1].order - b[1].order;
  });
  const best = new Map<string, { single: number; average: number }>();
  let current: string[] = [];
  let longest: string[] = [];

  for (const [competitionId, competition] of ordered) {
    let attained = false;
    for (const row of competition.rows) {
      const previous = best.get(row.eventId) ?? { single: Number.POSITIVE_INFINITY, average: Number.POSITIVE_INFINITY };
      if (row.single > 0 && row.single <= previous.single) {
        previous.single = row.single;
        attained = true;
      }
      if (row.average > 0 && row.average <= previous.average) {
        previous.average = row.average;
        attained = true;
      }
      best.set(row.eventId, previous);
    }

    if (attained) {
      current = [...current, competitionId];
      if (current.length > longest.length) longest = [...current];
    } else {
      current = [];
    }
  }

  return { current, longest };
}
