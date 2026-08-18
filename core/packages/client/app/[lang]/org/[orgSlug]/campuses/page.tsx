'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { hasTeachingPermission, type TeachingOrganizationRole } from '@cuberoot/shared/teaching';
import { useT } from '@/hooks/useT';
import { createTeachingCampus, listTeachingCampuses } from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../_components/OrgWorkspace';
import {
  entityStatusLabel,
  MutationMessage,
  TeachingPagination,
  teachingErrorMessage,
  useOperationKey,
  useTeachingPage,
} from '../../_components/OrgUi';

const PAGE_SIZE = 25;

export default function OrganizationCampusesPage() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return <OrgWorkspace orgSlug={orgSlug}>{(organization) => <CampusesContent orgSlug={orgSlug} page={page} organization={organization} />}</OrgWorkspace>;
}

function CampusesContent({ orgSlug, page, organization }: {
  orgSlug: string;
  page: number;
  organization: { role: TeachingOrganizationRole; timezone: string };
}) {
  const t = useT();
  const loader = useCallback(() => listTeachingCampuses(orgSlug, page, PAGE_SIZE), [orgSlug, page]);
  const campuses = useTeachingPage(loader);
  const operationKey = useOperationKey();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setMessage('');
    setMutationError('');
    try {
      await createTeachingCampus(orgSlug, {
        name: String(data.get('name') ?? '').trim(),
        code: String(data.get('code') ?? '').trim().toLowerCase() || null,
        timezone: String(data.get('timezone') ?? '').trim() || null,
      }, operationKey.get());
      form.reset();
      operationKey.reset();
      campuses.reload();
      setMessage(t('校区已创建。', 'Campus created.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  const canManage = hasTeachingPermission(organization.role, 'campus:manage');
  return (
    <>
          <h2>{t('校区', 'Campuses')}</h2>
          <p className="org-lead">{t('校区时区留空时继承机构时区。', 'A campus inherits the organization time zone when left blank.')}</p>

          {campuses.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : campuses.error ? (
            <MutationMessage message={campuses.error} error />
          ) : !campuses.result?.items.length ? (
            <p className="org-empty">{t('还没有可见的校区。', 'No campuses are visible yet.')}</p>
          ) : (
            <div className="org-list">
              {campuses.result.items.map((campus) => (
                <div className="org-row" key={campus.id}>
                  <div className="org-row-main">
                    <div className="org-row-title">{campus.name}</div>
                    <div className="org-row-meta">{[campus.code, campus.timezone ?? t('继承机构时区', 'Organization time zone')].filter(Boolean).join(' / ')}</div>
                  </div>
                  <span className="org-status">{entityStatusLabel(campus.status, t)}</span>
                </div>
              ))}
            </div>
          )}
          {campuses.result && <TeachingPagination page={campuses.result.page} pageSize={campuses.result.pageSize} total={campuses.result.total} baseHref={`/org/${orgSlug}/campuses`} />}

          {canManage && (
            <section className="org-section">
              <h2>{t('新建校区', 'Create campus')}</h2>
              <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
                <fieldset disabled={submitting}>
                  <label>{t('校区名称', 'Campus name')}<input name="name" required maxLength={160} /></label>
                  <label>{t('校区代码（可选）', 'Campus code (optional)')}<input name="code" maxLength={64} pattern="[a-z0-9][a-z0-9_-]{0,63}" autoCapitalize="none" /></label>
                  <label className="org-field-wide">{t('时区（可选）', 'Time zone (optional)')}<input name="timezone" maxLength={64} placeholder={organization.timezone} autoCapitalize="none" /></label>
                  <div className="org-form-actions"><button type="submit">{submitting ? t('创建中…', 'Creating…') : t('新建校区', 'Create campus')}</button></div>
                </fieldset>
                <MutationMessage message={mutationError || message} error={!!mutationError} />
              </form>
            </section>
          )}
    </>
  );
}
