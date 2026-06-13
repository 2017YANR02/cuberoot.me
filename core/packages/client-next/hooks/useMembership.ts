'use client';

/**
 * useMembership — 读取当前登录用户的会员状态(/v1/membership/me)。
 * 仅在客户端、且本地有 WCA 登录 token 时拉取;未登录返回 null。
 * 返回 { membership, isMember(生效中), loading, refresh }。门控付费/会员专属 UI 用。
 */
import { useCallback, useEffect, useState } from 'react';
import { getMyMembership, type Membership } from '@/lib/membership-api';
import { useAuthStore } from '@/lib/auth-store';

function hasToken(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(localStorage.getItem('cuberoot_jwt') || localStorage.getItem('wca_access_token'));
}

export function useMembership() {
  const wcaId = useAuthStore((s) => s.user?.wcaId);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!hasToken()) { setMembership(null); return; }
    setLoading(true);
    getMyMembership()
      .then((r) => setMembership(r.membership))
      .catch(() => setMembership(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh, wcaId]);

  return { membership, isMember: !!membership?.active, loading, refresh };
}
