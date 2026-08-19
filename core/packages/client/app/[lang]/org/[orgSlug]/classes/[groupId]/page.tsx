'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { hasTeachingPermission, type TeachingGroup, type TeachingOrganizationRole, type TeachingStudentGroupMembership } from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  createTeachingGroupMembership,
  getTeachingGroup,
  listTeachingGroupMemberships,
  listTeachingMembers,
  listTeachingStudents,
  revokeTeachingGroupMembership,
  type TeachingMember,
  type TeachingStudent,
} from '@/lib/teaching-saas-api';
import EffectiveRangeFields, { readEffectiveRange } from '../../../_components/EffectiveRangeFields';
import OrgWorkspace from '../../../_components/OrgWorkspace';
import TeacherAssignmentManager from '../../../_components/TeacherAssignmentManager';
import {
  entityStatusLabel,
  MutationMessage,
  teachingErrorMessage,
  useOperationKey,
  useTeachingPage,
} from '../../../_components/OrgUi';

const OPTION_LIMIT = 100;

export default function OrganizationClassDetailPage() {
  const params = useParams<{ orgSlug: string; groupId: string }>();
  return <OrgWorkspace orgSlug={params.orgSlug}>{(organization) => <ClassDetail orgSlug={params.orgSlug} groupId={params.groupId} role={organization.role} />}</OrgWorkspace>;
}

function ClassDetail({ orgSlug, groupId, role }: { orgSlug: string; groupId: string; role: TeachingOrganizationRole }) {
  const t = useT();
  const [group, setGroup] = useState<TeachingGroup | null>(null);
  const [groupError, setGroupError] = useState('');
  const canManageGroup = hasTeachingPermission(role, 'group:manage');
  const canManageAssignments = hasTeachingPermission(role, 'assignment:manage');
  const [students, setStudents] = useState<TeachingStudent[]>([]);
  const [studentTotal, setStudentTotal] = useState(0);
  const [members, setMembers] = useState<TeachingMember[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [optionsError, setOptionsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getTeachingGroup(orgSlug, groupId).then((value) => {
      if (!cancelled) setGroup(value);
    }).catch((reason: unknown) => {
      if (!cancelled) setGroupError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [groupId, orgSlug, t]);

  useEffect(() => {
    if (!canManageGroup && !canManageAssignments) return;
    let cancelled = false;
    const requests: Promise<void>[] = [];
    if (canManageGroup) {
      requests.push(listTeachingStudents(orgSlug, 1, OPTION_LIMIT).then((result) => {
        if (!cancelled) { setStudents(result.items); setStudentTotal(result.total); }
      }));
    }
    if (canManageAssignments) {
      requests.push(listTeachingMembers(orgSlug, 1, OPTION_LIMIT).then((result) => {
        if (!cancelled) { setMembers(result.items); setMemberTotal(result.total); }
      }));
    }
    void Promise.all(requests).catch((reason: unknown) => {
      if (!cancelled) setOptionsError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [canManageAssignments, canManageGroup, orgSlug, t]);

  if (groupError) return <MutationMessage message={groupError} error />;
  if (!group) return <p aria-busy="true">{t('正在加载班级…', 'Loading class…')}</p>;
  const active = group.status === 'active';

  return (
    <>
      <h2>{group.name}</h2>
      <p className="org-lead">{[group.code, entityStatusLabel(group.status, t)].filter(Boolean).join(' / ')}</p>
      {optionsError && <MutationMessage message={optionsError} error />}
      <GroupMemberships orgSlug={orgSlug} groupId={groupId} canManage={canManageGroup && active} students={students} studentTotal={studentTotal} />
      {canManageAssignments && <TeacherAssignmentManager orgSlug={orgSlug} target={{ groupId }} members={members} memberTotal={memberTotal} allowCreate={active} />}
    </>
  );
}

function GroupMemberships({ orgSlug, groupId, canManage, students, studentTotal }: {
  orgSlug: string;
  groupId: string;
  canManage: boolean;
  students: TeachingStudent[];
  studentTotal: number;
}) {
  const t = useT();
  const loader = useCallback(() => listTeachingGroupMemberships(orgSlug, groupId, 1, OPTION_LIMIT), [groupId, orgSlug]);
  const memberships = useTeachingPage(loader);
  const operationKey = useOperationKey();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const range = readEffectiveRange(data);
    const studentId = String(data.get('studentId') ?? '');
    setMessage('');
    setError('');
    if (!range || !studentId) {
      setError(t('请选择学员，并检查生效时间。', 'Choose a student and check the effective range.'));
      return;
    }
    setSubmitting(true);
    try {
      await createTeachingGroupMembership(orgSlug, groupId, { studentId, ...range }, operationKey.get());
      operationKey.reset();
      form.reset();
      memberships.reload();
      setMessage(t('学员已加入班级。', 'Student added to the class.'));
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="org-section">
      <h2>{t('班级学员', 'Class students')}</h2>
      {memberships.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : memberships.error ? (
        <MutationMessage message={memberships.error} error />
      ) : !memberships.result?.items.length ? (
        <p className="org-empty">{t('还没有分班记录。', 'No class memberships yet.')}</p>
      ) : (
        <div className="org-list">
          {memberships.result.items.map((membership) => (
            <div className="org-row" key={membership.id}>
              <AppLink className="org-row-main org-row-link" href={`/org/${orgSlug}/students/${membership.student.id}`} prefetch={false}>
                <div className="org-row-title">{membership.student.displayName}</div>
                <div className="org-row-meta">{membership.student.externalRef ?? t('无外部编号', 'No external reference')} / {rangeText(membership, t('长期有效', 'Open-ended'))}</div>
              </AppLink>
              {canManage && isUnended(membership.effectiveTo) ? <RevokeMembershipButton orgSlug={orgSlug} membershipId={membership.id} onSuccess={memberships.reload} /> : <span className="org-status">{isUnended(membership.effectiveTo) ? entityStatusLabel(membership.student.status, t) : t('已结束', 'Ended')}</span>}
            </div>
          ))}
        </div>
      )}
      {memberships.result && memberships.result.total > memberships.result.items.length && <p className="org-help">{t('这里只显示最近 100 条分班记录。', 'Only the latest 100 class memberships are shown.')}</p>}

      {canManage && (
        <form className="org-form org-subsection" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
          <fieldset disabled={submitting || !students.some((student) => student.status === 'active')}>
            <label className="org-field-wide">{t('选择学员', 'Choose student')}
              <select className="org-form-control" name="studentId" defaultValue="" required>
                <option value="" disabled>{t('请选择', 'Select')}</option>
                {students.filter((student) => student.status === 'active').map((student) => <option key={student.id} value={student.id}>{student.displayName}{student.externalRef ? ` (${student.externalRef})` : ''}</option>)}
              </select>
            </label>
            <EffectiveRangeFields />
            <div className="org-form-actions"><button className="org-form-button" type="submit">{submitting ? t('加入中…', 'Adding…') : t('加入班级', 'Add to class')}</button></div>
          </fieldset>
          {!students.some((student) => student.status === 'active') && <p className="org-help org-field-wide">{t('没有可分配的有效学员。', 'There are no active students to assign.')}</p>}
          {studentTotal > students.length && <p className="org-help org-field-wide">{t('选择器只显示前 100 名学员。', 'The selector shows the first 100 students.')}</p>}
          <MutationMessage message={error || message} error={!!error} />
        </form>
      )}
    </section>
  );
}

function RevokeMembershipButton({ orgSlug, membershipId, onSuccess }: { orgSlug: string; membershipId: string; onSuccess: () => void }) {
  const t = useT();
  const operationKey = useOperationKey();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  async function revoke() {
    setSubmitting(true);
    setError('');
    try {
      await revokeTeachingGroupMembership(orgSlug, membershipId, operationKey.get());
      operationKey.reset();
      onSuccess();
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="org-row-action">
      <button className="org-secondary-button" type="button" disabled={submitting} onClick={revoke}>{submitting ? t('结束中…', 'Ending…') : t('结束分班', 'End membership')}</button>
      {error && <span className="org-inline-error" role="alert">{error}</span>}
    </div>
  );
}

function rangeText(relation: Pick<TeachingStudentGroupMembership, 'effectiveFrom' | 'effectiveTo'>, openEnded: string): string {
  const from = new Date(relation.effectiveFrom).toLocaleString();
  const to = relation.effectiveTo ? new Date(relation.effectiveTo).toLocaleString() : openEnded;
  return `${from} – ${to}`;
}

function isUnended(effectiveTo: string | null): boolean {
  return !effectiveTo || Date.parse(effectiveTo) > Date.now();
}
