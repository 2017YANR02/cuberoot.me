import { decodeWebSessionUserEnvelope } from '@cuberoot/shared/auth/web-session';
import { apiUrl } from './api-base';

export async function verifyPageAdmin(token: string): Promise<boolean> {
  if (!token) return false;
  const response = await fetch(apiUrl('/v1/auth/me'), {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(5000),
  });
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw new Error('Account verification unavailable');
  return decodeWebSessionUserEnvelope(await response.json())?.user.isAdmin === true;
}
