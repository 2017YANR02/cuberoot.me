'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { hasTeachingPermission, type TeachingOrganizationRole } from '@cuberoot/shared/teaching';
import { useT } from '@/hooks/useT';
import AppLink from '@/components/AppLink';
import { createTeachingStudent, listTeachingStudents } from '@/lib/teaching-saas-api';
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

export default function OrganizationStudentsPage() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return <OrgWorkspace orgSlug={orgSlug}>{(organization) => <StudentsContent orgSlug={orgSlug} page={page} role={organization.role} />}</OrgWorkspace>;
}

function StudentsContent({ orgSlug, page, role }: { orgSlug: string; page: number; role: TeachingOrganizationRole }) {
  const t = useT();
  const loader = useCallback(() => listTeachingStudents(orgSlug, page, PAGE_SIZE), [orgSlug, page]);
  const students = useTeachingPage(loader);
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
      await createTeachingStudent(orgSlug, {
        displayName: String(data.get('displayName') ?? '').trim(),
        externalRef: String(data.get('externalRef') ?? '').trim() || null,
      }, operationKey.get());
      form.reset();
      operationKey.reset();
      students.reload();
      setMessage(t('学员已创建。', 'Student created.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  const canManage = hasTeachingPermission(role, 'student:manage');
  return (
    <>
          <h2>{t('学员', 'Students')}</h2>
          <p className="org-lead">{t('学员资料按机构隔离，老师只会看到自己负责范围内的学员。', 'Student profiles are isolated by organization. Teachers only see students in their assigned scope.')}</p>

          {students.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : students.error ? (
            <MutationMessage message={students.error} error />
          ) : !students.result?.items.length ? (
            <p className="org-empty">{t('还没有可见的学员。', 'No students are visible yet.')}</p>
          ) : (
            <div className="org-list">
              {students.result.items.map((student) => (
                <AppLink className="org-row org-row-link" href={`/org/${orgSlug}/students/${student.id}`} prefetch={false} key={student.id}>
                  <div className="org-row-main">
                    <div className="org-row-title">{student.displayName}</div>
                    <div className="org-row-meta">{student.externalRef ?? t('无外部编号', 'No external reference')}</div>
                  </div>
                  <span className="org-status">{entityStatusLabel(student.status, t)}</span>
                </AppLink>
              ))}
            </div>
          )}
          {students.result && <TeachingPagination page={students.result.page} pageSize={students.result.pageSize} total={students.result.total} baseHref={`/org/${orgSlug}/students`} />}

          {canManage && (
            <section className="org-section">
              <h2>{t('新建学员', 'Create student')}</h2>
              <form className="org-form" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
                <fieldset disabled={submitting}>
                  <label>{t('显示名称', 'Display name')}<input className="org-form-control" name="displayName" required maxLength={160} autoComplete="name" /></label>
                  <label>{t('外部编号（可选）', 'External reference (optional)')}<input className="org-form-control" name="externalRef" maxLength={100} autoCapitalize="none" /></label>
                  <div className="org-form-actions"><button className="org-form-button" type="submit">{submitting ? t('创建中…', 'Creating…') : t('新建学员', 'Create student')}</button></div>
                </fieldset>
                <MutationMessage message={mutationError || message} error={!!mutationError} />
              </form>
            </section>
          )}
    </>
  );
}
