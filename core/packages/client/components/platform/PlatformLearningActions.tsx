'use client';

import { Star } from '@app-foundation/icons/lucide';
import { useEffect, useRef, useState } from 'react';
import AppLink from '@/components/AppLink';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { nextQuery, useAuthUser } from '@/lib/auth-store';
import { commerceRecord } from '@/lib/platform-commerce-format';
import { loadPlatformResource } from '@/lib/platform-gateway';
import type { PlatformEntity } from '@/lib/platform-types';
import { PlatformPurchaseForm } from './PlatformPurchaseForm';
import { PlatformFavoriteButton } from './PlatformFavoriteButton';
import { type DomainFormSpec, type CommonProps } from './PlatformActionTypes';
import { text, field } from './PlatformFormDefinitions';
import { DomainForm, ActionButton } from './PlatformForm';

const COURSE_REVIEW_FORM: DomainFormSpec = {
  title: text('撰写评价', 'Write a review'),
  action: 'submit-review',
  fields: [
    field('rating', '星级评分', 'Star rating', { kind: 'rating', required: true }),
    field('title', '标题（选填）', 'Title (optional)', { maxLength: 160 }),
    field('body', '评价内容（选填）', 'Review (optional)', { kind: 'textarea', rows: 4, maxLength: 4000 }),
  ],
};
const EDIT_REVIEW_FORM: DomainFormSpec = {
  ...COURSE_REVIEW_FORM, title: text('编辑评价', 'Edit review'), submit: text('保存评价', 'Save review'),
};

const STAR_VALUES = [1, 2, 3, 4, 5];
type ReviewRecord = Readonly<Record<string, unknown>>;

function readReviews(raw: unknown): ReviewRecord[] {
  return Array.isArray(raw) ? raw.map(commerceRecord).filter(review => typeof review.id === 'string') : [];
}

function ReviewStars({ rating }: { rating: number }) {
  const t = useT();
  const value = Math.max(0, Math.min(5, Number.isFinite(rating) ? rating : 0));
  return <span className="platform-review-stars" role="img" aria-label={t(`${value} 分，满分 5 分`, `${value} out of 5 stars`)}>
    {STAR_VALUES.map(star => <span key={star} className="platform-review-star">
      <Star aria-hidden="true" />
      <span style={{ width: `${Math.max(0, Math.min(1, value - star + 1)) * 100}%` }}><Star aria-hidden="true" /></span>
    </span>)}
  </span>;
}

function CourseReviewSummary({ summary }: { summary: unknown }) {
  const t = useT();
  const lang = useLang();
  const data = commerceRecord(summary);
  const count = Number(data.count);
  const average = Number(data.average);
  if (!Number.isInteger(count) || count < 0 || (count > 0 && (!Number.isFinite(average) || average < 1 || average > 5))) {
    return <p className="platform-domain-note">{t('评分暂未加载。', 'Ratings are not available yet.')}</p>;
  }
  if (!count) return null;
  const distribution = data.distribution;
  const hasDistribution = Array.isArray(distribution) && distribution.length === 5
    && distribution.every(value => Number.isInteger(value) && value >= 0)
    && distribution.reduce((sum, value) => sum + value, 0) === count;
  const score = average.toFixed(1);
  const formattedCount = count.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US');

  return <div className="platform-review-summary" data-site-surface="panel">
    <div className="platform-review-average">
      <strong className="platform-review-score">{score}</strong>
      <div className="platform-review-total">
        <ReviewStars rating={Number(score)} />
        <p>{t(`${formattedCount} 个评分`, `${formattedCount} ${count === 1 ? 'rating' : 'ratings'}`)}</p>
      </div>
    </div>
    {hasDistribution && <ul className="platform-review-distribution" aria-label={t('星级分布', 'Rating distribution')}>
      {[...STAR_VALUES].reverse().map(star => {
        const value = distribution[star - 1] as number;
        const ratio = value / count;
        const label = t(`${star} 星，${value} 个评分`, `${star} stars, ${value} ratings`);
        return <li key={star}>
          <span className="sr-only">{label}</span>
          <span aria-hidden="true">{t(`${star} 星`, `${star}★`)}</span>
          <span className="platform-review-bar" aria-hidden="true"><span style={{ width: `${ratio * 100}%` }} /></span>
          <span aria-hidden="true">{ratio.toLocaleString(lang, { style: 'percent', maximumFractionDigits: 1 })}</span>
        </li>;
      })}
    </ul>}
  </div>;
}

function CourseReviewList({ courseId, initial, initialHasMore }: { courseId: string; initial: ReviewRecord[]; initialHasMore: boolean }) {
  const t = useT();
  const [additional, setAdditional] = useState<ReviewRecord[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function loadMore() {
    if (request.current || !hasMore) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(false);
    try {
      const result = await loadPlatformResource('courses', {
        params: { id: courseId }, reviewPage: page + 1, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const data = result.items[0]?.data;
      if (!data || !Array.isArray(data.reviews)) throw new Error('Missing reviews');
      const seen = new Set([...initial, ...additional].map(review => review.id));
      setAdditional([...additional, ...readReviews(data.reviews).filter(review => !seen.has(review.id))]);
      setPage(page + 1);
      setHasMore(data.reviewsHasMore === true);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const reviews = [...initial, ...additional];
  if (!reviews.length) return <p className="platform-review-empty">{t('还没有文字评价。', 'No written reviews yet.')}</p>;
  return <div>
    <h3>{t('最新评论', 'Latest reviews')}</h3>
    <ul className="platform-review-list">
      {reviews.map(review => <li key={String(review.id)}><article className="platform-review-card">
        <div className="platform-review-byline">
          <strong>{typeof review.authorName === 'string' && review.authorName.trim() ? review.authorName : t('学员', 'Learner')}</strong>
          <ReviewStars rating={Number(review.rating)} />
          {typeof review.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(review.createdAt)
            && <time dateTime={review.createdAt}>{review.createdAt.slice(0, 10)}</time>}
        </div>
        {typeof review.title === 'string' && review.title && <h4>{review.title}</h4>}
        {typeof review.body === 'string' && review.body && <p>{review.body}</p>}
      </article></li>)}
    </ul>
    {error && <p className="platform-domain-note" role="alert">{t('更多评价暂未加载。', 'Could not load more reviews.')}</p>}
    {hasMore && <button type="button" className="platform-button platform-review-more" disabled={loading} onClick={() => { void loadMore(); }}>
      {loading ? t('正在加载', 'Loading') : error ? t('重试', 'Retry') : t('加载更多评价', 'Load more reviews')}
    </button>}
  </div>;
}

function CourseReviews({ definition, entity, busy, runAction, reviewMessage }: CommonProps & { entity: PlatformEntity }) {
  const t = useT();
  const lang = useLang();
  const user = useAuthUser();
  const [editing, setEditing] = useState(false);
  const [revision, setRevision] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const data = entity.data ?? {};
  const mine = commerceRecord(data.myReview);
  const hasReview = typeof mine.id === 'string';
  const canWrite = Boolean(user) && data.canReview !== false;
  const reviews = readReviews(data.reviews);
  const courseHref = `${lang === 'zh' ? '/zh' : ''}/platform/courses/${encodeURIComponent(entity.id)}#platform-course-reviews`;
  const editingEntity = hasReview ? { ...entity, data: mine } : undefined;

  return <section className="platform-course-reviews" id="platform-course-reviews" aria-labelledby="platform-course-reviews-title">
    <header className="platform-review-heading">
      <h2 id="platform-course-reviews-title">{t('学员评价', 'Learner reviews')}</h2>
      <div className="platform-review-actions">
        <PlatformFavoriteButton definition={definition} targetType="course" entityId={entity.id} />
        {!user ? <AppLink className="platform-button" href={`/account${nextQuery(courseHref)}`} prefetch={false}>
          {t('登录后评价', 'Sign in to review')}
        </AppLink> : canWrite ? <MoreToggle ref={trigger} className="platform-button" expanded={editing}
          disabled={Boolean(busy)} onToggle={() => setEditing(open => !open)}>
          {editing ? t('收起编辑', 'Close editor') : hasReview ? t('编辑评价', 'Edit review') : t('写评价', 'Write a review')}
        </MoreToggle> : <span className="platform-review-eligibility">{t('解锁课程后可评价', 'Unlock this course to leave a review')}</span>}
      </div>
    </header>
    {canWrite && <MoreTogglePanel className="platform-review-composer" expanded={editing}>
      <DomainForm definition={definition} resourceId={entity.id} entity={editingEntity} busy={busy} runAction={runAction}
        spec={hasReview ? EDIT_REVIEW_FORM : COURSE_REVIEW_FORM} onResult={() => {
          setEditing(false);
          setRevision(value => value + 1);
          requestAnimationFrame(() => trigger.current?.focus());
        }} />
    </MoreTogglePanel>}
    {reviewMessage && <p className="platform-action-message" role={reviewMessage.error ? 'alert' : 'status'}>{reviewMessage.text}</p>}
    <div className="platform-review-layout">
      <CourseReviewSummary summary={data.reviewSummary} />
      <CourseReviewList key={`${entity.id}:${revision}:${reviews.map(item => item.id).join(',')}`}
        courseId={entity.id} initial={reviews} initialHasMore={data.reviewsHasMore === true} />
    </div>
  </section>;
}

export function PlatformLearningActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  const t = useT();
  if (definition.id === 'course-detail') {
    if (!entity) return null;
    const mode = entity.data?.enrollmentMode;
    return (
      <div className="platform-domain-stack" id="platform-course-access">
        {mode === 'free' && <section className="platform-domain-actions">
          <ActionButton action="enroll" resourceId={params.id} busy={busy} runAction={runAction} />
        </section>}
        {mode === 'admin_grant' && <p>{t('这门课程由管理员或机构授予，请联系课程运营方。', 'This course is granted by an administrator or organization; contact the course operator.')}</p>}
        {mode === 'purchase' && <PlatformPurchaseForm entity={entity} kind="course" busy={busy} runAction={runAction} />}
        <CourseReviews {...props} entity={entity} />
      </div>
    );
  }
  if (definition.id === 'account-invites') {
    return <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{ title: text('兑换课程码', 'Redeem course code'), action: 'redeem-invite', submit: text('兑换', 'Redeem'), fields: [field('code', '兑换码', 'Redemption code', { required: true, minLength: 3, maxLength: 128 })] }} />;
  }
  return null;
}
