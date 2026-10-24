'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Pin } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import { useIsAdmin } from '@/lib/auth-store';
import { deletePageNotice, featureHomepagePost, fetchPageNotices, homepagePostNotice } from '@/lib/page-notices-api';
import { Tooltip } from '@/components/Tooltip';
import { useT } from '@/hooks/useT';

type FeaturedPost = { id: string; title: { zh: string; en: string } };
export default function PostHeading({ children, href, backLabel, large = false }: {
  children: ReactNode; href: string; backLabel: string; large?: boolean;
}) {
  return <header className="news-heading">
    <Link href={href} className="reg-crumb-link news-heading-back" aria-label={backLabel}>
      <ArrowLeft size={20} aria-hidden="true" />
    </Link>
    <h1 className={large ? 'reg-title' : 'news-title'}>{children}</h1>
  </header>;
}

export function PostFeatureAction({ post }: { post: FeaturedPost }) {
  const admin = useIsAdmin();
  const t = useT();
  const savingRef = useRef(false);
  const [state, setState] = useState<'loading' | 'idle' | 'saving'>('loading');
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setPinnedId(null); setError(''); setState('loading');
    if (!admin || !post) return;
    fetchPageNotices().then(notices => {
      if (active) setPinnedId(homepagePostNotice(notices, post.id)?.id ?? null);
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : t('加载失败，请重试', 'Could not load. Please retry.'));
    }).finally(() => { if (active) setState('idle'); });
    return () => { active = false; };
  }, [admin, post?.id, t]);
  async function feature() {
    if (!post || !admin || savingRef.current) return;
    savingRef.current = true;
    setState('saving'); setError('');
    try {
      if (pinnedId !== null) {
        await deletePageNotice(pinnedId);
        setPinnedId(null);
      } else {
        setPinnedId((await featureHomepagePost(post)).id);
      }
      setState('idle');
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : t('设置失败，请重试', 'Could not save. Please retry.'));
    } finally { savingRef.current = false; }
  }
  if (!admin) return null;
  return <div className="news-feature-action">
      <Tooltip content={pinnedId !== null ? t('取消首页置顶', 'Unpin from homepage') : t('置顶到首页', 'Pin to homepage')}>
        {tip => <button {...tip} type="button" className="news-feature-button" disabled={state !== 'idle'} onClick={() => void feature()}
          aria-pressed={pinnedId !== null}
          aria-label={pinnedId !== null ? t('取消首页置顶', 'Unpin from homepage') : t('置顶到首页', 'Pin to homepage')}>
          <Pin size={18} fill={pinnedId !== null ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>}
      </Tooltip>
      {error && <span role="alert">{error}</span>}
    </div>;
}
