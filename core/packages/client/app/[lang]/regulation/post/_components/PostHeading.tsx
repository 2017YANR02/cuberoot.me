'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ArrowLeft } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import { useIsAdmin } from '@/lib/auth-store';
import { featureHomepagePost } from '@/lib/page-notices-api';
import { useT } from '@/hooks/useT';

type FeaturedPost = { id: string; title: { zh: string; en: string } };
export default function PostHeading({ children, href, backLabel, large = false, post }: {
  children: ReactNode; href: string; backLabel: string; large?: boolean; post?: FeaturedPost;
}) {
  const admin = useIsAdmin();
  const t = useT();
  const savingRef = useRef(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  async function feature() {
    if (!post || !admin || savingRef.current) return;
    savingRef.current = true;
    setState('saving'); setError('');
    try {
      await featureHomepagePost(post);
      setState('saved');
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : t('设置失败，请重试', 'Could not save. Please retry.'));
    } finally { savingRef.current = false; }
  }
  return <header className={'news-heading' + (admin && post ? ' news-heading-admin' : '')}>
    <Link href={href} className="reg-crumb-link news-heading-back" aria-label={backLabel}>
      <ArrowLeft size={20} aria-hidden="true" />
    </Link>
    <h1 className={large ? 'reg-title' : 'news-title'}>{children}</h1>
    {admin && post && <div className="news-feature-action">
      <button type="button" className="news-feature-button" disabled={state === 'saving'} onClick={() => void feature()}
        aria-label={t('一键设置为首页焦点', 'Set as homepage feature')}>
        {state === 'saving' ? t('设置中…', 'Saving…') : t('一键设置', 'Feature')}
      </button>
      {state === 'saved' && <span role="status">{t('已设为首页焦点', 'Featured on homepage')} · <Link href="/">{t('查看首页', 'View home')}</Link></span>}
      {error && <span role="alert">{error}</span>}
    </div>}
  </header>;
}
