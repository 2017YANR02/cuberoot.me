'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

export default function OrganizationsPage() {
  const t = useT();
  const user = useAuthUser();
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
        <h1>{t('企业信息', 'Enterprise')}</h1>
        <p className="org-lead">{t('登录后即可创建企业信息，并继续管理机构、学员和教学工作。', 'Sign in to create an enterprise profile and manage its organization, students, and teaching.')}</p>
        <AppLink className="org-primary-link" href={`/account${nextQuery(window.location.pathname)}`} prefetch={false}>{t('登录', 'Sign in')}</AppLink>
      </main>
    );
  }

  return (
    <main className="org-page org-directory">
      <header className="org-directory-header"><span className="org-feature-icon"><Building2 size={28} aria-hidden="true" /></span><div><p className="org-eyebrow">{t('企业工作台', 'Enterprise workspace')}</p><h1>{t('我的企业', 'My enterprises')}</h1></div></header>
      <p className="org-lead">{t('选择已有企业，继续认证或管理。只有添加另一家企业时，才需要新增企业。', 'Select an existing enterprise to continue verification or management. Add an enterprise only for a different business.')}</p>

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
        {organizations.length > 0 && <button type="button" className="org-secondary-button" aria-expanded={creating} aria-controls="create-enterprise" disabled={submitting} onClick={() => { setCreating(!creating); setError(''); }}>{!creating && <Plus size={18} aria-hidden="true" />}{creating ? t('取消新增企业', 'Cancel adding an enterprise') : t('新增另一家企业', 'Add another enterprise')}</button>}
        {(organizations.length === 0 || creating) && <div id="create-enterprise" className="org-subsection">
        <h2>{organizations.length === 0 ? t('第 1 步：创建你的企业', 'Step 1: Create your enterprise') : t('新增另一家企业', 'Add another enterprise')}</h2>
        <p className="org-lead">{t('创建后进入企业页面，再按指引申请认证。创建企业不会发起打款，也不代表认证通过。', 'After creation, open the enterprise and follow the verification steps. Creating a profile does not transfer money or verify the enterprise.')}</p>
        <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
          <fieldset disabled={submitting}>
            <label>{t('企业名称', 'Enterprise name')}<input className="org-form-control" name="name" required maxLength={160} autoComplete="organization" /></label>
            <label>{t('企业页面地址', 'Enterprise page address')}<input className="org-form-control" name="slug" required maxLength={64} pattern="[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?" placeholder="cuberoot-academy" autoCapitalize="none" /><span className="org-help">{t('填写小写字母、数字或短横线，用于生成企业链接。', 'Use lowercase letters, numbers or hyphens for your enterprise link.')}</span></label>
            <label className="org-field-wide">{t('时区', 'Time zone')}<input className="org-form-control" name="timezone" required maxLength={64} defaultValue="Asia/Shanghai" autoCapitalize="none" /></label>
            <div className="org-form-actions"><button className="org-form-button" type="submit">{submitting ? t('创建中…', 'Creating…') : t('创建企业', 'Create enterprise')}</button></div>
          </fieldset>
          <MutationMessage message={error || message} error={!!error} />
        </form>
        </div>}
      </section>}

      {hasAdminAccess(user) && <EnterpriseVerificationAdmin />}
    </main>
  );
}
