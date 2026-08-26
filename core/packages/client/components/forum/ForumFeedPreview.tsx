'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import { fetchForumFeed, type ForumFeedThread } from '@/lib/forum-api';
import { ForumFeedList } from './ForumFeedList';
import './forum-feed.css';

export default function ForumFeedPreview() {
  const [threads, setThreads] = useState<ForumFeedThread[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchForumFeed('active', 1, 3)
      .then((data) => { if (!cancelled) setThreads(data.threads); })
      .catch(() => { /* Homepage preview is optional. */ })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return <section className="forum-feed-preview" aria-busy="true" aria-label={tr({ zh: '社区动态', en: 'Community feed' })} />;
  }
  if (threads.length === 0) return null;

  return (
    <section className="forum-feed-preview">
      <div className="forum-feed-preview-header">
        <h2>
          <Link href="/forum/feed" prefetch={false} className="forum-feed-preview-title-link">
            <T zh="论坛" en="Forum" />
          </Link>
        </h2>
      </div>
      <ForumFeedList threads={threads} compact />
    </section>
  );
}
