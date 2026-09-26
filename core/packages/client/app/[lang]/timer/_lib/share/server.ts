import type { Solve } from '@cuberoot/shared/timer';
import { apiUrl } from '@/lib/api-base';
import { getSessionToken } from '@/lib/auth-store';

export async function createServerReplayShare(solve: Solve): Promise<string | null> {
  const token = getSessionToken();
  if (!token) return null;
  const response = await fetch(apiUrl('/v1/timer/replay-shares'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ solve }),
  });
  if (!response.ok) throw new Error(`Replay share failed: HTTP ${response.status}`);
  const data = await response.json() as { id?: string };
  if (!data.id) throw new Error('Replay share response was invalid');
  return data.id;
}

export async function fetchServerReplayShare(id: string): Promise<Solve | null> {
  if (!/^[A-Za-z0-9_-]{8,16}$/.test(id)) return null;
  const response = await fetch(apiUrl(`/v1/timer/replay-shares/${id}`), { cache: 'no-store' });
  if (!response.ok) return null;
  const data = await response.json() as { solve?: Solve };
  return data.solve && typeof data.solve === 'object' ? data.solve : null;
}
