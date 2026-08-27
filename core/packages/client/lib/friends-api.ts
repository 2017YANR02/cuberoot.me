import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export type FriendRelationship = 'none' | 'incoming' | 'outgoing' | 'friends' | 'blocked';

export interface FriendUser {
  userId: number;
  name: string;
  avatarUrl: string | null;
  avatarSource: 'auto' | 'clawd' | 'upload';
  avatarPreset: string | null;
  wcaId: string | null;
}

export interface FriendSearchUser extends FriendUser {
  relationship: FriendRelationship;
}

export interface FriendsOverview {
  friends: FriendUser[];
  incoming: FriendUser[];
  outgoing: FriendUser[];
  blocked: FriendUser[];
}

async function write(path: string, method: 'POST' | 'DELETE', body?: unknown): Promise<void> {
  const response = await fetch(apiUrl(path), {
    method,
    headers: authHeaders(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  await handleApi<{ ok: boolean }>(response);
}

export async function fetchFriends(): Promise<FriendsOverview> {
  const response = await fetch(apiUrl('/v1/friends'), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  return handleApi<FriendsOverview>(response);
}

export async function searchFriendUsers(q: string): Promise<FriendSearchUser[]> {
  const response = await fetch(apiUrl(`/v1/friends/search?q=${encodeURIComponent(q)}`), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  const result = await handleApi<{ users: FriendSearchUser[] }>(response);
  return result.users;
}

export const sendFriendRequest = (userId: number) => write('/v1/friends/requests', 'POST', { userId });
export const acceptFriendRequest = (userId: number) => write(`/v1/friends/requests/${userId}/accept`, 'POST');
export const deleteFriendRequest = (userId: number) => write(`/v1/friends/requests/${userId}`, 'DELETE');
export const removeFriend = (userId: number) => write(`/v1/friends/${userId}`, 'DELETE');
export const blockUser = (userId: number) => write('/v1/friends/blocks', 'POST', { userId });
export const unblockUser = (userId: number) => write(`/v1/friends/blocks/${userId}`, 'DELETE');
