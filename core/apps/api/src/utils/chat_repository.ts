import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { sql as database } from '../db/connection.js';
import { ownerKey } from './account.js';
import { friendPair, friendUser, lockFriendUsers, type FriendUserRow } from './friend_relationships.js';
import { ChatError, isChatSequence, isChatUuid, normalizeChatBody,
  type ChatMessage, type ChatMessagesPage, type ChatConversationsPage, type ChatSendInput,
  type ChatReadResult, type ChatPageInput } from '@cuberoot/shared/chat';

type Tx = postgres.TransactionSql;
interface ConversationRow {
  id: string; user_low_id: string | number; user_high_id: string | number;
  last_sequence: string; low_read_sequence: string; high_read_sequence: string;
  last_message_at: Date;
}
interface MessageRow { conversation_id: string; sequence: string; sender_user_id: string | number;
  client_message_id: string; body: string; created_at: Date }
type ConversationListRow = ConversationRow & MessageRow & Omit<FriendUserRow, 'id'> & {
  peer_id: string | number; unread_count: string; can_send: boolean;
};
const toMessage = (m: MessageRow): ChatMessage => ({ conversationId: m.conversation_id, sequence: String(m.sequence),
  senderUserId: Number(m.sender_user_id), clientMessageId: m.client_message_id, body: m.body, createdAt: m.created_at.toISOString() });
const readSequence = (c: ConversationRow, uid: number) => String(Number(c.user_low_id) === uid ? c.low_read_sequence : c.high_read_sequence);
async function canSend(tx: Tx, uid: number, peer: number): Promise<boolean> {
  const [low, high] = friendPair(uid, peer);
  const rows = await tx`SELECT 1 FROM user_friendships f
    WHERE f.user_low_id = ${low} AND f.user_high_id = ${high} AND f.status = 'accepted'
      AND NOT EXISTS (SELECT 1 FROM user_blocks b
        WHERE (b.blocker_user_id = ${uid} AND b.blocked_user_id = ${peer})
           OR (b.blocker_user_id = ${peer} AND b.blocked_user_id = ${uid}))`;
  return rows.length > 0;
}
async function conversation(tx: Tx, uid: number, peer: number, lock = false) {
  const [low, high] = friendPair(uid, peer);
  const rows = lock
    ? await tx<ConversationRow[]>`SELECT * FROM friend_chat_conversations WHERE user_low_id = ${low} AND user_high_id = ${high} FOR UPDATE`
    : await tx<ConversationRow[]>`SELECT * FROM friend_chat_conversations WHERE user_low_id = ${low} AND user_high_id = ${high}`;
  return rows[0] ?? null;
}
async function peerUser(tx: Tx, peer: number): Promise<FriendUserRow> {
  const rows = await tx<FriendUserRow[]>`SELECT id, display_name, avatar_url, avatar_source, avatar_preset, wca_id
    FROM app_users WHERE id = ${peer} AND merged_into_user_id IS NULL`;
  if (!rows[0]) throw new ChatError('CHAT_NOT_FOUND');
  return rows[0];
}
async function unread(tx: Tx, c: ConversationRow, uid: number) {
  const rows = await tx<{ count: string }[]>`SELECT count(*)::text AS count FROM friend_chat_messages
    WHERE conversation_id = ${c.id} AND sender_user_id <> ${uid} AND sequence > ${readSequence(c, uid)}`;
  return Number(rows[0].count);
}
function validatePeer(uid: number, peer: number) {
  if (!Number.isSafeInteger(peer) || peer <= 0 || peer === uid) throw new ChatError('CHAT_NOT_FOUND');
}
export function createChatRepository(db: typeof database = database) {
  return {
    async messages(uid: number, peer: number, page: ChatPageInput = {}): Promise<ChatMessagesPage> {
      validatePeer(uid, peer);
      const limit = page.limit ?? 50;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (page.before !== undefined && page.after !== undefined)
        || (page.before !== undefined && !isChatSequence(page.before)) || (page.after !== undefined && !isChatSequence(page.after))) throw new ChatError('INVALID_INPUT');
      return await db.begin('isolation level repeatable read read only', async (tx) => {
        const c = await conversation(tx, uid, peer);
        const allowed = await canSend(tx, uid, peer);
        if (!c && !allowed) throw new ChatError('CHAT_NOT_FOUND');
        const user = friendUser(await peerUser(tx, peer));
        if (!c) return { conversationId: null, peer: user, items: [], canSend: true, myReadSequence: '0',
          lastSequence: '0', oldestSequence: null, nextAfterSequence: '0', hasMore: false };
        const rows = page.after !== undefined
          ? await tx<MessageRow[]>`SELECT * FROM friend_chat_messages WHERE conversation_id = ${c.id} AND sequence > ${page.after} ORDER BY sequence LIMIT ${limit + 1}`
          : await tx<MessageRow[]>`SELECT * FROM friend_chat_messages WHERE conversation_id = ${c.id}
              AND (${page.before ?? null}::bigint IS NULL OR sequence < ${page.before ?? null}::bigint) ORDER BY sequence DESC LIMIT ${limit + 1}`;
        const visible = rows.slice(0, limit);
        if (page.after === undefined) visible.reverse();
        const items = visible.map(toMessage);
        return { conversationId: c.id, peer: user, items, canSend: allowed, myReadSequence: readSequence(c, uid),
          lastSequence: String(c.last_sequence), oldestSequence: items[0]?.sequence ?? null,
          nextAfterSequence: items.at(-1)?.sequence ?? page.after ?? '0', hasMore: rows.length > limit };
      }) as ChatMessagesPage;
    },
    async conversations(uid: number, cursor?: string, limit = 30): Promise<ChatConversationsPage> {
      let time: string | null = null;
      let id: string | null = null;
      if (cursor !== undefined) {
        const parts = cursor.split('|');
        if (parts.length !== 2 || !/^\d{4}-\d{2}-\d{2}T/.test(parts[0]) || !Number.isFinite(Date.parse(parts[0])) || !isChatUuid(parts[1])) throw new ChatError('INVALID_INPUT');
        [time, id] = parts;
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ChatError('INVALID_INPUT');
      return await db.begin('isolation level repeatable read read only', async (tx) => {
        const rows = await tx<ConversationListRow[]>`SELECT c.*, m.conversation_id, m.sequence, m.sender_user_id,
            m.client_message_id, m.body, m.created_at,
            u.id AS peer_id, u.display_name, u.avatar_url, u.avatar_source, u.avatar_preset, u.wca_id,
            (SELECT count(*)::text FROM friend_chat_messages unread
              WHERE unread.conversation_id = c.id AND unread.sender_user_id <> ${uid}
                AND unread.sequence > CASE WHEN c.user_low_id = ${uid} THEN c.low_read_sequence ELSE c.high_read_sequence END) AS unread_count,
            (EXISTS (SELECT 1 FROM user_friendships f WHERE f.user_low_id = c.user_low_id AND f.user_high_id = c.user_high_id AND f.status = 'accepted')
              AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_user_id = ${uid} AND b.blocked_user_id = u.id)
                OR (b.blocker_user_id = u.id AND b.blocked_user_id = ${uid}))) AS can_send
          FROM friend_chat_conversations c
          JOIN app_users u ON u.id = CASE WHEN c.user_low_id = ${uid} THEN c.user_high_id ELSE c.user_low_id END
            AND u.merged_into_user_id IS NULL
          JOIN friend_chat_messages m ON m.conversation_id = c.id AND m.sequence = c.last_sequence
          WHERE (c.user_low_id = ${uid} OR c.user_high_id = ${uid}) AND c.last_sequence > 0
            AND (${time}::timestamptz IS NULL OR (c.last_message_at, c.id) < (${time}::timestamptz, ${id}::uuid))
          ORDER BY c.last_message_at DESC, c.id DESC LIMIT ${limit + 1}`;
        const selected = rows.slice(0, limit);
        const items = selected.map((c) => ({ id: c.id, peer: friendUser({ ...c, id: c.peer_id }), lastMessage: toMessage(c),
          lastSequence: String(c.last_sequence), myReadSequence: readSequence(c, uid), unreadCount: Number(c.unread_count), canSend: c.can_send }));
        const tail = selected.at(-1);
        return { items, nextCursor: rows.length > limit && tail ? `${tail.last_message_at.toISOString()}|${tail.id}` : null };
      }) as ChatConversationsPage;
    },
    async send(uid: number, peer: number, input: ChatSendInput): Promise<{ message: ChatMessage; replay: boolean }> {
      validatePeer(uid, peer);
      const body = normalizeChatBody(input.body);
      if (!body || !isChatUuid(input.clientMessageId)) throw new ChatError('INVALID_INPUT');
      return await db.begin(async (tx) => {
        const users = await lockFriendUsers(tx, uid, peer);
        if (!users) throw new ChatError('CHAT_NOT_FOUND');
        let c = await conversation(tx, uid, peer, true);
        if (c) {
          const old = await tx<MessageRow[]>`SELECT * FROM friend_chat_messages WHERE conversation_id = ${c.id}
            AND sender_user_id = ${uid} AND client_message_id = ${input.clientMessageId}`;
          if (old[0]) {
            if (old[0].body !== body) throw new ChatError('IDEMPOTENCY_CONFLICT');
            return { message: toMessage(old[0]), replay: true };
          }
        }
        if (!await canSend(tx, uid, peer)) throw new ChatError('CHAT_UNAVAILABLE');
        const recent = await tx`SELECT 1 FROM friend_chat_messages WHERE sender_user_id = ${uid}
          AND created_at > clock_timestamp() - INTERVAL '60 seconds' LIMIT 60`;
        if (recent.length >= 60) throw new ChatError('RATE_LIMITED', 60_000);
        if (!c) {
          const [low, high] = friendPair(uid, peer);
          const rows = await tx<ConversationRow[]>`INSERT INTO friend_chat_conversations (id, user_low_id, user_high_id)
            VALUES (${randomUUID()}, ${low}, ${high}) RETURNING *`;
          c = rows[0];
        }
        const sequence = await tx<{ last_sequence: string; last_message_at: Date }[]>`UPDATE friend_chat_conversations
          SET last_sequence = last_sequence + 1, last_message_at = date_trunc('milliseconds', clock_timestamp())
          WHERE id = ${c.id} RETURNING last_sequence, last_message_at`;
        const rows = await tx<MessageRow[]>`INSERT INTO friend_chat_messages (conversation_id, sequence, sender_user_id, client_message_id, body, created_at)
          VALUES (${c.id}, ${sequence[0].last_sequence}, ${uid}, ${input.clientMessageId}, ${body}, ${sequence[0].last_message_at}) RETURNING *`;
        await tx`INSERT INTO notifications (user_key, kind, actor_key, actor_name, title, excerpt, link, dedupe_key)
          VALUES (${ownerKey(peer, users.target.wca_id)}, 'friend_message', ${ownerKey(uid, users.current.wca_id)},
            ${users.current.display_name.slice(0, 100)}, '好友聊天 / Friend chat', '', ${`/friends?view=chats&peer=${uid}`}, ${`friend-chat:${c.id}`})
          ON CONFLICT (user_key, kind, dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE
          SET actor_key = EXCLUDED.actor_key, actor_name = EXCLUDED.actor_name, link = EXCLUDED.link,
              read_at = NULL, created_at = clock_timestamp()`;
        return { message: toMessage(rows[0]), replay: false };
      }) as { message: ChatMessage; replay: boolean };
    },
    async read(uid: number, peer: number, through: string): Promise<ChatReadResult> {
      validatePeer(uid, peer);
      if (!isChatSequence(through)) throw new ChatError('INVALID_INPUT');
      return await db.begin(async (tx) => {
        const users = await lockFriendUsers(tx, uid, peer);
        if (!users) throw new ChatError('CHAT_NOT_FOUND');
        const c = await conversation(tx, uid, peer, true);
        if (!c) throw new ChatError('CHAT_NOT_FOUND');
        if (BigInt(through) > BigInt(c.last_sequence)) throw new ChatError('INVALID_INPUT');
        const rows = await tx<ConversationRow[]>`UPDATE friend_chat_conversations SET
          low_read_sequence = CASE WHEN user_low_id = ${uid} THEN GREATEST(low_read_sequence, ${through}::bigint) ELSE low_read_sequence END,
          high_read_sequence = CASE WHEN user_high_id = ${uid} THEN GREATEST(high_read_sequence, ${through}::bigint) ELSE high_read_sequence END
          WHERE id = ${c.id} RETURNING *`;
        if (BigInt(through) >= BigInt(c.last_sequence)) await tx`UPDATE notifications SET read_at = COALESCE(read_at, NOW())
          WHERE user_key = ${ownerKey(uid, users.current.wca_id)} AND kind = 'friend_message' AND dedupe_key = ${`friend-chat:${c.id}`}`;
        return { myReadSequence: readSequence(rows[0], uid), unreadCount: await unread(tx, rows[0], uid) };
      }) as ChatReadResult;
    },
  };
}
export const chatRepository = createChatRepository();
