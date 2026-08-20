'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
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
        <div>
          <div className="forum-feed-preview-kicker"><T zh="正在发生" en="Happening now" /></div>
          <h2><T zh="社区动态" en="Community feed" /></h2>
        </div>
        <div className="forum-feed-preview-links">
          <Link href="/forum" prefetch={false}><T zh="版块" en="Boards" /></Link>
          <Link href="/forum/feed" prefetch={false}>
            <T zh="全部动态" en="Full feed" /><ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <ForumFeedList threads={threads} compact />
    </section>
  );
}
