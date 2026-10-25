import { query, sql } from '../db/connection.js';
import { fetchTranslationSnapshot, TRANSLATION_COMPONENTS, WEBLATE } from './wca_translation_source.js';

const DAY = 86_400_000;
type SyncRow = { synced_at: Date | null; attempted_at: Date | null; error: string | null; digest: string | null; components: unknown[] };
export const translationFallback = (q: string) => `${WEBLATE}/browse/wca/-/zh_Hans/?q=${encodeURIComponent(q)}`;

export async function translationStatus() {
  const [row] = await query<SyncRow>('SELECT synced_at, attempted_at, error, digest, components FROM wca_translation_sync WHERE id = 1');
  return { ready: !!row?.synced_at, stale: !row?.synced_at || Date.now() - new Date(row.synced_at).getTime() > 2 * DAY,
    syncedAt: row?.synced_at ?? null, attemptedAt: row?.attempted_at ?? null, lastError: row?.error ?? null, digest: row?.digest ?? null,
    components: row?.components ?? [], scope: 'WCA public Weblate API: locales, regulations, glossary; excludes Payload CMS and other unavailable components.',
    attribution: 'World Cube Association and translation contributors; component licenses are included in metadata.' };
}

export async function searchTranslations(queries: string[], limit: number, component?: string) {
  // One statement/consistent database snapshot for the entire batch, including its provenance.
  return query<{ query: string; matches: unknown[]; snapshot: SyncRow }>(`
    SELECT terms.value AS query, COALESCE(hits.matches, '[]'::jsonb) AS matches,
      (SELECT to_jsonb(s) FROM wca_translation_sync s WHERE id = 1) AS snapshot
    FROM jsonb_array_elements_text(?::jsonb) WITH ORDINALITY terms(value, ord)
    CROSS JOIN LATERAL (
      SELECT jsonb_agg(to_jsonb(matches) ORDER BY matches.rank, length(matches.en), matches.component, matches.key, matches."unitId") AS matches FROM (
        SELECT component, unit_id AS "unitId", key, en, zh, source_forms AS "sourceForms", target_forms AS "targetForms",
          state, approved, checks AS "hasFailingChecks", source_url AS "sourceUrl", source_updated_at AS "sourceUpdatedAt",
          CASE WHEN lower(key) = lower(replace(terms.value, '.', '->')) THEN 0
            WHEN lower(en) = lower(terms.value) OR lower(zh) = lower(terms.value) THEN 1
            WHEN lower(key) = 'page->teams_committees_councils->groups_name->' || lower(terms.value) THEN 2
            WHEN lower(reverse(split_part(reverse(key), '>-', 1))) = lower(terms.value) THEN 3
            WHEN position(lower(terms.value) in lower(key)) > 0 THEN 4 ELSE 5 END AS rank
        FROM wca_translation_units
        WHERE usable AND (?::text IS NULL OR component = ?)
          AND (position(lower(terms.value) in lower(en)) > 0 OR position(lower(terms.value) in lower(zh)) > 0
            OR position(lower(replace(terms.value, '.', '->')) in lower(key)) > 0)
        ORDER BY rank, length(en), component, key, unit_id LIMIT ?
      ) matches
    ) hits ORDER BY terms.ord`, [queries, component ?? null, component ?? null, limit]);
}

/** Fetch completely, then atomically publish. Failures leave the last good corpus intact. */
export async function syncTranslations(force = false, fetcher: typeof fetch = fetch, db = sql) {
  const connection = await db.reserve(); let locked = false;
  try {
    const [lock] = await connection`SELECT pg_try_advisory_lock(733014) AS acquired`;
    if (!lock.acquired) return { status: 'busy' };
    locked = true;
    const [state] = await connection`SELECT synced_at FROM wca_translation_sync WHERE id = 1`;
    if (!force && state?.synced_at && Date.now() - new Date(state.synced_at).getTime() < DAY) return { status: 'fresh' };
    await connection`UPDATE wca_translation_sync SET attempted_at = NOW() WHERE id = 1`;
    const snapshot = await fetchTranslationSnapshot(fetcher);
    await db.begin(async tx => {
      await tx`DELETE FROM wca_translation_units`;
      await tx`INSERT INTO wca_translation_units
        SELECT * FROM jsonb_to_recordset(${tx.json(snapshot.units)}) AS u(
          component text, unit_id bigint, key text, en text, zh text, source_forms jsonb, target_forms jsonb,
          state integer, usable boolean, approved boolean, source_url text, source_updated_at text, checks boolean)`;
      await tx`UPDATE wca_translation_sync SET synced_at = NOW(), error = NULL, digest = ${snapshot.digest}, components = ${tx.json(snapshot.components)} WHERE id = 1`;
    });
    return { status: 'synced', total: snapshot.units.length, digest: snapshot.digest, components: snapshot.components };
  } catch (error) {
    // Do not persist upstream bodies or credentials in public status/error responses.
    if (locked) await connection`UPDATE wca_translation_sync SET error = 'Official sync failed; previous snapshot retained' WHERE id = 1`.catch(() => {});
    throw error;
  } finally {
    try { if (locked) await connection`SELECT pg_advisory_unlock(733014)`; } finally { connection.release(); }
  }
}

export function startTranslationSync() {
  if (process.env.NODE_ENV !== 'production' || process.env.WCA_TRANSLATIONS_SYNC_ENABLED === '0') return;
  const run = () => void syncTranslations().catch(error => console.error('[wca-translations] sync failed', error instanceof Error ? error.message : 'unknown'));
  setTimeout(run, 30_000).unref();
  setInterval(run, 60 * 60_000).unref(); // The DB timestamp limits successful refreshes to once per day.
}

export { TRANSLATION_COMPONENTS };
