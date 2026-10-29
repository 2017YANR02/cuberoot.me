import { createHash } from 'node:crypto';
import { constants, promises as fs } from 'node:fs';
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import {
  RECON_CAPTURE_CHUNK_BYTES, RECON_CAPTURE_MAX_VIDEO_BYTES,
  fitReconCaptureSync, validateReconCaptureInput,
  type ReconCapture, type ReconCaptureAnchor, type ReconCaptureInput, type ReconCaptureSync,
} from '@cuberoot/shared/recon-capture';
import { reconCanonicalJson } from '@cuberoot/shared/recon-ground-truth';
import { query, withTransaction, type QueryRunner } from '../db/connection.js';
import { checkRateLimit, requireAdminOrApiKey, type WcaUser } from '../utils/recon_helpers.js';
import { requireAppUserId } from '../utils/app_user_auth.js';
import { drivePartPath, driveStoredPath } from '../utils/drive_storage.js';
import { readVideoDurationMs, sniffVideo, storedVideoResponse } from '../utils/video_upload.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = (value: unknown) => createHash('sha256').update(reconCanonicalJson(value)).digest('hex');
function fail(status: 400 | 403 | 404 | 409 | 410 | 412 | 503, message: string): never { throw new HTTPException(status, { message }); }
const idOf = (value: string | undefined) => value && UUID.test(value) ? value : fail(400, 'Invalid capture ID');
const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const iso = (v: string | Date) => new Date(v).toISOString();
type Row = {
  id: string; owner_user_id: number | string; source_solve_id: string; drive_node_id: string | null;
  submission_hash: string; recording_hash: string; input: ReconCaptureInput;
  status: ReconCapture['status']; revision: number; video_sha256: string | null;
  video_mime: string | null; video_duration_ms: number | null; sync: ReconCaptureSync | null;
  created_at: Date | string; updated_at: Date | string;
};
type DriveRow = {
  id: string; owner_user_id: number | string; kind: string; status: string; storage_key: string | null;
  size_bytes: number | string; mime_type: string | null; restricted: boolean; derived: boolean;
  upload_id: string | null; expected_bytes: number | string | null; received_bytes: number | string | null;
  chunk_bytes: number | null; expires_at: Date | string | null;
};

async function driveNode(nodeId: string | null, q: QueryRunner = query, lock = false): Promise<DriveRow | null> {
  if (!nodeId) return null;
  const rows = await q<DriveRow>(`WITH RECURSIVE ancestry AS (
    SELECT id, parent_id, member_shared, trashed_at, ARRAY[id] AS seen FROM drive_nodes WHERE id = ?
    UNION ALL
    SELECT p.id, p.parent_id, p.member_shared, p.trashed_at, a.seen || p.id
      FROM drive_nodes p JOIN ancestry a ON p.id = a.parent_id
      WHERE NOT p.id = ANY(a.seen) AND cardinality(a.seen) < 64
  ) SELECT n.*, u.id AS upload_id, u.expected_bytes, u.received_bytes, u.chunk_bytes, u.expires_at,
    (EXISTS (SELECT 1 FROM ancestry WHERE member_shared OR trashed_at IS NOT NULL)
      OR EXISTS (SELECT 1 FROM drive_shares s JOIN ancestry a ON a.id = s.node_id)
      OR NOT EXISTS (SELECT 1 FROM ancestry WHERE parent_id IS NULL)) AS restricted,
    EXISTS (SELECT 1 FROM drive_compressions WHERE output_node_id = n.id) AS derived
    FROM drive_nodes n LEFT JOIN drive_uploads u ON u.node_id = n.id WHERE n.id = ?
    ${lock ? 'FOR SHARE OF n' : ''}`, [nodeId, nodeId]);
  return rows[0] ?? null;
}

function usable(node: DriveRow | null, row: Pick<Row, 'owner_user_id' | 'input'>): node is DriveRow {
  if (!node || Number(node.owner_user_id) !== Number(row.owner_user_id) || node.kind !== 'file'
    || node.restricted || node.derived) return false;
  if (node.status === 'ready') return !!node.storage_key && Number(node.size_bytes) === row.input.video.sizeBytes;
  return node.status === 'uploading' && !!node.upload_id && Number(node.expected_bytes) === row.input.video.sizeBytes
    && node.chunk_bytes === RECON_CAPTURE_CHUNK_BYTES && !!node.expires_at && new Date(node.expires_at).getTime() > Date.now();
}

async function describe(row: Row): Promise<ReconCapture> {
  const node = await driveNode(row.drive_node_id);
  let available = usable(node, row);
  const ready = available && node?.status === 'ready';
  if (available && node) {
    const path = ready ? driveStoredPath(node.storage_key!) : drivePartPath(node.upload_id!);
    const stat = await fs.lstat(path).catch(() => null);
    available = !!stat?.isFile() && (!ready || stat.size === row.input.video.sizeBytes);
  }
  return {
    id: row.id, revision: row.revision, input: row.input, recordingHash: row.recording_hash,
    contentHash: hash({ input: row.input, status: row.status, videoSha256: row.video_sha256, sync: row.sync }),
    status: row.status, videoSha256: row.video_sha256, videoMimeType: row.video_mime,
    videoDurationMs: row.video_duration_ms, sync: row.sync,
    createdBy: String(row.owner_user_id), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
    upload: { id: node?.upload_id ?? null, receivedBytes: ready ? row.input.video.sizeBytes : Number(node?.received_bytes ?? 0),
      expectedBytes: row.input.video.sizeBytes, chunkBytes: RECON_CAPTURE_CHUNK_BYTES, ready, available },
  };
}

async function readRow(id: string, q: QueryRunner = query, lock = false): Promise<Row> {
  const rows = await q<Row>(`SELECT * FROM recon_captures WHERE id = ? ${lock ? 'FOR UPDATE' : ''}`, [id]);
  return rows[0] ?? fail(404, 'Capture not found');
}

/** Fixed-size reads validate every browser fingerprint without loading a video into memory. */
async function verifyVideo(filePath: string, input: ReconCaptureInput) {
  const handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size !== input.video.sizeBytes) fail(409, 'Original video size changed');
    const bytes = Buffer.allocUnsafe(RECON_CAPTURE_CHUNK_BYTES);
    const full = createHash('sha256');
    let mime: string | null = null;
    for (let index = 0, position = 0; position < before.size; index++) {
      const length = Math.min(bytes.length, before.size - position);
      let read = 0;
      while (read < length) {
        const result = await handle.read(bytes, read, length - read, position + read);
        if (!result.bytesRead) fail(409, 'Original video was truncated');
        read += result.bytesRead;
      }
      const chunk = bytes.subarray(0, length);
      if (!index) mime = sniffVideo(chunk.subarray(0, 32));
      if (createHash('sha256').update(chunk).digest('hex') !== input.video.chunkSha256[index])
        fail(409, 'Video fingerprint mismatch; select the same original file');
      full.update(chunk);
      position += length;
    }
    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) fail(409, 'Original video changed during verification');
    if (!mime) fail(400, 'Original file is not an MP4, MOV or WebM video');
    return { sha256: full.digest('hex'), mime };
  } finally { await handle.close(); }
}

export function createReconCaptureRoutes(authenticate = requireAdminOrApiKey, options: { uploadsAvailable?: boolean } = {}) {
  const routes = new Hono();
  routes.onError((error, c) => {
    c.header('Cache-Control', 'private, no-store');
    c.header('Vary', 'Authorization, X-Admin-Key');
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    if (error.message === 'Authentication required') return c.json({ error: error.message }, 401);
    if (error.message === 'Admin access required') return c.json({ error: error.message }, 403);
    console.error('[recon-capture]', error);
    return c.json({ error: 'Capture service unavailable' }, 500);
  });
  const actors = new WeakMap<Context, WcaUser>();
  const actor = async (c: Context) => {
    let user = actors.get(c);
    if (!user) { user = await authenticate(c); actors.set(c, user); }
    if (!user.isAdmin) fail(403, 'Administrator access required');
    return user;
  };
  const human = async (c: Context) => {
    const user = await actor(c);
    if (user.wcaId === '__api_key__' || c.req.header('X-Admin-Key')) fail(403, 'Human administrator session required');
    const id = user.uid ?? await requireAppUserId(c);
    if (!Number.isSafeInteger(id) || id <= 0) fail(403, 'Account identity required');
    if (!(await query('SELECT id FROM app_users WHERE id = ?', [id])).length)
      fail(403, 'Account is unavailable in this capture database');
    return id;
  };
  const body = async (c: Context) => {
    const value: unknown = await c.req.json().catch(() => null);
    if (!plain(value)) fail(400, 'JSON object required');
    return value;
  };
  const gate = async (c: Context, next: () => Promise<void>) => {
    c.header('Cache-Control', 'private, no-store');
    c.header('Vary', 'Authorization, X-Admin-Key');
    await actor(c); await next();
  };
  routes.use('/recon-captures', bodyLimit({ maxSize: 2_000_000 }), gate);
  routes.use('/recon-captures/*', bodyLimit({ maxSize: 2_000_000 }), gate);

  routes.get('/recon-captures/status', async c => {
    if (options.uploadsAvailable === false) fail(503, 'Use the full local API with local Drive for capture uploads; the intake-only helper is read-only for video capture');
    const required = ['recon_captures', 'recon_capture_revisions', 'drive_nodes', 'drive_uploads', 'drive_shares', 'drive_compressions', 'app_users'];
    const tables = await query<{ name: string; present: string | null }>('SELECT name, to_regclass(name)::text AS present FROM unnest(?::text[]) AS name', [required]);
    if (tables.some(t => !t.present)) fail(503, 'Capture and Drive tables must be available in the same database');
    if ((await actor(c)).wcaId !== '__api_key__') await human(c);
    return c.json({ available: true, storage: 'drive', maxVideoBytes: RECON_CAPTURE_MAX_VIDEO_BYTES, chunkBytes: RECON_CAPTURE_CHUNK_BYTES });
  });

  routes.get('/recon-captures', async c => {
    const source = c.req.query('sourceSolveId');
    const status = c.req.query('status');
    const offset = Number(c.req.query('offset') ?? 0), limit = Number(c.req.query('limit') ?? 10);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 10
      || (source !== undefined && (!source.length || source.length > 200))
      || (status !== undefined && !['uploading', 'needs-review'].includes(status))) fail(400, 'Invalid capture query');
    const clauses: string[] = [], params: unknown[] = [];
    if (source) { clauses.push('source_solve_id = ?'); params.push(source); }
    if (source && (await actor(c)).wcaId !== '__api_key__') { clauses.push('owner_user_id = ?'); params.push(await human(c)); }
    if (status) { clauses.push('status = ?'); params.push(status); }
    const order = source ? 'DESC' : 'ASC';
    const rows = await query<Row>(`SELECT * FROM recon_captures ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY created_at ${order}, id ${order} LIMIT ? OFFSET ?`, [...params, limit + 1, offset]);
    return c.json({ items: await Promise.all(rows.slice(0, limit).map(describe)), hasMore: rows.length > limit });
  });

  routes.post('/recon-captures', async c => {
    const owner = await human(c);
    checkRateLimit(String(owner), { bucket: 'recon-capture-create', max: 60 });
    const request = await body(c);
    if (Object.keys(request).some(k => !['id', 'input'].includes(k)) || typeof request.id !== 'string') fail(400, 'Invalid capture request');
    const id = idOf(request.id), errors = validateReconCaptureInput(request.input);
    if (errors.length) fail(400, errors.join('; '));
    const input = request.input as ReconCaptureInput, submissionHash = hash(input);
    const row = await withTransaction(async q => {
      // Repeated submission of this same input reuses its sample even with another client UUID.
      await q('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [`capture:${owner}:${submissionHash}`]);
      const existing = await q<Row>('SELECT * FROM recon_captures WHERE id = ? OR (owner_user_id = ? AND submission_hash = ?)', [id, owner, submissionHash]);
      if (existing.length) {
        const sameId = existing.find(r => r.id === id), same = sameId ?? existing[0];
        if (Number(same.owner_user_id) !== owner || same.submission_hash !== submissionHash) fail(409, 'Capture ID is bound to different original data');
        return same;
      }
      const node = await driveNode(input.driveNodeId, q, true);
      if (!usable(node, { owner_user_id: owner, input })) fail(409, 'Select your private, original Drive video in this environment');
      const rows = await q<Row>(`INSERT INTO recon_captures
        (id, owner_user_id, source_solve_id, drive_node_id, submission_hash, recording_hash, input, sync)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'null'::jsonb) RETURNING *`,
      [id, owner, input.sourceSolveId, input.driveNodeId, submissionHash, hash(input.recording), input]);
      return rows[0];
    }).catch(error => {
      if ((error as { code?: string }).code === '23505') fail(409, 'Capture ID is already bound; reload the existing sample');
      throw error;
    });
    return c.json(await describe(row));
  });

  routes.get('/recon-captures/:id', async c => c.json(await describe(await readRow(idOf(c.req.param('id'))))));

  routes.post('/recon-captures/:id/complete', async c => {
    const owner = await human(c), id = idOf(c.req.param('id'));
    checkRateLimit(String(owner), { bucket: 'recon-capture-complete', max: 30 });
    const row = await withTransaction(async q => {
      const current = await readRow(id, q, true);
      if (Number(current.owner_user_id) !== owner) fail(403, 'Only the original uploader may complete this capture');
      const node = await driveNode(current.drive_node_id, q, true);
      if (!usable(node, current)) fail(410, 'Original Drive video is unavailable');
      if (node.status !== 'ready') fail(409, 'Video upload is not complete');
      const filePath = driveStoredPath(node.storage_key!);
      if (current.status === 'needs-review') {
        const stat = await fs.lstat(filePath).catch(() => null);
        if (!stat?.isFile() || stat.size !== current.input.video.sizeBytes) fail(410, 'Original video is missing');
        return current;
      }
      const verified = await verifyVideo(filePath, current.input).catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') fail(410, 'Original video is missing');
        throw error;
      });
      const duration = await readVideoDurationMs(filePath, verified.mime);
      const rows = await q<Row>(`UPDATE recon_captures SET status = 'needs-review', video_sha256 = ?, video_mime = ?,
        video_duration_ms = ?, revision = revision + 1, updated_at = NOW() WHERE id = ? RETURNING *`, [verified.sha256, verified.mime, duration, id]);
      return rows[0];
    });
    return c.json(await describe(row));
  });

  routes.post('/recon-captures/:id/sync', async c => {
    const owner = await human(c), id = idOf(c.req.param('id')), request = await body(c);
    if (Object.keys(request).some(k => !['revision', 'anchors'].includes(k)) || !Number.isSafeInteger(request.revision) || !Array.isArray(request.anchors))
      fail(400, 'Revision and synchronization anchors required');
    const row = await withTransaction(async q => {
      const current = await readRow(id, q, true);
      if (Number(current.owner_user_id) !== owner) fail(403, 'Only the original uploader may edit alignment');
      if (current.revision !== request.revision) fail(409, 'Capture changed; reload before saving');
      if (current.status !== 'needs-review') fail(409, 'Complete the original video upload first');
      const node = await driveNode(current.drive_node_id, q, true);
      if (!usable(node, current)) fail(410, 'Original Drive video is unavailable');
      let sync: ReconCaptureSync;
      try { sync = fitReconCaptureSync(current.input.recording, { ...current.input.video, durationMs: current.video_duration_ms }, request.anchors as ReconCaptureAnchor[]); }
      catch (error) { fail(400, error instanceof Error ? error.message : 'Invalid alignment'); }
      if (hash(sync) === hash(current.sync)) return current;
      await q(`INSERT INTO recon_capture_revisions (capture_id, revision, sync, actor_user_id)
        VALUES (?, ?, ${current.sync === null ? "'null'::jsonb" : '?'}, ?) ON CONFLICT DO NOTHING`,
      current.sync === null ? [id, current.revision, owner] : [id, current.revision, current.sync, owner]);
      const rows = await q<Row>('UPDATE recon_captures SET sync = ?, revision = revision + 1, updated_at = NOW() WHERE id = ? RETURNING *', [sync, id]);
      await q('INSERT INTO recon_capture_revisions (capture_id, revision, sync, actor_user_id) VALUES (?, ?, ?, ?)', [id, rows[0].revision, sync, owner]);
      return rows[0];
    });
    return c.json(await describe(row));
  });

  const video = async (c: Context, headOnly: boolean) => {
    const row = await readRow(idOf(c.req.param('id'))), node = await driveNode(row.drive_node_id);
    if (row.status !== 'needs-review' || !row.video_sha256 || !row.video_mime) fail(409, 'Video is not verified yet');
    if (!usable(node, row) || node.status !== 'ready') fail(410, 'Original Drive video is unavailable');
    const filePath = driveStoredPath(node.storage_key!), stat = await fs.lstat(filePath).catch(() => null);
    if (!stat?.isFile() || stat.size !== row.input.video.sizeBytes) fail(410, 'Original video is unavailable');
    const etag = `"${row.video_sha256}"`, requestedRange = c.req.header('Range'), ifRange = c.req.header('If-Range');
    const ifMatch = c.req.header('If-Match');
    if (ifMatch && ifMatch !== '*' && !ifMatch.split(',').some(value => value.trim() === etag)) fail(412, 'Video fingerprint changed');
    const response = storedVideoResponse({ filePath, mime: row.video_mime, size: stat.size, headOnly,
      rangeHeader: !ifRange || ifRange === etag ? requestedRange : undefined });
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Vary', 'Authorization, X-Admin-Key');
    response.headers.set('ETag', etag);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.input.video.filename)}`);
    return response;
  };
  routes.get('/recon-captures/:id/video', c => video(c, false));
  routes.on('HEAD', '/recon-captures/:id/video', c => video(c, true));
  return routes;
}

export const reconCaptureRoutes = createReconCaptureRoutes();
