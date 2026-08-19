'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { getSessionToken, nextQuery, useAuthUser } from '@/lib/auth-store';
import {
  createTeachingOrganization,
  listTeachingOrganizations,
  type TeachingOrganizationAccess,
} from '@/lib/teaching-saas-api';
import { MutationMessage, teachingErrorMessage, useOperationKey } from './_components/OrgUi';

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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setOrganizations(await listTeachingOrganizations()); }
    catch (reason) { setError(teachingErrorMessage(reason, t)); }
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
      setMessage(t('机构已创建。', 'Organization created.'));
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
        <h1>{t('教学管理', 'Teaching')}</h1>
        <p className="org-lead">{t('老师、机构和学员统一使用主站账号与训练工具。', 'Teachers, organizations, and students share the main site account and training tools.')}</p>
        <AppLink className="org-primary-link" href={`/account${nextQuery(window.location.pathname)}`} prefetch={false}>{t('登录', 'Sign in')}</AppLink>
      </main>
    );
  }

  return (
    <main className="org-page">
      <h1>{t('教学管理', 'Teaching')}</h1>
      <p className="org-lead">{t('在主站管理机构、学员与教学工作，不再切换到单独的平台。', 'Manage organizations, students, and teaching work on the main site without switching to a separate platform.')}</p>

      <section className="org-section">
        <h2>{t('我的机构', 'My organizations')}</h2>
        {loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : error ? <MutationMessage message={error} error /> : organizations.length === 0 ? (
          <p className="org-empty">{t('你还没有加入机构，可以在下面创建第一个机构。', 'You have not joined an organization yet. Create your first one below.')}</p>
        ) : (
          <div className="org-list">
            {organizations.map((organization) => (
              <AppLink className="org-tool-link" href={`/org/${organization.slug}`} key={organization.id} prefetch={false}>
                <span><strong>{organization.name}</strong><span className="org-row-meta">{organization.slug}: {organization.timezone}</span></span>
                <span className="org-status">{organization.role}</span>
              </AppLink>
            ))}
          </div>
        )}
      </section>

      <section className="org-section">
        <h2>{t('创建机构', 'Create organization')}</h2>
        <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
          <fieldset disabled={submitting}>
            <label>{t('机构名称', 'Organization name')}<input className="org-form-control" name="name" required maxLength={160} autoComplete="organization" /></label>
            <label>{t('网址标识', 'URL slug')}<input className="org-form-control" name="slug" required maxLength={64} pattern="[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?" placeholder="cuberoot-academy" autoCapitalize="none" /></label>
            <label className="org-field-wide">{t('时区', 'Time zone')}<input className="org-form-control" name="timezone" required maxLength={64} defaultValue="Asia/Shanghai" autoCapitalize="none" /></label>
            <div className="org-form-actions"><button className="org-form-button" type="submit">{submitting ? t('创建中…', 'Creating…') : t('创建机构', 'Create organization')}</button></div>
          </fieldset>
          <MutationMessage message={error || message} error={!!error} />
        </form>
      </section>
    </main>
  );
}
