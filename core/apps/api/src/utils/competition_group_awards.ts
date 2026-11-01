import { z } from 'zod';
import { cubingUser, fetchCubingJson, type CompetitionGroupAward } from '@cuberoot/shared/cubing-live';
import { query } from '../db/connection.js';

const category = z.object({ type: z.enum(['age', 'female', 'newcomer']), age: z.number().int().positive().optional(), under: z.boolean().optional() });
const competitor = z.object({ id: z.number().int().positive(), number: z.number().int().positive(), name: z.string().min(1), localName: z.string().optional(), wcaId: z.union([z.string().regex(/^\d{4}[A-Z]{4}\d{2}$/), z.literal('')]).nullish(), regionIso2: z.string().optional() });
const result = z.object({ competitionId: z.number().int(), eventId: z.string(), roundNumber: z.number().int(), position: z.number().int().positive(), competitor, best: z.number().int(), average: z.number().int(), attempts: z.array(z.number().int()).max(5) });
const podiumSchema = z.object({ data: z.array(z.object({ eventId: z.string().min(1), roundNumber: z.number().int().positive(), group: category.optional(), groupIndex: z.number().int().nonnegative().optional(), results: z.array(result) })) });
const competitionSchema = z.object({ id: z.number().int().positive(), alias: z.string().min(1), wcaCompetitionId: z.string().nullish(), name: z.string(), nameZh: z.string(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().nullable(), podiums: z.array(z.object({ number: z.number().int().positive(), events: z.array(z.string()), categories: z.array(category) })) });
const roundsSchema = z.array(z.object({ competitionId: z.number().int(), eventId: z.string(), roundNumber: z.number().int(), status: z.string(), round: z.object({ format: z.string() }) }));
export function parseCompetitionGroupAwards(rawCompetition: unknown, rawPodiums: unknown, rawRounds: unknown, fetchedAt: string): CompetitionGroupAward[] {
  const comp = competitionSchema.parse(rawCompetition);
  const podiums = podiumSchema.parse(rawPodiums).data;
  const rounds = roundsSchema.parse(rawRounds);
  const rows: CompetitionGroupAward[] = [];
  const seen = new Set<string>();
  for (const podium of podiums) {
    if (!podium.group) continue;
    const group = podium.group;
    if (group.type === 'age' && (group.age === undefined || group.under === undefined)) throw new Error('Incomplete age category');
    const rules = comp.podiums[podium.groupIndex ?? -1];
    if (!rules?.events.includes(podium.eventId) || !rules.categories.some(c => c.type === group.type && c.age === group.age && c.under === group.under)) throw new Error('Unknown category rules');
    const round = rounds.find(r => r.competitionId === comp.id && r.eventId === podium.eventId && r.roundNumber === podium.roundNumber);
    if (!round) throw new Error('Missing award round');
    const groupKey = [podium.groupIndex, group.type, group.age ?? '', group.under === undefined ? '' : Number(group.under)].join(':');
    for (const r of podium.results) {
      if (r.competitionId !== comp.id || r.eventId !== podium.eventId || r.roundNumber !== podium.roundNumber) throw new Error('Mismatched award result');
      const key = [podium.eventId, groupKey, r.competitor.id].join(':');
      if (seen.has(key)) throw new Error('Duplicate category award');
      seen.add(key);
      rows.push({ competitionId: comp.wcaCompetitionId || comp.alias, competitionName: comp.name, competitionNameZh: comp.nameZh,
        date: comp.startDate, endDate: comp.endDate, cubingSlug: comp.alias, eventId: podium.eventId,
        roundNumber: podium.roundNumber, roundFormat: round.round.format, groupKey, group, groupRules: rules,
        place: r.position, competitorNumber: r.competitor.number, sourcePersonId: r.competitor.id,
        wcaId: r.competitor.wcaId || null, name: cubingUser(r.competitor).name, best: r.best, average: r.average,
        attempts: r.attempts, provisional: round.status !== 'finished',
        sourceUrl: 'https://cubing.com/competition/' + encodeURIComponent(comp.alias) + '/live/podiums', fetchedAt });
    }
  }
  return rows;
}
interface Snapshot { competition_id: string; cubing_slug: string; rows: CompetitionGroupAward[]; fetched_at: Date }
export async function readGroupAwards(id: string) {
  return (await query<Snapshot>('SELECT * FROM competition_group_awards WHERE competition_id = ? OR cubing_slug = ?', [id, id]))[0];
}
const pending = new Map<string, Promise<CompetitionGroupAward[]>>();
export function refreshGroupAwards(slug: string, expectedId?: string): Promise<CompetitionGroupAward[]> {
  const running = pending.get(slug);
  if (running) return running;
  const promise = (async () => {
    const [raw, podiums, rounds] = await Promise.all([fetchCubingJson(slug), fetchCubingJson(slug, '/live/podiums'), fetchCubingJson(slug, '/live/rounds')]);
    const comp = competitionSchema.parse(raw);
    if (expectedId && expectedId !== comp.alias && expectedId !== comp.wcaCompetitionId) throw new Error('Mismatched award competition');
    const fetchedAt = new Date().toISOString();
    const rows = parseCompetitionGroupAwards(raw, podiums, rounds, fetchedAt);
    // One atomic snapshot replaces all rows, including corrections and withdrawn awards.
    await query(
      'INSERT INTO competition_group_awards (competition_id, cubing_slug, rows, person_ids, fetched_at) VALUES (?, ?, ?::jsonb, ?::text[], ?) ON CONFLICT (competition_id) DO UPDATE SET cubing_slug = EXCLUDED.cubing_slug, rows = EXCLUDED.rows, person_ids = EXCLUDED.person_ids, fetched_at = EXCLUDED.fetched_at',
      [comp.wcaCompetitionId || comp.alias, comp.alias, rows, [...new Set(rows.flatMap(r => r.wcaId ? [r.wcaId] : []))], fetchedAt]);
    return rows;
  })().finally(() => pending.delete(slug));
  pending.set(slug, promise);
  return promise;
}
