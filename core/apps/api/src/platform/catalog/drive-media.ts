import { driveStoredPath } from '../../utils/drive_storage.js';
import { type PlatformActor } from '../auth.js';
import { type PlatformDb, platformQuery, platformTransaction } from '../db.js';
import { badRequest } from '../errors.js';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { platformMediaPath } from '../media_access.js';
import { sniffVideo, readVideoDurationMs } from '../../utils/video_upload.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_PLATFORM_MEDIA_BYTES = 1_073_741_824;

export function driveVideoNodeId(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') badRequest('driveVideo must be a Drive file ID or preview URL');
  const reference = value.trim();
  if (!reference) return undefined;
  let id = reference;
  if (!UUID.test(id)) {
    try {
      id = new URL(reference).searchParams.get('preview') ?? '';
    } catch {
      badRequest('driveVideo must be a Drive file ID or preview URL');
    }
  }
  if (!UUID.test(id)) badRequest('driveVideo must contain a valid Drive file ID');
  return id.toLowerCase();
}

async function lockCourseVideo(db: PlatformDb, nodeId: string): Promise<void> {
  await platformQuery(db, 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`course-drive-video:${nodeId}`]);
}

/** Only remove an unattached file after the failed lesson transaction has rolled back. */
export async function cleanupUnattachedCourseVideo(nodeId: string): Promise<void> {
  await platformTransaction(async db => {
    await lockCourseVideo(db, nodeId);
    const key = `lesson-videos/${nodeId}`;
    const rows = await platformQuery(db, 'SELECT id FROM platform_media_assets WHERE storage_key = $1', [key]);
    if (!rows.length) await fs.unlink(platformMediaPath(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  });
}

export async function driveVideoMediaId(db: PlatformDb, actor: PlatformActor, nodeId: string, onStage?: (id: string) => void): Promise<string> {
  if (actor.userId == null) badRequest('A signed-in account is required to use a Drive video');
  await lockCourseVideo(db, nodeId);
  // Published lessons retain their own durable path even if the original is removed from Drive.
  const storageKey = `lesson-videos/${nodeId}`;
  const existing = await platformQuery<{ id: string; sizeBytes: string | number }>(db, `
    SELECT id::text AS id, size_bytes AS "sizeBytes" FROM platform_media_assets
    WHERE storage_key = $1 AND owner_user_id = $2 AND status = 'ready'
  `, [storageKey, actor.userId]);
  if (existing[0]) {
    const stat = await fs.stat(platformMediaPath(storageKey)).catch(() => null);
    if (stat?.isFile() && stat.size === Number(existing[0].sizeBytes)) return existing[0].id;
  }
  const nodes = await platformQuery<{
    storageKey: string; mimeType: string | null; sizeBytes: number | string;
  }>(db, `
    SELECT storage_key AS "storageKey", mime_type AS "mimeType", size_bytes AS "sizeBytes"
    FROM drive_nodes
    WHERE id = $1::uuid AND owner_user_id = $2 AND kind = 'file'
      AND status = 'ready' AND trashed_at IS NULL FOR SHARE
  `, [nodeId, actor.userId]);
  const node = nodes[0];
  if (!node) badRequest('Drive video is unavailable or is not owned by the current account');
  if (!node.mimeType?.startsWith('video/')) badRequest('The selected Drive file is not a video');
  const sizeBytes = Number(node.sizeBytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_PLATFORM_MEDIA_BYTES) {
    badRequest('Drive video size must be between 1 byte and 1 GB');
  }
  let filePath: string;
  try {
    filePath = driveStoredPath(node.storageKey);
  } catch {
    badRequest('Drive video file is unavailable');
  }
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) badRequest('Drive video file is unavailable');
  if (stat.size !== sizeBytes) badRequest('Drive video storage metadata does not match the uploaded file');

  const header = Buffer.alloc(32);
  const input = await fs.open(filePath, 'r');
  let mime: string | null;
  try { const { bytesRead } = await input.read(header, 0, header.length, 0); mime = sniffVideo(header.subarray(0, bytesRead)); }
  finally { await input.close(); }
  if (!mime) badRequest('Choose a valid MP4, WebM or MOV video');

  let sha256: string;
  try {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filePath)) hash.update(chunk);
    sha256 = hash.digest('hex');
  } catch {
    badRequest('Drive video file is unavailable');
  }

  const finalPath = platformMediaPath(storageKey);
  onStage?.(nodeId);
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  try {
    // An immutable file can have two durable directory entries without doubling disk usage.
    await fs.link(filePath, finalPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST') {
      const staging = `${finalPath}.${randomUUID()}.part`;
      try { await fs.copyFile(filePath, staging); await fs.rename(staging, finalPath); }
      finally { await fs.unlink(staging).catch(() => {}); }
    }
  }
  const copied = await fs.stat(finalPath).catch(() => null);
  if (!copied?.isFile() || copied.size !== sizeBytes) badRequest('Course video storage is unavailable');
  const durationMs = await readVideoDurationMs(finalPath, mime).catch(() => null);

  const media = await platformQuery<{ id: string }>(db, `
    INSERT INTO platform_media_assets (
      owner_user_id, storage_key, mime_type, size_bytes, sha256, access_scope, status, metadata
    ) VALUES ($1, $2, $3, $4, decode($5, 'hex'), 'entitled', 'ready',
      jsonb_build_object('source', 'drive', 'driveNodeId', $6::text, 'durationSeconds', $7::integer))
    ON CONFLICT (storage_key) DO UPDATE SET
      mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes, sha256 = EXCLUDED.sha256,
      access_scope = 'entitled', status = 'ready', metadata = platform_media_assets.metadata || EXCLUDED.metadata
    RETURNING id::text AS id
  `, [actor.userId, storageKey, mime, sizeBytes, sha256, nodeId, durationMs === null ? null : Math.round(durationMs / 1000)]);
  return media[0]!.id;
}
