'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/hooks/useT';
import { loadPlatformManagedLessonMedia, platformMediaBrowserUrl, type PlatformManagedLessonMedia } from '@/lib/platform-gateway';
import type { PlatformEntity } from '@/lib/platform-types';
import type { RunAction } from './PlatformActionTypes';
import { ActionButton } from './PlatformForm';
import { text } from './PlatformFormDefinitions';
import { renderArticleMarkdown } from '@/lib/article-markdown';

export function ContentReviewBadge({ entity }: { entity: PlatformEntity }) {
  const t = useT();
  const status = entity.data?.reviewStatus;
  if (status !== 'pending' && status !== 'rejected') return null;
  return <span className="platform-status" data-review-status={status}>{status === 'pending' ? t('待审核', 'Awaiting review') : t('审核未通过', 'Review rejected')}</span>;
}

function LessonPreview({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const t = useT();
  const [media, setMedia] = useState<PlatformManagedLessonMedia | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void loadPlatformManagedLessonMedia('admin', courseId, lessonId, controller.signal)
      .then(setMedia).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [courseId, lessonId]);
  if (error) return <p role="alert">{t('无法加载视频预览，请重试后再审核。', 'Could not load video preview. Retry before reviewing.')}</p>;
  if (!media) return <p>{t('正在加载课时预览…', 'Loading lesson preview…')}</p>;
  if (!media.accessUrl) return null;
  return <video className="platform-content-review-video" controls preload="metadata" src={platformMediaBrowserUrl(media.accessUrl)} poster={media.posterUrl ? platformMediaBrowserUrl(media.posterUrl) : undefined} />;
}

export function PlatformContentReview({ entity, courseId, lesson = false, admin, busy, runAction }: {
  entity?: PlatformEntity; courseId: string; lesson?: boolean; admin: boolean; busy: string | null; runAction: RunAction;
}) {
  const t = useT();
  const [note, setNote] = useState('');
  const data = entity?.data;
  const status = data?.reviewStatus;
  const reviewId = data?.reviewId;
  if (!entity || !data || typeof reviewId !== 'string' || (status !== 'pending' && status !== 'rejected')) return null;
  const pending = status === 'pending';
  const metadata = data.reviewMetadata && typeof data.reviewMetadata === 'object' ? data.reviewMetadata as Record<string, unknown> : {};
  const presentation = data.presentation && typeof data.presentation === 'object' ? data.presentation as Record<string, unknown> : {};
  const body = (value: unknown) => value && typeof value === 'object' && 'markdown' in value ? String(value.markdown ?? '') : value && typeof value === 'object' ? JSON.stringify(value, null, 2) : '';
  const snapshots = lesson ? [body(data.bodyZh), body(data.bodyEn)] : [data.summaryZh, data.summaryEn, data.descriptionZh, data.descriptionEn];
  return <section className="platform-content-review">
    <div className="platform-course-editor-heading"><h3>{lesson ? t('课时发布审核', 'Lesson publication review') : t('课程发布审核', 'Course publication review')}</h3><ContentReviewBadge entity={entity} /></div>
    {typeof data.reviewNote === 'string' && data.reviewNote && <p>{t('审核意见：', 'Review feedback: ')}{data.reviewNote}</p>}
    {!admin && pending && <><p>{t('审核通过后才会发布。已上线的版本在审核期间保持不变。', 'Publication requires approval. Any live version remains unchanged while in review.')}</p>
      <ActionButton action="withdraw-content-review" resourceId={courseId} payload={{ reviewId }} label={text('撤回审核', 'Withdraw review')} confirm={text('撤回后可以重新编辑并提交审核，确定撤回？', 'Withdraw this submission to edit and resubmit?')} secondary busy={busy} runAction={runAction} /></>}
    {admin && pending && <>
      {typeof data.reviewSubmittedBy === 'string' && <p>{t('提交讲师：', 'Submitted by: ')}{data.reviewSubmittedBy}{typeof data.reviewSubmittedAt === 'string' && <> · {new Date(data.reviewSubmittedAt).toLocaleString()}</>}</p>}
      <h4>{t(String(data.titleZh || data.titleEn || entity.title), String(data.titleEn || data.titleZh || entity.title))}</h4>
      {lesson && <p>{t('访问范围：', 'Access: ')}{metadata.accessScope === 'public' ? t('公开课时', 'Public lesson') : t('需课程权益', 'Entitled learners')}</p>}
      {!lesson && <><p>{data.reviewTargetStatus === 'unlisted' ? t('不公开列出', 'Unlisted') : t('公开发布', 'Public publication')} · {t('价格', 'Price')} {String(metadata.currency ?? data.currency ?? 'CNY')} {Number(metadata.baseAmountMinor ?? 0) / 100}{metadata.memberAmountMinor != null && <> · {t('会员价', 'Member price')} {Number(metadata.memberAmountMinor) / 100}</>}</p>
        {typeof presentation.coverUrl === 'string' && presentation.coverUrl && <img className="platform-content-review-cover" src={presentation.coverUrl} alt={t('课程封面', 'Course cover')} />}
        {typeof presentation.mobileCoverUrl === 'string' && presentation.mobileCoverUrl && <img className="platform-content-review-cover" src={presentation.mobileCoverUrl} alt={t('移动端封面', 'Mobile cover')} />}
        {Array.isArray(presentation.outline) && <ul>{presentation.outline.map((item, index) => <li key={index}>{String(item?.label ?? '')} {String(item?.topic ?? '')}</li>)}</ul>}
      </>}
      {snapshots.filter(value => typeof value === 'string' && value.trim()).map((value, index) => <div className="platform-prose platform-content-review-copy" key={index}>{renderArticleMarkdown(String(value))}</div>)}
      {lesson && <LessonPreview key={reviewId} courseId={courseId} lessonId={entity.id} />}
      <label className="platform-field"><span>{t('审核意见（驳回时必填）', 'Review feedback (required for rejection)')}</span><textarea className="platform-field-control" rows={3} maxLength={4000} value={note} onChange={event => setNote(event.target.value)} /></label>
      <div className="platform-route-actions">
        <button type="button" className="platform-button" disabled={!!busy || !note.trim()} onClick={() => void runAction('decide-content-review', courseId, { reviewId, decision: 'rejected', note })}>{t('驳回', 'Reject')}</button>
        <button type="button" className="platform-button platform-button-primary" disabled={!!busy} onClick={() => void runAction('decide-content-review', courseId, { reviewId, decision: 'approved', note })}>{t('审核通过并发布', 'Approve and publish')}</button>
      </div>
    </>}
  </section>;
}

export function reviewEditableEntity(entity: PlatformEntity | undefined): PlatformEntity | undefined {
  if (!entity || !entity.data?.reviewMetadata || !['rejected', 'withdrawn'].includes(String(entity.data.reviewStatus))) return entity;
  return { ...entity, data: { ...entity.data, ...(entity.data.reviewMetadata as Record<string, unknown>), status: entity.data.reviewTargetStatus ?? entity.status } };
}
