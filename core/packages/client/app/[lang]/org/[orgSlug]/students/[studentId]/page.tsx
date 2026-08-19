'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { hasTeachingPermission, type TeachingOrganizationRole } from '@cuberoot/shared/teaching';
import { useT } from '@/hooks/useT';
import AppLink from '@/components/AppLink';
import { getTeachingStudent, listTeachingMembers, type TeachingMember, type TeachingStudent } from '@/lib/teaching-saas-api';
import OrgWorkspace from '../../../_components/OrgWorkspace';
import TeacherAssignmentManager from '../../../_components/TeacherAssignmentManager';
import StudentAccountBindingManager from '../../../_components/StudentAccountBindingManager';
import { entityStatusLabel, MutationMessage, teachingErrorMessage } from '../../../_components/OrgUi';

const MEMBER_OPTION_LIMIT = 100;

export default function OrganizationStudentDetailPage() {
  const params = useParams<{ orgSlug: string; studentId: string }>();
  return <OrgWorkspace orgSlug={params.orgSlug}>{(organization) => <StudentDetail orgSlug={params.orgSlug} studentId={params.studentId} role={organization.role} />}</OrgWorkspace>;
}

function StudentDetail({ orgSlug, studentId, role }: { orgSlug: string; studentId: string; role: TeachingOrganizationRole }) {
  const t = useT();
  const [student, setStudent] = useState<TeachingStudent | null>(null);
  const [members, setMembers] = useState<TeachingMember[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [error, setError] = useState('');
  const canManageAssignments = hasTeachingPermission(role, 'assignment:manage');
  const canManageStudent = hasTeachingPermission(role, 'student:manage');
  const canReadPackages = hasTeachingPermission(role, 'package:read');
  const canReadConversations = hasTeachingPermission(role, 'conversation:read');

  useEffect(() => {
    let cancelled = false;
    void getTeachingStudent(orgSlug, studentId).then((value) => {
      if (!cancelled) setStudent(value);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [orgSlug, studentId, t]);

  useEffect(() => {
    if (!canManageAssignments) return;
    let cancelled = false;
    void listTeachingMembers(orgSlug, 1, MEMBER_OPTION_LIMIT).then((result) => {
      if (!cancelled) { setMembers(result.items); setMemberTotal(result.total); }
    }).catch((reason: unknown) => {
      if (!cancelled) setError(teachingErrorMessage(reason, t));
    });
    return () => { cancelled = true; };
  }, [canManageAssignments, orgSlug, t]);

  if (error) return <MutationMessage message={error} error />;
  if (!student) return <p aria-busy="true">{t('正在加载学员…', 'Loading student…')}</p>;

  return (
    <>
      <h2>{student.displayName}</h2>
      <p className="org-lead">{student.externalRef ?? t('无外部编号', 'No external reference')} / {entityStatusLabel(student.status, t)}</p>
      <dl className="org-summary">
        <div><strong>{student.accountUserId ? t('已绑定', 'Linked') : t('未绑定', 'Not linked')}</strong><span>{t('主站学习账号', 'Main-site learning account')}</span></div>
        <div><strong>{entityStatusLabel(student.status, t)}</strong><span>{t('学员状态', 'Student status')}</span></div>
      </dl>
      {(canReadPackages || canReadConversations) && (
        <div className="org-row-action">
          {canReadPackages && <AppLink className="org-primary-link" href={`/org/${orgSlug}/students/${studentId}/packages`} prefetch={false}>{t('查看课包与流水', 'View packages and ledger')}</AppLink>}
          {canReadConversations && <AppLink className="org-primary-link" href={`/org/${orgSlug}/students/${studentId}/messages`} prefetch={false}>{t('家校沟通', 'Family communication')}</AppLink>}
        </div>
      )}
      {canManageStudent && <StudentAccountBindingManager orgSlug={orgSlug} studentId={studentId} linked={student.accountUserId !== null} />}
      {canManageAssignments && <TeacherAssignmentManager orgSlug={orgSlug} target={{ studentId }} members={members} memberTotal={memberTotal} allowCreate={student.status === 'active'} />}
    </>
  );
}
