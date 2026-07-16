'use client';

// /forum/review — 管理员审核台:待审核内容(issue #36)+ 举报处理(forum_reports)。
// 待审队列先来先审;每项就地 通过/驳回(驳回可附原因,随站内通知+邮件发给作者)。

import { useCallback, useEffect, useState } from 'react';
import { Hourglass, Check, CircleX, ExternalLink } from 'lucide-react';
import Link from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import PillToggle from '@/components/PillToggle/PillToggle';
import { tr, T, useLang } from '@/i18n/tr';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useIsAdmin } from '@/lib/auth-store';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { displayCuberName } from '@/lib/cuber-name-display';
import {
  fetchReviewQueue, moderateReview, fetchReports, resolveReport,
  type ReviewItem, type ForumReport,
} from '@/lib/forum-api';
import { ForumBreadcrumbs } from '../_components/ForumBreadcrumbs';
import { formatRelativeTime } from '../_lib/forum-format';
import '../forum.css';
import './forum_review.css';

export default function ForumReviewPage() {
  useDocumentTitle('论坛审核', 'Forum moderation');
  const lang = useLang();
  const zh = lang === 'zh';
  const isAdmin = useIsAdmin();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // on = 待审核(主项),off = 举报
  const [showQueue, setShowQueue] = useState(true);
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [reports, setReports] = useState<ForumReport[] | null>(null);
  const [showAllReports, setShowAllReports] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    fetchReviewQueue()
      .then(d => setItems(d.items))
      .catch(e => setError((e as Error).message));
    fetchReports(showAllReports)
      .then(d => setReports(d.reports))
      .catch(e => setError((e as Error).message));
  }, [showAllReports]);

  useEffect(() => { if (mounted && isAdmin) load(); }, [mounted, isAdmin, load]);

  const handleModerate = async (item: ReviewItem, action: 'approve' | 'reject') => {
    let reason: string | undefined;
    if (action === 'reject') {
      const input = window.prompt(tr({
        zh: '驳回原因(可留空,作者会收到):',
        en: 'Rejection reason (optional, sent to the author):',
      }));
      if (input === null) return;
      reason = input.trim().slice(0, 500) || undefined;
    }
    try {
      await moderateReview(item.type, item.id, action, reason);
      setItems(list => (list ?? []).filter(x => !(x.type === item.type && x.id === item.id)));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleResolve = async (report: ForumReport) => {
    try {
      await resolveReport(report.id);
      setReports(list => (list ?? []).map(r => (
        r.id === report.id ? { ...r, resolvedAt: new Date().toISOString() } : r
      )));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (!mounted) return null;
  if (!isAdmin) {
    return (
      <div className="forum-page">
        <ForumBreadcrumbs items={[{ label: tr({ zh: '审核', en: 'Moderation' }) }]} />
        <div className="forum-error"><T zh="需要管理员权限。" en="Admin access required." /></div>
      </div>
    );
  }

  return (
    <div className="forum-page forum-review-page">
      <ForumBreadcrumbs items={[{ label: tr({ zh: '审核', en: 'Moderation' }) }]} />
      <div className="forum-page-header">
        <div>
          <h1><T zh="论坛审核" en="Forum moderation" /></h1>
          <p className="forum-subtitle">
            <T
              zh="新用户的帖子先审后发;举报由这里处理。"
              en="New users' posts are held for review; reports are handled here too."
            />
          </p>
        </div>
        <div className="forum-header-actions">
          <PillToggle
            value={showQueue}
            onChange={setShowQueue}
            onLabel={tr({ zh: '待审核', en: 'Queue' })}
            offLabel={tr({ zh: '举报', en: 'Reports' })}
            ariaLabel={tr({ zh: '切换 待审核/举报', en: 'Toggle queue/reports' })}
          />
        </div>
      </div>

      {error && <div className="forum-error">{error}</div>}

      {showQueue && (
        !items ? (
          !error && <div className="forum-loading"><T zh="加载中…" en="Loading…" /></div>
        ) : items.length === 0 ? (
          <div className="forum-empty"><T zh="队列空了,没有待审核的内容。" en="Queue is clear — nothing awaiting review." /></div>
        ) : (
          <div className="forum-review-list">
            {items.map(item => (
              <article key={`${item.type}-${item.id}`} className="forum-review-item">
                <div className="forum-review-item-head">
                  <span className="forum-badge forum-badge-pending">
                    <Hourglass size={11} aria-hidden="true" />
                    {item.type === 'thread'
                      ? tr({ zh: '新主题', en: 'New thread' })
                      : tr({ zh: '回帖', en: 'Reply' })}
                  </span>
                  <span className="forum-review-item-author">{displayCuberName(item.authorName, zh)}</span>
                  <span className="forum-review-item-time">{formatRelativeTime(item.createdAt, lang)}</span>
                  {item.type === 'thread' && (item.forumNameZh || item.forumNameEn) && (
                    <span className="forum-review-item-forum">{zh ? item.forumNameZh : item.forumNameEn}</span>
                  )}
                </div>
                <Link href={`/forum/t/${item.threadId}`} prefetch={false} className="forum-review-item-title">
                  {item.threadTitle}
                  <ExternalLink size={12} aria-hidden="true" />
                </Link>
                <div className="forum-review-item-body forum-post-body">
                  {renderArticleMarkdown(item.content)}
                </div>
                <div className="forum-review-item-actions">
                  <button
                    type="button" className="forum-post-action is-approve"
                    onClick={() => handleModerate(item, 'approve')}
                  >
                    <Check size={13} aria-hidden="true" /> <T zh="通过" en="Approve" />
                  </button>
                  <button
                    type="button" className="forum-post-action is-danger"
                    onClick={() => handleModerate(item, 'reject')}
                  >
                    <CircleX size={13} aria-hidden="true" /> <T zh="驳回" en="Reject" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {!showQueue && (
        !reports ? (
          !error && <div className="forum-loading"><T zh="加载中…" en="Loading…" /></div>
        ) : (
          <>
            <BoolToggle
              className="forum-review-showall"
              value={showAllReports}
              onChange={setShowAllReports}
              label={tr({ zh: '含已处理', en: 'Include resolved' })}
            />
            {reports.length === 0 ? (
              <div className="forum-empty"><T zh="没有待处理的举报。" en="No open reports." /></div>
            ) : (
              <div className="forum-review-list">
                {reports.map(r => (
                  <article key={r.id} className={`forum-review-item${r.resolvedAt ? ' is-resolved' : ''}`}>
                    <div className="forum-review-item-head">
                      <span className="forum-badge forum-badge-rejected">
                        {tr({ zh: '举报', en: 'Report' })}
                      </span>
                      <span className="forum-review-item-author">
                        {displayCuberName(r.reporterName, zh)}
                        {' → '}
                        {displayCuberName(r.postAuthorName, zh)}
                      </span>
                      <span className="forum-review-item-time">{formatRelativeTime(r.createdAt, lang)}</span>
                      {r.resolvedAt && (
                        <span className="forum-review-item-resolved">
                          <Check size={11} aria-hidden="true" /><T zh="已处理" en="Resolved" />
                        </span>
                      )}
                    </div>
                    <Link href={`/forum/t/${r.threadId}#post-${r.postId}`} prefetch={false} className="forum-review-item-title">
                      {r.threadTitle}
                      <ExternalLink size={12} aria-hidden="true" />
                    </Link>
                    <div className="forum-review-item-reason">
                      {tr({ zh: '理由:', en: 'Reason: ' })}{r.reason}
                    </div>
                    <div className="forum-review-item-body forum-review-item-excerpt">{r.excerpt}</div>
                    {!r.resolvedAt && (
                      <div className="forum-review-item-actions">
                        <button
                          type="button" className="forum-post-action is-approve"
                          onClick={() => handleResolve(r)}
                        >
                          <Check size={13} aria-hidden="true" /> <T zh="标记已处理" en="Mark resolved" />
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
