import { query } from '../db/connection.js';

interface FemaleRecordRow { e: string; t: 's' | 'a'; v: number; d: string }
interface GenderUser { wcaid?: string; gender?: string }
const TTL = 60 * 60_000;
let history: FemaleRecordRow[] = [];
let expiresAt = 0;
let inflight: Promise<FemaleRecordRow[]> | null = null;
const genders = new Map<string, { value: string; until: number }>();

/** Reuse the published gender history; no results-table aggregation on requests. */
async function getHistory(): Promise<FemaleRecordRow[]> {
  if (Date.now() < expiresAt) return history;
  if (!inflight) inflight = (async () => {
    try {
      const res = await fetch('https://static.cuberoot.me/stats/records/history/gender/f/world.json', {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`female records HTTP ${res.status}`);
      const data = await res.json() as { rows: FemaleRecordRow[] };
      if (!Array.isArray(data.rows)) throw new Error('invalid female record history');
      history = data.rows;
      expiresAt = Date.now() + TTL;
    } catch (e) {
      expiresAt = Date.now() + 60_000;
      console.warn('[female-records]', (e as Error).message);
    }
    return history;
  })().finally(() => { inflight = null; });
  return inflight;
}

export function femaleRecordBaseline(rows: FemaleRecordRow[], date: string): Record<string, number> {
  const best: Record<string, number> = {};
  for (const row of rows) {
    // The published history can already contain this competition. Only older
    // dates form its pre-competition baseline; same-day results are adjudicated
    // separately through the live day pool.
    if (row.d >= date || !Number.isFinite(row.v) || row.v <= 0) continue;
    const key = `${row.e}|${row.t === 'a' ? 1 : 0}`;
    best[key] = Math.min(best[key] ?? Infinity, row.v);
  }
  return best;
}

/** Resolve gender from explicit registration data or the indexed person directory. */
export async function prepareFemaleRecords(
  users: Record<string, GenderUser>, females: number[], date: string | null,
): Promise<Record<string, number>> {
  if (!date) return {};
  for (const num of females) if (users[String(num)]) users[String(num)].gender = 'f';
  const ids = [...new Set(Object.values(users).flatMap(u =>
    !u.gender && u.wcaid && (!genders.has(u.wcaid) || genders.get(u.wcaid)!.until <= Date.now()) ? [u.wcaid] : [],
  ))];
  try {
    if (ids.length) {
      const rows = await query<{ wca_id: string; gender: string }>(
        `SELECT wca_id, gender FROM wca_persons WHERE wca_id IN (${ids.map(() => '?').join(',')})`, ids,
      );
      const found = new Map(rows.map(r => [r.wca_id, r.gender]));
      for (const id of ids) genders.set(id, { value: found.get(id) ?? '', until: Date.now() + 24 * TTL });
      for (const [id, entry] of genders) if (entry.until <= Date.now()) genders.delete(id);
    }
    for (const u of Object.values(users)) if (!u.gender && u.wcaid) u.gender = genders.get(u.wcaid)?.value;
  } catch (e) {
    console.warn('[female-records] gender lookup:', (e as Error).message);
  }
  return femaleRecordBaseline(await getHistory(), date);
}
