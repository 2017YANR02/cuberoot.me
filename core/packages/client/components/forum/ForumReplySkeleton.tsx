import { tr } from '@/i18n/tr';
import { ContentSkeleton } from '@/components/ContentSkeleton';

export function ForumReplySkeleton() {
  return (
    <ContentSkeleton variant="text" className="community-feed-reply-skeleton" label={tr({ zh: '加载回复中…', en: 'Loading replies…' })} />
  );
}
