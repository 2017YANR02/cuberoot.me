/**
 * /v1/recon-ground-truth — 智能魔方复盘 ground-truth 管理器。
 *
 * 第一版候选池硬约束：recons.event = 3x3，且 added_by_id 是站点管理员。
 * wca / non_wca / practice 都可进入候选；只有管理员逐条确认、来源文字与 replay
 * 都能完整复原的记录才进入公开 export，供本地测试 gate 同步。
 */
import { Hono } from 'hono';
import { puzzles } from 'cubing/puzzles';
import {
  buildReconGroundTruth,
  reconCandidateMetadataBlockers,
  reconAlgMoves,
} from '@cuberoot/shared/recon-ground-truth';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import {
  ADMIN_WCA_IDS,
  checkRateLimit,
  requireAdminOrApiKey,
} from '../utils/recon_helpers.js';

export const reconGroundTruthRoutes = new Hono();

const CURRENT_EVENT = '3x3';
const CURRENT_REPLAY_EVENT = '333';
const PUBLISHER_WCA_ID = ADMIN_WCA_IDS[0];
const STATUSES = ['confirmed', 'discussion', 'rejected'] as const;
type Status = (typeof STATUSES)[number];
type StatusFilter = Status | 'pending' | 'all';

interface SourceRow {
  id: number | string;
  official: string;
  visibility: string;
  event: string;
  person: string | null;
  person_id: string | null;
  value: string | null;
  raw_time: number | string | null;
  comp: string | null;
  date: string | null;
  method: string | null;
  added_by: string | null;
  added_by_id: string | null;
  reconer: string | null;
  reconer_id: string | null;
  optimal_scramble: string | null;
  wca_scramble: string | null;
  solution: string | null;
}

interface DecisionRow {
  recon_id: number | string;
  status: Status;
  replay: string | null;
  truth: string;
  truth_mode: string;
  current_wrong: string;
  note: string;
  source_event: string;
  source_added_by_id: string;
  source_scramble: string;
  source_solution: string;
  created_by_id: string;
  updated_by_id: string;
  created_at: string;
  updated_at: string;
}

interface ExportRow extends DecisionRow {
  current_event: string | null;
  current_added_by_id: string | null;
  current_value: string | null;
  current_raw_time: number | string | null;
  current_scramble: string | null;
  current_solution: string | null;
}

function sourceScramble(row: SourceRow): string {
  return (row.optimal_scramble?.trim() || row.wca_scramble?.trim() || '');
}

function sourceQuery(select: string): string {
  return `SELECT ${select} FROM recons r
    WHERE r.id = ? AND r.event = ? AND r.added_by_id = ?`;
}

async function loadSource(reconId: number): Promise<SourceRow | null> {
  const rows = await query<SourceRow>(sourceQuery(`
    r.id, r.official, r.visibility, r.event, r.person, r.person_id,
    r.value, r.raw_time, r.comp, r.date, r.method,
    r.added_by, r.added_by_id, r.reconer, r.reconer_id,
    r.optimal_scramble, r.wca_scramble, r.solution
  `), [reconId, CURRENT_EVENT, PUBLISHER_WCA_ID]);
  return rows[0] ?? null;
}

let cube3Promise: ReturnType<(typeof puzzles)['3x3x3']['kpuzzle']> | null = null;
function cube3() {
  cube3Promise ??= puzzles['3x3x3'].kpuzzle();
  return cube3Promise;
}

async function algSolves(scramble: string, moves: string): Promise<boolean> {
  if (!scramble || !moves) return false;
  try {
    const kpuzzle = await cube3();
    // 2 与 2' 的状态相同；执行方向仍原样保存在 truth 与 replay 中。
    const stateAlg = `${scramble} ${moves}`.replace(/2'/g, '2');
    return kpuzzle.defaultPattern().applyAlg(stateAlg).experimentalIsSolved({
      ignorePuzzleOrientation: true,
      ignoreCenterOrientation: true,
    });
  } catch {
    return false;
  }
}

interface Assessment {
  eligible: boolean;
  blockers: string[];
  warnings: string[];
  truth: string;
  normalizedSolution: string;
  crossNormalized: boolean;
  sourceSolved: boolean;
}

async function assessSource(row: SourceRow): Promise<Assessment> {
  const scramble = sourceScramble(row);
  const solution = row.solution?.trim() ?? '';
  const built = buildReconGroundTruth(scramble, solution);
  const blockers = reconCandidateMetadataBlockers({
    scramble,
    solution,
    value: row.value ?? '',
    rawTime: row.raw_time,
  });
  const warnings: string[] = [];

  const hasSourceAlg = !blockers.includes('missing_scramble') && !blockers.includes('missing_solution');
  const sourceSolved = hasSourceAlg && await algSolves(scramble, reconAlgMoves(solution));
  if (hasSourceAlg && !sourceSolved) blockers.push('source_not_solved');
  if (!row.comp || !row.date) warnings.push('missing_comp_or_date');

  return {
    eligible: blockers.length === 0,
    blockers: [...new Set(blockers)],
    warnings,
    truth: built.truth,
    normalizedSolution: built.normalizedSolution,
    crossNormalized: built.crossNormalized,
    sourceSolved,
  };
}

const CANDIDATE_SCRAMBLE_SQL =
  "COALESCE(NULLIF(BTRIM(r.optimal_scramble), ''), BTRIM(r.wca_scramble), '')";

/**
 * 候选资格包含一次真实魔方状态校验，不能只靠 SQL 猜。结果持久化，并用全部来源字段
 * 做快照键；新增或被编辑的复盘才重算，候选池增长后不会在每次翻页时全库求值。
 */
async function refreshCandidateChecks(): Promise<void> {
  const stale = await query<SourceRow>(
    `SELECT r.id, r.official, r.visibility, r.event, r.person, r.person_id,
            r.value, r.raw_time, r.comp, r.date, r.method,
            r.added_by, r.added_by_id, r.reconer, r.reconer_id,
            r.optimal_scramble, r.wca_scramble, r.solution
     FROM recons r
     LEFT JOIN recon_ground_truth_candidate_checks k ON k.recon_id = r.id
     WHERE r.event = ? AND r.added_by_id = ? AND (
       k.recon_id IS NULL OR
       k.source_event IS DISTINCT FROM r.event OR
       k.source_added_by_id IS DISTINCT FROM r.added_by_id OR
       k.source_value IS DISTINCT FROM COALESCE(r.value, '') OR
       k.source_raw_time IS DISTINCT FROM r.raw_time OR
       k.source_scramble IS DISTINCT FROM ${CANDIDATE_SCRAMBLE_SQL} OR
       k.source_solution IS DISTINCT FROM COALESCE(r.solution, '')
     )
     ORDER BY r.id`,
    [CURRENT_EVENT, PUBLISHER_WCA_ID],
  );
  if (stale.length === 0) return;

  const checked: Array<{ row: SourceRow; assessment: Assessment }> = [];
  for (const row of stale) checked.push({ row, assessment: await assessSource(row) });

  for (let start = 0; start < checked.length; start += 200) {
    const chunk = checked.slice(start, start + 200);
    const values = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())').join(', ');
    const params = chunk.flatMap(({ row, assessment }) => [
      Number(row.id),
      row.event,
      row.added_by_id ?? '',
      row.value ?? '',
      row.raw_time,
      sourceScramble(row),
      row.solution ?? '',
      assessment.eligible,
      JSON.stringify(assessment.blockers),
    ]);
    await query(
      `INSERT INTO recon_ground_truth_candidate_checks (
         recon_id, source_event, source_added_by_id, source_value, source_raw_time,
         source_scramble, source_solution, eligible, blockers_json, checked_at
       ) VALUES ${values}
       ON CONFLICT (recon_id) DO UPDATE SET
         source_event = EXCLUDED.source_event,
         source_added_by_id = EXCLUDED.source_added_by_id,
         source_value = EXCLUDED.source_value,
         source_raw_time = EXCLUDED.source_raw_time,
         source_scramble = EXCLUDED.source_scramble,
         source_solution = EXCLUDED.source_solution,
         eligible = EXCLUDED.eligible,
         blockers_json = EXCLUDED.blockers_json,
         checked_at = NOW()`,
      params,
    );
  }
}

let candidateRefresh: Promise<void> | null = null;
async function ensureCandidateChecks(): Promise<void> {
  candidateRefresh ??= refreshCandidateChecks().finally(() => { candidateRefresh = null; });
  await candidateRefresh;
}

const CANDIDATE_CHECK_JOIN = `JOIN recon_ground_truth_candidate_checks k ON
  k.recon_id = r.id AND k.eligible = TRUE AND
  k.source_event = r.event AND
  k.source_added_by_id = r.added_by_id AND
  k.source_value = COALESCE(r.value, '') AND
  k.source_raw_time IS NOT DISTINCT FROM r.raw_time AND
  k.source_scramble = ${CANDIDATE_SCRAMBLE_SQL} AND
  k.source_solution = COALESCE(r.solution, '')`;

function extractReplay(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).searchParams.get('replay')?.trim() || null;
    } catch { /* try the remaining forms */ }
  }
  if (trimmed.includes('=')) {
    try {
      const queryText = trimmed.startsWith('?') ? trimmed.slice(1) : trimmed;
      return new URLSearchParams(queryText).get('replay')?.trim() || null;
    } catch { /* try a bare token */ }
  }
  return /^[A-Za-z0-9+/_=-]{31,1000000}$/.test(trimmed) ? trimmed : null;
}

interface ReplayPayload {
  e?: unknown;
  s?: unknown;
  m?: unknown;
  t?: unknown;
}

function decodeReplay(token: string): ReplayPayload | null {
  try {
    const normalized = token.replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
    const text = Buffer.from(normalized, 'base64').toString('utf8');
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as ReplayPayload : null;
  } catch {
    return null;
  }
}

async function validateReplay(token: string, expectedScramble: string): Promise<string | null> {
  const payload = decodeReplay(token);
  if (!payload) return 'replay_malformed';
  if (payload.e !== CURRENT_REPLAY_EVENT) return 'replay_event_not_333';
  if (typeof payload.s !== 'string') return 'replay_scramble_missing';
  const norm = (value: string) => value.trim().replace(/\s+/g, ' ');
  if (norm(payload.s) !== norm(expectedScramble)) return 'replay_scramble_mismatch';
  if (!Array.isArray(payload.m) || payload.m.length === 0 || payload.m.length > 5000) return 'replay_moves_invalid';
  if (typeof payload.t !== 'number' || !Number.isFinite(payload.t) || payload.t < 0) return 'replay_time_invalid';

  const moves: string[] = [];
  let previousTimestamp = -1;
  for (const entry of payload.m) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string'
      || typeof entry[1] !== 'number' || !Number.isFinite(entry[1])
      // 蓝牙最后一手可能在计时停止后才到达（现有 #2466 晚 50ms），允许 1 秒上报余量。
      || entry[1] < 0 || entry[1] < previousTimestamp || entry[1] > payload.t + 1000) return 'replay_moves_invalid';
    moves.push(entry[0]);
    previousTimestamp = entry[1];
  }
  return await algSolves(payload.s, moves.join(' ')) ? null : 'replay_not_solved';
}

function decisionJson(row: DecisionRow | null) {
  if (!row) return null;
  return {
    status: row.status,
    replay: row.replay ?? '',
    truth: row.truth,
    truthMode: row.truth_mode,
    currentWrong: row.current_wrong,
    note: row.note,
    sourceEvent: row.source_event,
    sourceAddedById: row.source_added_by_id,
    sourceScramble: row.source_scramble,
    sourceSolution: row.source_solution,
    createdById: row.created_by_id,
    updatedById: row.updated_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sourceJson(row: SourceRow) {
  return {
    id: Number(row.id),
    official: row.official,
    visibility: row.visibility,
    event: row.event,
    person: row.person ?? '',
    personId: row.person_id ?? '',
    value: row.value ?? '',
    rawTime: row.raw_time == null ? null : Number(row.raw_time),
    comp: row.comp ?? '',
    date: row.date ?? '',
    method: row.method ?? '',
    addedBy: row.added_by ?? '',
    addedById: row.added_by_id ?? '',
    reconer: row.reconer ?? '',
    reconerId: row.reconer_id ?? '',
    scramble: sourceScramble(row),
    solution: row.solution ?? '',
  };
}

// Public deterministic export: tracked JSON and tests consume confirmed rows only.
reconGroundTruthRoutes.get('/recon-ground-truth/export', async (c) => {
  const rows = await query<ExportRow>(
    `SELECT g.*,
            r.event AS current_event,
            r.added_by_id AS current_added_by_id,
            r.value AS current_value,
            r.raw_time AS current_raw_time,
            COALESCE(NULLIF(BTRIM(r.optimal_scramble), ''), BTRIM(r.wca_scramble), '') AS current_scramble,
            COALESCE(r.solution, '') AS current_solution
     FROM recon_ground_truth_cases g
     LEFT JOIN recons r ON r.id = g.recon_id
     WHERE g.status = 'confirmed' AND g.source_event = ? AND g.source_added_by_id = ?
     ORDER BY g.recon_id`,
    [CURRENT_EVENT, PUBLISHER_WCA_ID],
  );
  const blockedConfirmed: Array<{ id: string; reasons: string[] }> = [];
  const fixtures: Array<{
    id: string;
    source: string;
    replay: string;
    truth: string;
    currentWrong: string;
    note: string;
  }> = [];
  for (const row of rows) {
    const reasons: string[] = [];
    if (row.current_event !== CURRENT_EVENT || row.current_added_by_id !== PUBLISHER_WCA_ID) {
      reasons.push('source_scope_changed');
    }
    if (row.current_scramble !== row.source_scramble || row.current_solution !== row.source_solution) {
      reasons.push('source_changed');
    }
    if (buildReconGroundTruth(row.source_scramble, row.source_solution).truth !== row.truth) {
      reasons.push('truth_rule_changed');
    }
    const eligibilityBlockers = reconCandidateMetadataBlockers({
      scramble: row.current_scramble ?? '',
      solution: row.current_solution ?? '',
      value: row.current_value ?? '',
      rawTime: row.current_raw_time,
    });
    const canCheckSolved = !eligibilityBlockers.includes('missing_scramble')
      && !eligibilityBlockers.includes('missing_solution');
    const sourceSolved = canCheckSolved
      && await algSolves(row.current_scramble ?? '', reconAlgMoves(row.current_solution ?? ''));
    if (eligibilityBlockers.length > 0 || !sourceSolved) reasons.push('source_ineligible');
    if (reasons.length > 0) {
      blockedConfirmed.push({ id: String(row.recon_id), reasons });
      continue;
    }
    fixtures.push({
      id: String(row.recon_id),
      source: `https://cuberoot.me/zh/recon/${row.recon_id}`,
      replay: row.replay ?? '',
      truth: row.truth,
      currentWrong: row.current_wrong,
      note: row.note,
    });
  }
  c.header('Cache-Control', 'public, max-age=60');
  return c.json({
    version: 1,
    blockedConfirmed,
    fixtures,
  });
});

// Admin candidate list. Scope is enforced here, not by a client-side filter.
reconGroundTruthRoutes.get('/recon-ground-truth/candidates', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  await requireAdminOrApiKey(c);
  await ensureCandidateChecks();

  const q = (c.req.query('q') ?? '').trim();
  const requestedStatus = c.req.query('status') ?? 'all';
  const status: StatusFilter = requestedStatus === 'pending' || requestedStatus === 'all'
    || STATUSES.includes(requestedStatus as Status) ? requestedStatus as StatusFilter : 'all';
  const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(10, Number.parseInt(c.req.query('limit') ?? '40', 10) || 40));
  const offset = (page - 1) * limit;
  const statusClause = status === 'all' ? '1=1'
    : status === 'pending' ? 'g.recon_id IS NULL' : 'g.status = ?';
  const statusParams = status === 'all' || status === 'pending' ? [] : [status];
  const search = `%${q}%`;
  const where = `r.event = ? AND r.added_by_id = ?
    AND (? = '' OR r.id::text = ? OR COALESCE(r.person, '') ILIKE ? OR COALESCE(r.comp, '') ILIKE ?)
    AND ${statusClause}`;
  const baseParams: unknown[] = [CURRENT_EVENT, PUBLISHER_WCA_ID, q, q, search, search, ...statusParams];

  const [rows, counts] = await Promise.all([
    query<SourceRow & {
      status: Status | null;
      decision_note: string | null;
      decision_updated_at: string | null;
      source_changed: boolean;
    }>(
      `SELECT r.id, r.official, r.visibility, r.event, r.person, r.person_id,
              r.value, r.raw_time, r.comp, r.date, r.method,
              r.added_by, r.added_by_id, r.reconer, r.reconer_id,
              r.optimal_scramble, r.wca_scramble, NULL::text AS solution,
              g.status, g.note AS decision_note, g.updated_at AS decision_updated_at,
              (g.recon_id IS NOT NULL AND (
                g.source_event IS DISTINCT FROM r.event OR
                g.source_added_by_id IS DISTINCT FROM r.added_by_id OR
                g.source_scramble IS DISTINCT FROM COALESCE(NULLIF(BTRIM(r.optimal_scramble), ''), BTRIM(r.wca_scramble), '') OR
                g.source_solution IS DISTINCT FROM COALESCE(r.solution, '')
              )) AS source_changed
       FROM recons r ${CANDIDATE_CHECK_JOIN}
       LEFT JOIN recon_ground_truth_cases g ON g.recon_id = r.id
       WHERE ${where}
       ORDER BY r.id DESC LIMIT ? OFFSET ?`,
      [...baseParams, limit, offset],
    ),
    query<{ count: number | string }>(
      `SELECT COUNT(*) AS count
       FROM recons r ${CANDIDATE_CHECK_JOIN}
       LEFT JOIN recon_ground_truth_cases g ON g.recon_id = r.id
       WHERE ${where}`,
      baseParams,
    ),
  ]);

  return c.json({
    scope: { event: CURRENT_EVENT, addedById: PUBLISHER_WCA_ID },
    page,
    limit,
    total: Number(counts[0]?.count ?? 0),
    items: rows.map((row) => ({
      ...sourceJson(row),
      solution: undefined,
      status: row.status ?? 'pending',
      decisionNote: row.decision_note ?? '',
      decisionUpdatedAt: row.decision_updated_at,
      sourceChanged: row.source_changed,
    })),
  });
});

// Admin detail: source + derived normalized truth + stored decision snapshot.
reconGroundTruthRoutes.get('/recon-ground-truth/:reconId', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  await requireAdminOrApiKey(c);
  const reconId = Number(c.req.param('reconId'));
  if (!Number.isInteger(reconId) || reconId <= 0) return c.json({ error: 'invalid recon id' }, 400);
  const source = await loadSource(reconId);
  if (!source) return c.json({ error: 'candidate not found in current scope' }, 404);
  const [assessment, decisions] = await Promise.all([
    assessSource(source),
    query<DecisionRow>('SELECT * FROM recon_ground_truth_cases WHERE recon_id = ?', [reconId]),
  ]);
  const decision = decisions[0] ?? null;
  const currentScramble = sourceScramble(source);
  const sourceChanged = !!decision && (
    decision.source_event !== source.event
    || decision.source_added_by_id !== source.added_by_id
    || decision.source_scramble !== currentScramble
    || decision.source_solution !== (source.solution ?? '')
  );
  return c.json({
    source: sourceJson(source),
    assessment,
    decision: decisionJson(decision),
    sourceChanged,
  });
});

interface DecisionInput {
  status?: unknown;
  replay?: unknown;
  currentWrong?: unknown;
  note?: unknown;
  acknowledgeWarnings?: unknown;
}

// Upsert one manual decision. Confirmed is the only state exported to tests.
reconGroundTruthRoutes.put('/recon-ground-truth/:reconId', async (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  checkRateLimit(getIp(c));
  const actor = await requireAdminOrApiKey(c);
  const reconId = Number(c.req.param('reconId'));
  if (!Number.isInteger(reconId) || reconId <= 0) return c.json({ error: 'invalid recon id' }, 400);
  const body = await c.req.json<DecisionInput>();
  if (typeof body.status !== 'string' || !STATUSES.includes(body.status as Status)) {
    return c.json({ error: 'invalid status' }, 400);
  }
  const status = body.status as Status;
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const currentWrong = typeof body.currentWrong === 'string' ? body.currentWrong.trim() : '';
  if (note.length > 4000) return c.json({ error: 'note too long' }, 400);
  if (currentWrong.length > 65535) return c.json({ error: 'currentWrong too long' }, 400);
  if (status !== 'confirmed' && !note) return c.json({ error: 'discussion/rejected requires a note' }, 400);

  const source = await loadSource(reconId);
  if (!source) return c.json({ error: 'candidate not found in current scope' }, 404);
  const assessment = await assessSource(source);
  let replay = extractReplay(body.replay);
  if (status === 'confirmed') {
    if (!assessment.eligible) return c.json({ error: 'source is not a complete solve', blockers: assessment.blockers }, 400);
    if (assessment.warnings.length > 0 && body.acknowledgeWarnings !== true) {
      return c.json({ error: 'warnings must be acknowledged', warnings: assessment.warnings }, 400);
    }
    if (!replay) return c.json({ error: 'valid replay URL or token required' }, 400);
    const replayError = await validateReplay(replay, sourceScramble(source));
    if (replayError) return c.json({ error: replayError }, 400);
  } else if (body.replay !== undefined && body.replay !== '' && !replay) {
    return c.json({ error: 'replay malformed' }, 400);
  }

  // Leaving confirmed keeps an existing replay when the textarea was not changed, so a later re-confirm
  // does not force the administrator to recover the link again.
  if (!replay) {
    const existing = await query<{ replay: string | null }>(
      'SELECT replay FROM recon_ground_truth_cases WHERE recon_id = ?', [reconId],
    );
    replay = existing[0]?.replay ?? null;
  }
  const scramble = sourceScramble(source);
  const saved = await query<DecisionRow>(
    `INSERT INTO recon_ground_truth_cases (
       recon_id, status, replay, truth, truth_mode, current_wrong, note,
       source_event, source_added_by_id, source_scramble, source_solution,
       created_by_id, updated_by_id
     ) VALUES (?, ?, ?, ?, 'normalize_cross', ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (recon_id) DO UPDATE SET
       status = EXCLUDED.status, replay = EXCLUDED.replay, truth = EXCLUDED.truth,
       truth_mode = EXCLUDED.truth_mode, current_wrong = EXCLUDED.current_wrong,
       note = EXCLUDED.note, source_event = EXCLUDED.source_event,
       source_added_by_id = EXCLUDED.source_added_by_id,
       source_scramble = EXCLUDED.source_scramble,
       source_solution = EXCLUDED.source_solution,
       updated_by_id = EXCLUDED.updated_by_id, updated_at = NOW()
     RETURNING *`,
    [
      reconId, status, replay, assessment.truth, currentWrong, note,
      source.event, source.added_by_id, scramble, source.solution ?? '',
      actor.wcaId, actor.wcaId,
    ],
  );
  return c.json({ decision: decisionJson(saved[0]), assessment, sourceChanged: false });
});
