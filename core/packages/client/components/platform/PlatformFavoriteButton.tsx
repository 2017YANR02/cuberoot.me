'use client';

import { useEffect, useRef, useState } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { executePlatformAction, PlatformPermissionError } from '@/lib/platform-gateway';
import type { PlatformRouteDefinition } from '@/lib/platform-types';

type Props = { definition: PlatformRouteDefinition; targetType: 'course' | 'product' | 'event' | 'news'; entityId?: string };

/** Uses the resolved entity UUID, never the route's potentially slug-valued parameter. */
export function PlatformFavoriteButton(props: Props) {
  const user = useAuthUser();
  const t = useT();
  if (!user) return <AppLink className="platform-button" href="/platform/login">{t('登录后收藏', 'Sign in to save')}</AppLink>;
  if (!props.entityId) return null;
  return <AuthenticatedFavorite key={`${user.uid ?? user.wcaId}:${props.targetType}:${props.entityId}`} {...props} entityId={props.entityId} />;
}

function AuthenticatedFavorite({ definition, targetType, entityId }: Props & { entityId: string }) {
  const t = useT();
  const [active, setActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [signIn, setSignIn] = useState(false);
  const [revision, setRevision] = useState(0);
  const mounted = useRef(false);
  const mutationPending = useRef(false);
  const wishlist = targetType === 'product';
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setLoading(true); setError(''); setSignIn(false);
    void (async () => {
      try {
        const response = await fetch(apiUrl(`/v1/platform/me/${wishlist ? 'wishlist' : 'favorites'}`), { headers: authHeaders(false), signal: controller.signal });
        if (response.status === 401) { setSignIn(true); return; }
        const result = await handleApi<{ items: { id: string; targetType: string }[] }>(response);
        if (!controller.signal.aborted) setActive(result.items.some(item => item.id === entityId && item.targetType === targetType));
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : t('无法读取收藏状态。', 'Could not load saved status.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => { mounted.current = false; controller.abort(); };
  }, [entityId, targetType, wishlist, revision, t]);

  async function toggle() {
    if (active === null || loading || mutationPending.current) return;
    const next = !active;
    mutationPending.current = true; setSaving(true); setError('');
    try {
      await executePlatformAction(definition, { action: wishlist ? 'wishlist' : 'favorite', resourceId: entityId, payload: { targetType, active: next } });
      if (mounted.current) setActive(next);
    } catch (reason) {
      if (mounted.current) {
        if (reason instanceof PlatformPermissionError && reason.status === 401) setSignIn(true);
        setError(reason instanceof Error ? reason.message : t('收藏未更新，请重试。', 'Could not update saved status. Try again.'));
      }
    } finally {
      mutationPending.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return <div className="platform-domain-stack">
    {signIn ? <AppLink className="platform-button" href="/platform/login">{t('请重新登录后收藏', 'Sign in again to save')}</AppLink> : <button type="button" className="platform-button" aria-pressed={active === true} disabled={loading || saving || active === null} onClick={() => { void toggle(); }}>
      {loading ? t('正在读取收藏…', 'Loading saved status…') : saving ? t('正在保存…', 'Saving…') : active ? wishlist ? t('移出心愿单', 'Remove from wishlist') : t('取消收藏', 'Remove from saved') : wishlist ? t('加入心愿单', 'Add to wishlist') : t('收藏', 'Save')}
    </button>}
    {error ? <p role="alert">{error}</p> : null}
    {error && active === null && !signIn ? <button type="button" className="platform-button" disabled={loading} onClick={() => setRevision(value => value + 1)}>{t('重新读取收藏', 'Retry loading saved status')}</button> : null}
  </div>;
}
