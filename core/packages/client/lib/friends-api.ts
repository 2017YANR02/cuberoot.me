import { sessionFetch } from '@/lib/session-fetch';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

import type { FriendSearchUser, FriendsOverview, WcaFriendContact } from '@cuberoot/shared/friends';
export type { FriendRelationship, FriendUser, FriendSearchUser, FriendsOverview, WcaFriendContact } from '@cuberoot/shared/friends';

async function write(path: string, method: 'POST' | 'DELETE', body?: unknown): Promise<void> {
  const response = await sessionFetch(apiUrl(path), {
    method,
    headers: authHeaders(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  await handleApi<{ ok: boolean }>(response);
}

export async function fetchFriends(): Promise<FriendsOverview> {
  const response = await sessionFetch(apiUrl('/v1/friends'), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  return handleApi<FriendsOverview>(response);
}

export async function searchFriendUsers(q: string): Promise<FriendSearchUser[]> {
  const response = await sessionFetch(apiUrl(`/v1/friends/search?q=${encodeURIComponent(q)}`), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  const result = await handleApi<{ users: FriendSearchUser[] }>(response);
  return result.users;
}

export async function saveWcaFriendContact(contact: WcaFriendContact): Promise<'wca-contact' | 'outgoing' | 'friends'> {
  const response = await sessionFetch(apiUrl('/v1/friends/wca-contacts'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(contact),
  });
  const result = await handleApi<{ ok: boolean; relationship: 'wca-contact' | 'outgoing' | 'friends' }>(response);
  return result.relationship;
}

export const sendFriendRequest = (userId: number) => write('/v1/friends/requests', 'POST', { userId });
export const acceptFriendRequest = (userId: number) => write(`/v1/friends/requests/${userId}/accept`, 'POST');
export const deleteFriendRequest = (userId: number) => write(`/v1/friends/requests/${userId}`, 'DELETE');
export const removeFriend = (userId: number) => write(`/v1/friends/${userId}`, 'DELETE');
export const blockUser = (userId: number) => write('/v1/friends/blocks', 'POST', { userId });
export const unblockUser = (userId: number) => write(`/v1/friends/blocks/${userId}`, 'DELETE');
export const removeWcaFriendContact = (wcaId: string) => write(`/v1/friends/wca-contacts/${encodeURIComponent(wcaId)}`, 'DELETE');
