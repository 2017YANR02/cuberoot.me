import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { SITE_ASSISTANT_IMAGE_BYTES, type AssistantImage } from '@cuberoot/shared/site-assistant';
import { query, withTransaction, type QueryRunner } from '../db/connection.js';
import { rasterImageMime } from './raster_image.js';
import { AssistantFailure } from './site_assistant_diagnostics.js';

export const inlineAssistantImageSchema = z.object({
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  data: z.string().min(4).max(4 * Math.ceil(SITE_ASSISTANT_IMAGE_BYTES / 3)),
}).strict().refine(image => {
  const bytes = Buffer.from(image.data, 'base64');
  return bytes.length <= SITE_ASSISTANT_IMAGE_BYTES && bytes.toString('base64') === image.data
    && rasterImageMime(bytes) === image.mediaType;
});
export const assistantImageSchema = z.union([inlineAssistantImageSchema, z.object({
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']), data: z.literal(''), attachmentId: z.string().uuid(),
}).strict()]);

export async function saveAssistantAttachment(uid: number, conversationId: string, image: AssistantImage,
  transaction = withTransaction): Promise<AssistantImage> {
  const parsed = inlineAssistantImageSchema.safeParse({ mediaType: image.mediaType, data: image.data });
  if (!parsed.success) throw new AssistantFailure('invalid_image');
  const hash = createHash('sha256').update(Buffer.from(image.data, 'base64')).digest('hex');
  return transaction(async run => {
    // Serialize each owner's writes so simultaneous requests cannot bypass the storage limit.
    await run('SELECT id FROM app_users WHERE id=? FOR UPDATE', [uid]);
    const old = await run<{ id: string }>('SELECT id FROM site_assistant_attachments WHERE user_id=? AND conversation_id=? AND sha256=? AND deleted_at IS NULL', [uid, conversationId, hash]);
    if (old.length) return { mediaType: image.mediaType, data: '', attachmentId: old[0].id };
    const [usage] = await run<{ bytes: string }>('SELECT COALESCE(SUM(octet_length(data)),0)::text AS bytes FROM site_assistant_attachments WHERE user_id=?', [uid]);
    if (Number(usage.bytes) + Buffer.byteLength(image.data, 'base64') > 100 * 1024 * 1024) throw new AssistantFailure('request_too_large');
    const id = randomUUID();
    await run(`INSERT INTO site_assistant_attachments(id,user_id,conversation_id,media_type,sha256,data)
      VALUES(?,?,?,?,?,decode(?,'base64'))`, [id, uid, conversationId, image.mediaType, hash, image.data]);
    return { mediaType: image.mediaType, data: '', attachmentId: id };
  });
}

export async function readAssistantAttachment(uid: number, id: string, run: QueryRunner = query): Promise<AssistantImage | null> {
  const [row] = await run<{ media_type: AssistantImage['mediaType']; data: string }>(
    "SELECT media_type, encode(data,'base64') AS data FROM site_assistant_attachments WHERE id=? AND user_id=? AND deleted_at IS NULL", [id, uid]);
  return row ? { mediaType: row.media_type, data: row.data.replace(/\s/g, ''), attachmentId: id } : null;
}

export async function resolveAssistantImages(uid: number, images: AssistantImage[], read = readAssistantAttachment): Promise<AssistantImage[]> {
  return Promise.all(images.map(async image => {
    if (!image.attachmentId) return image;
    const saved = await read(uid, image.attachmentId);
    if (!saved || saved.mediaType !== image.mediaType) throw new AssistantFailure('invalid_image');
    return saved;
  }));
}
