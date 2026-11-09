'use client';

import { tr } from '@/i18n/tr';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import type { ForumPost } from '@/lib/forum-api';
import { ForumVideoPlayer } from './ForumVideoPlayer';

/** Preserve the API's deleted / viewer-masked post placeholders in every view. */
export function forumPostPlaceholder(post: ForumPost): string | null {
  if (post.isDeleted || (post.status === 'rejected' && !post.content && !post.videos?.length)) {
    return tr({ zh: '该帖已删除', en: 'This post was deleted' });
  }
  if (post.status === 'pending' && !post.content && !post.videos?.length) {
    return tr({ zh: '该帖待审核', en: 'This post is awaiting review' });
  }
  return null;
}

export function ForumPostBody({ post }: { post: ForumPost }) {
  const placeholder = forumPostPlaceholder(post);
  return (
    <div className="forum-post-body">
      {placeholder ? <p>{placeholder}</p> : <>
        {post.status === 'rejected' && post.reviewNote && (
          <div className="forum-review-note">
            {tr({ zh: '驳回原因:', en: 'Reason: ' })}{post.reviewNote}
          </div>
        )}
        {post.content && renderArticleMarkdown(post.content)}
        {(post.videos ?? []).map(video => <ForumVideoPlayer key={video.id} video={video} />)}
      </>}
    </div>
  );
}
