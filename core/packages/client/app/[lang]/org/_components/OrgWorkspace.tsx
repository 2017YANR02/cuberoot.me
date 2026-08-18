'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { hasTeachingPermission, type TeachingPermission } from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getSessionToken, nextQuery, useAuthUser } from '@/lib/auth-store';
import { getTeachingOrganization, type TeachingOrganizationAccess } from '@/lib/teaching-saas-api';
import { teachingErrorMessage } from './OrgUi';

interface Props {
  orgSlug: string;
  children: (organization: TeachingOrganizationAccess) => ReactNode;
}

export default function OrgWorkspace({ orgSlug, children }: Props) {
  const t = useT();
  const user = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [organization, setOrganization] = useState<TeachingOrganizationAccess | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted || !user || !getSessionToken()) return;
    let cancelled = false;
    setError('');
    void getTeachingOrganization(orgSlug).then((value) => {
      if (!cancelled) setOrganization(value);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [mounted, orgSlug, t, user]);

  if (!mounted) return <main className="org-page" aria-busy="true" />;
  if (!user || !getSessionToken()) {
    return (
      <main className="org-page org-centered">
        <h1>{t('教学管理', 'Teaching')}</h1>
        <p>{t('登录后才能进入机构工作区。', 'Sign in to open an organization workspace.')}</p>
        <AppLink className="org-primary-link" href={`/account${nextQuery(window.location.pathname)}`} prefetch={false}>{t('登录', 'Sign in')}</AppLink>
      </main>
    );
  }
  if (error) return <main className="org-page org-centered"><p role="alert">{error}</p><AppLink href="/org" prefetch={false}>{t('返回机构列表', 'Back to organizations')}</AppLink></main>;
  if (!organization) return <main className="org-page" aria-busy="true"><p>{t('正在加载机构…', 'Loading organization…')}</p></main>;

  const links: Array<{ href: string; label: string; permission?: TeachingPermission }> = [
    { href: `/org/${organization.slug}`, label: t('概览', 'Overview') },
    { href: `/org/${organization.slug}/members`, label: t('成员', 'Members'), permission: 'member:read' },
    { href: `/org/${organization.slug}/students`, label: t('学员', 'Students'), permission: 'student:read' },
    { href: `/org/${organization.slug}/campuses`, label: t('校区', 'Campuses'), permission: 'campus:read' },
    { href: `/org/${organization.slug}/classes`, label: t('班级', 'Classes'), permission: 'group:read' },
  ];

  return (
    <main className="org-page">
      <header className="org-header">
        <AppLink className="org-eyebrow" href="/org" prefetch={false}>{t('教学管理', 'Teaching')}</AppLink>
        <div className="org-heading-row">
          <h1>{organization.name}</h1>
          <span className="org-role">{organization.role}</span>
        </div>
      </header>
      <nav className="org-nav" aria-label={t('机构导航', 'Organization navigation')}>
        {links.filter((link) => !link.permission || hasTeachingPermission(organization.role, link.permission)).map((link) => (
          <AppLink key={link.href} href={link.href} prefetch={false}>{link.label}</AppLink>
        ))}
      </nav>
      <div className="org-content">{children(organization)}</div>
    </main>
  );
}
