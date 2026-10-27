'use client';

import { useCallback, useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useIsAdmin } from '@/lib/auth-store';
import ReleaseManager from '../../download/ReleaseManager';
import '../../download/download.css';
import '../admin.css';

export default function AdminReleasesPage() {
  const t = useT();
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const onPublished = useCallback(() => {}, []);

  if (!mounted) return <main className="admin-hub" />;
  if (!isAdmin) return <main className="admin-hub"><h1>{t('应用版本管理', 'App releases')}</h1>
    <p className="admin-hub__status">{t('只有管理员可以管理应用版本。', 'Only administrators can manage app releases.')}</p>
    <AppLink href="/account" prefetch={false}>{t('前往账号页', 'Go to account')}</AppLink></main>;

  return <main className="admin-hub">
    <header className="admin-hub__heading">
      <h1>{t('应用版本管理', 'App releases')}</h1>
      <p>{t('发布 Android 和 Windows 版本，查看发布状态。', 'Publish Android and Windows releases and check their status.')}</p>
    </header>
    <AppLink href="/admin?section=system" prefetch={false}>{t('返回系统工具', 'Back to system tools')}</AppLink>
    <ReleaseManager onPublished={onPublished} />
  </main>;
}
