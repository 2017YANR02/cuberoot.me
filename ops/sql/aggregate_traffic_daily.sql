-- aggregate_traffic_daily.sql
-- Roll any unaggregated past day into traffic_daily, then prune pageviews older than 90 days.
-- Run by systemd: ops/systemd/analytics-aggregate.service (daily 04:30 UTC).
--
-- Backfill window: aggregate every day in the last 7 that has rows in
-- pageviews but no rows in traffic_daily. Skipping a day (server down, timer
-- disabled) → next run fills in the gap before pruning hits.
--
-- Idempotent: a day is only re-aggregated if no rows for it exist yet in
-- traffic_daily. To force recompute: DELETE FROM traffic_daily WHERE day = '...'
-- then run the unit manually.

BEGIN;

WITH candidate_days AS (
  SELECT DISTINCT (ts AT TIME ZONE 'UTC')::date AS day
  FROM pageviews
  WHERE ts >= (CURRENT_DATE - INTERVAL '7 days') AT TIME ZONE 'UTC'
    AND ts <  CURRENT_DATE                       AT TIME ZONE 'UTC'
),
unaggregated AS (
  SELECT cd.day
  FROM candidate_days cd
  LEFT JOIN traffic_daily td ON td.day = cd.day
  GROUP BY cd.day
  HAVING COUNT(td.day) = 0
)
INSERT INTO traffic_daily (day, path, country, ref_domain, pv, uv, avg_dwell_ms)
SELECT
  (pv.ts AT TIME ZONE 'UTC')::date        AS day,
  pv.path,
  COALESCE(pv.country, 'XX')              AS country,
  COALESCE(pv.ref_domain, '')             AS ref_domain,
  COUNT(*)::int                           AS pv,
  COUNT(DISTINCT pv.visitor_id)::int      AS uv,
  ROUND(AVG(pv.dwell_ms))::int            AS avg_dwell_ms
FROM pageviews pv
JOIN unaggregated u ON u.day = (pv.ts AT TIME ZONE 'UTC')::date
WHERE pv.ua_class <> 'bot'
GROUP BY day, pv.path, country, ref_domain
ON CONFLICT (day, path, country, ref_domain) DO NOTHING;

-- Retention: drop rows older than 90 days. traffic_daily keeps the long-term picture.
DELETE FROM pageviews WHERE ts < NOW() - INTERVAL '90 days';

COMMIT;
