'use client';

import { useParams } from 'next/navigation';
import LearnerWorkspace from '@/components/teaching/LearnerWorkspace';
import TeachingConversationThread from '@/components/teaching/TeachingConversationThread';

export default function LearnerMessageThreadPage() {
  const params = useParams<{ orgSlug: string; studentId: string; conversationId: string }>();
  const baseHref = `/learn/${params.orgSlug}/students/${params.studentId}/messages`;
  return (
    <LearnerWorkspace orgSlug={params.orgSlug} studentId={params.studentId}>
      {() => (
        <TeachingConversationThread
          orgSlug={params.orgSlug}
          studentId={params.studentId}
          conversationId={params.conversationId}
          baseHref={baseHref}
          canReply
        />
      )}
    </LearnerWorkspace>
  );
}
