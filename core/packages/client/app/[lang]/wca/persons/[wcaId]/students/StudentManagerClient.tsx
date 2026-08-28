'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import AppLink from '@/components/AppLink';
import PersonStudents from '@/components/persons/sections/PersonStudents';
import { useT } from '@/hooks/useT';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fetchWcaPerson, type WcaPersonProfile } from '@/lib/wca-person-api';
import '@/components/persons/persons.css';

export default function StudentManagerClient() {
  const pathname = usePathname();
  const { i18n } = useTranslation();
  const t = useT();
  const isZh = i18n.language.startsWith('zh');
  const [wcaId, setWcaId] = useState('');
  const [profile, setProfile] = useState<WcaPersonProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const match = window.location.pathname.match(/\/wca\/persons\/([^/?#]+)\/students(?:\/|$)/);
    setWcaId(match ? decodeURIComponent(match[1]) : '');
  }, [pathname]);

  useEffect(() => {
    if (!wcaId) return;
    let cancelled = false;
    setProfile(null);
    setError('');
    fetchWcaPerson(wcaId)
      .then((nextProfile) => {
        if (!cancelled) setProfile(nextProfile);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => { cancelled = true; };
  }, [wcaId]);

  if (error) {
    return (
      <div className="wp-page">
        <main className="wp-main">
          <div className="wp-error">{t('加载失败', 'Failed to load')}: {error}</div>
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="wp-page">
        <main className="wp-main">
          <div className="wp-loading">{t('加载中…', 'Loading…')}</div>
        </main>
      </div>
    );
  }

  const personName = displayCuberName(profile.person.name, isZh);

  return (
    <div className="wp-page">
      <main className="wp-main">
        <header className="wp-student-manager-head">
          <h1 className="wp-student-manager-title">{t('学生管理', 'Student management')}</h1>
          <AppLink
            href={`/wca/persons/${profile.person.wca_id}`}
            className="wp-student-manager-person"
            prefetch={false}
          >
            {personName} {profile.person.wca_id}
          </AppLink>
        </header>
        <PersonStudents
          teacherWcaId={profile.person.wca_id}
          teacherCountryIso2={profile.person.country_iso2}
          isZh={isZh}
          mode="manage"
        />
      </main>
    </div>
  );
}
