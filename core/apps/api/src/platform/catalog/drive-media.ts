import { driveStoredPath } from '../../utils/drive_storage.js';
import { type PlatformActor } from '../auth.js';
import { type PlatformDb, platformQuery } from '../db.js';
import { badRequest } from '../errors.js';
import { createHash } from 'node:crypto';
import { promises as fs, createReadStream } from 'node:fs';

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

export async function driveVideoMediaId(db: PlatformDb, actor: PlatformActor, nodeId: string): Promise<string> {
  if (actor.userId == null) badRequest('A signed-in account is required to use a Drive video');
  const nodes = await platformQuery<{
    storageKey: string; mimeType: string | null; sizeBytes: number | string;
  }>(db, `
    SELECT storage_key AS "storageKey", mime_type AS "mimeType", size_bytes AS "sizeBytes"
    FROM drive_nodes
    WHERE id = $1::uuid AND owner_user_id = $2 AND kind = 'file'
      AND status = 'ready' AND trashed_at IS NULL
  `, [nodeId, actor.userId]);
  const node = nodes[0];
  if (!node) badRequest('Drive video is unavailable or is not owned by the current account');
  if (!node.mimeType?.startsWith('video/')) badRequest('The selected Drive file is not a video');
  const sizeBytes = Number(node.sizeBytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_PLATFORM_MEDIA_BYTES) {
    badRequest('Drive video size must be between 1 byte and 1 GB');
  }
  const storageKey = `drive:${node.storageKey}`;
  const existing = await platformQuery<{ id: string }>(db, `
    SELECT id::text AS id FROM platform_media_assets
    WHERE storage_key = $1 AND status = 'ready'
  `, [storageKey]);
  if (existing[0]) return existing[0].id;

  let filePath: string;
  try {
    filePath = driveStoredPath(node.storageKey);
  } catch {
    badRequest('Drive video file is unavailable');
  }
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) badRequest('Drive video file is unavailable');
  if (stat.size !== sizeBytes) badRequest('Drive video storage metadata does not match the uploaded file');

  let sha256: string;
  try {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filePath)) hash.update(chunk);
    sha256 = hash.digest('hex');
  } catch {
    badRequest('Drive video file is unavailable');
  }

  const media = await platformQuery<{ id: string }>(db, `
    INSERT INTO platform_media_assets (
      owner_user_id, storage_key, mime_type, size_bytes, sha256, access_scope, status, metadata
    ) VALUES ($1, $2, $3, $4, decode($5, 'hex'), 'entitled', 'ready',
      jsonb_build_object('source', 'drive', 'driveNodeId', $6::text))
    ON CONFLICT (storage_key) DO UPDATE SET
      mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes, sha256 = EXCLUDED.sha256,
      access_scope = 'entitled', status = 'ready', metadata = platform_media_assets.metadata || EXCLUDED.metadata
    RETURNING id::text AS id
  `, [actor.userId, storageKey, node.mimeType, sizeBytes, sha256, nodeId]);
  return media[0]!.id;
}
