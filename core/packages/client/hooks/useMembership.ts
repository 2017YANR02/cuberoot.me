'use client';

/**
 * useMembership — 读取当前登录用户的会员状态(/v1/membership/me)。
 * 仅在客户端、且本地有 WCA 登录 token 时拉取;未登录返回 null。
 * 返回会员记录、可编辑公开资料和会员访问权。门控付费/会员专属 UI 用。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { getMyMembership, type EditableMemberProfile, type Membership } from '@/lib/membership-api';
import { useAuthUser, getSessionToken, getWcaToken } from '@/lib/auth-store';

function currentToken(): string {
  if (typeof window === 'undefined') return '';
  return getSessionToken() || getWcaToken();
}

export function useMembership() {
  const user = useAuthUser();
  const wcaId = user?.wcaId;
  const uid = user?.uid;
  const admin = isAdminWcaId(wcaId);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [profile, setProfile] = useState<EditableMemberProfile | null>(null);
  const [memberAccess, setMemberAccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  const refresh = useCallback(() => {
    const version = ++request.current;
    const token = currentToken();
    const isCurrent = () => request.current === version && currentToken() === token;
    if (!token) {
      setMembership(null);
      setProfile(null);
      setMemberAccess(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    getMyMembership()
      .then((r) => {
        if (!isCurrent()) return;
        setMembership(r.membership);
        setProfile(r.profile ?? r.membership);
        setMemberAccess(r.isMember ?? !!r.membership?.active);
      })
      .catch(() => {
        if (!isCurrent()) return;
        setMembership(null);
        setProfile(null);
        setMemberAccess(false);
      })
      .finally(() => { if (isCurrent()) setLoading(false); });
  }, []);

  useEffect(() => {
    setMembership(null);
    setProfile(null);
    setMemberAccess(false);
    refresh();
    return () => { request.current++; };
  }, [refresh, uid, wcaId]);

  return { membership, profile, isMember: admin || memberAccess, loading, refresh };
}
