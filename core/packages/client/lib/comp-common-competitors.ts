/** The public roster/result fields already returned by /api/comp/:slug. */
export interface CompetitionRosterData {
  slug: string;
  name: string;
  fetchedAt: number;
  partial?: boolean;
  users: Record<string, {
    number: number;
    name: string;
    wcaid: string;
    eventIds?: string[];
  }>;
  resultsByRound: Record<string, {
    n: number;
    b: number;
    a: number;
    v: number[];
  }[]>;
}

export type CompetitorPresence = 'competed' | 'registered' | 'dns' | 'listed';

export interface RosterCompetitor {
  wcaId: string;
  name: string;
  presence: CompetitorPresence;
}

export interface CompetitionRoster {
  people: Map<string, RosterCompetitor>;
  unidentified: number;
  total: number;
}

const presencePriority: Record<CompetitorPresence, number> = {
  listed: 0, registered: 1, dns: 2, competed: 3,
};

export function competitionRoster(data: CompetitionRosterData): CompetitionRoster {
  // An event shard is never evidence that somebody is absent from the competition.
  if (data.partial) throw new Error('A full competition roster is required');
  const results = new Map<number, CompetitorPresence>();
  for (const rows of Object.values(data.resultsByRound)) {
    for (const row of rows) {
      const entered = row.v.filter(value => value !== 0);
      const competed = entered.length > 0
        ? entered.some(value => value > 0 || value === -1)
        : row.b > 0 || row.b === -1 || row.a > 0;
      const presence: CompetitorPresence = competed ? 'competed'
        : entered.includes(-2) || row.b === -2 ? 'dns' : 'listed';
      const previous = results.get(row.n);
      if (!previous || presencePriority[presence] > presencePriority[previous]) {
        results.set(row.n, presence);
      }
    }
  }

  const people = new Map<string, RosterCompetitor>();
  let unidentified = 0;
  for (const user of Object.values(data.users)) {
    const resultPresence = results.get(user.number);
    const registered = !!user.eventIds?.length;
    // WCIF can also contain staff. A user alone does not establish participation.
    if (!registered && !resultPresence) continue;
    const wcaId = user.wcaid.trim().toUpperCase();
    if (!/^\d{4}[A-Z]{4}\d{2}$/.test(wcaId)) {
      unidentified++;
      continue;
    }
    const presence = resultPresence && resultPresence !== 'listed'
      ? resultPresence : registered ? 'registered' : 'listed';
    const previous = people.get(wcaId);
    if (!previous || presencePriority[presence] > presencePriority[previous.presence]) {
      people.set(wcaId, { wcaId, name: user.name, presence });
    }
  }
  return { people, unidentified, total: people.size + unidentified };
}

export function commonCompetitors(left: CompetitionRoster, right: CompetitionRoster) {
  return [...left.people.values()].flatMap(person => {
    const other = right.people.get(person.wcaId);
    return other ? [{ ...person, otherPresence: other.presence }] : [];
  });
}
