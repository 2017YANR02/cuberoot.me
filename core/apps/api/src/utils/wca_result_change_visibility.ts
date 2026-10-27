/** Shared public-history predicate. Keep the original audit rows in storage.
 * Only suppress automatic removals when the latest official snapshot contains
 * an identical fingerprint under a different ID and no longer contains the old ID.
 * Alias `ch` is the result-change row; apply BEFORE LIMIT and to public counts.
 */
export const visibleResultChangeSql = `ch.status <> 'rejected' AND NOT (
  COALESCE(ch.source, '') = 'auto' AND ch.change_type = 'removed'
  AND EXISTS (
    SELECT 1 FROM wca_person_results_snapshot replacement_snapshot
    CROSS JOIN LATERAL jsonb_each(replacement_snapshot.results_json) replacement
    WHERE replacement_snapshot.wca_id = ch.wca_id
      AND NOT jsonb_exists(replacement_snapshot.results_json, ch.result_id::text)
      AND replacement.key <> ch.result_id::text
      AND replacement.value = ch.before_json
  )
)`;
