/** Real PostgreSQL fixture. Creates and drops only its own uniquely named database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { createChatRepository } from '../../src/utils/chat_repository.js';
import { removeAcceptedFriend } from '../../src/utils/friend_relationships.js';
import { ChatError, CHAT_STICKER_BODY } from '@cuberoot/shared/chat';
import { createStickerRepository, purgeOrphanedStickers } from '../../src/utils/chat_stickers.js';

const settings = { host: process.env.DB_HOST ?? '127.0.0.1', port: Number(process.env.DB_PORT ?? 5433),
  username: process.env.DB_USER ?? 'postgres', password: process.env.DB_PASS ?? 'dev', connect_timeout: 5 };
const name = `friend_chat_fixture_${randomUUID().replaceAll('-', '')}`;
const admin = postgres({ ...settings, database: process.env.DB_NAME ?? 'cuberoot_db', max: 1 });
let db: ReturnType<typeof postgres> | null = null;
let created = false;
let checks = 0;
async function rejects(run: () => Promise<unknown>, code: string) {
  await assert.rejects(run, (error: unknown) => error instanceof ChatError && error.code === code); checks++;
}
try {
  await admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
  db = postgres({ ...settings, database: name, max: 12 });
  const sql = db;
  await sql.unsafe(`CREATE TABLE app_users (
    id BIGINT PRIMARY KEY, display_name TEXT NOT NULL, avatar_url TEXT, avatar_source TEXT NOT NULL DEFAULT 'auto',
    avatar_preset TEXT, wca_id TEXT, merged_into_user_id BIGINT
  );
  CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
  CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY, user_key TEXT NOT NULL, kind TEXT NOT NULL, actor_key TEXT,
    actor_name VARCHAR(100), title TEXT, excerpt TEXT, link TEXT, dedupe_key TEXT,
    read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE UNIQUE INDEX uq_notifications_user_kind_dedupe ON notifications (user_key, kind, dedupe_key) WHERE dedupe_key IS NOT NULL;`);
  for (const migration of ['0175_friends.sql', '0249_friend_chat.sql', '0250_chat_stickers.sql']) {
    await sql.unsafe(await readFile(new URL(`../../migrations/${migration}`, import.meta.url), 'utf8'));
  }
  await sql`INSERT INTO app_users (id, display_name) VALUES (1,'One'), (2,'Two'), (3,'Three'), (4,'Four')`;
  const repo = createChatRepository(sql);
  const input = (body = 'hello') => ({ clientMessageId: randomUUID(), body });
  const accept = () => sql`INSERT INTO user_friendships (user_low_id,user_high_id,requested_by_user_id,status,responded_at)
    VALUES (1,2,1,'accepted',NOW()) ON CONFLICT (user_low_id,user_high_id) DO UPDATE SET status='accepted',responded_at=NOW()`;
  await rejects(() => repo.send(1, 2, input()), 'CHAT_UNAVAILABLE');
  await rejects(() => repo.messages(3, 1), 'CHAT_NOT_FOUND');
  await rejects(() => repo.send(1, 1, input()), 'CHAT_NOT_FOUND');
  await accept();
  assert.equal((await repo.messages(1, 2)).conversationId, null); checks++;
  const firstInput = input('你好\r\n😀');
  const first = await repo.send(1, 2, firstInput);
  assert.equal(first.message.body, '你好\n😀');
  assert.equal(first.message.sequence, '1');
  const replay = await repo.send(1, 2, firstInput);
  assert.deepEqual(replay.message, first.message); assert.equal(replay.replay, true); checks++;
  await rejects(() => repo.send(1, 2, { ...firstInput, body: 'changed' }), 'IDEMPOTENCY_CONFLICT');
  await rejects(() => repo.send(3, 2, input()), 'CHAT_UNAVAILABLE');
  await rejects(() => repo.messages(3, 2), 'CHAT_NOT_FOUND');
  await rejects(() => repo.read(3, 2, '1'), 'CHAT_NOT_FOUND');
  const duplicate = input('retry');
  const duplicates = await Promise.all(Array.from({ length: 5 }, () => repo.send(1, 2, duplicate)));
  assert.equal(duplicates.filter((r) => !r.replay).length, 1); checks++;
  await Promise.all(Array.from({ length: 12 }, (_, i) => repo.send(i % 2 ? 1 : 2, i % 2 ? 2 : 1, input(String(i)))));
  const all = await repo.messages(2, 1);
  assert.deepEqual(all.items.map((m) => m.sequence), Array.from({ length: 14 }, (_, i) => String(i + 1))); checks++;
  const conversations = await repo.conversations(2);
  assert.equal(conversations.items[0].unreadCount, 8);
  assert.equal((await sql`SELECT * FROM notifications WHERE user_key='u2'`).length, 1); checks++;
  const newest = await repo.messages(1, 2, { limit: 4 });
  assert.deepEqual(newest.items.map((m) => m.sequence), ['11','12','13','14']);
  const older = await repo.messages(1, 2, { before: '11', limit: 4 });
  assert.deepEqual(older.items.map((m) => m.sequence), ['7','8','9','10']);
  const newer = await repo.messages(1, 2, { after: '10', limit: 2 });
  assert.deepEqual(newer.items.map((m) => m.sequence), ['11','12']); assert.equal(newer.hasMore, true); checks++;
  await rejects(() => repo.messages(1,2,{ before:'2', after:'1' }), 'INVALID_INPUT');
  await rejects(() => repo.read(1, 2, '999'), 'INVALID_INPUT');
  assert.equal((await repo.messages(1, 2)).peerReadSequence, '0'); checks++;
  await repo.read(2, 1, '14');
  assert.equal((await repo.messages(1, 2, { after: '14' })).peerReadSequence, '14'); checks++;
  assert.equal((await repo.messages(2, 1)).peerReadSequence, '0'); checks++;
  await repo.read(2, 1, '2');
  assert.equal((await repo.conversations(2)).items[0].myReadSequence, '14'); checks++;
  await Promise.all([repo.send(1, 2, input('new')), repo.read(2, 1, '14')]);
  assert.equal((await repo.conversations(2)).items[0].unreadCount, 1);
  assert.equal((await sql`SELECT read_at FROM notifications WHERE user_key='u2'`)[0].read_at, null); checks++;
  await sql`DELETE FROM user_friendships WHERE user_low_id=1 AND user_high_id=2`;
  await rejects(() => repo.send(1,2,input()), 'CHAT_UNAVAILABLE');
  assert.equal((await repo.messages(2,1)).canSend, false);
  assert.equal((await repo.send(1,2,firstInput)).replay, true); checks++;
  await accept();
  await sql`INSERT INTO user_blocks VALUES (2,1,NOW())`;
  await rejects(() => repo.send(1,2,input()), 'CHAT_UNAVAILABLE');
  await rejects(() => repo.send(2,1,input()), 'CHAT_UNAVAILABLE');
  await sql`DELETE FROM user_blocks`;
  await sql.unsafe(`CREATE FUNCTION reject_chat_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture notification failure'; END $$;
    CREATE TRIGGER reject_notification BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_chat_notification();`);
  await assert.rejects(() => repo.send(1,2,input('rollback')));
  assert.equal((await repo.messages(1,2)).lastSequence, '15'); checks++;
  await sql.unsafe('DROP TRIGGER reject_notification ON notifications');
  const competing = await Promise.allSettled([
    repo.send(1, 2, input('racing removal')),
    sql.begin(async (tx) => removeAcceptedFriend(tx, 1, 2)),
  ]);
  assert.equal(competing[1].status, 'fulfilled');
  if (competing[0].status === 'rejected') assert.equal(competing[0].reason.code, 'CHAT_UNAVAILABLE');
  await rejects(() => repo.send(1,2,input()), 'CHAT_UNAVAILABLE'); checks++;
  await accept();
  // Exhaust the persistent account quota across simultaneous requests.
  const sent = await Promise.allSettled(Array.from({ length: 60 }, () => repo.send(1,2,input('quota'))));
  assert.equal(sent.some((r) => r.status === 'rejected' && r.reason.code === 'RATE_LIMITED'), true);
  assert.equal(Number((await sql`SELECT count(*) AS n FROM friend_chat_messages WHERE sender_user_id=1`)[0].n), 60); checks++;
  // Query work stays bounded by the indexed conversation and sequence, even for an empty poll.
  const plan = await sql`EXPLAIN (FORMAT JSON) SELECT * FROM friend_chat_messages
    WHERE conversation_id=${first.message.conversationId} AND sequence > 0 ORDER BY sequence LIMIT 51`;
  assert.ok(plan.length); checks++;
  const stickers = createStickerRepository(sql);
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
  const sticker = await stickers.upload(2, gif);
  assert.deepEqual((await stickers.list(2)).map((s) => s.id), [sticker.id]);
  await rejects(() => stickers.image(1, sticker.id), 'CHAT_NOT_FOUND');
  await rejects(() => stickers.save(3, sticker.id, true), 'CHAT_NOT_FOUND');
  const stickerInput = { ...input(CHAT_STICKER_BODY), stickerId: sticker.id };
  const sentSticker = await repo.send(2, 1, stickerInput);
  assert.equal(sentSticker.message.stickerId, sticker.id);
  assert.deepEqual((await stickers.image(1, sticker.id)).data, gif);
  assert.equal((await stickers.image(1, sticker.id)).mime, 'image/gif');
  assert.equal((await repo.conversations(1)).items[0].lastMessage.stickerId, sticker.id);
  assert.equal((await repo.send(2, 1, stickerInput)).replay, true);
  await rejects(() => repo.send(2, 1, { ...stickerInput, stickerId: randomUUID() }), 'IDEMPOTENCY_CONFLICT');
  await rejects(() => repo.send(2, 1, { ...input(CHAT_STICKER_BODY), stickerId: randomUUID() }), 'CHAT_NOT_FOUND');
  await rejects(() => stickers.image(3, sticker.id), 'CHAT_NOT_FOUND');
  assert.equal((await stickers.save(1, sticker.id, true))[0].id, sticker.id);
  await stickers.save(2, sticker.id, false);
  assert.equal((await stickers.list(2)).length, 0);
  assert.deepEqual((await stickers.image(1, sticker.id)).data, gif);
  await sql`DELETE FROM user_friendships WHERE user_low_id=1 AND user_high_id=2`;
  await rejects(() => repo.send(2, 1, { ...input(CHAT_STICKER_BODY), stickerId: sticker.id }), 'CHAT_UNAVAILABLE');
  assert.deepEqual((await stickers.image(1, sticker.id)).data, gif); checks++;
  await sql.begin(async (tx) => {
    await tx`SELECT id FROM app_users WHERE id=1 FOR UPDATE`;
    await tx`DELETE FROM notifications WHERE kind='friend_message' AND dedupe_key IN (
      SELECT 'friend-chat:' || id::text FROM friend_chat_conversations WHERE user_low_id=1 OR user_high_id=1)`;
    await tx`DELETE FROM app_users WHERE id=1`;
  });
  assert.equal((await sql`SELECT * FROM friend_chat_conversations`).length, 0);
  assert.equal((await sql`SELECT * FROM friend_chat_messages`).length, 0);
  assert.equal((await sql`SELECT * FROM notifications`).length, 0); checks++;
  const unused = await stickers.upload(2, gif);
  await stickers.save(3, sticker.id, true).catch((error) => { assert.equal(error.code, 'CHAT_NOT_FOUND'); });
  // Another user's existing favorite survives uploader deletion; unused uploads do not.
  await sql`INSERT INTO friend_chat_sticker_favorites (user_id, sticker_id) VALUES (4, ${sticker.id})`;
  await sql.begin(async (tx) => { await tx`DELETE FROM app_users WHERE id=2`; await purgeOrphanedStickers(tx); });
  assert.equal((await sql`SELECT id FROM friend_chat_stickers WHERE id=${unused.id}`).length, 0);
  assert.deepEqual((await stickers.image(4, sticker.id)).data, gif);
  await stickers.save(4, sticker.id, false);
  assert.equal((await sql`SELECT id FROM friend_chat_stickers`).length, 0); checks++;
  console.log(`friend chat PostgreSQL fixture: ${checks} checks passed`);
} finally {
  await db?.end({ timeout: 5 });
  if (created) await admin.unsafe(`DROP DATABASE "${name}"`);
  await admin.end({ timeout: 5 });
}
