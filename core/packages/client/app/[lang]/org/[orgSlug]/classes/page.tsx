'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { hasTeachingPermission, type TeachingCampus, type TeachingOrganizationRole } from '@cuberoot/shared/teaching';
import { useT } from '@/hooks/useT';
import AppLink from '@/components/AppLink';
import { createTeachingGroup, listTeachingCampuses, listTeachingGroups } from '@/lib/teaching-saas-api';
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
const CAMPUS_OPTION_LIMIT = 100;

export default function OrganizationClassesPage() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return <OrgWorkspace orgSlug={orgSlug}>{(organization) => <ClassesContent orgSlug={orgSlug} page={page} role={organization.role} />}</OrgWorkspace>;
}

function ClassesContent({ orgSlug, page, role }: { orgSlug: string; page: number; role: TeachingOrganizationRole }) {
  const t = useT();
  const loader = useCallback(() => listTeachingGroups(orgSlug, page, PAGE_SIZE), [orgSlug, page]);
  const groups = useTeachingPage(loader);
  const operationKey = useOperationKey();
  const [campuses, setCampuses] = useState<TeachingCampus[]>([]);
  const [campusTotal, setCampusTotal] = useState(0);
  const [campusError, setCampusError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');
  const canManage = hasTeachingPermission(role, 'group:manage');

  useEffect(() => {
    let cancelled = false;
    void listTeachingCampuses(orgSlug, 1, CAMPUS_OPTION_LIMIT).then((result) => {
      if (!cancelled) {
        setCampuses(result.items);
        setCampusTotal(result.total);
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setCampusError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [orgSlug, t]);

  const campusNames = useMemo(() => new Map(campuses.map((campus) => [campus.id, campus.name])), [campuses]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setMessage('');
    setMutationError('');
    try {
      await createTeachingGroup(orgSlug, {
        name: String(data.get('name') ?? '').trim(),
        code: String(data.get('code') ?? '').trim().toLowerCase() || null,
        campusId: String(data.get('campusId') ?? '').trim() || null,
      }, operationKey.get());
      form.reset();
      operationKey.reset();
      groups.reload();
      setMessage(t('班级已创建。', 'Class created.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
          <h2>{t('班级', 'Classes')}</h2>
          <p className="org-lead">{t('老师只会看到自己当前负责的班级。', 'Teachers only see classes currently assigned to them.')}</p>

          {groups.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : groups.error ? (
            <MutationMessage message={groups.error} error />
          ) : !groups.result?.items.length ? (
            <p className="org-empty">{t('还没有可见的班级。', 'No classes are visible yet.')}</p>
          ) : (
            <div className="org-list">
              {groups.result.items.map((group) => (
                <AppLink className="org-row org-row-link" href={`/org/${orgSlug}/classes/${group.id}`} prefetch={false} key={group.id}>
                  <div className="org-row-main">
                    <div className="org-row-title">{group.name}</div>
                    <div className="org-row-meta">{[group.code, group.campusId ? campusNames.get(group.campusId) ?? t('校区不可见', 'Campus unavailable') : t('未指定校区', 'No campus')].filter(Boolean).join(' / ')}</div>
                  </div>
                  <span className="org-status">{entityStatusLabel(group.status, t)}</span>
                </AppLink>
              ))}
            </div>
          )}
          {groups.result && <TeachingPagination page={groups.result.page} pageSize={groups.result.pageSize} total={groups.result.total} baseHref={`/org/${orgSlug}/classes`} />}

          {canManage && (
            <section className="org-section">
              <h2>{t('新建班级', 'Create class')}</h2>
              <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
                <fieldset disabled={submitting}>
                  <label>{t('班级名称', 'Class name')}<input name="name" required maxLength={160} /></label>
                  <label>{t('班级代码（可选）', 'Class code (optional)')}<input name="code" maxLength={64} pattern="[a-z0-9][a-z0-9_-]{0,63}" autoCapitalize="none" /></label>
                  <label className="org-field-wide">{t('校区（可选）', 'Campus (optional)')}
                    <select name="campusId" defaultValue="">
                      <option value="">{t('不指定校区', 'No campus')}</option>
                      {campuses.filter((campus) => campus.status === 'active').map((campus) => <option value={campus.id} key={campus.id}>{campus.name}</option>)}
                    </select>
                  </label>
                  {campusError && <MutationMessage message={campusError} error />}
                  {campusTotal > campuses.length && <p className="org-help org-field-wide">{t('这里只显示前 100 个校区；如未找到，请稍后使用搜索。', 'Only the first 100 campuses are shown. Search selection will be added later.')}</p>}
                  <div className="org-form-actions"><button type="submit">{submitting ? t('创建中…', 'Creating…') : t('新建班级', 'Create class')}</button></div>
                </fieldset>
                <MutationMessage message={mutationError || message} error={!!mutationError} />
              </form>
            </section>
          )}
    </>
  );
}
