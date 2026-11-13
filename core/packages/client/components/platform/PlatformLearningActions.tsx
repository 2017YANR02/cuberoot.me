'use client';

import { Star } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import type { PlatformEntity } from '@/lib/platform-types';
import { PlatformPurchaseForm } from './PlatformPurchaseForm';
import { PlatformFavoriteButton } from './PlatformFavoriteButton';
import { type DomainFormSpec, type CommonProps } from './PlatformActionTypes';
import { text, field } from './PlatformFormDefinitions';
import { DomainForm, ActionButton } from './PlatformForm';

const COURSE_REVIEW_FORM: DomainFormSpec = {
  title: text('撰写评论', 'Write a Review'),
  action: 'submit-review',
  fields: [field('rating', '轻点星星评分', 'Tap to rate', { kind: 'rating', required: true }), field('title', '标题（选填）', 'Title (optional)', { maxLength: 160 }), field('body', '评价内容（选填）', 'Review (optional)', { kind: 'textarea', rows: 5, maxLength: 4000 })],
};

function ReviewStars({ rating }: { rating: number }) {
  const t = useT();
  const value = Math.max(0, Math.min(5, Number.isFinite(rating) ? rating : 0));
  return <span className="platform-review-stars" role="img" aria-label={t(`${value} 分，满分 5 分`, `${value} out of 5 stars`)}>
    {[1, 2, 3, 4, 5].map(star => <span key={star} className="platform-review-star">
      <Star aria-hidden="true" />
      <span style={{ width: `${Math.max(0, Math.min(1, value - star + 1)) * 100}%` }}><Star aria-hidden="true" /></span>
    </span>)}
  </span>;
}

function CourseReviewSummary({ entity }: { entity?: PlatformEntity }) {
  const t = useT();
  const raw = entity?.data?.reviewSummary;
  const summary = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  const count = Number(summary?.count);
  const average = Number(summary?.average);
  const loaded = summary !== null && Number.isInteger(count) && count >= 0
    && (count === 0 || (Number.isFinite(average) && average >= 1 && average <= 5));
  const reviews = Array.isArray(entity?.data?.reviews) ? entity.data.reviews as Record<string, unknown>[] : [];
  return <>
    <h2>{t('评分及评论', 'Ratings & Reviews')}</h2>
    {loaded ? <div className="platform-review-summary">
      <div className="platform-review-score">{count > 0 ? average.toFixed(1) : '—'}</div>
      <div className="platform-review-total">
        <ReviewStars rating={count > 0 ? average : 0} />
        <p>{t(`${count.toLocaleString('zh-CN')} 个评分`, `${count.toLocaleString('en-US')} ${count === 1 ? 'rating' : 'ratings'}`)}</p>
      </div>
    </div> : <p className="platform-domain-note">{t('评分暂未加载。', 'Ratings are not available yet.')}</p>}
    {loaded && count === 0 ? <p className="platform-domain-note">{t('还没有评价，分享你的学习感受吧。', 'No reviews yet. Share your learning experience.')}</p> : null}
    {reviews.length ? <>
      <h3>{t('最新评论', 'Latest Reviews')}</h3>
      <div className="platform-review-list" tabIndex={0} role="region" aria-label={t('最新评论', 'Latest Reviews')}>
        {reviews.map(review => <article className="platform-review-card" key={String(review.id)}>
          {review.title ? <h4>{String(review.title)}</h4> : null}
          <div className="platform-review-byline">
            <ReviewStars rating={Number(review.rating)} />
            <span>{typeof review.authorName === 'string' && review.authorName.trim() ? review.authorName : t('学员', 'Learner')}</span>
            {typeof review.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(review.createdAt) ? <time dateTime={review.createdAt}>{review.createdAt.slice(0, 10)}</time> : null}
          </div>
          {review.body ? <p>{String(review.body)}</p> : null}
        </article>)}
      </div>
    </> : null}
  </>;
}

export function PlatformLearningActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  const t = useT();
  if (definition.id === 'course-detail') {
    const mode = entity?.data?.enrollmentMode;
    return (
      <div className="platform-domain-stack">
        <section className="platform-domain-actions">
          <h2>{t('课程操作', 'Course actions')}</h2>
          <div className="platform-write-actions">
            {mode === 'free' ? <ActionButton action="enroll" resourceId={params.id} busy={busy} runAction={runAction} /> : null}
            <PlatformFavoriteButton definition={definition} targetType="course" entityId={entity?.id} />
            {mode === 'invite' ? <AppLink className="platform-button platform-button-primary" href="/platform/account/invites">{t('兑换课程邀请', 'Redeem course invitation')}</AppLink> : null}
          </div>
          {mode === 'admin_grant' ? <p>{t('这门课程由管理员或机构授予，请联系课程运营方。', 'This course is granted by an administrator or organization; contact the course operator.')}</p> : null}
        </section>
        {mode === 'purchase' ? (
          <PlatformPurchaseForm entity={entity} kind="course" busy={busy} runAction={runAction} />
        ) : null}
        <section className="platform-course-reviews" aria-label={t('评分及评论', 'Ratings & Reviews')}>
          <CourseReviewSummary entity={entity} />
          <DomainForm definition={definition} resourceId={entity?.id ?? params.id} busy={busy} runAction={runAction} spec={COURSE_REVIEW_FORM} />
        </section>
      </div>
    );
  }
  if (definition.id === 'account-invites') {
    return <DomainForm definition={definition} entity={entity} busy={busy} runAction={runAction} spec={{ title: text('兑换课程码', 'Redeem course code'), action: 'redeem-invite', submit: text('兑换', 'Redeem'), fields: [field('code', '兑换码', 'Redemption code', { required: true, minLength: 3, maxLength: 128 })] }} />;
  }
  return null;
}
