/**
 * /v1/wca/result-watch — 关注选手「往期成绩变更」只读端点。
 * 数据由 monitors/wca_past_results.ts 后台慢周期(默认 6h)diff 写入,这里纯读 PG。
 *
 *   GET /wca/result-watch/status            监控概览(关注选手列表 + 各自变更计数 + 最近检查时间)
 *   GET /wca/result-watch/changes?wcaId=&limit=  变更日志(按检出时间倒序)
 *
 * 变更属可变数据:浏览器层短缓存(<600s,过 server-cache-headers 守卫),nginx 共享层稍长。
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';

export const wcaResultWatchRoutes = new Hono();

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;

interface ChangeField { field: string; old: unknown; new: unknown }

interface PersonRow {
  wca_id: string;
  name: string | null;
  country_iso2: string | null;
  result_count: number | null;
  checked_at: string | null;
  change_count: number | string;
}

wcaResultWatchRoutes.get('/wca/result-watch/status', async (c) => {
  c.header('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=300');
  const persons = await query<PersonRow>(
    `SELECT wp.wca_id,
            COALESCE(s.person_name, wp.match_key) AS name,
            s.country_iso2,
            s.result_count,
            s.checked_at,
            (SELECT COUNT(*) FROM wca_result_changes ch WHERE ch.wca_id = wp.wca_id) AS change_count
       FROM watched_persons wp
       LEFT JOIN wca_person_results_snapshot s ON s.wca_id = wp.wca_id
       ORDER BY change_count DESC, name ASC NULLS LAST`,
  );
  const totals = await query<{ total: string | number; last_checked: string | null }>(
    `SELECT (SELECT COUNT(*) FROM wca_result_changes) AS total,
            (SELECT MAX(checked_at) FROM wca_person_results_snapshot) AS last_checked`,
  );
  return c.json({
    enabled: process.env.RESULT_WATCH_ENABLED === '1',
    totalChanges: Number(totals[0]?.total ?? 0),
    lastCheckedAt: totals[0]?.last_checked ?? null,
    persons: persons.map((p) => ({
      wcaId: p.wca_id,
      name: p.name,
      countryIso2: p.country_iso2,
      resultCount: p.result_count ?? null,
      checkedAt: p.checked_at,
      changeCount: Number(p.change_count ?? 0),
    })),
  });
});

interface ChangeRow {
  id: string | number;
  wca_id: string;
  result_id: string | number | null;
  competition_id: string | null;
  comp_name: string | null;
  comp_start_date: string | null;
  comp_iso2: string | null;
  event_id: string | null;
  round_type_id: string | null;
  change_type: string;
  fields: ChangeField[] | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  detected_at: string;
  person_name: string | null;
  person_iso2: string | null;
}

wcaResultWatchRoutes.get('/wca/result-watch/changes', async (c) => {
  c.header('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=300');
  const wcaIdRaw = (c.req.query('wcaId') ?? '').trim();
  const wcaId = /^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaIdRaw) ? wcaIdRaw : null;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(c.req.query('limit')) || DEFAULT_LIMIT));

  const params: unknown[] = [];
  let whereSql = '';
  if (wcaId) {
    whereSql = 'WHERE ch.wca_id = ?';
    params.push(wcaId);
  }
  params.push(limit);

  const rows = await query<ChangeRow>(
    `SELECT ch.id, ch.wca_id, ch.result_id, ch.competition_id,
            comp.name       AS comp_name,
            comp.start_date AS comp_start_date,
            cc.iso2         AS comp_iso2,
            ch.event_id, ch.round_type_id, ch.change_type,
            ch.fields, ch.before_json, ch.after_json, ch.detected_at,
            COALESCE(s.person_name, wp.match_key) AS person_name,
            s.country_iso2 AS person_iso2
       FROM wca_result_changes ch
       LEFT JOIN wca_person_results_snapshot s ON s.wca_id = ch.wca_id
       LEFT JOIN watched_persons wp ON wp.wca_id = ch.wca_id
       LEFT JOIN wca_competitions comp ON comp.id = ch.competition_id
       LEFT JOIN wca_countries cc ON cc.id = comp.country_id
      ${whereSql}
      ORDER BY ch.detected_at DESC, ch.id DESC
      LIMIT ?`,
    params,
  );

  return c.json({
    changes: rows.map((r) => ({
      id: Number(r.id),
      wcaId: r.wca_id,
      personName: r.person_name,
      personIso2: r.person_iso2,
      resultId: r.result_id != null ? Number(r.result_id) : null,
      competitionId: r.competition_id,
      compName: r.comp_name,
      compStartDate: r.comp_start_date,
      compIso2: r.comp_iso2,
      eventId: r.event_id,
      roundTypeId: r.round_type_id,
      changeType: r.change_type,
      fields: r.fields ?? null,
      before: r.before_json ?? null,
      after: r.after_json ?? null,
      detectedAt: r.detected_at,
    })),
  });
});
