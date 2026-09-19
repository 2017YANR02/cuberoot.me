/** Public cubing.com REST data, shared by the API snapshot and browser refresh. */
export interface CubingRound {
  competitionId: number;
  eventId: string;
  roundNumber: number;
  status: string;
  round: {
    format: string;
    cutoff?: { attemptResult: number } | null;
    timeLimit?: { centiseconds: number } | null;
    advancementCondition?: { type: string; level: number } | null;
  };
}

export interface CubingCompetitor {
  number: number;
  name: string;
  localName?: string;
  wcaId?: string | null;
  regionIso2?: string;
  gender?: string;
}

export interface CubingResult {
  id: number;
  competitionId: number;
  eventId: string;
  roundNumber: number;
  best: number;
  average: number;
  attempts: number[];
  regionalSingleRecord?: string;
  regionalAverageRecord?: string;
  competitor: CubingCompetitor;
}

export async function fetchCubingJson<T>(slug: string, path = '', signal?: AbortSignal): Promise<T> {
  const response = await fetch(`https://api.cubing.com/competitions/${encodeURIComponent(slug)}${path}`, {
    headers: { accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw Object.assign(new Error(`cubing.com ${path || 'competition'}: HTTP ${response.status}`), { status: response.status });
  return response.json() as Promise<T>;
}

export function cubingUser(person: CubingCompetitor) {
  if (!Number.isSafeInteger(person.number) || person.number <= 0 || !person.name) {
    throw new Error('Invalid cubing.com competitor');
  }
  return {
    number: person.number,
    name: person.localName && person.localName !== person.name ? `${person.name} (${person.localName})` : person.name,
    wcaid: person.wcaId || '', region: person.regionIso2 || '',
    ...(person.gender ? { gender: person.gender === 'female' ? 'f' : person.gender === 'male' ? 'm' : person.gender } : {}),
  };
}

export function cubingRoundMeta(round: CubingRound, roundTypeId = String(round.roundNumber)) {
  if (!Number.isSafeInteger(round.roundNumber) || round.roundNumber < 1 || !round.eventId || !round.round?.format) {
    throw new Error('Invalid cubing.com round');
  }
  return {
    i: roundTypeId, e: round.eventId, f: round.round.format,
    co: (round.round.cutoff?.attemptResult ?? 0) / 100,
    tl: (round.round.timeLimit?.centiseconds ?? 0) / 100,
    n: round.round.advancementCondition?.type === 'ranking' ? round.round.advancementCondition.level : 0,
    s: round.status === 'finished' ? 1 : round.status === 'live' || round.status === 'checking' ? 2 : 0,
    rn: 0, tt: 0, liveId: String(round.roundNumber),
    name: roundTypeId === 'f' ? 'Final' : ['First round', 'Second round', 'Third round'][round.roundNumber - 1] ?? `Round ${round.roundNumber}`,
  };
}

export function normalizeCubingRound(payload: { round: CubingRound; results: CubingResult[] }, roundTypeId?: string) {
  if (!payload?.round || !Array.isArray(payload.results)) throw new Error('Invalid cubing.com results');
  const round = cubingRoundMeta(payload.round, roundTypeId);
  const users: Record<string, ReturnType<typeof cubingUser>> = {};
  const results = payload.results.map(row => {
    if (row.eventId !== round.e || row.roundNumber !== payload.round.roundNumber || row.competitionId !== payload.round.competitionId
      || !Number.isSafeInteger(row.id) || !Number.isSafeInteger(row.best) || !Number.isSafeInteger(row.average)
      || !Array.isArray(row.attempts) || !row.attempts.every(Number.isSafeInteger)) {
      throw new Error('Invalid or mismatched cubing.com result');
    }
    const user = cubingUser(row.competitor);
    users[String(user.number)] = user;
    return { i: row.id, c: row.competitionId, n: user.number, e: row.eventId, r: round.i, f: round.f,
      b: row.best, a: row.average, v: row.attempts, sr: row.regionalSingleRecord || '', ar: row.regionalAverageRecord || '' };
  });
  round.rn = results.filter(row => row.v.some(value => value !== 0)).length;
  round.tt = results.reduce((total, row) => total + row.v.filter(value => value !== 0).length, 0);
  return { round, users, results };
}

export async function fetchCubingLiveRound(slug: string, eventId: string, roundNumber: number, roundTypeId: string, signal?: AbortSignal) {
  if (!Number.isSafeInteger(roundNumber) || roundNumber < 1) throw new Error('Invalid cubing.com round number');
  const payload = await fetchCubingJson<{ round: CubingRound; results: CubingResult[] }>(
    slug, `/live/results/${encodeURIComponent(eventId)}/${roundNumber}`, signal,
  );
  if (payload.round?.eventId !== eventId || payload.round?.roundNumber !== roundNumber) throw new Error('Mismatched cubing.com round');
  return normalizeCubingRound(payload, roundTypeId);
}
