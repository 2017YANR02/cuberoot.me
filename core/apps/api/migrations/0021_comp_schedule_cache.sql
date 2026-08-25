-- comp_schedule_cache: trimmed WCA competition schedule (赛程), one row per comp.
-- Read path GET /v1/wca/comp/:id/schedule reads here; on miss it write-throughs
-- (fetch full WCIF server-side, trim, upsert). A bulk backfill pre-populates all
-- comps so the first viewer is instant too.
--
-- `data` holds the SMALL trimmed ScheduleData (~tens of KB), NEVER the raw ~10MB
-- WCIF (95% of which is the persons roster we discard). NULL data = tombstone:
-- "fetched, this comp has no schedule" — prevents re-downloading 10MB on every view.
--
-- Freshness: a comp whose end_date < today has a frozen schedule → cached forever.
-- Upcoming / ongoing comps (or unknown end_date) refresh on a short TTL.
CREATE TABLE IF NOT EXISTS comp_schedule_cache (
  comp_id    VARCHAR(50) PRIMARY KEY,
  data       JSONB,                              -- NULL = no-schedule tombstone
  end_date   DATE,                               -- comp last day; NULL if unknown
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
