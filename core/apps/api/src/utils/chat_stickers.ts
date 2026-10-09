import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { ChatError, CHAT_STICKER_LIMIT, CHAT_STICKER_MAX_BYTES, isChatUuid } from '@cuberoot/shared/chat';
import { sql as database } from '../db/connection.js';

/** Read raster headers only; never accept SVG, an arbitrary URL, or the supplied MIME alone. */
export function stickerMime(data: Buffer): string {
  if (!data.length || data.length > CHAT_STICKER_MAX_BYTES) throw new ChatError('BODY_TOO_LARGE');
  let mime = '';
  let width = 0;
  let height = 0;
  if (data.length >= 33 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && data.toString('ascii', 12, 16) === 'IHDR') {
    mime = 'image/png'; width = data.readUInt32BE(16); height = data.readUInt32BE(20);
  } else if (data.length >= 14 && /^GIF8[79]a$/.test(data.toString('ascii', 0, 6)) && data.at(-1) === 0x3b) {
    mime = 'image/gif'; width = data.readUInt16LE(6); height = data.readUInt16LE(8);
  } else if (data.length >= 30 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP'
    && data.readUInt32LE(4) + 8 === data.length) {
    mime = 'image/webp';
    const chunk = data.toString('ascii', 12, 16);
    if (chunk === 'VP8X') { width = data.readUIntLE(24, 3) + 1; height = data.readUIntLE(27, 3) + 1; }
    else if (chunk === 'VP8 ' && data.subarray(23, 26).equals(Buffer.from([157, 1, 42]))) {
      width = data.readUInt16LE(26) & 0x3fff; height = data.readUInt16LE(28) & 0x3fff;
    } else if (chunk === 'VP8L' && data[20] === 0x2f) {
      const bits = data.readUInt32LE(21); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
    }
  } else if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data.at(-2) === 0xff && data.at(-1) === 0xd9) {
    mime = 'image/jpeg';
    let offset = 2;
    while (offset + 4 <= data.length && data[offset] === 0xff) {
      while (data[offset + 1] === 0xff) offset++;
      const marker = data[offset + 1];
      if (marker === 0xda || marker === 0xd9 || offset + 4 > data.length) break;
      const size = data.readUInt16BE(offset + 2);
      if (size < 2 || offset + 2 + size > data.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && size >= 8) {
        height = data.readUInt16BE(offset + 5); width = data.readUInt16BE(offset + 7); break;
      }
      offset += 2 + size;
    }
  }
  if (!mime || width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 16_000_000) throw new ChatError('INVALID_INPUT');
  return mime;
}

export async function requireStickerAccess(tx: postgres.TransactionSql, uid: number, id: string) {
  if (!isChatUuid(id)) throw new ChatError('INVALID_INPUT');
  const rows = await tx`SELECT s.id FROM friend_chat_stickers s WHERE s.id = ${id} AND (
    s.owner_user_id = ${uid} OR EXISTS (SELECT 1 FROM friend_chat_sticker_favorites f WHERE f.user_id = ${uid} AND f.sticker_id = s.id)
    OR EXISTS (SELECT 1 FROM friend_chat_messages m JOIN friend_chat_conversations c ON c.id = m.conversation_id
      WHERE m.sticker_id = s.id AND (c.user_low_id = ${uid} OR c.user_high_id = ${uid})))`;
  if (!rows.length) throw new ChatError('CHAT_NOT_FOUND');
}
/** Run after account FK cascades, retaining only copies held by other users. */
export async function purgeOrphanedStickers(tx: postgres.TransactionSql) {
  await tx`DELETE FROM friend_chat_stickers s WHERE s.owner_user_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM friend_chat_messages m WHERE m.sticker_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM friend_chat_sticker_favorites f WHERE f.sticker_id = s.id)`;
}
export function createStickerRepository(db: typeof database = database) {
  const list = async (uid: number) => await db<{ id: string }[]>`SELECT sticker_id AS id FROM friend_chat_sticker_favorites
    WHERE user_id = ${uid} ORDER BY created_at DESC, sticker_id LIMIT ${CHAT_STICKER_LIMIT}`;
  async function lockOwner(tx: postgres.TransactionSql, uid: number) {
    const users = await tx`SELECT id FROM app_users WHERE id = ${uid} AND merged_into_user_id IS NULL FOR UPDATE`;
    if (!users.length) throw new ChatError('UNAUTHENTICATED');
    const count = await tx`SELECT count(*) AS n FROM friend_chat_sticker_favorites WHERE user_id = ${uid}`;
    return Number(count[0].n);
  }
  return {
    list,
    async upload(uid: number, data: Buffer) {
      const mime = stickerMime(data);
      return await db.begin(async (tx) => {
        if (await lockOwner(tx, uid) >= CHAT_STICKER_LIMIT) throw new ChatError('STICKER_LIMIT');
        const [usage] = await tx`SELECT COALESCE(sum(octet_length(data)), 0) AS bytes,
          count(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') AS today FROM friend_chat_stickers WHERE owner_user_id = ${uid}`;
        if (Number(usage.today) >= 50 || Number(usage.bytes) + data.length > 100 * 1024 * 1024) throw new ChatError('STICKER_LIMIT');
        const id = randomUUID();
        await tx`INSERT INTO friend_chat_stickers (id, owner_user_id, data, mime) VALUES (${id}, ${uid}, ${data}, ${mime})`;
        await tx`INSERT INTO friend_chat_sticker_favorites (user_id, sticker_id) VALUES (${uid}, ${id})`;
        return { id };
      }) as { id: string };
    },
    async image(uid: number, id: string) {
      return await db.begin(async (tx) => {
        await requireStickerAccess(tx, uid, id);
        const [row] = await tx<{ data: Buffer; mime: string }[]>`SELECT data, mime FROM friend_chat_stickers WHERE id = ${id}`;
        return row;
      }) as { data: Buffer; mime: string };
    },
    async save(uid: number, id: string, saved: boolean) {
      await db.begin(async (tx) => {
        const count = await lockOwner(tx, uid);
        await requireStickerAccess(tx, uid, id);
        if (saved) {
          const old = await tx`SELECT 1 FROM friend_chat_sticker_favorites WHERE user_id = ${uid} AND sticker_id = ${id}`;
          if (!old.length && count >= CHAT_STICKER_LIMIT) throw new ChatError('STICKER_LIMIT');
          await tx`INSERT INTO friend_chat_sticker_favorites (user_id, sticker_id) VALUES (${uid}, ${id}) ON CONFLICT DO NOTHING`;
        } else {
          await tx`DELETE FROM friend_chat_sticker_favorites WHERE user_id = ${uid} AND sticker_id = ${id}`;
          await purgeOrphanedStickers(tx);
        }
      });
      return list(uid);
    },
  };
}
export const stickerRepository = createStickerRepository();
