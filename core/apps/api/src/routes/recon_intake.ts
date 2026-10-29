import { createHash, randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { query, withTransaction } from '../db/connection.js';
import { requireAdminOrApiKey } from '../utils/recon_helpers.js';
import type { ReconIntakeCase, ReconIntakeInput, ReconSnapshot } from '@cuberoot/shared/recon-ground-truth';
import { reconCanonicalJson } from '@cuberoot/shared/recon-ground-truth';

const short = z.string().max(4000);
const index = z.number().int().min(0).max(9999);
const range = z.object({ fromIdx: index, toIdx: index }).strict();
export const intakeSnapshotSchema = z.object({
  inspection: short,
  lines: z.array(z.object({
    key: z.string().max(100), kind: z.string().max(100), fromIdx: index, toIdx: index,
    moves: z.array(z.string().max(30)).max(1000), label: short.nullable(),
  }).strict()).min(1).max(100),
}).strict();
const inputSchema = z.object({
  source: z.string().max(10000),
  sourceReconId: z.number().int().positive().max(2147483647).optional(),
  sourceReconHash: z.string().regex(/^[a-f0-9]{32}$/).optional(),
  recording: z.object({
    scramble: short.min(1),
    moves: z.array(z.object({ m: z.string().regex(/^[URFDLBurfdlbMESxyz]w?(?:2'?|')?$/),
      ts: z.number().finite().min(0).max(86400000) }).strict()).min(1).max(10000),
    timeMs: z.number().finite().positive().max(86400000), model: z.string().max(100),
    gyro: z.string().max(1500000).optional(),
  }).strict(),
  observed: intakeSnapshotSchema,
  annotations: z.array(z.object({
    id: z.string().uuid(), range: range.nullable(), observed: short,
    problem: short.trim().min(1), expectedAlgorithm: short, expectedEffect: short,
  }).strict()).max(100),
  verdict: z.enum(['correct', 'needs-fix']), language: z.enum(['en', 'zh']), hadOverride: z.boolean(),
}).strict().superRefine((input, ctx) => {
  if (Boolean(input.sourceReconId) !== Boolean(input.sourceReconHash))
    ctx.addIssue({ code: 'custom', message: 'Source identity and fingerprint must be provided together' });
  const moves = input.recording.moves;
  const ranges = [...input.observed.lines, ...input.annotations.flatMap(a => a.range ? [a.range] : [])];
  if (ranges.some(r => r.fromIdx > r.toIdx || r.toIdx >= moves.length)
    // Device timestamps and the stopwatch have independent drift/rounding.
    // Keep the raw track, including a final turn slightly after timeMs.
    || moves.some((m, i) => i > 0 && m.ts < moves[i - 1].ts))
    ctx.addIssue({ code: 'custom', message: 'Invalid recording range or timestamps' });
  if (input.verdict === 'needs-fix' && !input.annotations.length)
    ctx.addIssue({ code: 'custom', message: 'An annotation is required' });
});
const hash = (value: unknown) => createHash('sha256').update(reconCanonicalJson(value)).digest('hex');
const caseHash = (input: ReconIntakeInput, expected: ReconSnapshot | null) => hash({ input, expected });
const uuid = z.string().uuid();
type Row = {
  id: string; recording_hash: string; content_hash: string; revision: number;
  input: ReconIntakeInput; expected: ReconSnapshot | null; status: ReconIntakeCase['status'];
  created_by: string; approved_by: string | null; created_at: Date; updated_at: Date;
  latest_run: ReconIntakeCase['latestRun']; claimed_by: string | null; lease_until: Date | null;
  lease_token: string | null;
  source_snapshot: ReconIntakeCase['sourceSnapshot'];
};
function item(row: Row): ReconIntakeCase {
  return { id: row.id, revision: row.revision, recordingHash: row.recording_hash, contentHash: row.content_hash,
    input: row.input, expected: row.expected, status: row.status, createdBy: row.created_by,
    approvedBy: row.approved_by, createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(), latestRun: row.latest_run,
    claimedBy: row.claimed_by, leaseUntil: row.lease_until ? new Date(row.lease_until).toISOString() : null,
    sourceSnapshot: row.source_snapshot ?? null };
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HTTPException(400, { message: result.error.issues.map(i => i.message).join('; ') });
  return result.data;
}
export function createReconIntakeRoutes(authenticate = requireAdminOrApiKey) {
const actors = new WeakMap<Context, Awaited<ReturnType<typeof requireAdminOrApiKey>>>();
const authorize = async (c: Context) => {
  let actor = actors.get(c);
  if (!actor) { actor = await authenticate(c); actors.set(c, actor); }
  return actor;
};
const reconIntakeRoutes = new Hono();
reconIntakeRoutes.use('/recon-intake/*', bodyLimit({ maxSize: 2_000_000 }));
reconIntakeRoutes.use('/recon-intake/*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  await authorize(c);
  await next();
});
// This list is an administrator workflow over source reconstructions, not a
// public search. Only a successful collection changes its intake status.
reconIntakeRoutes.get('/recon-intake/sources/filters', async c => {
  const rows = await query<{ role: 'person' | 'collector'; id: string; name: string }>(
    `WITH sources AS (
      SELECT person_id, person, added_by_id, added_by FROM recons
      WHERE event = '3x3'
        AND COALESCE(NULLIF(BTRIM(optimal_scramble), ''), NULLIF(BTRIM(wca_scramble), ''), BTRIM(scramble), '') <> ''
        AND COALESCE(BTRIM(solution), '') <> ''
    )
    SELECT 'person' AS role, person_id AS id, COALESCE(MAX(NULLIF(BTRIM(person), '')), person_id) AS name
      FROM sources WHERE COALESCE(person_id, '') <> '' GROUP BY person_id
    UNION ALL
    SELECT 'collector' AS role, added_by_id AS id, COALESCE(MAX(NULLIF(BTRIM(added_by), '')), added_by_id) AS name
      FROM sources WHERE COALESCE(added_by_id, '') <> '' GROUP BY added_by_id
    ORDER BY name, id`);
  return c.json({ persons: rows.filter(row => row.role === 'person'), collectors: rows.filter(row => row.role === 'collector') });
});
reconIntakeRoutes.get('/recon-intake/sources', async c => {
  const status = c.req.query('status') ?? 'pending';
  if (!['pending', 'collected', 'all'].includes(status)) throw new HTTPException(400);
  const personId = parse(z.string().max(100), c.req.query('personId') ?? '2023GENG02');
  const collectorId = parse(z.string().max(100), c.req.query('collectorId') ?? '2017YANR02');
  const offset = Math.max(0, Math.min(100000, Math.trunc(Number(c.req.query('offset')) || 0)));
  const rows = await query<{ id: number; scramble: string; solution: string; comp: string | null; comp_wca_id: string | null; country: string | null; date: string | null;
    value: string | null; intake_status: string | null; intake_id: string | null; truth_status: string | null; source_changed: boolean; source_hash: string }>(
    `SELECT r.id, COALESCE(NULLIF(BTRIM(r.optimal_scramble), ''), NULLIF(BTRIM(r.wca_scramble), ''), BTRIM(r.scramble), '') AS scramble,
      COALESCE(r.solution, '') AS solution, r.comp, r.comp_wca_id, r.country, r.date::text, r.value,
      i.status AS intake_status, i.id::text AS intake_id, g.status AS truth_status,
      md5(jsonb_build_array(COALESCE(NULLIF(BTRIM(r.optimal_scramble), ''), NULLIF(BTRIM(r.wca_scramble), ''), BTRIM(r.scramble), ''), COALESCE(r.solution, ''))::text) AS source_hash,
      ((i.id IS NOT NULL AND i.input->>'sourceReconHash' IS DISTINCT FROM
        md5(jsonb_build_array(COALESCE(NULLIF(BTRIM(r.optimal_scramble), ''), NULLIF(BTRIM(r.wca_scramble), ''), BTRIM(r.scramble), ''), COALESCE(r.solution, ''))::text))
       OR (g.recon_id IS NOT NULL AND (g.source_event IS DISTINCT FROM r.event
        OR g.source_added_by_id IS DISTINCT FROM r.added_by_id OR g.source_scramble IS DISTINCT FROM
        COALESCE(NULLIF(BTRIM(r.optimal_scramble), ''), NULLIF(BTRIM(r.wca_scramble), ''), BTRIM(r.scramble), '')
        OR g.source_solution IS DISTINCT FROM COALESCE(r.solution, '')))) AS source_changed
     FROM recons r LEFT JOIN recon_intake i ON i.source_recon_id = r.id
     LEFT JOIN recon_ground_truth_cases g ON g.recon_id = r.id
     WHERE r.event = '3x3' AND (? = '' OR r.person_id = ?) AND (? = '' OR r.added_by_id = ?)
       AND COALESCE(NULLIF(BTRIM(r.optimal_scramble), ''), NULLIF(BTRIM(r.wca_scramble), ''), BTRIM(r.scramble), '') <> ''
       AND COALESCE(BTRIM(r.solution), '') <> ''
       AND (? = 'all' OR (? = 'pending' AND i.id IS NULL AND
         (g.status IS DISTINCT FROM 'confirmed' OR g.source_event IS DISTINCT FROM r.event
          OR g.source_added_by_id IS DISTINCT FROM r.added_by_id OR g.source_scramble IS DISTINCT FROM
          COALESCE(NULLIF(BTRIM(r.optimal_scramble), ''), NULLIF(BTRIM(r.wca_scramble), ''), BTRIM(r.scramble), '')
          OR g.source_solution IS DISTINCT FROM COALESCE(r.solution, '')))
         OR (? = 'collected' AND (i.id IS NOT NULL OR (g.status = 'confirmed' AND g.source_event = r.event
          AND g.source_added_by_id IS NOT DISTINCT FROM r.added_by_id AND g.source_scramble =
          COALESCE(NULLIF(BTRIM(r.optimal_scramble), ''), NULLIF(BTRIM(r.wca_scramble), ''), BTRIM(r.scramble), '')
          AND g.source_solution = COALESCE(r.solution, '')))))
     ORDER BY r.id DESC LIMIT 51 OFFSET ?`, [personId, personId, collectorId, collectorId, status, status, status, offset]);
  return c.json({ items: rows.slice(0, 50).map(row => ({ id: row.id, scramble: row.scramble,
    solution: row.solution, competition: row.comp, competitionId: row.comp_wca_id, country: row.country, date: row.date, value: row.value,
    intakeId: row.intake_id, intakeStatus: row.intake_status, truthStatus: row.truth_status,
    sourceChanged: row.source_changed, sourceHash: row.source_hash })), hasMore: rows.length > 50 });
});
reconIntakeRoutes.get('/recon-intake', async c => {
  const status = c.req.query('status') ?? 'todo';
  if (!['todo', 'all', 'active', 'needs-fix', 'needs-review', 'pending-test'].includes(status))
    throw new HTTPException(400);
  const offset = Math.max(0, Math.min(100000, Math.trunc(Number(c.req.query('offset')) || 0)));
  const where = status === 'all' ? 'TRUE' : status === 'todo' ? "status <> 'active'" : 'status = ?';
  const rows = await query<Row>(`SELECT * FROM recon_intake WHERE ${where} ORDER BY created_at, id LIMIT 51 OFFSET ?`,
    [...(status === 'all' || status === 'todo' ? [] : [status]), offset]);
  return c.json({ items: rows.slice(0, 50).map(item), hasMore: rows.length > 50 });
});
reconIntakeRoutes.post('/recon-intake', async c => {
  const actor = await authorize(c);
  const { id, input } = parse(z.object({ id: uuid, input: inputSchema }).strict(), await c.req.json());
  if (input.verdict === 'correct' && c.req.header('X-Admin-Key'))
    throw new HTTPException(403, { message: 'Administrator sign-in required to confirm an answer' });
  const expected = input.verdict === 'correct' ? input.observed : null;
  const submissionHash = hash({ ...input, source: '' });
  const saved = await withTransaction(async q => {
    let sourceSnapshot: ReconIntakeCase['sourceSnapshot'] = null;
    if (input.sourceReconId) {
      const [source] = await q<{ scramble: string; solution: string; source_hash: string; added_by_id: string | null }>(`SELECT
        COALESCE(NULLIF(BTRIM(optimal_scramble), ''), NULLIF(BTRIM(wca_scramble), ''), BTRIM(scramble), '') AS scramble,
        COALESCE(solution, '') AS solution, added_by_id,
        md5(jsonb_build_array(COALESCE(NULLIF(BTRIM(optimal_scramble), ''), NULLIF(BTRIM(wca_scramble), ''), BTRIM(scramble), ''), COALESCE(solution, ''))::text) AS source_hash FROM recons
        WHERE id = ? AND event = '3x3' FOR SHARE`, [input.sourceReconId]);
      const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
      if (!source || !source.solution.trim() || !source.scramble || source.source_hash !== input.sourceReconHash
        || normalize(source.scramble) !== normalize(input.recording.scramble))
        throw new HTTPException(400, { message: 'Source reconstruction or scramble does not match' });
      const [confirmed] = await q<{ recon_id: number }>("SELECT recon_id FROM recon_ground_truth_cases WHERE recon_id = ? AND status = 'confirmed' AND source_event = '3x3' AND source_added_by_id IS NOT DISTINCT FROM ? AND source_scramble = ? AND source_solution = ?", [input.sourceReconId, source.added_by_id, source.scramble, source.solution]);
      if (confirmed) throw new HTTPException(409, { message: 'Source reconstruction already collected' });
      sourceSnapshot = { id: input.sourceReconId, scramble: source.scramble, solution: source.solution };
    }
    await q(`INSERT INTO recon_intake (id, source_recon_id, source_snapshot, submission_hash, recording_hash, content_hash, input, expected, status, created_by, approved_by)
      VALUES (?, ?, ?::jsonb, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?) ON CONFLICT DO NOTHING`,
    [id, input.sourceReconId ?? null, sourceSnapshot, submissionHash, hash(input.recording), caseHash(input, expected), input, expected,
      expected ? 'pending-test' : 'needs-fix', actor.wcaId, expected ? actor.wcaId : null]);
    const [row] = await q<Row>('SELECT * FROM recon_intake WHERE submission_hash = ?', [submissionHash]);
    if (!row) throw new HTTPException(409, { message: input.sourceReconId ? 'Source reconstruction already collected' : 'Submission ID already used' });
    await q(`INSERT INTO recon_intake_revisions (case_id, revision, content_hash, input, expected, actor)
      VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?) ON CONFLICT DO NOTHING`,
    [row.id, row.revision, row.content_hash, row.input, row.expected, actor.wcaId]);
    return item(row);
  });
  return c.json(saved);
});
reconIntakeRoutes.get('/recon-intake/:id', async c => {
  const id = parse(uuid, c.req.param('id'));
  const [row] = await query<Row>('SELECT * FROM recon_intake WHERE id = ?', [id]);
  if (!row) throw new HTTPException(404);
  const runs = await query('SELECT payload, revision, created_at FROM recon_intake_runs WHERE case_id = ? ORDER BY created_at DESC LIMIT 30', [id]);
  const revisions = await query('SELECT revision, input, expected, actor, created_at FROM recon_intake_revisions WHERE case_id = ? ORDER BY revision DESC LIMIT 30', [id]);
  return c.json({ item: item(row), runs, revisions });
});
reconIntakeRoutes.post('/recon-intake/:id/claim', async c => {
  const id = parse(uuid, c.req.param('id'));
  const actor = await authorize(c);
  const leaseToken = randomUUID();
  const [row] = await query<Row>(`UPDATE recon_intake SET lease_token = ?, claimed_by = ?, lease_until = NOW() + INTERVAL '30 minutes'
    WHERE id = ? AND status IN ('pending-test','needs-fix') AND (lease_until IS NULL OR lease_until < NOW()) RETURNING *`,
  [leaseToken, actor.wcaId, id]);
  if (!row) throw new HTTPException(409, { message: 'Case unavailable or already claimed' });
  return c.json({ item: item(row), leaseToken });
});
const leaseSchema = z.object({ leaseToken: uuid, revision: z.number().int().positive(), contentHash: z.string().length(64) });
reconIntakeRoutes.post('/recon-intake/:id/renew', async c => {
  const id = parse(uuid, c.req.param('id'));
  const actor = await authorize(c);
  const body = parse(leaseSchema.strict(), await c.req.json());
  const [row] = await query<Row>(`UPDATE recon_intake SET lease_until = NOW() + INTERVAL '30 minutes'
    WHERE id = ? AND lease_token = ? AND claimed_by = ? AND revision = ? AND content_hash = ? AND lease_until > NOW() RETURNING *`,
  [id, body.leaseToken, actor.wcaId, body.revision, body.contentHash]);
  if (!row) throw new HTTPException(409, { message: 'Lease expired or sample changed' });
  return c.json(item(row));
});
const runSchema = z.object({
  id: uuid, status: z.enum(['passed', 'failed', 'interrupted']), actual: intakeSnapshotSchema.nullable(),
  errors: z.array(short).max(100), fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  libraryHash: z.string().regex(/^[a-f0-9]{64}$/), commit: z.string().max(80), regressionPassed: z.boolean(),
}).strict();
reconIntakeRoutes.post('/recon-intake/:id/results', async c => {
  const id = parse(uuid, c.req.param('id'));
  const actor = await authorize(c);
  const body = parse(leaseSchema.extend({ run: runSchema }).strict(), await c.req.json());
  const saved = await withTransaction(async q => {
    const [row] = await q<Row>('SELECT * FROM recon_intake WHERE id = ? FOR UPDATE', [id]);
    if (!row) throw new HTTPException(404);
    const [existing] = await q<{ payload: unknown; case_id: string; revision: number; content_hash: string }>(
      'SELECT payload, case_id, revision, content_hash FROM recon_intake_runs WHERE id = ?', [body.run.id]);
    if (existing) {
      if (existing.case_id !== id || existing.revision !== body.revision || existing.content_hash !== body.contentHash
        || hash(existing.payload) !== hash(body.run)) throw new HTTPException(409, { message: 'Run ID already used' });
      return item(row);
    }
    if (row.revision !== body.revision || row.content_hash !== body.contentHash || row.lease_token !== body.leaseToken
      || row.claimed_by !== actor.wcaId || !row.lease_until || new Date(row.lease_until).getTime() <= Date.now())
      throw new HTTPException(409, { message: 'Lease expired or sample changed' });
    if (body.run.status === 'passed' && (!body.run.actual || body.run.errors.length
      || (row.expected && hash(body.run.actual) !== hash(row.expected))))
      throw new HTTPException(400, { message: 'Passing result must match the approved expectation' });
    const status = body.run.status === 'passed'
      ? row.expected && body.run.regressionPassed ? 'active' : 'needs-review'
      : row.status;
    await q(`INSERT INTO recon_intake_runs (id, case_id, revision, content_hash, actor, payload)
      VALUES (?, ?, ?, ?, ?, ?::jsonb)`, [body.run.id, id, row.revision, row.content_hash, actor.wcaId, body.run]);
    const [updated] = await q<Row>(`UPDATE recon_intake SET latest_run = ?::jsonb, status = ?,
      lease_token = NULL, claimed_by = NULL, lease_until = NULL, updated_at = NOW() WHERE id = ? RETURNING *`,
    [{ ...body.run, revision: row.revision, createdAt: new Date().toISOString() }, status, id]);
    return item(updated);
  });
  return c.json(saved);
});
// Only an interactive administrator can approve a proposed answer. AI keys cannot.
reconIntakeRoutes.post('/recon-intake/:id/review', async c => {
  if (c.req.header('X-Admin-Key')) throw new HTTPException(403, { message: 'Administrator sign-in required for review' });
  const actor = await authorize(c);
  const id = parse(uuid, c.req.param('id'));
  const body = parse(z.object({ revision: z.number().int().positive(),
    action: z.enum(['approve', 'revise']), input: inputSchema.optional() }).strict(), await c.req.json());
  const saved = await withTransaction(async q => {
    const [row] = await q<Row>('SELECT * FROM recon_intake WHERE id = ? FOR UPDATE', [id]);
    if (!row || row.revision !== body.revision) throw new HTTPException(409, { message: 'Sample changed; refresh first' });
    if (body.action === 'approve' && (!row.latest_run?.actual || row.latest_run.status !== 'passed'
      || row.latest_run.revision !== row.revision)) throw new HTTPException(400, { message: 'No current passing proposal to approve' });
    if (body.action === 'revise' && (!body.input || hash(body.input.recording) !== row.recording_hash
      || body.input.sourceReconId !== row.input.sourceReconId || body.input.sourceReconHash !== row.input.sourceReconHash))
      throw new HTTPException(400, { message: 'Keep the original recording' });
    const input = body.action === 'revise' ? body.input! : row.input;
    const expected = body.action === 'approve' ? row.latest_run!.actual : input.verdict === 'correct' ? input.observed : null;
    const [updated] = await q<Row>(`UPDATE recon_intake SET input = ?::jsonb, expected = ?::jsonb, content_hash = ?,
      revision = revision + 1, status = ?, approved_by = ?, lease_token = NULL, claimed_by = NULL, lease_until = NULL,
      updated_at = NOW() WHERE id = ? RETURNING *`, [input, expected, caseHash(input, expected),
      expected ? 'pending-test' : 'needs-fix', expected ? actor.wcaId : null, id]);
    await q(`INSERT INTO recon_intake_revisions (case_id, revision, content_hash, input, expected, actor)
      VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?)`, [id, updated.revision, updated.content_hash, input, expected, actor.wcaId]);
    return item(updated);
  });
  return c.json(saved);
});

return reconIntakeRoutes;
}
export const reconIntakeRoutes = createReconIntakeRoutes();
