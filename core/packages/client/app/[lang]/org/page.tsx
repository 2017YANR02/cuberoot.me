'use client';
import BackHome from '@/components/BackHome';
import PageHeading from '@/components/PageHeading';
import MoreToggle from '@/components/MoreToggle';

import { useCallback, useContext, useEffect, useState, type FormEvent } from 'react';
import { Building2, ArrowRight, Plus } from '@app-foundation/icons/lucide';
import EnterpriseVerificationAdmin from './_components/EnterpriseVerificationAdmin';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getSessionToken, nextQuery, useAuthUser, hasAdminAccess } from '@/lib/auth-store';
import {
  createTeachingOrganization,
  listTeachingOrganizations,
  type TeachingOrganizationAccess,
} from '@/lib/teaching-saas-api';
import { MutationMessage, teachingErrorMessage, teachingRoleLabel, useOperationKey } from './_components/OrgUi';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { PlatformNavigationContext } from '@/lib/platform-navigation-context';
import { useQueryState, parseAsString } from 'nuqs';
import { usePathname } from 'next/navigation';
import { platformPathname } from '@/lib/platform-navigation';

export default function OrganizationsPage() {
  const user = useAuthUser();
  return <OrganizationsAccountPage key={user?.uid ?? user?.wcaId ?? 'guest'} user={user} />;
}

function OrganizationsAccountPage({ user }: { user: ReturnType<typeof useAuthUser> }) {
  const t = useT();
  const inPlatformShell = useContext(PlatformNavigationContext);
  const pathname = usePathname();
  const adminRoute = platformPathname(pathname) === '/platform/admin/organization-verification';
  const [view, setView] = useQueryState('view', parseAsString.withDefault(''));
  const operationKey = useOperationKey();
  const [mounted, setMounted] = useState(false);
  const [organizations, setOrganizations] = useState<TeachingOrganizationAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try { setOrganizations(await listTeachingOrganizations()); }
    catch (reason) { setLoadError(teachingErrorMessage(reason, t)); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    // Preserve the former management deep link while keeping the creation flow separate.
    if (mounted && inPlatformShell && hasAdminAccess(user) && !view && window.location.hash === '#enterprise-admin') void setView('admin');
  }, [mounted, inPlatformShell, user, view, setView]);
  useEffect(() => {
    if (mounted && user && getSessionToken()) void load();
    else if (mounted) setLoading(false);
  }, [load, mounted, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const organization = await createTeachingOrganization({
        slug: String(data.get('slug') ?? '').trim().toLowerCase(),
        name: String(data.get('name') ?? '').trim(),
        timezone: String(data.get('timezone') ?? '').trim(),
      }, operationKey.get());
      setOrganizations((current) => [...current.filter((item) => item.id !== organization.id), organization]);
      form.reset();
      operationKey.reset();
      setCreating(false);
      setMessage(t('企业已创建。点击企业卡片，继续认证或管理。', 'Enterprise created. Select its card to continue with verification or management.'));
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return <main className="org-page" aria-busy="true" />;
  if (!user || !getSessionToken()) {
    return (
      <main className="org-page org-centered">
        <PageHeading>{t('机构工作台', 'Organization workspace')}</PageHeading>
        <p className="org-lead">{t('登录后即可创建企业信息，并继续管理机构、学员和教学工作。', 'Sign in to create an enterprise profile and manage its organization, students, and teaching.')}</p>
        <AppLink className="org-primary-link" href={`/account${nextQuery(window.location.pathname)}`} prefetch={false}>{t('登录', 'Sign in')}</AppLink>
      </main>
    );
  }
  if (view === 'admin' || adminRoute) return <main className="org-page">
    <h1>{t('机构认证管理', 'Organization verification management')}</h1>
    {!adminRoute && <AppLink href="/org" className="org-secondary-button" prefetch={false}>{t('返回机构', 'Back to organizations')}</AppLink>}
    {hasAdminAccess(user) ? <EnterpriseVerificationAdmin /> : <p role="status">{t('无权访问此管理区。', 'You do not have access to this administration area.')}</p>}
  </main>;

  return (
    <main className="org-page org-directory">
      <header className="org-directory-header">{!inPlatformShell && <BackHome />}<span className="org-feature-icon"><Building2 size={28} aria-hidden="true" /></span><div><h1>{t('我的机构', 'My organizations')}</h1></div></header>
      <p className="org-lead">{t('企业是机构用于认证和收款的主体信息。选择已有企业继续认证或开展教学。', 'An enterprise is the registered entity for organization verification and receiving payments. Select an existing enterprise to continue verification or teaching.')}</p>

      <section className="org-section">
        <h2>{t('选择企业', 'Select an enterprise')}</h2>
        <MutationMessage message={message} />
        {loading ? <p aria-busy="true"><LoadingIndicator>{t('正在加载…', 'Loading…')}</LoadingIndicator></p> : loadError ? <><MutationMessage message={loadError} error /><button type="button" className="org-secondary-button" onClick={() => void load()}>{t('重新加载企业列表', 'Reload enterprises')}</button></> : organizations.length === 0 ? (
          <p className="org-empty">{t('你还没有企业信息，可以在下面创建。', 'You do not have an enterprise profile yet. Create one below.')}</p>
        ) : (
          <div className="org-list">
            {organizations.map((organization) => (
              <AppLink className="org-tool-link org-enterprise-card" data-site-surface="panel" href={`/org/${organization.slug}`} key={organization.id} prefetch={false}>
                <span><strong>{organization.name}</strong><span className="org-enterprise-meta">{t('你的身份：', 'Your role: ')}{teachingRoleLabel(organization.role, t)}</span></span>
                <span className="org-enterprise-action">{['owner', 'admin'].includes(organization.role) ? t('进入企业 · 认证与管理', 'Open enterprise · verification & management') : t('进入企业', 'Open enterprise')}<ArrowRight size={18} aria-hidden="true" /></span>
              </AppLink>
            ))}
          </div>
        )}
      </section>

      {!loading && !loadError && <section className="org-section">
        {organizations.length > 0 && <MoreToggle type="button" className="org-secondary-button" expanded={creating} aria-controls="create-enterprise" disabled={submitting} onClick={() => { setCreating(!creating); setError(''); }}>{!creating && <Plus size={18} aria-hidden="true" />}{creating ? t('取消新增企业', 'Cancel adding an enterprise') : t('新增另一家企业', 'Add another enterprise')}</MoreToggle>}
        {(organizations.length === 0 || creating) && <div id="create-enterprise" className="org-subsection">
        <h2>{organizations.length === 0 ? t('第 1 步：创建你的企业', 'Step 1: Create your enterprise') : t('新增另一家企业', 'Add another enterprise')}</h2>
        <ol className="org-create-steps"><li aria-current="step">{t('创建', 'Create')}</li><li>{t('申请认证', 'Verify')}</li><li>{t('开始使用', 'Get started')}</li></ol>
        <p className="org-lead">{t('创建不会发起打款，也不代表认证通过。', 'Creating a profile does not transfer money or verify the enterprise.')}</p>
        <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
          <fieldset disabled={submitting}>
            <label>{t('企业名称', 'Enterprise name')}<input className="org-form-control" name="name" required maxLength={160} autoComplete="organization" /></label>
            <label>{t('企业页面地址', 'Enterprise page address')}<input autoComplete="off" className="org-form-control" name="slug" required maxLength={64} pattern="[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?" placeholder="cuberoot-academy" autoCapitalize="none" /><span className="org-help">{t('填写小写字母、数字或短横线，用于生成企业链接。', 'Use lowercase letters, numbers or hyphens for your enterprise link.')}</span></label>
            <label className="org-field-wide">{t('时区', 'Time zone')}<select className="org-form-control" name="timezone" required defaultValue="Asia/Shanghai">
              {[...new Set(['Asia/Shanghai', 'UTC', ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['Asia/Hong_Kong', 'Asia/Tokyo', 'America/Los_Angeles', 'America/New_York', 'Europe/London'])])].map(zone => <option key={zone} value={zone}>{zone === 'Asia/Shanghai' ? t('中国标准时间（上海）', 'China Standard Time (Shanghai)') : zone}</option>)}
            </select></label>
            <div className="org-form-actions"><button className="org-form-button" type="submit">{submitting ? t('创建中…', 'Creating…') : t('创建企业', 'Create enterprise')}</button></div>
          </fieldset>
          <MutationMessage message={error || message} error={!!error} />
        </form>
        </div>}
      </section>}

      {!inPlatformShell && hasAdminAccess(user) && <EnterpriseVerificationAdmin />}
    </main>
  );
}
