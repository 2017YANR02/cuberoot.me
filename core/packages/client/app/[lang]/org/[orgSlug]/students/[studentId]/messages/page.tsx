'use client';

import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import { hasTeachingPermission } from '@cuberoot/shared/teaching';
import TeachingConversationList from '@/components/teaching/TeachingConversationList';
import { MutationMessage } from '@/components/teaching/TeachingUi';
import { useT } from '@/hooks/useT';
import OrgWorkspace from '../../../../_components/OrgWorkspace';

export default function OrganizationStudentMessagesPage() {
  const params = useParams<{ orgSlug: string; studentId: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  const t = useT();
  const baseHref = `/org/${params.orgSlug}/students/${params.studentId}/messages`;
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => hasTeachingPermission(organization.role, 'conversation:read') ? (
        <TeachingConversationList
          orgSlug={params.orgSlug}
          studentId={params.studentId}
          baseHref={baseHref}
          page={page}
          audience="staff"
          canManage={hasTeachingPermission(organization.role, 'conversation:manage')}
        />
      ) : (
        <MutationMessage message={t('你没有查看该学员沟通记录的权限。', 'You do not have permission to view this learner’s conversations.')} error />
      )}
    </OrgWorkspace>
  );
}
