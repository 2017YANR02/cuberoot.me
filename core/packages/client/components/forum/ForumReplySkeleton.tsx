import { tr } from '@/i18n/tr';

export function ForumReplySkeleton() {
  return (
    <div className="community-feed-reply-skeleton" role="status" aria-label={tr({ zh: '加载回复中…', en: 'Loading replies…' })}>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </div>
  );
}
