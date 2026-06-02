/**
 * Pre-collect EVERY WCA competition's schedule into comp_schedule_cache so the
 * first viewer of any comp is instant (no on-view 10MB write-through).
 *
 * Enumerates wca_competitions (weekly WCA dump, ~10k+ rows) LEFT JOIN
 * comp_schedule_cache → comps not yet cached, plus cached upcoming/ongoing comps
 * whose schedule may have changed (>12h old; past comps are frozen, never
 * re-fetched). Run daily on cron to keep new + upcoming comps warm. For each:
 * fetch the public WCIF,
 * trim to the SMALL ScheduleData (shared trimWcif), upsert. A comp with no
 * schedule node stores a NULL tombstone so it is not re-downloaded. Failures
 * (network / 429 / 5xx) write nothing → retried on the next run (resumable:
 * re-run picks up where it left off via the IS NULL filter).
 *
 * MUST run where Node can reach worldcubeassociation.org (the prod server / CI
 * runner) — same as scripts/dump-past-comps.ts. PG via src/db/connection.ts env.
 *
 * Env:
 *   LIMIT        only process first N candidates (0 = all, default 0)
 *   CONCURRENCY  parallel WCIF fetches (default 2 — each is up to ~10MB)
 *   DELAY_MS     pace between fetches per worker (default 300, polite to WCA)
 *   FORCE        1 = re-fetch every comp, ignoring existing cache rows
 *   DRY_RUN      1 = just report counts, fetch nothing
 */
import { query, sql } from '../src/db/connection.js';
import { trimWcif, type RawWcif } from '@cuberoot/shared/comp-schedule';

const LIMIT = Number(process.env.LIMIT) || 0;
const CONCURRENCY = Number(process.env.CONCURRENCY) || 2;
const DELAY_MS = Number(process.env.DELAY_MS) || 300;
const FORCE = process.env.FORCE === '1';
const DRY_RUN = process.env.DRY_RUN === '1';

const UA = 'CubeRoot-Schedule/1.0';
const WCIF_URL = (id: string) =>
  `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(id)}/wcif/public`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Candidate { id: string; end_date: string | null; }

async function getCandidates(): Promise<Candidate[]> {
  // Default: comps with no cache row yet, PLUS cached upcoming/ongoing comps
  // whose schedule may have changed (refresh > 12h old). Past comps are frozen
  // and never re-fetched. FORCE = every comp.
  const where = FORCE
    ? 'TRUE'
    : `(cs.comp_id IS NULL
        OR (cs.end_date >= CURRENT_DATE AND cs.fetched_at < NOW() - INTERVAL '12 hours'))`;
  const lim = LIMIT > 0 ? `LIMIT ${LIMIT}` : '';
  return query<Candidate>(
    `SELECT wc.id, wc.end_date
       FROM wca_competitions wc
       LEFT JOIN comp_schedule_cache cs ON cs.comp_id = wc.id
      WHERE ${where}
      ORDER BY wc.end_date DESC NULLS LAST
      ${lim}`,
  );
}

async function upsert(id: string, data: unknown, endDate: string | null): Promise<void> {
  await query(
    `INSERT INTO comp_schedule_cache (comp_id, data, end_date, fetched_at)
     VALUES (?, ?::jsonb, ?, NOW())
     ON CONFLICT (comp_id) DO UPDATE SET
       data = EXCLUDED.data, end_date = EXCLUDED.end_date, fetched_at = NOW()`,
    [id, data, endDate],
  );
}

// 'ok' = schedule stored, 'empty' = tombstone (no schedule), 'skip' = transient
// failure (no row written, retried next run).
async function processOne(c: Candidate): Promise<'ok' | 'empty' | 'skip'> {
  let res: Response;
  try {
    res = await fetch(WCIF_URL(c.id), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  } catch {
    return 'skip'; // network / timeout → retry next run
  }
  if (res.status === 404) {
    // A past comp that 404s will never publish a WCIF → tombstone (don't retry).
    // An upcoming/unknown comp may publish later → skip and retry next run, so a
    // transient or not-yet-published 404 is never permanently tombstoned.
    const todayStr = new Date().toISOString().slice(0, 10);
    if (c.end_date && c.end_date < todayStr) {
      await upsert(c.id, null, c.end_date);
      return 'empty';
    }
    return 'skip';
  }
  if (!res.ok) return 'skip'; // 429 / 5xx → retry next run
  let raw: RawWcif;
  try {
    raw = (await res.json()) as RawWcif;
  } catch {
    return 'skip';
  }
  const data = trimWcif(raw);
  await upsert(c.id, data, c.end_date);
  return data ? 'ok' : 'empty';
}

async function main(): Promise<void> {
  const total = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM wca_competitions`);
  const cached = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM comp_schedule_cache`);
  const candidates = await getCandidates();
  console.log(
    `[backfill] wca_competitions=${total[0]?.c} already_cached=${cached[0]?.c} ` +
    `to_process=${candidates.length} (FORCE=${FORCE} LIMIT=${LIMIT || '∞'} CONCURRENCY=${CONCURRENCY} DELAY_MS=${DELAY_MS})`,
  );
  if (DRY_RUN) {
    console.log('[backfill] DRY_RUN — nothing fetched');
    await sql.end({ timeout: 5 });
    return;
  }

  let idx = 0, ok = 0, empty = 0, skip = 0, done = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = idx++;
      if (i >= candidates.length) return;
      const r = await processOne(candidates[i]);
      if (r === 'ok') ok++; else if (r === 'empty') empty++; else skip++;
      done++;
      if (done % 100 === 0 || done === candidates.length) {
        console.log(`[backfill] ${done}/${candidates.length} (ok=${ok} empty=${empty} skip=${skip})`);
      }
      if (DELAY_MS) await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  console.log(`[backfill] DONE ok=${ok} empty=${empty} skip=${skip} total=${done}`);
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exitCode = 1;
});
