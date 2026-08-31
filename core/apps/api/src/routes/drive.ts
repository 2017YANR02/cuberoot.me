import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  DRIVE_CHUNK_BYTES,
  DRIVE_TOTAL_BYTES,
  DRIVE_UPLOAD_TTL_MS,
  isDrivePreviewableMime,
  normalizeDriveName,
  type DriveNode,
  type DriveQuota,
  type DriveSnapshot,
  type DriveUpload,
} from '@cuberoot/shared/drive';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { Hono, type Context } from 'hono';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { sql } from '../db/connection.js';
import { requireAppUserId } from '../utils/app_user_auth.js';
import { getIp } from '../utils/analytics_helpers.js';
import { parseByteRange } from '../utils/byte_range.js';
import {
  DRIVE_UPLOAD_DIR,
  drivePartPath,
  driveStorageKey,
  driveStoredPath,
  safeRemoveDriveFile,
} from '../utils/drive_storage.js';
import { checkRateLimit, requireAdmin, requireAuth } from '../utils/recon_helpers.js';
import { JWT_SECRET } from '../utils/session.js';

export const driveRoutes = new Hono();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const QUOTA_LOCK_ID = 2026082901;

interface DriveIdentity {
  userId: number;
  isAdmin: boolean;
  allowed: boolean;
}

interface NodeRow {
  id: string;
  parent_id: string | null;
  name: string;
  kind: 'file' | 'folder';
  shared?: boolean;
  mime_type: string | null;
  size_bytes: number | string;
  storage_key: string | null;
  status: 'uploading' | 'ready';
  created_at: Date | string;
  updated_at: Date | string;
}

interface UploadRow {
  id: string;
  node_id: string;
  owner_user_id: number | string;
  parent_id: string | null;
  name: string;
  mime_type: string | null;
  expected_bytes: number | string;
  received_bytes: number | string;
  chunk_bytes: number;
  client_last_modified: number | string | null;
  expires_at: Date | string;
}

interface TicketPayload extends JwtPayload {
  driveFile?: string;
  driveUser?: number;
  inline?: boolean;
}

function noStore(c: Context): void {
  c.header('Cache-Control', 'no-store');
}

function uuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

function safeInteger(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function mimeType(value: unknown): string {
  if (typeof value !== 'string') return 'application/octet-stream';
  const mime = value.split(';', 1)[0].trim().toLowerCase();
  return mime.length <= 255 && MIME_PATTERN.test(mime) ? mime : 'application/octet-stream';
}

function asIso(value: Date | string): string {
  return new Date(value).toISOString();
}

function nodeJson(row: NodeRow): DriveNode {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    kind: row.kind,
    shared: row.shared === true,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function uploadJson(row: UploadRow): DriveUpload {
  return {
    id: row.id,
    nodeId: row.node_id,
    parentId: row.parent_id,
    name: row.name,
    mimeType: row.mime_type ?? 'application/octet-stream',
    expectedBytes: Number(row.expected_bytes),
    receivedBytes: Number(row.received_bytes),
    chunkBytes: row.chunk_bytes,
    lastModified: row.client_last_modified == null ? null : Number(row.client_last_modified),
    expiresAt: asIso(row.expires_at),
  };
}

async function identity(c: Context): Promise<DriveIdentity> {
  const userId = await requireAppUserId(c);
  const user = await requireAuth(c);
  const isAdmin = isAdminWcaId(user.wcaId);
  if (isAdmin) return { userId, isAdmin, allowed: true };
  const member = await sql<{ enabled: boolean }[]>`
    SELECT enabled FROM drive_members WHERE user_id = ${userId}`;
  return { userId, isAdmin, allowed: member[0]?.enabled === true };
}

async function requireDrive(c: Context): Promise<DriveIdentity> {
  const current = await identity(c);
  if (!current.allowed) throw new Error('Drive access required');
  return current;
}

async function quota(): Promise<DriveQuota> {
  const rows = await sql<{ used_bytes: number | string; reserved_bytes: number | string }[]>`
    SELECT
      COALESCE((SELECT SUM(size_bytes) FROM drive_nodes WHERE kind = 'file' AND status = 'ready'), 0) AS used_bytes,
      COALESCE((SELECT SUM(expected_bytes) FROM drive_uploads WHERE expires_at > NOW()), 0) AS reserved_bytes`;
  return {
    limitBytes: DRIVE_TOTAL_BYTES,
    usedBytes: Number(rows[0]?.used_bytes ?? 0),
    reservedBytes: Number(rows[0]?.reserved_bytes ?? 0),
  };
}

const uploadLocks = new Map<string, Promise<void>>();

async function withUploadLock<T>(uploadId: string, run: () => Promise<T>): Promise<T> {
  const previous = uploadLocks.get(uploadId) ?? Promise.resolve();
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => gate);
  uploadLocks.set(uploadId, queued);
  await previous;
  try {
    return await run();
  } finally {
    release();
    if (uploadLocks.get(uploadId) === queued) uploadLocks.delete(uploadId);
  }
}

async function cleanupExpiredUploads(userId?: number): Promise<void> {
  const rows = await sql<{ id: string; node_id: string }[]>`
    SELECT id, node_id FROM drive_uploads
     WHERE (${userId ?? null}::bigint IS NULL OR owner_user_id = ${userId ?? null})
       AND expires_at <= NOW()
     ORDER BY expires_at
     LIMIT 100`;
  await Promise.all(rows.map((row) => withUploadLock(row.id, async () => {
    const current = await sql<{ node_id: string }[]>`
      DELETE FROM drive_uploads
       WHERE id = ${row.id} AND expires_at <= NOW()
         AND (${userId ?? null}::bigint IS NULL OR owner_user_id = ${userId ?? null})
       RETURNING node_id`;
    if (!current.length) return;
    await sql`DELETE FROM drive_nodes WHERE id = ${row.node_id} AND status = 'uploading'`;
    await safeRemoveDriveFile(drivePartPath(row.id));
    await safeRemoveDriveFile(driveStoredPath(driveStorageKey(row.node_id)));
  })));
}

async function validFolder(userId: number, parentId: string | null): Promise<boolean> {
  if (parentId === null) return true;
  const rows = await sql`
    SELECT 1 FROM drive_nodes
     WHERE id = ${parentId} AND owner_user_id = ${userId}
       AND kind = 'folder' AND status = 'ready' AND trashed_at IS NULL
     LIMIT 1`;
  return rows.length > 0;
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === '23505';
}

async function uploadById(uploadId: string, userId: number): Promise<UploadRow | null> {
  const rows = await sql<UploadRow[]>`
    SELECT u.id, u.node_id, u.owner_user_id, n.parent_id, n.name, n.mime_type,
           u.expected_bytes, u.received_bytes, u.chunk_bytes, u.client_last_modified, u.expires_at
      FROM drive_uploads u
      JOIN drive_nodes n ON n.id = u.node_id
     WHERE u.id = ${uploadId} AND u.owner_user_id = ${userId}
     LIMIT 1`;
  return rows[0] ?? null;
}

async function breadcrumbs(userId: number, parentId: string | null): Promise<Array<{ id: string; name: string }>> {
  if (!parentId) return [];
  const rows = await sql<{ id: string; name: string; depth: number }[]>`
    WITH RECURSIVE chain AS (
      SELECT id, parent_id, name, 0 AS depth
        FROM drive_nodes
       WHERE id = ${parentId} AND owner_user_id = ${userId}
         AND kind = 'folder' AND trashed_at IS NULL
      UNION ALL
      SELECT parent.id, parent.parent_id, parent.name, chain.depth + 1
        FROM drive_nodes parent
        JOIN chain ON chain.parent_id = parent.id
       WHERE parent.owner_user_id = ${userId} AND parent.trashed_at IS NULL
    )
    SELECT id, name, depth FROM chain ORDER BY depth DESC`;
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

driveRoutes.get('/drive', async (c) => {
  noStore(c);
  const current = await identity(c);
  if (!current.allowed) {
    const denied: DriveSnapshot = {
      allowed: false,
      isAdmin: current.isAdmin,
      nodes: [],
      uploads: [],
      breadcrumbs: [],
      quota: { limitBytes: DRIVE_TOTAL_BYTES, usedBytes: 0, reservedBytes: 0 },
    };
    return c.json(denied);
  }

  await cleanupExpiredUploads();
  const trash = c.req.query('trash') === '1';
  const parentParam = c.req.query('parent');
  const parentId = parentParam ? uuid(parentParam) : null;
  if (parentParam && !parentId) return c.json({ error: 'valid parent is required' }, 400);
  if (!trash && !(await validFolder(current.userId, parentId))) return c.json({ error: 'folder not found' }, 404);

  const [nodes, uploads, currentQuota, currentBreadcrumbs] = await Promise.all([
    trash
      ? sql<NodeRow[]>`
          SELECT n.id, n.parent_id, n.name, n.kind, n.mime_type, n.size_bytes, n.storage_key,
                 n.status, n.created_at, n.updated_at, share.id IS NOT NULL AS shared
            FROM drive_nodes n
            LEFT JOIN drive_shares share ON share.node_id = n.id
           WHERE n.owner_user_id = ${current.userId} AND n.trashed_at IS NOT NULL AND n.trash_root_id = n.id
           ORDER BY n.trashed_at DESC, n.id`
      : sql<NodeRow[]>`
          SELECT n.id, n.parent_id, n.name, n.kind, n.mime_type, n.size_bytes, n.storage_key,
                 n.status, n.created_at, n.updated_at, share.id IS NOT NULL AS shared
            FROM drive_nodes n
            LEFT JOIN drive_shares share ON share.node_id = n.id
           WHERE n.owner_user_id = ${current.userId} AND n.parent_id IS NOT DISTINCT FROM ${parentId}
             AND n.trashed_at IS NULL AND n.status = 'ready'
           ORDER BY CASE WHEN n.kind = 'folder' THEN 0 ELSE 1 END, LOWER(n.name), n.id`,
    sql<UploadRow[]>`
      SELECT u.id, u.node_id, u.owner_user_id, n.parent_id, n.name, n.mime_type,
             u.expected_bytes, u.received_bytes, u.chunk_bytes, u.client_last_modified, u.expires_at
        FROM drive_uploads u
        JOIN drive_nodes n ON n.id = u.node_id
       WHERE u.owner_user_id = ${current.userId} AND u.expires_at > NOW()
       ORDER BY u.updated_at DESC`,
    quota(),
    trash ? Promise.resolve([]) : breadcrumbs(current.userId, parentId),
  ]);

  const snapshot: DriveSnapshot = {
    allowed: true,
    isAdmin: current.isAdmin,
    nodes: nodes.map(nodeJson),
    uploads: uploads.map(uploadJson),
    breadcrumbs: currentBreadcrumbs,
    quota: currentQuota,
  };
  return c.json(snapshot);
});

driveRoutes.post('/drive/folders', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'drive-write', max: 120 });
  const current = await requireDrive(c);
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const name = normalizeDriveName(body.name);
  const parentId = body.parentId == null ? null : uuid(body.parentId);
  if (!name) return c.json({ error: 'valid folder name is required' }, 400);
  if (body.parentId != null && !parentId) return c.json({ error: 'valid parentId is required' }, 400);
  if (!(await validFolder(current.userId, parentId))) return c.json({ error: 'parent folder not found' }, 404);
  try {
    const rows = await sql<NodeRow[]>`
      INSERT INTO drive_nodes (owner_user_id, parent_id, kind, name)
      VALUES (${current.userId}, ${parentId}, 'folder', ${name})
      RETURNING id, parent_id, name, kind, mime_type, size_bytes, storage_key, status, created_at, updated_at`;
    return c.json({ node: nodeJson(rows[0]) }, 201);
  } catch (error) {
    if (isUniqueViolation(error)) return c.json({ error: 'an item with this name already exists' }, 409);
    throw error;
  }
});

driveRoutes.post('/drive/uploads', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'drive-upload-create', max: 60 });
  const current = await requireDrive(c);
  await cleanupExpiredUploads(current.userId);
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const name = normalizeDriveName(body.name);
  const parentId = body.parentId == null ? null : uuid(body.parentId);
  const expectedBytes = safeInteger(body.sizeBytes);
  const lastModified = body.lastModified == null ? null : safeInteger(body.lastModified);
  const declaredMime = mimeType(body.mimeType);
  if (!name) return c.json({ error: 'valid file name is required' }, 400);
  if (body.parentId != null && !parentId) return c.json({ error: 'valid parentId is required' }, 400);
  if (expectedBytes == null || expectedBytes <= 0 || expectedBytes > DRIVE_TOTAL_BYTES) {
    return c.json({ error: 'file size must be between 1 byte and 20 GB' }, 413);
  }
  if (body.lastModified != null && lastModified == null) return c.json({ error: 'valid lastModified is required' }, 400);
  if (!(await validFolder(current.userId, parentId))) return c.json({ error: 'parent folder not found' }, 404);

  const existing = await sql<UploadRow[]>`
    SELECT u.id, u.node_id, u.owner_user_id, n.parent_id, n.name, n.mime_type,
           u.expected_bytes, u.received_bytes, u.chunk_bytes, u.client_last_modified, u.expires_at
      FROM drive_uploads u
      JOIN drive_nodes n ON n.id = u.node_id
     WHERE u.owner_user_id = ${current.userId}
       AND n.parent_id IS NOT DISTINCT FROM ${parentId}
       AND LOWER(n.name) = LOWER(${name})
       AND u.expected_bytes = ${expectedBytes}
       AND u.client_last_modified IS NOT DISTINCT FROM ${lastModified}
       AND u.expires_at > NOW()
     LIMIT 1`;
  if (existing[0]) return c.json({ upload: uploadJson(existing[0]) });

  let created: UploadRow | 'folder-missing' | null = null;
  try {
    created = await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(${QUOTA_LOCK_ID})`;
      if (parentId) {
        const folders = await tx`
          SELECT 1 FROM drive_nodes
           WHERE id = ${parentId} AND owner_user_id = ${current.userId}
             AND kind = 'folder' AND status = 'ready' AND trashed_at IS NULL
           LIMIT 1`;
        if (!folders.length) return 'folder-missing' as const;
      }
      const usage = await tx<{ used_bytes: number | string; reserved_bytes: number | string }[]>`
        SELECT
          COALESCE((SELECT SUM(size_bytes) FROM drive_nodes WHERE kind = 'file' AND status = 'ready'), 0) AS used_bytes,
          COALESCE((SELECT SUM(expected_bytes) FROM drive_uploads WHERE expires_at > NOW()), 0) AS reserved_bytes`;
      const occupied = Number(usage[0].used_bytes) + Number(usage[0].reserved_bytes);
      if (occupied + expectedBytes > DRIVE_TOTAL_BYTES) return null;
      const nodes = await tx<NodeRow[]>`
        INSERT INTO drive_nodes (owner_user_id, parent_id, kind, name, mime_type, status)
        VALUES (${current.userId}, ${parentId}, 'file', ${name}, ${declaredMime}, 'uploading')
        RETURNING id, parent_id, name, kind, mime_type, size_bytes, storage_key, status, created_at, updated_at`;
      const rows = await tx<UploadRow[]>`
        INSERT INTO drive_uploads (
          node_id, owner_user_id, expected_bytes, chunk_bytes, client_last_modified, expires_at
        ) VALUES (
          ${nodes[0].id}, ${current.userId}, ${expectedBytes}, ${DRIVE_CHUNK_BYTES}, ${lastModified},
          NOW() + (${DRIVE_UPLOAD_TTL_MS} * INTERVAL '1 millisecond')
        )
        RETURNING id, node_id, owner_user_id, ${parentId}::uuid AS parent_id, ${name}::text AS name,
                  ${declaredMime}::text AS mime_type, expected_bytes, received_bytes, chunk_bytes,
                  client_last_modified, expires_at`;
      return rows[0];
    });
  } catch (error) {
    if (isUniqueViolation(error)) return c.json({ error: 'an item with this name already exists' }, 409);
    throw error;
  }
  if (created === 'folder-missing') return c.json({ error: 'parent folder not found' }, 404);
  if (!created) return c.json({ error: 'Drive storage quota exceeded' }, 413);

  await fs.mkdir(DRIVE_UPLOAD_DIR, { recursive: true });
  try {
    const handle = await fs.open(drivePartPath(created.id), 'wx');
    await handle.close();
  } catch (error) {
    await sql`DELETE FROM drive_nodes WHERE id = ${created.node_id} AND owner_user_id = ${current.userId}`;
    throw error;
  }
  return c.json({ upload: uploadJson(created) }, 201);
});

driveRoutes.on('HEAD', '/drive/uploads/:id', async (c) => {
  noStore(c);
  const current = await requireDrive(c);
  const uploadId = uuid(c.req.param('id'));
  if (!uploadId) return c.body(null, 400);
  const upload = await uploadById(uploadId, current.userId);
  if (!upload || new Date(upload.expires_at).getTime() <= Date.now()) return c.body(null, 404);
  c.header('Upload-Offset', String(upload.received_bytes));
  c.header('Upload-Length', String(upload.expected_bytes));
  c.header('Upload-Expires', asIso(upload.expires_at));
  return c.body(null, 204);
});

driveRoutes.patch('/drive/uploads/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'drive-upload-chunk', max: 900 });
  const current = await requireDrive(c);
  const uploadId = uuid(c.req.param('id'));
  if (!uploadId) return c.json({ error: 'valid upload id is required' }, 400);
  const requestOffset = safeInteger(c.req.header('Upload-Offset'));
  if (requestOffset == null) return c.json({ error: 'Upload-Offset is required' }, 400);
  const checksumHeader = c.req.header('Upload-Checksum') ?? '';
  const checksumMatch = /^sha256 ([A-Za-z0-9+/]{43}=)$/.exec(checksumHeader);
  if (!checksumMatch) return c.json({ error: 'Upload-Checksum sha256 is required' }, 400);

  return withUploadLock(uploadId, async () => {
    const upload = await uploadById(uploadId, current.userId);
    if (!upload || new Date(upload.expires_at).getTime() <= Date.now()) {
      return c.json({ error: 'upload session not found or expired' }, 404);
    }
    const received = Number(upload.received_bytes);
    const expected = Number(upload.expected_bytes);
    if (requestOffset !== received) return c.json({ error: 'upload offset mismatch', offset: received }, 409);
    const remaining = expected - received;
    if (remaining <= 0) return c.json({ offset: received, complete: true });
    const declaredLength = c.req.header('Content-Length');
    if (declaredLength) {
      const length = safeInteger(declaredLength);
      if (length == null || length <= 0 || length > Math.min(upload.chunk_bytes, remaining)) {
        return c.json({ error: 'invalid chunk size' }, 413);
      }
    }
    if (!c.req.raw.body) return c.json({ error: 'chunk body is required' }, 400);

    await fs.mkdir(DRIVE_UPLOAD_DIR, { recursive: true });
    const filePath = drivePartPath(uploadId);
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const key = driveStorageKey(upload.node_id);
      const finalPath = driveStoredPath(key);
      const completed = await fs.stat(finalPath).catch(() => null);
      if (completed?.isFile() && completed.size === expected) {
        await sql.begin(async (tx) => {
          await tx`
            UPDATE drive_nodes
               SET status = 'ready', size_bytes = ${expected}, storage_key = ${key}
             WHERE id = ${upload.node_id} AND owner_user_id = ${current.userId}`;
          await tx`
            DELETE FROM drive_uploads
             WHERE id = ${uploadId} AND owner_user_id = ${current.userId}`;
        });
        c.header('Upload-Offset', String(expected));
        return c.json({ offset: expected, complete: true, nodeId: upload.node_id });
      }
      if (received > 0) throw error;
      const empty = await fs.open(filePath, 'wx');
      await empty.close();
      stat = await fs.stat(filePath);
    }
    if (stat.size !== received) return c.json({ error: 'stored upload offset mismatch', offset: stat.size }, 409);

    const file = await fs.open(filePath, 'r+');
    const reader = c.req.raw.body.getReader();
    const hash = createHash('sha256');
    let written = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.byteLength) continue;
        if (written + value.byteLength > Math.min(upload.chunk_bytes, remaining)) {
          await reader.cancel();
          throw new RangeError('chunk too large');
        }
        const buffer = Buffer.from(value);
        hash.update(buffer);
        let offset = 0;
        while (offset < buffer.byteLength) {
          const result = await file.write(buffer, offset, buffer.byteLength - offset, received + written + offset);
          if (result.bytesWritten <= 0) throw new Error('Drive upload write made no progress');
          offset += result.bytesWritten;
        }
        written += buffer.byteLength;
      }
      if (written <= 0) throw new RangeError('empty chunk');
      if (hash.digest('base64') !== checksumMatch[1]) throw new RangeError('chunk checksum mismatch');
      await file.sync();
    } catch (error) {
      await file.truncate(received).catch(() => {});
      await file.close().catch(() => {});
      if (error instanceof RangeError) return c.json({ error: error.message, offset: received }, 400);
      throw error;
    }
    await file.close();

    const nextOffset = received + written;
    if (nextOffset < expected) {
      await sql`
        UPDATE drive_uploads
           SET received_bytes = ${nextOffset},
               expires_at = NOW() + (${DRIVE_UPLOAD_TTL_MS} * INTERVAL '1 millisecond')
         WHERE id = ${uploadId} AND owner_user_id = ${current.userId}`;
      c.header('Upload-Offset', String(nextOffset));
      return c.json({ offset: nextOffset, complete: false });
    }

    const key = driveStorageKey(upload.node_id);
    const finalPath = driveStoredPath(key);
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.rename(filePath, finalPath);
    try {
      await sql.begin(async (tx) => {
        const locked = await tx`
          SELECT 1 FROM drive_uploads
           WHERE id = ${uploadId} AND owner_user_id = ${current.userId}
           FOR UPDATE`;
        if (!locked.length) throw new Error('upload session disappeared during finalization');
        await tx`
          UPDATE drive_nodes
             SET status = 'ready', size_bytes = ${expected}, storage_key = ${key}
           WHERE id = ${upload.node_id} AND owner_user_id = ${current.userId}`;
        await tx`DELETE FROM drive_uploads WHERE id = ${uploadId}`;
      });
    } catch (error) {
      await fs.rename(finalPath, filePath).catch(() => {});
      throw error;
    }
    c.header('Upload-Offset', String(nextOffset));
    return c.json({ offset: nextOffset, complete: true, nodeId: upload.node_id });
  });
});

driveRoutes.delete('/drive/uploads/:id', async (c) => {
  noStore(c);
  const current = await requireDrive(c);
  const uploadId = uuid(c.req.param('id'));
  if (!uploadId) return c.json({ error: 'valid upload id is required' }, 400);
  return withUploadLock(uploadId, async () => {
    const rows = await sql<{ node_id: string }[]>`
      DELETE FROM drive_uploads
       WHERE id = ${uploadId} AND owner_user_id = ${current.userId}
       RETURNING node_id`;
    if (!rows.length) return c.json({ error: 'upload session not found' }, 404);
    await sql`DELETE FROM drive_nodes WHERE id = ${rows[0].node_id} AND owner_user_id = ${current.userId}`;
    await safeRemoveDriveFile(drivePartPath(uploadId));
    await safeRemoveDriveFile(driveStoredPath(driveStorageKey(rows[0].node_id)));
    return c.json({ ok: true });
  });
});

driveRoutes.patch('/drive/nodes/:id', async (c) => {
  noStore(c);
  const current = await requireDrive(c);
  const nodeId = uuid(c.req.param('id'));
  if (!nodeId) return c.json({ error: 'valid node id is required' }, 400);
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const hasName = Object.hasOwn(body, 'name');
  const hasParent = Object.hasOwn(body, 'parentId');
  const name = hasName ? normalizeDriveName(body.name) : null;
  const parentId = hasParent ? (body.parentId == null ? null : uuid(body.parentId)) : null;
  if (!hasName && !hasParent) return c.json({ error: 'name or parentId is required' }, 400);
  if (hasName && !name) return c.json({ error: 'valid name is required' }, 400);
  if (hasParent && body.parentId != null && !parentId) return c.json({ error: 'valid parentId is required' }, 400);
  const nodes = await sql<NodeRow[]>`
    SELECT id, parent_id, name, kind, mime_type, size_bytes, storage_key, status, created_at, updated_at
      FROM drive_nodes
     WHERE id = ${nodeId} AND owner_user_id = ${current.userId}
       AND status = 'ready' AND trashed_at IS NULL
     LIMIT 1`;
  if (!nodes[0]) return c.json({ error: 'item not found' }, 404);
  if (hasParent) {
    if (!(await validFolder(current.userId, parentId))) return c.json({ error: 'parent folder not found' }, 404);
    if (parentId === nodeId) return c.json({ error: 'folder cannot contain itself' }, 409);
    if (nodes[0].kind === 'folder' && parentId) {
      const cycle = await sql`
        WITH RECURSIVE subtree AS (
          SELECT id FROM drive_nodes WHERE id = ${nodeId} AND owner_user_id = ${current.userId}
          UNION ALL
          SELECT child.id FROM drive_nodes child JOIN subtree ON child.parent_id = subtree.id
           WHERE child.owner_user_id = ${current.userId}
        ) SELECT 1 FROM subtree WHERE id = ${parentId} LIMIT 1`;
      if (cycle.length) return c.json({ error: 'folder cannot be moved into its descendant' }, 409);
    }
  }
  try {
    const rows = await sql<NodeRow[]>`
      UPDATE drive_nodes
         SET name = ${hasName ? name : nodes[0].name},
             parent_id = ${hasParent ? parentId : nodes[0].parent_id}
       WHERE id = ${nodeId} AND owner_user_id = ${current.userId}
       RETURNING id, parent_id, name, kind, mime_type, size_bytes, storage_key, status, created_at, updated_at`;
    return c.json({ node: nodeJson(rows[0]) });
  } catch (error) {
    if (isUniqueViolation(error)) return c.json({ error: 'an item with this name already exists' }, 409);
    throw error;
  }
});

driveRoutes.post('/drive/nodes/:id/trash', async (c) => {
  noStore(c);
  const current = await requireDrive(c);
  const nodeId = uuid(c.req.param('id'));
  if (!nodeId) return c.json({ error: 'valid node id is required' }, 400);
  const outcome = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${QUOTA_LOCK_ID})`;
    const locked = await tx`
      SELECT id FROM drive_nodes
       WHERE id IN (
         WITH RECURSIVE subtree AS (
           SELECT id FROM drive_nodes
            WHERE id = ${nodeId} AND owner_user_id = ${current.userId} AND status = 'ready' AND trashed_at IS NULL
           UNION ALL
           SELECT child.id FROM drive_nodes child JOIN subtree ON child.parent_id = subtree.id
            WHERE child.owner_user_id = ${current.userId} AND child.trashed_at IS NULL
         )
         SELECT id FROM subtree
       )
       FOR UPDATE`;
    if (!locked.length) return 'missing' as const;
    const uploads = await tx`
      WITH RECURSIVE subtree AS (
        SELECT id FROM drive_nodes
         WHERE id = ${nodeId} AND owner_user_id = ${current.userId} AND status = 'ready' AND trashed_at IS NULL
        UNION ALL
        SELECT child.id FROM drive_nodes child JOIN subtree ON child.parent_id = subtree.id
         WHERE child.owner_user_id = ${current.userId} AND child.trashed_at IS NULL
      )
      SELECT 1 FROM drive_uploads upload
       WHERE upload.node_id IN (SELECT id FROM subtree)
       LIMIT 1`;
    if (uploads.length) return 'active-upload' as const;
    await tx`
      WITH RECURSIVE subtree AS (
        SELECT id FROM drive_nodes
         WHERE id = ${nodeId} AND owner_user_id = ${current.userId} AND status = 'ready' AND trashed_at IS NULL
        UNION ALL
        SELECT child.id FROM drive_nodes child JOIN subtree ON child.parent_id = subtree.id
         WHERE child.owner_user_id = ${current.userId} AND child.trashed_at IS NULL
      )
      DELETE FROM drive_shares WHERE node_id IN (SELECT id FROM subtree)`;
    const rows = await tx`
      WITH RECURSIVE subtree AS (
        SELECT id FROM drive_nodes
         WHERE id = ${nodeId} AND owner_user_id = ${current.userId} AND status = 'ready' AND trashed_at IS NULL
        UNION ALL
        SELECT child.id FROM drive_nodes child JOIN subtree ON child.parent_id = subtree.id
         WHERE child.owner_user_id = ${current.userId} AND child.trashed_at IS NULL
      )
      UPDATE drive_nodes SET trashed_at = NOW(), trash_root_id = ${nodeId}
       WHERE id IN (SELECT id FROM subtree)
       RETURNING id`;
    return rows.length ? 'trashed' as const : 'missing' as const;
  });
  if (outcome === 'active-upload') return c.json({ error: 'cancel active uploads before trashing this item' }, 409);
  if (outcome === 'missing') return c.json({ error: 'item not found' }, 404);
  return c.json({ ok: true });
});

driveRoutes.post('/drive/nodes/:id/restore', async (c) => {
  noStore(c);
  const current = await requireDrive(c);
  const nodeId = uuid(c.req.param('id'));
  if (!nodeId) return c.json({ error: 'valid node id is required' }, 400);
  try {
    const rows = await sql`
      WITH root AS (
        SELECT id, parent_id FROM drive_nodes
         WHERE id = ${nodeId} AND owner_user_id = ${current.userId}
           AND trashed_at IS NOT NULL AND trash_root_id = id
      )
      UPDATE drive_nodes n
         SET parent_id = CASE
           WHEN n.id = root.id THEN CASE
             WHEN root.parent_id IS NULL THEN NULL
             WHEN EXISTS (
               SELECT 1 FROM drive_nodes parent
                WHERE parent.id = root.parent_id
                  AND parent.owner_user_id = ${current.userId}
                  AND parent.trashed_at IS NULL
             ) THEN root.parent_id
             ELSE NULL
           END
           ELSE n.parent_id
         END,
         trashed_at = NULL,
         trash_root_id = NULL
        FROM root
       WHERE n.owner_user_id = ${current.userId} AND n.trash_root_id = root.id
       RETURNING n.id`;
    if (!rows.length) return c.json({ error: 'trashed item not found' }, 404);
    return c.json({ ok: true });
  } catch (error) {
    if (isUniqueViolation(error)) return c.json({ error: 'an item with this name already exists' }, 409);
    throw error;
  }
});

driveRoutes.delete('/drive/nodes/:id', async (c) => {
  noStore(c);
  const current = await requireDrive(c);
  const nodeId = uuid(c.req.param('id'));
  if (!nodeId) return c.json({ error: 'valid node id is required' }, 400);
  const keys = await sql<{ storage_key: string }[]>`
    WITH RECURSIVE subtree AS (
      SELECT id, storage_key FROM drive_nodes
       WHERE id = ${nodeId} AND owner_user_id = ${current.userId}
         AND trashed_at IS NOT NULL AND trash_root_id = id
      UNION ALL
      SELECT child.id, child.storage_key FROM drive_nodes child JOIN subtree ON child.parent_id = subtree.id
       WHERE child.owner_user_id = ${current.userId}
    ) SELECT storage_key FROM subtree WHERE storage_key IS NOT NULL`;
  const deleted = await sql`
    DELETE FROM drive_nodes
     WHERE id = ${nodeId} AND owner_user_id = ${current.userId}
       AND trashed_at IS NOT NULL AND trash_root_id = id
     RETURNING id`;
  if (!deleted.length) return c.json({ error: 'trashed item not found' }, 404);
  await Promise.all(keys.map((row) => safeRemoveDriveFile(driveStoredPath(row.storage_key))));
  return c.json({ ok: true });
});

driveRoutes.post('/drive/files/:id/access', async (c) => {
  noStore(c);
  const current = await requireDrive(c);
  const nodeId = uuid(c.req.param('id'));
  if (!nodeId) return c.json({ error: 'valid file id is required' }, 400);
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const requestedInline = body.inline === true;
  const rows = await sql<NodeRow[]>`
    SELECT id, parent_id, name, kind, mime_type, size_bytes, storage_key, status, created_at, updated_at
      FROM drive_nodes
     WHERE id = ${nodeId} AND owner_user_id = ${current.userId}
       AND kind = 'file' AND status = 'ready' AND trashed_at IS NULL
     LIMIT 1`;
  const file = rows[0];
  if (!file) return c.json({ error: 'file not found' }, 404);
  const inline = requestedInline && isDrivePreviewableMime(file.mime_type);
  const token = jwt.sign(
    { driveFile: file.id, driveUser: current.userId, inline },
    JWT_SECRET,
    { audience: 'drive-content', issuer: 'cuberoot', expiresIn: '2h' },
  );
  const origin = new URL(c.req.url).origin;
  return c.json({ url: `${origin}/v1/drive/content/${file.id}?token=${encodeURIComponent(token)}`, inline });
});

driveRoutes.post('/drive/files/:id/share', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'drive-write', max: 120 });
  const current = await requireDrive(c);
  const nodeId = uuid(c.req.param('id'));
  if (!nodeId) return c.json({ error: 'valid file id is required' }, 400);
  const shareId = await sql.begin(async (tx) => {
    if (!current.isAdmin) {
      const members = await tx<{ enabled: boolean }[]>`
        SELECT enabled FROM drive_members WHERE user_id = ${current.userId} FOR UPDATE`;
      if (members[0]?.enabled !== true) return null;
    }
    const files = await tx<{ id: string }[]>`
      SELECT id FROM drive_nodes
       WHERE id = ${nodeId} AND owner_user_id = ${current.userId}
         AND kind = 'file' AND status = 'ready' AND trashed_at IS NULL
       FOR UPDATE`;
    if (!files[0]) return null;
    const rows = await tx<{ id: string }[]>`
      INSERT INTO drive_shares (node_id) VALUES (${nodeId})
      ON CONFLICT (node_id) DO UPDATE SET node_id = EXCLUDED.node_id
      RETURNING id`;
    return rows[0]?.id ?? null;
  });
  if (!shareId) return c.json({ error: 'file not found' }, 404);
  return c.json({ id: shareId });
});

driveRoutes.delete('/drive/files/:id/share', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'drive-write', max: 120 });
  const current = await requireDrive(c);
  const nodeId = uuid(c.req.param('id'));
  if (!nodeId) return c.json({ error: 'valid file id is required' }, 400);
  const found = await sql.begin(async (tx) => {
    const files = await tx`
      SELECT 1 FROM drive_nodes
       WHERE id = ${nodeId} AND owner_user_id = ${current.userId}
         AND kind = 'file' AND status = 'ready' AND trashed_at IS NULL
       FOR UPDATE`;
    if (!files.length) return false;
    await tx`DELETE FROM drive_shares WHERE node_id = ${nodeId}`;
    return true;
  });
  if (!found) return c.json({ error: 'file not found' }, 404);
  return c.json({ ok: true });
});

function contentDisposition(name: string, inline: boolean): string {
  const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download';
  return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

type StoredFileRow = NodeRow & { owner_wca_id: string | null; drive_enabled: boolean | null };

async function streamDriveFile(
  c: Context,
  file: StoredFileRow,
  inline: boolean,
  cacheControl = 'private, no-store',
): Promise<Response> {
  if (!file.storage_key || (!file.drive_enabled && !isAdminWcaId(file.owner_wca_id ?? ''))) {
    return c.json({ error: 'file not found' }, 404);
  }
  const filePath = driveStoredPath(file.storage_key);
  const size = Number(file.size_bytes);
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size !== size) return c.json({ error: 'stored file unavailable' }, 404);
  } catch {
    return c.json({ error: 'stored file unavailable' }, 404);
  }

  const rangeHeader = c.req.header('Range');
  const range = parseByteRange(rangeHeader, size);
  if (rangeHeader && !range) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': cacheControl },
    });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': cacheControl,
    'Content-Disposition': contentDisposition(file.name, inline),
    'Content-Length': String(end - start + 1),
    'Content-Type': file.mime_type ?? 'application/octet-stream',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff',
  });
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  if (c.req.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
  const body = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(body, { status: range ? 206 : 200, headers });
}

async function driveContent(c: Context): Promise<Response> {
  const nodeId = uuid(c.req.param('id'));
  const token = c.req.query('token');
  if (!nodeId || !token) return c.json({ error: 'valid access token is required' }, 401);
  let payload: TicketPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET, {
      audience: 'drive-content',
      issuer: 'cuberoot',
    }) as TicketPayload;
  } catch {
    return c.json({ error: 'file access token expired or invalid' }, 401);
  }
  const ticketUserId = safeInteger(payload.driveUser);
  if (payload.driveFile !== nodeId || ticketUserId == null || ticketUserId <= 0) {
    return c.json({ error: 'file access token invalid' }, 401);
  }
  const rows = await sql<StoredFileRow[]>`
    SELECT n.id, n.parent_id, n.name, n.kind, n.mime_type, n.size_bytes, n.storage_key,
           n.status, n.created_at, n.updated_at, owner.wca_id AS owner_wca_id,
           member.enabled AS drive_enabled
      FROM drive_nodes n
      JOIN app_users owner ON owner.id = n.owner_user_id
      LEFT JOIN drive_members member ON member.user_id = n.owner_user_id
     WHERE n.id = ${nodeId} AND n.owner_user_id = ${ticketUserId}
       AND n.kind = 'file' AND n.status = 'ready' AND n.trashed_at IS NULL
     LIMIT 1`;
  const file = rows[0];
  if (!file) return c.json({ error: 'file not found' }, 404);
  return streamDriveFile(c, file, payload.inline === true && isDrivePreviewableMime(file.mime_type));
}

async function driveSharedContent(c: Context): Promise<Response> {
  const shareId = uuid(c.req.param('id'));
  if (!shareId) return c.json({ error: 'file not found' }, 404);
  const rows = await sql<StoredFileRow[]>`
    SELECT n.id, n.parent_id, n.name, n.kind, n.mime_type, n.size_bytes, n.storage_key,
           n.status, n.created_at, n.updated_at, owner.wca_id AS owner_wca_id,
           member.enabled AS drive_enabled
      FROM drive_shares share
      JOIN drive_nodes n ON n.id = share.node_id
      JOIN app_users owner ON owner.id = n.owner_user_id
      LEFT JOIN drive_members member ON member.user_id = n.owner_user_id
     WHERE share.id = ${shareId}
       AND n.kind = 'file' AND n.status = 'ready' AND n.trashed_at IS NULL
     LIMIT 1`;
  const file = rows[0];
  if (!file) return c.json({ error: 'file not found' }, 404);
  return streamDriveFile(c, file, false, 'no-store');
}

driveRoutes.get('/drive/content/:id', driveContent);
driveRoutes.on('HEAD', '/drive/content/:id', driveContent);
driveRoutes.get('/drive/shared/:id', driveSharedContent);
driveRoutes.on('HEAD', '/drive/shared/:id', driveSharedContent);

driveRoutes.get('/drive/members', async (c) => {
  noStore(c);
  await requireAdmin(c);
  const rows = await sql<{
    user_id: number | string;
    display_name: string;
    wca_id: string | null;
    created_at: Date | string;
  }[]>`
    SELECT m.user_id, u.display_name, u.wca_id, m.created_at
      FROM drive_members m
      JOIN app_users u ON u.id = m.user_id
     WHERE m.enabled
     ORDER BY LOWER(u.display_name), m.user_id`;
  return c.json({ members: rows.map((row) => ({
    userId: Number(row.user_id),
    name: row.display_name,
    wcaId: row.wca_id,
    createdAt: asIso(row.created_at),
  })) });
});

driveRoutes.post('/drive/members', async (c) => {
  noStore(c);
  await requireAdmin(c);
  const grantedBy = await requireAppUserId(c);
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const userId = safeInteger(body.userId);
  if (userId == null || userId <= 0) return c.json({ error: 'valid userId is required' }, 400);
  const users = await sql`SELECT 1 FROM app_users WHERE id = ${userId}`;
  if (!users.length) return c.json({ error: 'user not found' }, 404);
  await sql`
    INSERT INTO drive_members (user_id, enabled, granted_by_user_id)
    VALUES (${userId}, TRUE, ${grantedBy})
    ON CONFLICT (user_id) DO UPDATE
      SET enabled = TRUE, granted_by_user_id = EXCLUDED.granted_by_user_id`;
  return c.json({ ok: true });
});

driveRoutes.delete('/drive/members/:userId', async (c) => {
  noStore(c);
  await requireAdmin(c);
  const userId = safeInteger(c.req.param('userId'));
  if (userId == null || userId <= 0) return c.json({ error: 'valid userId is required' }, 400);
  const removed = await sql.begin(async (tx) => {
    const rows = await tx`
      UPDATE drive_members SET enabled = FALSE WHERE user_id = ${userId} AND enabled RETURNING user_id`;
    if (!rows.length) return false;
    await tx`
      DELETE FROM drive_shares share
       USING drive_nodes node
       WHERE share.node_id = node.id AND node.owner_user_id = ${userId}`;
    return true;
  });
  if (!removed) return c.json({ error: 'Drive member not found' }, 404);
  return c.json({ ok: true });
});
