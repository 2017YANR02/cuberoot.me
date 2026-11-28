import { useEffect, useState } from 'react';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { apiUrl } from '@/lib/api-base';
import { getAuthUser, hasAdminAccess, type WcaUser } from '@/lib/auth-store';
import { sessionFetch } from '@/lib/session-fetch';
import { listTeachingLearningContexts } from '@/lib/teaching-saas-api';

type CardAccess = { learning?: boolean; vault?: boolean; workspace?: boolean };

export function useAccountCardAccess(user: WcaUser | null) {
  const admin = hasAdminAccess(user);
  const [result, setResult] = useState<{ user: WcaUser; access: CardAccess }>();

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const request: RequestInit = {
      headers: authHeaders(false),
      cache: 'no-store',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
    };
    const check = async (card: keyof CardAccess, read: () => Promise<boolean>) => {
      const allowed = await read().catch(() => false);
      if (controller.signal.aborted || getAuthUser() !== user) return;
      setResult(previous => ({
        user,
        access: { ...(previous?.user === user ? previous.access : {}), [card]: allowed },
      }));
    };

    void check('learning', async () => (await listTeachingLearningContexts()).length > 0);
    if (!admin) {
      void check('workspace', async () => {
        const response = await sessionFetch(apiUrl('/v1/workspace/member-request'), request);
        return (await handleApi<{ status: string }>(response)).status === 'enabled';
      });
      void check('vault', async () => {
        const response = await sessionFetch(apiUrl('/v1/vault/availability'), request);
        return (await handleApi<{ available: boolean }>(response)).available === true;
      });
    }
    return () => controller.abort();
  }, [admin, user]);

  const access = result?.user === user ? result.access : undefined;
  return {
    learning: access?.learning === true,
    vault: admin || access?.vault === true,
    workspace: admin || access?.workspace === true,
  };
}
