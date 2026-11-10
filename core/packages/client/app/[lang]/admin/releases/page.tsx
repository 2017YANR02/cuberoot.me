'use client';

import { useCallback, useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import AdminSectionNavigation from '../AdminSectionNavigation';
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

  if (!mounted) return <main className="admin-hub admin-hub--dashboard" />;
  if (!isAdmin) return <main className="admin-hub admin-hub--dashboard"><h1>{t('应用版本管理', 'App releases')}</h1>
    <p className="admin-hub__status">{t('只有管理员可以管理应用版本。', 'Only administrators can manage app releases.')}</p>
    <AppLink href="/account" prefetch={false}>{t('前往账号页', 'Go to account')}</AppLink></main>;

  return <main className="admin-hub admin-hub--dashboard">
    <AdminSectionNavigation group="operations" active="releases" />
    <ReleaseManager onPublished={onPublished} />
  </main>;
}
