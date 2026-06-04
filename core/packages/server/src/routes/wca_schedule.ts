// GET /v1/wca/comp/:id/schedule — cached WCA competition schedule (赛程).
//
// The official public WCIF is ~10MB for a championship (95% is the persons
// roster we discard); the trimmed schedule is a few tens of KB. So the client
// must NEVER download the WCIF directly. This endpoint:
//   1. reads the trimmed ScheduleData from comp_schedule_cache (instant), else
//   2. write-throughs: fetch the WCIF server-side, trim, upsert, return.
// A bulk backfill (scripts/backfill-schedules.ts) pre-populates every comp so
// even the first viewer is instant; this write-through is the safety net for
// comps the backfill has not reached yet (e.g. just-announced).
//
// Freshness: a comp whose end_date < today is frozen → cached forever; upcoming
// / ongoing comps (or unknown end_date) refresh on a 6h TTL. A null `data` row
// is a "no schedule" tombstone, so we don't re-download 10MB on every view.
import { Hono } from 'hono';
import type { Context } from 'hono';
import { query } from '../db/connection.js';
import { trimWcif, type ScheduleData, type RawWcif } from '@cuberoot/shared/comp-schedule';

export const wcaScheduleRoutes = new Hono();

const UPCOMING_TTL_MS = 6 * 60 * 60 * 1000;
const WCIF_URL = (id: string) =>
  `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(id)}/wcif/public`;

interface Fetched { data: ScheduleData | null; endDate: string | null; }

// Dedupe concurrent write-throughs for the same comp so 100 first-viewers don't
// each download + parse a 10MB WCIF on the memory-tight box.
const inflight = new Map<string, Promise<Fetched | null>>();

// end = startDate + (numberOfDays - 1), computed in UTC calendar days.
export function computeEndDate(startDate: string, numberOfDays: number): string | null {
  if (!startDate || !numberOfDays) return null;
  const d = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + Math.max(0, numberOfDays - 1));
  return d.toISOString().slice(0, 10);
}

// Fetch WCIF server-side → trim → upsert. Returns null on network/parse failure
// (so the caller can serve a stale row instead of erroring).
async function fetchTrimStore(compId: string): Promise<Fetched | null> {
  let raw: RawWcif;
  try {
    const res = await fetch(WCIF_URL(compId), {
      headers: { 'User-Agent': 'CubeRoot-Schedule/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    raw = (await res.json()) as RawWcif;
  } catch (err) {
    console.error(`[wca-schedule] WCIF fetch failed for ${compId}:`, (err as Error)?.message ?? err);
    return null;
  }

  const data = trimWcif(raw);
  let endDate = data ? computeEndDate(data.startDate, data.numberOfDays) : null;
  if (!endDate) {
    // no schedule node (tombstone) → take end_date from the weekly WCA dump
    try {
      const er = await query<{ end_date: string | null }>(
        `SELECT end_date FROM wca_competitions WHERE id = ?`, [compId],
      );
      endDate = er[0]?.end_date ?? null;
    } catch { /* table may be empty mid-deploy; leave null → short TTL */ }
  }

  try {
    await query(
      `INSERT INTO comp_schedule_cache (comp_id, data, end_date, fetched_at)
       VALUES (?, ?::jsonb, ?, NOW())
       ON CONFLICT (comp_id) DO UPDATE SET
         data = EXCLUDED.data, end_date = EXCLUDED.end_date, fetched_at = NOW()`,
      [compId, data, endDate],
    );
  } catch (err) {
    console.error(`[wca-schedule] cache write failed for ${compId}:`, (err as Error)?.message ?? err);
  }
  return { data, endDate };
}

function dedupedFetch(compId: string): Promise<Fetched | null> {
  const existing = inflight.get(compId);
  if (existing) return existing;
  const p = fetchTrimStore(compId).finally(() => inflight.delete(compId));
  inflight.set(compId, p);
  return p;
}

function isPast(endDate: string | null, todayStr: string): boolean {
  return !!endDate && endDate < todayStr;
}

function respond(
  c: Context,
  data: ScheduleData | null,
  endDate: string | null,
  todayStr: string,
  cacheStatus: 'HIT' | 'MISS' | 'STALE',
) {
  // Frozen past comps cache hard; upcoming refresh hourly at the edge.
  c.header('Cache-Control', isPast(endDate, todayStr) ? 'public, max-age=86400' : 'public, max-age=3600');
  c.header('X-Cache', cacheStatus);
  return c.json({ schedule: data });
}

wcaScheduleRoutes.get('/wca/comp/:id/schedule', async (c) => {
  const compId = c.req.param('id');
  if (!compId || !/^[A-Za-z0-9_-]+$/.test(compId)) {
    return c.json({ error: 'invalid comp id' }, 400);
  }
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. read existing row (keep even if stale, for fetch-failure fallback)
  let stale: Fetched | null = null;
  try {
    const rows = await query<{ data: ScheduleData | null; end_date: string | null; fetched_at: string | Date }>(
      `SELECT data, end_date, fetched_at FROM comp_schedule_cache WHERE comp_id = ?`,
      [compId],
    );
    if (rows[0]) {
      const fetchedAt = rows[0].fetched_at instanceof Date ? rows[0].fetched_at : new Date(rows[0].fetched_at);
      const fresh = isPast(rows[0].end_date, todayStr) || (Date.now() - fetchedAt.getTime() < UPCOMING_TTL_MS);
      stale = { data: rows[0].data ?? null, endDate: rows[0].end_date };
      if (fresh) return respond(c, stale.data, stale.endDate, todayStr, 'HIT');
    }
  } catch (err) {
    console.error(`[wca-schedule] cache read failed for ${compId}:`, (err as Error)?.message ?? err);
  }

  // 2. stale entry exists → serve immediately, refresh in background
  if (stale) {
    dedupedFetch(compId).catch(() => {});
    return respond(c, stale.data, stale.endDate, todayStr, 'STALE');
  }

  // 3. no entry at all → must wait for first fetch
  const result = await dedupedFetch(compId);
  if (!result) return c.json({ error: 'WCA API unreachable' }, 502);
  return respond(c, result.data, result.endDate, todayStr, 'MISS');
});
