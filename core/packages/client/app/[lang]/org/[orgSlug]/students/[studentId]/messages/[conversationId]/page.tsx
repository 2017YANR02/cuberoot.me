'use client';

import { useParams } from 'next/navigation';
import { hasTeachingPermission } from '@cuberoot/shared/teaching';
import TeachingConversationThread from '@/components/teaching/TeachingConversationThread';
import { MutationMessage } from '@/components/teaching/TeachingUi';
import { useT } from '@/hooks/useT';
import OrgWorkspace from '../../../../../_components/OrgWorkspace';

export default function OrganizationStudentMessageThreadPage() {
  const params = useParams<{ orgSlug: string; studentId: string; conversationId: string }>();
  const t = useT();
  const baseHref = `/org/${params.orgSlug}/students/${params.studentId}/messages`;
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => hasTeachingPermission(organization.role, 'conversation:read') ? (
        <TeachingConversationThread
          orgSlug={params.orgSlug}
          studentId={params.studentId}
          conversationId={params.conversationId}
          baseHref={baseHref}
          canReply={hasTeachingPermission(organization.role, 'conversation:manage')}
        />
      ) : (
        <MutationMessage message={t('你没有查看该学员沟通记录的权限。', 'You do not have permission to view this learner’s conversations.')} error />
      )}
    </OrgWorkspace>
  );
}
