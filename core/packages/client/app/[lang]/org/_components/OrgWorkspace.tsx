'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Building2, ChevronRight } from '@app-foundation/icons/lucide';
import { hasTeachingPermission, type TeachingPermission } from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getSessionToken, nextQuery, useAuthUser } from '@/lib/auth-store';
import { getTeachingOrganization, type TeachingOrganizationAccess } from '@/lib/teaching-saas-api';
import { teachingErrorMessage, teachingRoleLabel } from './OrgUi';
import { LoadingIndicator } from '@/components/LoadingIndicator';

interface Props {
  orgSlug: string;
  children: (organization: TeachingOrganizationAccess) => ReactNode;
}

export default function OrgWorkspace({ orgSlug, children }: Props) {
  const t = useT();
  const user = useAuthUser();
  const pathname = usePathname().replace(/^\/zh(?=\/|$)/, '');
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
  if (error) return <main className="org-page org-centered"><p role="alert">{error}</p><AppLink href="/org" prefetch={false}><span aria-hidden="true">←</span> <span className="sr-only">{t('返回机构列表', 'Back to organizations')}</span></AppLink></main>;
  if (!organization) return <main className="org-page" aria-busy="true"><p><LoadingIndicator>{t('正在加载机构…', 'Loading organization…')}</LoadingIndicator></p></main>;

  const links: Array<{ href: string; label: string; permission?: TeachingPermission }> = [
    { href: `/org/${organization.slug}`, label: t('概览', 'Overview') },
    { href: `/org/${organization.slug}/members`, label: t('成员', 'Members'), permission: 'member:read' },
    { href: `/org/${organization.slug}/students`, label: t('学员', 'Students'), permission: 'student:read' },
    { href: `/org/${organization.slug}/campuses`, label: t('校区', 'Campuses'), permission: 'campus:read' },
    { href: `/org/${organization.slug}/classes`, label: t('班级', 'Classes'), permission: 'group:read' },
    { href: `/org/${organization.slug}/packages`, label: t('课包', 'Packages'), permission: 'package:read' },
    { href: `/org/${organization.slug}/sessions`, label: t('课次', 'Sessions'), permission: 'session:read' },
    { href: `/org/${organization.slug}/training`, label: t('训练', 'Training'), permission: 'training:assignment:read' },
    { href: `/org/${organization.slug}/reports`, label: t('周报', 'Reports'), permission: 'report:read' },
    { href: `/org/${organization.slug}/operations`, label: t('经营', 'Operations'), permission: 'operations:read' },
    { href: `/org/${organization.slug}/audit`, label: t('审计', 'Audit'), permission: 'audit:read' },
  ];

  return (
    <main className="org-page">
      <header className="org-header org-workspace-header">
        <AppLink className="org-eyebrow org-breadcrumb" href="/org" prefetch={false}><Building2 size={16} aria-hidden="true" />{t('我的企业', 'My enterprises')}<ChevronRight size={14} aria-hidden="true" /></AppLink>
        <div className="org-heading-row">
          <h1>{organization.name}</h1>
          <span className="org-role">{teachingRoleLabel(organization.role, t)}</span>
        </div>
        <p className="org-lead">{t('企业认证、学员与教学事务，在这里统一管理。', 'Manage verification, students and teaching in one place.')}</p>
      </header>
      <nav className="org-nav" aria-label={t('机构导航', 'Organization navigation')}>
        {links.filter((link) => !link.permission || hasTeachingPermission(organization.role, link.permission)).map((link) => (
          <AppLink key={link.href} href={link.href} aria-current={(link.href === `/org/${organization.slug}` ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`)) ? 'page' : undefined} prefetch={false}>{link.label}</AppLink>
        ))}
      </nav>
      <div className="org-content">{children(organization)}</div>
    </main>
  );
}
