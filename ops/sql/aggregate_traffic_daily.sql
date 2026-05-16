-- aggregate_traffic_daily.sql
-- Roll yesterday's pageviews into traffic_daily, then prune rows older than 90 days.
-- Run by systemd: ops/systemd/analytics-aggregate.service (daily 04:30 UTC).
--
-- Idempotent: ON CONFLICT DO NOTHING means re-running for the same day is a no-op
-- (we don't recompute — once aggregated, that day is frozen). If you need to recompute,
-- DELETE FROM traffic_daily WHERE day = '...' then re-run.

BEGIN;

INSERT INTO traffic_daily (day, path, country, ref_domain, pv, uv, avg_dwell_ms)
SELECT
  (ts AT TIME ZONE 'UTC')::date           AS day,
  path,
  COALESCE(country, 'XX')                 AS country,
  COALESCE(ref_domain, '')                AS ref_domain,
  COUNT(*)::int                           AS pv,
  COUNT(DISTINCT visitor_id)::int         AS uv,
  ROUND(AVG(dwell_ms))::int               AS avg_dwell_ms
FROM pageviews
WHERE ua_class <> 'bot'
  AND ts >= (CURRENT_DATE - INTERVAL '1 day') AT TIME ZONE 'UTC'
  AND ts <  CURRENT_DATE                       AT TIME ZONE 'UTC'
GROUP BY day, path, country, ref_domain
ON CONFLICT (day, path, country, ref_domain) DO NOTHING;

-- Retention: drop rows older than 90 days. traffic_daily keeps the long-term picture.
DELETE FROM pageviews WHERE ts < NOW() - INTERVAL '90 days';

COMMIT;
