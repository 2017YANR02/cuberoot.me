/**
 * /v1/wca/result-watch — 选手「成绩变更」端点。
 * 自动数据由 monitors/wca_past_results.ts 后台 diff 写入(source='auto');
 * 管理员可经下面的写端点手动录入/编辑变更链(source='manual')。
 *
 *   GET    /wca/result-watch/status                 监控概览
 *   GET    /wca/result-watch/changes?wcaId=&compId=&limit=  变更日志(可按选手或比赛过滤)
 *   POST   /wca/result-watch/changes                管理员新增一条变更(手动)
 *   PUT    /wca/result-watch/changes/:id            管理员编辑
 *   DELETE /wca/result-watch/changes/:id            管理员删除
 *
 * 读端点属可变数据:浏览器短缓存;写端点 no-store + requireAdminOrApiKey。
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAdminOrApiKey, checkRateLimit } from '../utils/recon_helpers.js';

export const wcaResultWatchRoutes = new Hono();

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;
const WCA_ID_RE = /^[0-9]{4}[A-Z]{4}[0-9]{2}$/;
const COMP_ID_RE = /^[A-Za-z0-9]{2,40}$/;
const NOTE_MAX = 1000;
const ALLOWED_FIELDS = new Set([
  'best', 'average', 'pos', 'attempts',
  'regional_single_record', 'regional_average_record',
]);

interface ChangeField { field: string; old: unknown; new: unknown }

function getIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

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
  note: string | null;
  effective_at: string | null;
  source: string | null;
  created_by: string | null;
  edited_at: string | null;
  person_name: string | null;
  person_iso2: string | null;
}

wcaResultWatchRoutes.get('/wca/result-watch/changes', async (c) => {
  c.header('Cache-Control', 'public, max-age=120, s-maxage=300, stale-while-revalidate=300');
  const wcaIdRaw = (c.req.query('wcaId') ?? '').trim();
  const wcaId = WCA_ID_RE.test(wcaIdRaw) ? wcaIdRaw : null;
  const compIdRaw = (c.req.query('compId') ?? '').trim();
  const compId = COMP_ID_RE.test(compIdRaw) ? compIdRaw : null;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(c.req.query('limit')) || DEFAULT_LIMIT));

  const params: unknown[] = [];
  const conds: string[] = [];
  if (wcaId) { conds.push('ch.wca_id = ?'); params.push(wcaId); }
  if (compId) { conds.push('ch.competition_id = ?'); params.push(compId); }
  const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  params.push(limit);

  const rows = await query<ChangeRow>(
    `SELECT ch.id, ch.wca_id, ch.result_id, ch.competition_id,
            comp.name       AS comp_name,
            comp.start_date AS comp_start_date,
            cc.iso2         AS comp_iso2,
            ch.event_id, ch.round_type_id, ch.change_type,
            ch.fields, ch.before_json, ch.after_json, ch.detected_at,
            ch.note, ch.effective_at, ch.source, ch.created_by, ch.edited_at,
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
      note: r.note ?? null,
      effectiveAt: r.effective_at ?? null,
      source: r.source ?? 'auto',
      createdBy: r.created_by ?? null,
      editedAt: r.edited_at ?? null,
    })),
  });
});

// ── 管理员写端点(手动录入/编辑变更链) ─────────────────────────────────────────

interface ChangeInput {
  wcaId?: string;
  resultId?: number | null;
  competitionId?: string;
  eventId?: string;
  roundTypeId?: string;
  changeType?: string;
  fields?: unknown;
  note?: string | null;
  effectiveAt?: string | null;
}

interface NormalizedChange {
  wca_id: string;
  result_id: number | null;
  competition_id: string;
  event_id: string;
  round_type_id: string;
  change_type: string;
  fields: ChangeField[] | null;
  note: string | null;
  effective_at: string | null;
}

function validateChange(b: ChangeInput): { error: string } | { value: NormalizedChange } {
  const wca_id = String(b.wcaId ?? '').trim().toUpperCase();
  if (!WCA_ID_RE.test(wca_id)) return { error: 'invalid wcaId' };

  const competition_id = String(b.competitionId ?? '').trim();
  if (!COMP_ID_RE.test(competition_id)) return { error: 'invalid competitionId' };

  const event_id = String(b.eventId ?? '').trim();
  if (!event_id || event_id.length > 8) return { error: 'invalid eventId' };

  const round_type_id = String(b.roundTypeId ?? '').trim();
  if (!round_type_id || round_type_id.length > 4) return { error: 'invalid roundTypeId' };

  const change_type = b.changeType === 'removed' ? 'removed' : 'modified';

  let fields: ChangeField[] | null = null;
  if (change_type === 'modified') {
    if (!Array.isArray(b.fields) || b.fields.length === 0) {
      return { error: 'fields must be a non-empty array for modified' };
    }
    const out: ChangeField[] = [];
    for (const it of b.fields as unknown[]) {
      if (!it || typeof it !== 'object') return { error: 'invalid field entry' };
      const f = it as { field?: unknown; old?: unknown; new?: unknown };
      const name = String(f.field ?? '');
      if (!ALLOWED_FIELDS.has(name)) return { error: `unsupported field: ${name}` };
      out.push({ field: name, old: f.old ?? null, new: f.new ?? null });
    }
    fields = out;
  }

  let result_id: number | null = null;
  if (b.resultId != null && b.resultId !== ('' as unknown)) {
    const n = Number(b.resultId);
    if (!Number.isFinite(n)) return { error: 'invalid resultId' };
    result_id = n;
  }

  let note: string | null = null;
  if (b.note != null && b.note !== '') {
    if (typeof b.note !== 'string') return { error: 'note must be a string' };
    note = b.note.trim().slice(0, NOTE_MAX);
  }

  let effective_at: string | null = null;
  if (b.effectiveAt != null && b.effectiveAt !== '') {
    if (typeof b.effectiveAt !== 'string') return { error: 'effectiveAt must be a string' };
    const t = Date.parse(b.effectiveAt);
    if (Number.isNaN(t)) return { error: 'invalid effectiveAt' };
    effective_at = b.effectiveAt;
  }

  return {
    value: { wca_id, result_id, competition_id, event_id, round_type_id, change_type, fields, note, effective_at },
  };
}

// POST /wca/result-watch/changes — 新增
wcaResultWatchRoutes.post('/wca/result-watch/changes', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const user = await requireAdminOrApiKey(c);

  const res = validateChange(await c.req.json<ChangeInput>());
  if ('error' in res) return c.json({ error: res.error }, 400);
  const f = res.value;

  const inserted = await query<{ id: number | string }>(
    `INSERT INTO wca_result_changes
       (wca_id, result_id, competition_id, event_id, round_type_id, change_type,
        fields, note, effective_at, source, created_by, detected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, 'manual', ?, NOW())
     RETURNING id`,
    [
      f.wca_id, f.result_id, f.competition_id, f.event_id, f.round_type_id, f.change_type,
      f.fields, f.note, f.effective_at, user.wcaId,
    ],
  );
  return c.json({ ok: true, id: Number(inserted[0].id) });
});

// PUT /wca/result-watch/changes/:id — 编辑
wcaResultWatchRoutes.put('/wca/result-watch/changes/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const res = validateChange(await c.req.json<ChangeInput>());
  if ('error' in res) return c.json({ error: res.error }, 400);
  const f = res.value;

  const updated = await query<{ id: number | string }>(
    `UPDATE wca_result_changes SET
       wca_id = ?, result_id = ?, competition_id = ?, event_id = ?, round_type_id = ?,
       change_type = ?, fields = ?::jsonb, note = ?, effective_at = ?, edited_at = NOW()
     WHERE id = ?
     RETURNING id`,
    [
      f.wca_id, f.result_id, f.competition_id, f.event_id, f.round_type_id,
      f.change_type, f.fields, f.note, f.effective_at, id,
    ],
  );
  if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true, id });
});

// DELETE /wca/result-watch/changes/:id
wcaResultWatchRoutes.delete('/wca/result-watch/changes/:id', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid id' }, 400);

  const deleted = await query<{ id: number | string }>(
    'DELETE FROM wca_result_changes WHERE id = ? RETURNING id',
    [id],
  );
  if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});
