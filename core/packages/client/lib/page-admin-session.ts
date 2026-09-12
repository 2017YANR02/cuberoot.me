import { decodeWebSessionUserEnvelope } from '@cuberoot/shared/auth/web-session';
import { apiUrl } from './api-base';
import { isForumReplyProfileComplete, type AccountBasicProfile } from '@cuberoot/shared/account';

export type ForumPageAccess = 'allowed' | 'login' | 'banned' | 'profile';

/** Use the saved forum profile and its existing completeness rule, never browser claims. */
export async function verifyForumPageAccess(token: string): Promise<ForumPageAccess> {
  if (!token) return 'login';
  const response = await fetch(apiUrl('/v1/auth/profile?v=2'), {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(5000),
  });
  if (response.status === 401) return 'login';
  if (!response.ok) throw new Error('Account verification unavailable');
  const { profile } = await response.json() as { profile?: AccountBasicProfile };
  if (!profile) throw new Error('Account profile unavailable');
  if (profile.forumBanned) return 'banned';
  return profile.forumProfileExempt === true
    || isForumReplyProfileComplete(profile, new Date().toISOString().slice(0, 10)) ? 'allowed' : 'profile';
}

export function isCompSimPage(pathname: string): boolean {
  const path = decodeURIComponent(pathname).replace(/^\/(en|zh)(?=\/|$)/, '');
  return path === '/comp-sim' || path.startsWith('/comp-sim/');
}

export async function verifyPageRole(token: string, requestId?: string): Promise<'login' | 'user' | 'admin'> {
  if (!token) return 'login';
  const response = await fetch(apiUrl('/v1/auth/me'), {
    headers: { Authorization: `Bearer ${token}`, ...(requestId ? { 'X-Request-ID': requestId } : {}) }, cache: 'no-store', signal: AbortSignal.timeout(5000),
  });
  if (response.status === 401 || response.status === 403) return 'login';
  if (!response.ok) throw new Error('Account verification unavailable');
  const session = decodeWebSessionUserEnvelope(await response.json());
  if (!session) throw new Error('Invalid account response');
  return session.user.isAdmin === true ? 'admin' : 'user';
}

export async function verifyPageAdmin(token: string, requestId?: string): Promise<boolean> {
  return await verifyPageRole(token, requestId) === 'admin';
}
