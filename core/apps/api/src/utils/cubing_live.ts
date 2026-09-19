import { cubingRoundMeta, cubingUser, fetchCubingJson, fetchCubingLiveRound, type CubingCompetitor, type CubingRound } from '@cuberoot/shared/cubing-live';

interface Competition {
  id: number; name: string; type: string;
  events: { eventId: string; roundCount: number; dualRounds?: boolean }[];
}

export async function fetchCubingMeta(slug: string) {
  const [competition, rounds] = await Promise.all([
    fetchCubingJson<Competition>(slug),
    fetchCubingJson<CubingRound[]>(slug, '/live/rounds').catch(error => {
      // Upcoming competitions expose their roster before live results are enabled.
      if (error?.status === 404) return [];
      throw error;
    }),
  ]);
  if (!Number.isSafeInteger(competition.id) || competition.id <= 0 || !competition.name
    || !Array.isArray(competition.events) || !Array.isArray(rounds)) throw new Error('Invalid cubing.com competition');
  const events = competition.events.map(event => ({
    i: event.eventId, name: event.eventId, dual: event.dualRounds === true,
    rs: rounds.filter(round => round.eventId === event.eventId)
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map(round => {
        if (round.competitionId !== competition.id) throw new Error('Mismatched cubing.com competition');
        return cubingRoundMeta(round, round.roundNumber === event.roundCount ? 'f' : String(round.roundNumber));
      }),
  }));
  return { compId: competition.id, name: competition.name, type: competition.type, events, slug };
}

export async function collectCubingResults(slug: string, events: { rs: { i: string; e: string; liveId?: string }[] }[],
  onProgress?: (progress: { step: 'cubing.results'; done: number; total: number }) => void) {
  const users: Record<string, ReturnType<typeof cubingUser> & { eventIds?: string[] }> = {};
  const resultsByRound: Record<string, Awaited<ReturnType<typeof fetchCubingLiveRound>>['results']> = {};
  const membersByFilter = { females: [] as number[], children: [] as number[], newcomers: [] as number[] };
  const rounds = events.flatMap(event => event.rs);
  // Results can be entered before a round status changes; fetch even pending rounds.
  let done = 0;
  for (let offset = 0; offset < rounds.length; offset += 3) {
    await Promise.all(rounds.slice(offset, offset + 3).map(async round => {
      const snapshot = await fetchCubingLiveRound(slug, round.e, Number(round.liveId), round.i);
      Object.assign(users, snapshot.users);
      Object.assign(round, snapshot.round);
      resultsByRound[`${round.e}:${round.i}`] = snapshot.results;
      try { onProgress?.({ step: 'cubing.results', done: ++done, total: rounds.length }); } catch { /* UI progress is optional. */ }
    }));
  }
  // The public roster supplies gender and registrations, including entrants without results.
  // It does not expose age: never infer children's membership from a podium's top three.
  try {
    const roster = await fetchCubingJson<{ number: number; user: Omit<CubingCompetitor, 'number'>; registrationEvents: { eventId: string }[] }[]>(slug, '/competitors');
    if (!Array.isArray(roster)) throw new Error('Invalid cubing.com roster');
    for (const entry of roster) {
      const user = cubingUser({ ...entry.user, number: entry.number });
      users[String(user.number)] = { ...user, eventIds: entry.registrationEvents.map(event => event.eventId) };
    }
  } catch (error) {
    if (!Object.keys(users).length) throw error;
    console.warn('[cubing-live] public roster unavailable:', (error as Error).message);
  }
  for (const user of Object.values(users)) {
    if (user.gender === 'f') membersByFilter.females.push(user.number);
    if (!user.wcaid) membersByFilter.newcomers.push(user.number);
  }
  return { users, resultsByRound, membersByFilter };
}
