'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { fetchForumIndex, type ForumIndexData } from '@/lib/forum-api';
import { forumIcon } from './_lib/forum-icons';
import { ForumHeader } from './_components/ForumHeader';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import './forum.css';

export default function ForumIndexPage() {
  const t = useT();
  const [data, setData] = useState<ForumIndexData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchForumIndex()
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="forum-page forum-directory-page">
      <ForumHeader activeView="boards" />

      {error && <div className="forum-error">{error}</div>}
      {!data && !error && <ContentSkeleton variant="list" columns={2} rows={6} />}

      {data && (
        <div className="forum-directory">
          {data.categories.map(cat => {
            // adminOnly restricts posting, not reading.
            if (cat.forums.length === 0) return null;
            return (
              <section key={cat.id} className="forum-cat" aria-labelledby={`forum-category-${cat.id}`}>
                <h2 id={`forum-category-${cat.id}`} className="forum-cat-title">
                  {t(cat.nameZh, cat.nameEn)}
                </h2>
                <div className="forum-cat-forums">
                  {cat.forums.map(f => {
                    const Icon = forumIcon(f.icon);
                    const description = t(f.descZh, f.descEn);
                    return (
                      <Link key={f.id} href={`/forum/f/${f.slug}`} prefetch={false} className="forum-forum-row">
                        <Icon size={22} strokeWidth={1.5} className="forum-forum-icon" aria-hidden="true" />
                        <span className="forum-forum-main">
                          <span className="forum-forum-name">{t(f.nameZh, f.nameEn)}</span>
                          {description && <span className="forum-forum-desc">{description}</span>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
