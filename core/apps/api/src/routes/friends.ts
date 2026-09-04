import { Hono } from 'hono';
import type postgres from 'postgres';
import { sql } from '../db/connection.js';
import { ownerKey } from '../utils/account.js';
import { getIp } from '../utils/analytics_helpers.js';
import { requireAppUserId } from '../utils/app_user_auth.js';
import { notify } from '../utils/notify.js';
import { checkRateLimit } from '../utils/recon_helpers.js';

export const friendRoutes = new Hono();

type Tx = postgres.TransactionSql;

interface UserRow {
  id: number | string;
  display_name: string;
  avatar_url: string | null;
  avatar_source: 'auto' | 'clawd' | 'upload';
  avatar_preset: string | null;
  wca_id: string | null;
}

interface FriendshipRow {
  status: 'pending' | 'accepted';
  requested_by_user_id: number | string;
}

interface WcaContactRow {
  wca_id: string;
  name: string;
  country_iso2: string;
}

interface WcaContactInput {
  wcaId: string;
  name: string;
  countryIso2: string;
}

type FriendRequestResult =
  | { error: 'user not found' | 'friend request unavailable' | 'cannot add yourself' }
  | {
      state: 'friends' | 'outgoing';
      users: { current: UserRow; target: UserRow };
      notifyRequest?: boolean;
      notifyAccepted?: boolean;
    };

const WCA_ID_PATTERN = /^\d{4}[A-Z]{4}\d{2}$/;

function noStore(c: { header: (name: string, value: string) => void }): void {
  c.header('Cache-Control', 'no-store');
}

function parseUserId(value: unknown): number | null {
  const id = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function pair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

async function revokeVaultAccess(tx: Tx, userId: number, targetUserId: number): Promise<void> {
  await tx`
    DELETE FROM vault_item_access access
     USING vault_items item
     WHERE access.item_id = item.id
       AND ((item.owner_user_id = ${userId} AND access.recipient_user_id = ${targetUserId})
         OR (item.owner_user_id = ${targetUserId} AND access.recipient_user_id = ${userId}))`;
}

function parseWcaContact(value: unknown): WcaContactInput | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const wcaId = typeof input.wcaId === 'string' ? input.wcaId.trim().toUpperCase() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const countryIso2 = typeof input.countryIso2 === 'string' ? input.countryIso2.trim().toLowerCase() : '';
  if (!WCA_ID_PATTERN.test(wcaId) || !name || name.length > 200 || !/^[a-z]{2}$/.test(countryIso2)) {
    return null;
  }
  return { wcaId, name, countryIso2 };
}

function toUser(row: UserRow) {
  return {
    userId: Number(row.id),
    name: row.display_name,
    avatarUrl: row.avatar_url,
    avatarSource: row.avatar_source,
    avatarPreset: row.avatar_preset,
    wcaId: row.wca_id,
  };
}

function keyFor(row: UserRow): string {
  return ownerKey(Number(row.id), row.wca_id);
}

async function lockedUsers(
  tx: Tx,
  currentUserId: number,
  targetUserId: number,
): Promise<{ current: UserRow; target: UserRow } | null> {
  const rows = await tx<UserRow[]>`
    SELECT id, display_name, avatar_url, avatar_source, avatar_preset, wca_id
      FROM app_users
     WHERE id = ANY(${[currentUserId, targetUserId]}::bigint[])
     ORDER BY id
     FOR UPDATE`;
  if (rows.length !== 2) return null;
  const current = rows.find((row) => Number(row.id) === currentUserId);
  const target = rows.find((row) => Number(row.id) === targetUserId);
  return current && target ? { current, target } : null;
}

async function requestFriend(tx: Tx, currentUserId: number, targetUserId: number): Promise<FriendRequestResult> {
  if (currentUserId === targetUserId) return { error: 'cannot add yourself' };
  const [low, high] = pair(currentUserId, targetUserId);
  const users = await lockedUsers(tx, currentUserId, targetUserId);
  if (!users) return { error: 'user not found' };
  const blocks = await tx`
    SELECT 1 FROM user_blocks
     WHERE (blocker_user_id = ${currentUserId} AND blocked_user_id = ${targetUserId})
        OR (blocker_user_id = ${targetUserId} AND blocked_user_id = ${currentUserId})
     LIMIT 1`;
  if (blocks.length) return { error: 'friend request unavailable' };

  const clearSavedContact = async () => {
    if (!users.target.wca_id) return;
    await tx`
      DELETE FROM user_wca_friend_contacts
       WHERE owner_user_id = ${currentUserId}
         AND wca_id = ${users.target.wca_id.toUpperCase()}`;
  };
  const rows = await tx<FriendshipRow[]>`
    SELECT status, requested_by_user_id
      FROM user_friendships
     WHERE user_low_id = ${low} AND user_high_id = ${high}
     FOR UPDATE`;
  const existing = rows[0];
  if (existing?.status === 'accepted') {
    await clearSavedContact();
    return { state: 'friends', users };
  }
  if (existing && Number(existing.requested_by_user_id) === currentUserId) {
    await clearSavedContact();
    return { state: 'outgoing', users };
  }
  if (existing) {
    await tx`
      UPDATE user_friendships
         SET status = 'accepted', responded_at = NOW()
       WHERE user_low_id = ${low} AND user_high_id = ${high}`;
    await tx`
      UPDATE notifications SET read_at = COALESCE(read_at, NOW())
       WHERE user_key = ${keyFor(users.current)} AND actor_key = ${keyFor(users.target)}
         AND kind = 'friend_request'`;
    await clearSavedContact();
    return { state: 'friends', users, notifyAccepted: true };
  }
  await tx`
    INSERT INTO user_friendships (user_low_id, user_high_id, requested_by_user_id)
    VALUES (${low}, ${high}, ${currentUserId})`;
  await clearSavedContact();
  return { state: 'outgoing', users, notifyRequest: true };
}

async function notifyFriendRequest(result: Exclude<FriendRequestResult, { error: string }>): Promise<void> {
  if (result.notifyRequest) {
    await notify({
      recipients: [keyFor(result.users.target)],
      kind: 'friend_request',
      actorKey: keyFor(result.users.current),
      actorName: result.users.current.display_name,
      title: '好友 / Friends',
      excerpt: '',
      link: '/friends?view=requests',
    });
  } else if (result.notifyAccepted) {
    await notify({
      recipients: [keyFor(result.users.target)],
      kind: 'friend_accepted',
      actorKey: keyFor(result.users.current),
      actorName: result.users.current.display_name,
      title: '好友 / Friends',
      excerpt: '',
      link: '/friends',
    });
  }
}

friendRoutes.get('/friends', async (c) => {
  noStore(c);
  const userId = await requireAppUserId(c);
  const [friends, incoming, outgoing, blocked, wcaContacts] = await Promise.all([
    sql<UserRow[]>`
      SELECT u.id, u.display_name, u.avatar_url, u.avatar_source, u.avatar_preset, u.wca_id
        FROM user_friendships f
        JOIN app_users u ON u.id = CASE
          WHEN f.user_low_id = ${userId} THEN f.user_high_id ELSE f.user_low_id END
       WHERE f.status = 'accepted'
         AND (f.user_low_id = ${userId} OR f.user_high_id = ${userId})
       ORDER BY lower(u.display_name), u.id`,
    sql<UserRow[]>`
      SELECT u.id, u.display_name, u.avatar_url, u.avatar_source, u.avatar_preset, u.wca_id
        FROM user_friendships f
        JOIN app_users u ON u.id = f.requested_by_user_id
       WHERE f.status = 'pending'
         AND f.requested_by_user_id <> ${userId}
         AND (f.user_low_id = ${userId} OR f.user_high_id = ${userId})
       ORDER BY f.created_at DESC`,
    sql<UserRow[]>`
      SELECT u.id, u.display_name, u.avatar_url, u.avatar_source, u.avatar_preset, u.wca_id
        FROM user_friendships f
        JOIN app_users u ON u.id = CASE
          WHEN f.user_low_id = ${userId} THEN f.user_high_id ELSE f.user_low_id END
       WHERE f.status = 'pending'
         AND f.requested_by_user_id = ${userId}
       ORDER BY f.created_at DESC`,
    sql<UserRow[]>`
      SELECT u.id, u.display_name, u.avatar_url, u.avatar_source, u.avatar_preset, u.wca_id
        FROM user_blocks b
        JOIN app_users u ON u.id = b.blocked_user_id
       WHERE b.blocker_user_id = ${userId}
       ORDER BY b.created_at DESC`,
    sql<WcaContactRow[]>`
      SELECT wca_id, name, country_iso2
        FROM user_wca_friend_contacts
       WHERE owner_user_id = ${userId}
       ORDER BY created_at DESC, wca_id`,
  ]);
  return c.json({
    friends: friends.map(toUser),
    incoming: incoming.map(toUser),
    outgoing: outgoing.map(toUser),
    blocked: blocked.map(toUser),
    wcaContacts: wcaContacts.map((row) => ({
      wcaId: row.wca_id,
      name: row.name,
      countryIso2: row.country_iso2,
    })),
  });
});

friendRoutes.get('/friends/search', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'friends-search', max: 60 });
  const userId = await requireAppUserId(c);
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  if (q.length < 2 && !/^\d+$/.test(q)) return c.json({ users: [] });
  const numericId = parseUserId(q);
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const rows = await sql<(UserRow & { relationship: string })[]>`
    SELECT u.id, u.display_name, u.avatar_url, u.avatar_source, u.avatar_preset, u.wca_id,
           CASE
             WHEN mine.blocker_user_id IS NOT NULL THEN 'blocked'
             WHEN f.status = 'accepted' THEN 'friends'
             WHEN f.status = 'pending' AND f.requested_by_user_id = ${userId} THEN 'outgoing'
             WHEN f.status = 'pending' THEN 'incoming'
             ELSE 'none'
           END AS relationship
      FROM app_users u
      LEFT JOIN user_blocks mine
        ON mine.blocker_user_id = ${userId} AND mine.blocked_user_id = u.id
      LEFT JOIN user_friendships f
        ON f.user_low_id = LEAST(${userId}, u.id)
       AND f.user_high_id = GREATEST(${userId}, u.id)
     WHERE u.id <> ${userId}
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks hidden
          WHERE hidden.blocker_user_id = u.id AND hidden.blocked_user_id = ${userId}
       )
       AND (
         (${numericId}::bigint IS NOT NULL AND u.id = ${numericId})
         OR u.display_name ILIKE ${like} ESCAPE '\\'
         OR u.wca_id ILIKE ${like} ESCAPE '\\'
       )
     ORDER BY CASE WHEN u.id = ${numericId} THEN 0 ELSE 1 END,
              CASE WHEN lower(u.display_name) = lower(${q}) THEN 0 ELSE 1 END,
              lower(u.display_name), u.id
     LIMIT 20`;
  return c.json({
    users: rows.map((row) => ({ ...toUser(row), relationship: row.relationship })),
  });
});

friendRoutes.post('/friends/requests', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'friends-write', max: 30 });
  const userId = await requireAppUserId(c);
  const body: { userId?: unknown } = await c.req.json<{ userId?: unknown }>().catch(() => ({}));
  const targetUserId = parseUserId(body.userId);
  if (!targetUserId) return c.json({ error: 'valid userId is required' }, 400);
  if (targetUserId === userId) return c.json({ error: 'cannot add yourself' }, 400);
  const result = await sql.begin((tx) => requestFriend(tx, userId, targetUserId));

  if ('error' in result) {
    return c.json({ error: result.error }, result.error === 'user not found' ? 404 : 409);
  }
  await notifyFriendRequest(result);
  return c.json({ ok: true, relationship: result.state });
});

friendRoutes.post('/friends/wca-contacts', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'friends-write', max: 30 });
  const userId = await requireAppUserId(c);
  const body = await c.req.json<unknown>().catch(() => null);
  const contact = parseWcaContact(body);
  if (!contact) return c.json({ error: 'valid WCA person is required' }, 400);

  const result = await sql.begin(async (tx) => {
    const registered = await tx<UserRow[]>`
      SELECT id, display_name, avatar_url, avatar_source, avatar_preset, wca_id
        FROM app_users
       WHERE upper(wca_id) = ${contact.wcaId}
       LIMIT 1
       FOR UPDATE`;
    const target = registered[0];
    if (target) return requestFriend(tx, userId, Number(target.id));
    await tx`
      INSERT INTO user_wca_friend_contacts (owner_user_id, wca_id, name, country_iso2)
      VALUES (${userId}, ${contact.wcaId}, ${contact.name}, ${contact.countryIso2})
      ON CONFLICT (owner_user_id, wca_id) DO UPDATE
        SET name = EXCLUDED.name, country_iso2 = EXCLUDED.country_iso2`;
    return { state: 'wca-contact' as const };
  });

  if ('error' in result) {
    return c.json({ error: result.error }, result.error === 'user not found' ? 404 : 409);
  }
  if (result.state === 'wca-contact') {
    return c.json({ ok: true, relationship: result.state });
  }
  await notifyFriendRequest(result);
  return c.json({ ok: true, relationship: result.state });
});

friendRoutes.delete('/friends/wca-contacts/:wcaId', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'friends-write', max: 30 });
  const userId = await requireAppUserId(c);
  const wcaId = c.req.param('wcaId').trim().toUpperCase();
  if (!WCA_ID_PATTERN.test(wcaId)) return c.json({ error: 'invalid WCA ID' }, 400);
  const rows = await sql`
    DELETE FROM user_wca_friend_contacts
     WHERE owner_user_id = ${userId} AND wca_id = ${wcaId}
     RETURNING owner_user_id`;
  if (!rows.length) return c.json({ error: 'WCA friend entry not found' }, 404);
  return c.json({ ok: true });
});

friendRoutes.post('/friends/requests/:userId/accept', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'friends-write', max: 30 });
  const userId = await requireAppUserId(c);
  const targetUserId = parseUserId(c.req.param('userId'));
  if (!targetUserId || targetUserId === userId) return c.json({ error: 'invalid userId' }, 400);
  const [low, high] = pair(userId, targetUserId);
  const result = await sql.begin(async (tx) => {
    const users = await lockedUsers(tx, userId, targetUserId);
    if (!users) return null;
    const rows = await tx<FriendshipRow[]>`
      UPDATE user_friendships
         SET status = 'accepted', responded_at = NOW()
       WHERE user_low_id = ${low} AND user_high_id = ${high}
         AND status = 'pending' AND requested_by_user_id = ${targetUserId}
       RETURNING status, requested_by_user_id`;
    if (!rows.length) return null;
    await tx`
      UPDATE notifications SET read_at = COALESCE(read_at, NOW())
       WHERE user_key = ${keyFor(users.current)} AND actor_key = ${keyFor(users.target)}
         AND kind = 'friend_request'`;
    return users;
  });
  if (!result) return c.json({ error: 'incoming friend request not found' }, 404);
  await notify({
    recipients: [keyFor(result.target)],
    kind: 'friend_accepted',
    actorKey: keyFor(result.current),
    actorName: result.current.display_name,
    title: '好友 / Friends',
    excerpt: '',
    link: '/friends',
  });
  return c.json({ ok: true, relationship: 'friends' });
});

friendRoutes.delete('/friends/requests/:userId', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'friends-write', max: 30 });
  const userId = await requireAppUserId(c);
  const targetUserId = parseUserId(c.req.param('userId'));
  if (!targetUserId || targetUserId === userId) return c.json({ error: 'invalid userId' }, 400);
  const [low, high] = pair(userId, targetUserId);
  const result = await sql.begin(async (tx) => {
    const users = await lockedUsers(tx, userId, targetUserId);
    if (!users) return false;
    const rows = await tx`
      DELETE FROM user_friendships
       WHERE user_low_id = ${low} AND user_high_id = ${high} AND status = 'pending'
       RETURNING requested_by_user_id`;
    if (!rows.length) return false;
    await tx`
      DELETE FROM notifications
       WHERE kind = 'friend_request'
         AND ((user_key = ${keyFor(users.current)} AND actor_key = ${keyFor(users.target)})
           OR (user_key = ${keyFor(users.target)} AND actor_key = ${keyFor(users.current)}))`;
    return true;
  });
  if (!result) return c.json({ error: 'friend request not found' }, 404);
  return c.json({ ok: true, relationship: 'none' });
});

friendRoutes.delete('/friends/:userId', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'friends-write', max: 30 });
  const userId = await requireAppUserId(c);
  const targetUserId = parseUserId(c.req.param('userId'));
  if (!targetUserId || targetUserId === userId) return c.json({ error: 'invalid userId' }, 400);
  const [low, high] = pair(userId, targetUserId);
  const removed = await sql.begin(async (tx) => {
    const rows = await tx`
      DELETE FROM user_friendships
       WHERE user_low_id = ${low} AND user_high_id = ${high} AND status = 'accepted'
       RETURNING user_low_id`;
    if (!rows.length) return false;
    await revokeVaultAccess(tx, userId, targetUserId);
    return true;
  });
  if (!removed) return c.json({ error: 'friend not found' }, 404);
  return c.json({ ok: true, relationship: 'none' });
});

friendRoutes.post('/friends/blocks', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'friends-write', max: 30 });
  const userId = await requireAppUserId(c);
  const body: { userId?: unknown } = await c.req.json<{ userId?: unknown }>().catch(() => ({}));
  const targetUserId = parseUserId(body.userId);
  if (!targetUserId) return c.json({ error: 'valid userId is required' }, 400);
  if (targetUserId === userId) return c.json({ error: 'cannot block yourself' }, 400);
  const [low, high] = pair(userId, targetUserId);
  const result = await sql.begin(async (tx) => {
    const users = await lockedUsers(tx, userId, targetUserId);
    if (!users) return null;
    await tx`
      INSERT INTO user_blocks (blocker_user_id, blocked_user_id)
      VALUES (${userId}, ${targetUserId})
      ON CONFLICT DO NOTHING`;
    await tx`
      DELETE FROM user_friendships
       WHERE user_low_id = ${low} AND user_high_id = ${high}`;
    await revokeVaultAccess(tx, userId, targetUserId);
    if (users.target.wca_id) {
      await tx`
        DELETE FROM user_wca_friend_contacts
         WHERE owner_user_id = ${userId}
           AND wca_id = ${users.target.wca_id.toUpperCase()}`;
    }
    await tx`
      DELETE FROM notifications
       WHERE kind IN ('friend_request', 'friend_accepted')
         AND ((user_key = ${keyFor(users.current)} AND actor_key = ${keyFor(users.target)})
           OR (user_key = ${keyFor(users.target)} AND actor_key = ${keyFor(users.current)}))`;
    return true;
  });
  if (!result) return c.json({ error: 'user not found' }, 404);
  return c.json({ ok: true, relationship: 'blocked' });
});

friendRoutes.delete('/friends/blocks/:userId', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c), { bucket: 'friends-write', max: 30 });
  const userId = await requireAppUserId(c);
  const targetUserId = parseUserId(c.req.param('userId'));
  if (!targetUserId || targetUserId === userId) return c.json({ error: 'invalid userId' }, 400);
  const rows = await sql`
    DELETE FROM user_blocks
     WHERE blocker_user_id = ${userId} AND blocked_user_id = ${targetUserId}
     RETURNING blocker_user_id`;
  if (!rows.length) return c.json({ error: 'blocked user not found' }, 404);
  return c.json({ ok: true, relationship: 'none' });
});
