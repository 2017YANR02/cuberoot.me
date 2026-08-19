'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { hasTeachingPermission, type TeachingOrganizationRole } from '@cuberoot/shared/teaching';
import { useT } from '@/hooks/useT';
import { createTeachingMember, listTeachingMembers } from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../_components/OrgWorkspace';
import {
  entityStatusLabel,
  MutationMessage,
  TeachingPagination,
  teachingErrorMessage,
  teachingRoleLabel,
  useOperationKey,
  useTeachingPage,
} from '../../_components/OrgUi';

const PAGE_SIZE = 25;
const BASE_ASSIGNABLE_ROLES = ['teacher', 'assistant', 'finance', 'viewer'] as const;

export default function OrganizationMembersPage() {
  const params = useParams<{ orgSlug: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  return <OrgWorkspace orgSlug={params.orgSlug}>{(organization) => <MembersContent orgSlug={params.orgSlug} page={page} role={organization.role} />}</OrgWorkspace>;
}

function MembersContent({ orgSlug, page, role }: { orgSlug: string; page: number; role: TeachingOrganizationRole }) {
  const t = useT();
  const loader = useCallback(() => listTeachingMembers(orgSlug, page, PAGE_SIZE), [orgSlug, page]);
  const members = useTeachingPage(loader);
  const operationKey = useOperationKey();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canManage = hasTeachingPermission(role, 'member:manage');
  const assignableRoles: Exclude<TeachingOrganizationRole, 'owner'>[] = role === 'owner'
    ? ['admin', ...BASE_ASSIGNABLE_ROLES]
    : [...BASE_ASSIGNABLE_ROLES];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const userId = Number(data.get('userId'));
    const memberRole = String(data.get('role')) as Exclude<TeachingOrganizationRole, 'owner'>;
    setMessage('');
    setError('');
    if (!Number.isSafeInteger(userId) || userId <= 0 || !assignableRoles.includes(memberRole)) {
      setError(t('请填写有效的主站用户 ID 和机构角色。', 'Enter a valid main-site user ID and organization role.'));
      return;
    }
    setSubmitting(true);
    try {
      await createTeachingMember(orgSlug, { userId, role: memberRole }, operationKey.get());
      operationKey.reset();
      form.reset();
      members.reload();
      setMessage(t('成员已加入机构。', 'Member added to the organization.'));
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h2>{t('机构成员', 'Organization members')}</h2>
      <p className="org-lead">{t('成员身份属于当前机构；老师和助教的学员范围还需要在班级或学员详情中分配。', 'Membership belongs to this organization. Teacher and assistant scopes are assigned from class or student details.')}</p>
      {members.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : members.error ? (
        <MutationMessage message={members.error} error />
      ) : !members.result?.items.length ? (
        <p className="org-empty">{t('还没有可见成员。', 'No members are visible yet.')}</p>
      ) : (
        <div className="org-list">
          {members.result.items.map((member) => (
            <div className="org-row" key={member.userId}>
              <div className="org-row-main">
                <div className="org-row-title">{member.displayName}</div>
                <div className="org-row-meta">{teachingRoleLabel(member.role, t)} / ID {member.userId}</div>
              </div>
              <span className="org-status">{entityStatusLabel(member.status, t)}</span>
            </div>
          ))}
        </div>
      )}
      {members.result && <TeachingPagination page={members.result.page} pageSize={members.result.pageSize} total={members.result.total} baseHref={`/org/${orgSlug}/members`} />}

      {canManage && (
        <section className="org-section">
          <h2>{t('添加已有用户', 'Add existing user')}</h2>
          <p className="org-help">{t('这里使用主站账号的数字用户 ID；不会在机构内另建一套登录账号。', 'Use the numeric user ID from an existing main-site account. This does not create a separate organization login.')}</p>
          <form className="org-form org-subsection" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
            <fieldset disabled={submitting}>
              <label>{t('主站用户 ID', 'Main-site user ID')}<input className="org-form-control" name="userId" type="number" min="1" step="1" required inputMode="numeric" /></label>
              <label>{t('机构角色', 'Organization role')}
                <select className="org-form-control" name="role" defaultValue="teacher" required>
                  {assignableRoles.map((memberRole) => <option key={memberRole} value={memberRole}>{teachingRoleLabel(memberRole, t)}</option>)}
                </select>
              </label>
              <div className="org-form-actions"><button className="org-form-button" type="submit">{submitting ? t('添加中…', 'Adding…') : t('添加成员', 'Add member')}</button></div>
            </fieldset>
            <MutationMessage message={error || message} error={!!error} />
          </form>
        </section>
      )}
    </>
  );
}
