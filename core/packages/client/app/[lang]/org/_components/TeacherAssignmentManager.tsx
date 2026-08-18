'use client';

import { useCallback, useMemo, useState, type FormEvent } from 'react';
import type { TeachingTeacherAssignment } from '@cuberoot/shared/teaching';
import { useT } from '@/hooks/useT';
import {
  createTeachingTeacherAssignment,
  listTeachingTeacherAssignments,
  revokeTeachingTeacherAssignment,
  type TeachingMember,
} from '@/lib/teaching-saas-api';
import EffectiveRangeFields, { readEffectiveRange } from './EffectiveRangeFields';
import { MutationMessage, teachingErrorMessage, teachingRoleLabel, useOperationKey, useTeachingPage } from './OrgUi';

type AssignmentTarget = { groupId: string } | { studentId: string };

function rangeText(assignment: TeachingTeacherAssignment, openEnded: string): string {
  const from = new Date(assignment.effectiveFrom).toLocaleString();
  const to = assignment.effectiveTo ? new Date(assignment.effectiveTo).toLocaleString() : openEnded;
  return `${from} – ${to}`;
}

export default function TeacherAssignmentManager({ orgSlug, target, members, memberTotal, allowCreate = true }: {
  orgSlug: string;
  target: AssignmentTarget;
  members: TeachingMember[];
  memberTotal: number;
  allowCreate?: boolean;
}) {
  const t = useT();
  const groupId = 'groupId' in target ? target.groupId : null;
  const studentId = 'studentId' in target ? target.studentId : null;
  const loader = useCallback(
    () => listTeachingTeacherAssignments(orgSlug, groupId ? { groupId } : { studentId: studentId! }, 1, 100),
    [groupId, orgSlug, studentId],
  );
  const assignments = useTeachingPage(loader);
  const operationKey = useOperationKey();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const eligibleMembers = useMemo(() => members.filter((member) => member.status === 'active' && ['owner', 'admin', 'teacher', 'assistant'].includes(member.role)), [members]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const range = readEffectiveRange(data);
    const teacherUserId = Number(data.get('teacherUserId'));
    setMessage('');
    setError('');
    if (!range || !Number.isSafeInteger(teacherUserId) || teacherUserId <= 0) {
      setError(t('请选择负责人，并检查生效时间。', 'Choose a teacher and check the effective range.'));
      return;
    }
    setSubmitting(true);
    try {
      await createTeachingTeacherAssignment(orgSlug, {
        teacherUserId,
        groupId,
        studentId,
        ...range,
      }, operationKey.get());
      operationKey.reset();
      form.reset();
      assignments.reload();
      setMessage(t('负责人已分配。', 'Teacher assigned.'));
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="org-section">
      <h2>{t('负责人', 'Assigned teachers')}</h2>
      {assignments.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : assignments.error ? <MutationMessage message={assignments.error} error /> : !assignments.result?.items.length ? (
        <p className="org-empty">{t('还没有负责人记录。', 'No teacher assignments yet.')}</p>
      ) : (
        <div className="org-list">
          {assignments.result.items.map((assignment) => (
            <div className="org-row" key={assignment.id}>
              <div className="org-row-main">
                <div className="org-row-title">{assignment.teacher.displayName}</div>
                <div className="org-row-meta">{teachingRoleLabel(assignment.teacher.role, t)} / {rangeText(assignment, t('长期有效', 'Open-ended'))}</div>
              </div>
              {allowCreate && (!assignment.effectiveTo || Date.parse(assignment.effectiveTo) > Date.now()) ? (
                <RevokeAssignmentButton orgSlug={orgSlug} assignmentId={assignment.id} onSuccess={assignments.reload} />
              ) : <span className="org-status">{t('已结束', 'Ended')}</span>}
            </div>
          ))}
        </div>
      )}
      {assignments.result && assignments.result.total > assignments.result.items.length && <p className="org-help">{t('这里只显示最近 100 条负责人记录。', 'Only the latest 100 teacher assignments are shown.')}</p>}

      {allowCreate && (
        <form className="org-form org-subsection" onSubmit={submit} onChange={() => { operationKey.reset(); setMessage(''); }}>
          <fieldset disabled={submitting || !eligibleMembers.length}>
            <label className="org-field-wide">{t('选择负责人', 'Choose teacher')}
              <select name="teacherUserId" defaultValue="" required>
                <option value="" disabled>{t('请选择', 'Select')}</option>
                {eligibleMembers.map((member) => <option key={member.userId} value={member.userId}>{member.displayName} ({teachingRoleLabel(member.role, t)})</option>)}
              </select>
            </label>
            <EffectiveRangeFields />
            <div className="org-form-actions"><button type="submit">{submitting ? t('分配中…', 'Assigning…') : t('分配负责人', 'Assign teacher')}</button></div>
          </fieldset>
          {!eligibleMembers.length && <p className="org-help org-field-wide">{t('没有可分配的有效教学成员。', 'There are no active teaching members to assign.')}</p>}
          {memberTotal > members.length && <p className="org-help org-field-wide">{t('选择器只显示前 100 名成员。', 'The selector shows the first 100 members.')}</p>}
          <MutationMessage message={error || message} error={!!error} />
        </form>
      )}
    </section>
  );
}

function RevokeAssignmentButton({ orgSlug, assignmentId, onSuccess }: { orgSlug: string; assignmentId: string; onSuccess: () => void }) {
  const t = useT();
  const operationKey = useOperationKey();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  async function revoke() {
    setSubmitting(true);
    setError('');
    try {
      await revokeTeachingTeacherAssignment(orgSlug, assignmentId, operationKey.get());
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
      <button className="org-secondary-button" type="button" disabled={submitting} onClick={revoke}>{submitting ? t('结束中…', 'Ending…') : t('结束负责', 'End assignment')}</button>
      {error && <span className="org-inline-error" role="alert">{error}</span>}
    </div>
  );
}
