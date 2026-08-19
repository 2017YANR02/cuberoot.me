'use client';

import { useParams } from 'next/navigation';
import { parseAsInteger, useQueryState } from 'nuqs';
import LearnerWorkspace from '@/components/teaching/LearnerWorkspace';
import TeachingConversationList from '@/components/teaching/TeachingConversationList';

export default function LearnerMessagesPage() {
  const params = useParams<{ orgSlug: string; studentId: string }>();
  const [rawPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const page = Math.max(1, rawPage);
  const baseHref = `/learn/${params.orgSlug}/students/${params.studentId}/messages`;
  return (
    <LearnerWorkspace orgSlug={params.orgSlug} studentId={params.studentId}>
      {() => (
        <TeachingConversationList
          orgSlug={params.orgSlug}
          studentId={params.studentId}
          baseHref={baseHref}
          page={page}
          audience="learner"
          canManage
        />
      )}
    </LearnerWorkspace>
  );
}
