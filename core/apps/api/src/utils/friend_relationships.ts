import type postgres from 'postgres';
import type { FriendUser } from '@cuberoot/shared/friends';

export interface FriendUserRow {
  id: number | string;
  display_name: string;
  avatar_url: string | null;
  avatar_source: 'auto' | 'clawd' | 'upload';
  avatar_preset: string | null;
  wca_id: string | null;
  merged_into_user_id?: number | string | null;
}
export function friendPair(a: number, b: number): [number, number] { return a < b ? [a, b] : [b, a]; }
export function friendUser(row: FriendUserRow): FriendUser {
  return { userId: Number(row.id), name: row.display_name, avatarUrl: row.avatar_url,
    avatarSource: row.avatar_source, avatarPreset: row.avatar_preset, wcaId: row.wca_id };
}
/** Friend writes and chat writes acquire account locks in the same order. */
export async function lockFriendUsers(tx: postgres.TransactionSql, currentUserId: number, targetUserId: number) {
  const rows = await tx<FriendUserRow[]>`
    SELECT id, display_name, avatar_url, avatar_source, avatar_preset, wca_id, merged_into_user_id
      FROM app_users
     WHERE id = ANY(${[currentUserId, targetUserId]}::bigint[])
     ORDER BY id
     FOR UPDATE`;
  if (rows.length !== 2) return null;
  const current = rows.find((row) => Number(row.id) === currentUserId);
  const target = rows.find((row) => Number(row.id) === targetUserId);
  return current && target && current.merged_into_user_id == null && target.merged_into_user_id == null
    ? { current, target } : null;
}

/** Removal must serialize with sends before it changes the accepted relationship. */
export async function removeAcceptedFriend(tx: postgres.TransactionSql, userId: number, peerId: number): Promise<boolean> {
  if (!await lockFriendUsers(tx, userId, peerId)) return false;
  const [low, high] = friendPair(userId, peerId);
  const rows = await tx`DELETE FROM user_friendships
    WHERE user_low_id = ${low} AND user_high_id = ${high} AND status = 'accepted' RETURNING user_low_id`;
  return rows.length > 0;
}
