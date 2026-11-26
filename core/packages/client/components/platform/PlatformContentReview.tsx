'use client';

import { useEffect, useState } from 'react';
import MoreToggle from '@/components/MoreToggle';
import { commerceMoney, commerceRecord } from '@/lib/platform-commerce-format';
import { useT } from '@/hooks/useT';
import { loadPlatformManagedLessonMedia, platformMediaBrowserUrl, type PlatformManagedLessonMedia } from '@/lib/platform-gateway';
import type { PlatformEntity } from '@/lib/platform-types';
import type { RunAction } from './PlatformActionTypes';
import { PlatformCourseDetail } from './PlatformCourseDetail';
import { ActionButton } from './PlatformForm';
import { text } from './PlatformFormDefinitions';
import { renderArticleMarkdown } from '@/lib/article-markdown';

export function ContentReviewBadge({ entity }: { entity: PlatformEntity }) {
  const t = useT();
  const status = entity.data?.reviewStatus;
  if (status !== 'pending' && status !== 'rejected') return null;
  return <span className="platform-status" data-review-status={status}>{status === 'pending' ? t('待审核', 'Awaiting review') : t('审核未通过', 'Review rejected')}</span>;
}

function LessonPreview({ courseId, lessonId, admin }: { courseId: string; lessonId: string; admin: boolean }) {
  const t = useT();
  const [media, setMedia] = useState<PlatformManagedLessonMedia | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void loadPlatformManagedLessonMedia(admin ? 'admin' : 'instructor', courseId, lessonId, controller.signal)
      .then(value => { if (!controller.signal.aborted) setMedia(value); }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [admin, courseId, lessonId]);
  if (error) return <p role="alert">{t('无法加载视频预览。', 'Could not load the video preview.')}</p>;
  if (!media) return <p>{t('正在加载课时预览…', 'Loading lesson preview…')}</p>;
  if (!media.accessUrl) return null;
  return <video className="platform-content-review-video" controls preload="metadata" src={platformMediaBrowserUrl(media.accessUrl)} poster={media.posterUrl ? platformMediaBrowserUrl(media.posterUrl) : undefined} />;
}

export function PlatformContentReview({ entity, courseId, lesson = false, quiz = false, admin, busy, runAction, preview = false }: {
  entity?: PlatformEntity; courseId: string; lesson?: boolean; quiz?: boolean; admin: boolean; busy: string | null; runAction: RunAction; preview?: boolean;
}) {
  const t = useT();
  const [note, setNote] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const data = entity?.data;
  if (!entity || !data) return null;
  const reviewId = data.reviewId;
  const pending = data.reviewStatus === 'pending' && typeof reviewId === 'string';
  const rejected = data.reviewStatus === 'rejected' && typeof reviewId === 'string';
  if (!pending && !rejected && !preview) return null;
  const before = admin ? commerceRecord(data.reviewBase) : {};
  const compare = Object.keys(before).length > 0;
  const candidate: Record<string, unknown> = { ...data, ...commerceRecord(data.reviewMetadata), status: data.reviewTargetStatus ?? data.status };
  const presentation = commerceRecord(candidate.presentation);
  const body = (value: unknown) => {
    if (typeof value === 'string') return value;
    const fields = commerceRecord(value);
    return String(fields.markdown ?? fields.text ?? fields.content ?? '');
  };
  const statusLabel = (value: unknown) => value === 'unlisted' ? t('不公开列出', 'Unlisted') : value === 'published' ? t('已发布', 'Published') : value === 'draft' ? t('草稿', 'Draft') : '';
  const accessLabel = (value: unknown) => value === 'public' ? t('免费试听', 'Free preview') : t('需课程权益', 'Entitled learners');
  const field = (label: string, next: unknown, previous: unknown, kind: 'text' | 'markdown' | 'asset' | 'cover' | 'multiline' = 'text') => {
    const changed = compare && String(next ?? '') !== String(previous ?? '');
    const display = (value: unknown) => {
      if (!value) return <span>—</span>;
      if (kind === 'markdown') return <div className="platform-prose platform-content-review-copy">{renderArticleMarkdown(String(value))}</div>;
      if (kind === 'multiline') return <span style={{ whiteSpace: 'pre-wrap' }}>{String(value)}</span>;
      if (kind === 'asset') return <span>{t('已设置', 'Set')}{changed ? ` · ${String(value)}` : ''}</span>;
      if (kind === 'cover' && /^(https?:\/\/|\/[^/])/i.test(String(value))) return <img className="platform-content-review-cover" src={String(value)} alt={label} />;
      return <span>{String(value)}</span>;
    };
    if (!next && !previous) return null;
    return <div key={label} className="platform-content-review-field" data-changed={changed || undefined}>
      <h4>{label}{changed && <small>{t('有修改', 'Changed')}</small>}</h4>
      {changed ? <div className="platform-content-review-comparison">
        <div><strong>{t('修改前', 'Before')}</strong>{display(previous)}</div>
        <div><strong>{t('修改后', 'After')}</strong>{display(next)}</div>
      </div> : display(next)}
    </div>;
  };
  const price = (row: Record<string, unknown>, key: string) => row[key] == null ? '' : commerceMoney(row[key], row.currency);
  const quizQuestions = (row: Record<string, unknown>) => Array.isArray(row.questions) ? row.questions.map(commerceRecord) : [];
  const quizQuestion = (question: Record<string, unknown> | undefined) => {
    if (!question) return '';
    const choices = Array.isArray(question.choices) ? question.choices.map((choice, index) => `${index + 1}. ${String(choice)}`) : [];
    const answer = Array.isArray(question.answerKey) ? question.answerKey : [question.answerKey];
    const answerText = answer.map(value => typeof value === 'boolean' ? (value ? t('正确', 'True') : t('错误', 'False'))
      : typeof value === 'number' && Array.isArray(question.choices) ? String(question.choices[value] ?? value + 1) : String(value ?? '')).join(', ');
    return [
      question.promptZh && `${t('中文题目', 'Question in Chinese')} · ${question.promptZh}`,
      question.promptEn && `${t('英文题目', 'Question in English')} · ${question.promptEn}`,
      choices.length && `${t('选项', 'Choices')}
${choices.join('\n')}`,
      answerText && `${t('正确答案', 'Correct answer')} · ${answerText}`,
      question.explanation && `${t('答案解析', 'Explanation')} · ${question.explanation}`,
      question.points != null && `${t('分值', 'Points')} · ${question.points}`,
    ].filter(Boolean).join('\n');
  };
  const newQuestions = quizQuestions(candidate);
  const previousQuestions = quizQuestions(before);
  const score = (value: unknown) => value == null ? '' : `${Number(value) / 100}%`;
  const contents = <>
    {field(t('中文标题', 'Chinese title'), candidate.titleZh, before.titleZh)}
    {field(t('英文标题', 'English title'), candidate.titleEn, before.titleEn)}
    {field(t('发布状态', 'Publication status'), statusLabel(candidate.status), statusLabel(before.status))}
    {quiz ? <>
      {field(t('及格分', 'Passing score'), score(candidate.passingScoreBps), score(before.passingScoreBps))}
      {field(t('作答次数上限', 'Attempt limit'), candidate.maxAttempts ?? t('不限', 'Unlimited'), compare ? before.maxAttempts ?? t('不限', 'Unlimited') : '')}
      {Array.from({ length: Math.max(newQuestions.length, previousQuestions.length) }, (_, index) =>
        field(t(`第 ${index + 1} 题`, `Question ${index + 1}`), quizQuestion(newQuestions[index]), quizQuestion(previousQuestions[index]), 'multiline'))}
    </> : lesson ? <>
      {field(t('访问范围', 'Access scope'), accessLabel(candidate.accessScope), compare ? accessLabel(before.accessScope) : '')}
      {field(t('中文讲义', 'Chinese notes'), body(candidate.bodyZh), body(before.bodyZh), 'markdown')}
      {field(t('英文讲义', 'English notes'), body(candidate.bodyEn), body(before.bodyEn), 'markdown')}
      {field(t('课时视频', 'Lesson video'), candidate.mediaId, before.mediaId, 'asset')}
      {field(t('视频封面', 'Video cover'), candidate.coverMediaId, before.coverMediaId, 'asset')}
      {candidate.mediaId ? <LessonPreview key={String(reviewId ?? candidate.mediaId)} courseId={courseId} lessonId={entity.id} admin={admin} /> : null}
    </> : <>
      {field(t('中文摘要', 'Chinese summary'), candidate.summaryZh, before.summaryZh)}
      {field(t('英文摘要', 'English summary'), candidate.summaryEn, before.summaryEn)}
      {field(t('中文说明', 'Chinese description'), candidate.descriptionZh, before.descriptionZh, 'markdown')}
      {field(t('英文说明', 'English description'), candidate.descriptionEn, before.descriptionEn, 'markdown')}
      {field(t('课程价格', 'Course price'), price(candidate, 'baseAmountMinor'), price(before, 'baseAmountMinor'))}
      {field(t('会员价格', 'Member price'), price(candidate, 'memberAmountMinor'), price(before, 'memberAmountMinor'))}
      {field(t('报名方式', 'Enrollment method'), candidate.enrollmentMode, before.enrollmentMode)}
      {field(t('课程封面', 'Course cover'), presentation.coverUrl, commerceRecord(before.presentation).coverUrl, 'cover')}
      {field(t('移动端封面', 'Mobile cover'), presentation.mobileCoverUrl, commerceRecord(before.presentation).mobileCoverUrl, 'cover')}
      {Array.isArray(presentation.outline) && <ol>{presentation.outline.map((item, index) => <li key={index}>{String(item?.label ?? '')} {String(item?.topic ?? '')}</li>)}</ol>}
    </>}
  </>;

  if (!pending && !rejected) return <details className="platform-content-review" onToggle={event => setPreviewOpen(event.currentTarget.open)}>
    <MoreToggle as="summary">{lesson ? t('预览课时', 'Preview lesson') : t('预览课程页', 'Preview course page')}</MoreToggle>
    {previewOpen && (lesson ? contents : <PlatformCourseDetail preview
      course={{ ...entity, data: candidate, summary: t(String(candidate.summaryZh || candidate.summaryEn || ''), String(candidate.summaryEn || candidate.summaryZh || '')) }}
      lessons={Array.isArray(data.lessons) ? data.lessons.map(commerceRecord).filter(row => row.status !== 'archived') : []} />)}
  </details>;

  return <section id={lesson || quiz ? undefined : 'course-publication-review'} className="platform-content-review" data-site-surface="panel">
    <div className="platform-course-editor-heading"><h3>{quiz ? t('测验发布审核', 'Quiz publication review') : lesson ? t('课时发布审核', 'Lesson publication review') : t('课程发布审核', 'Course publication review')}</h3><ContentReviewBadge entity={entity} /></div>
    {typeof data.reviewNote === 'string' && data.reviewNote && <p>{t('审核意见：', 'Review feedback: ')}{data.reviewNote}</p>}
    {pending && <>
      {typeof data.reviewSubmittedBy === 'string' && admin && <p>{t('提交讲师：', 'Submitted by: ')}{data.reviewSubmittedBy}{typeof data.reviewSubmittedAt === 'string' && <> · {new Date(data.reviewSubmittedAt).toLocaleString()}</>}</p>}
      {contents}
      {admin ? <>
        <label className="platform-field"><span>{t('审核意见（驳回时必填）', 'Review feedback (required for rejection)')}</span><textarea className="platform-field-control" rows={3} maxLength={4000} value={note} onChange={event => setNote(event.target.value)} /></label>
        <div className="platform-route-actions">
          <button type="button" className="platform-button" disabled={!!busy || !note.trim()} onClick={() => void runAction('decide-content-review', courseId, { reviewId, decision: 'rejected', note })}>{t('驳回', 'Reject')}</button>
          <button type="button" className="platform-button platform-button-primary" disabled={!!busy} onClick={() => void runAction('decide-content-review', courseId, { reviewId, decision: 'approved', note })}>{t('审核通过并发布', 'Approve and publish')}</button>
        </div>
      </> : <ActionButton action="withdraw-content-review" resourceId={courseId} payload={{ reviewId }}
        label={text('撤回审核以重新编辑', 'Withdraw review to edit')} confirm={text('确定撤回这次审核？', 'Withdraw this submission?')} secondary busy={busy} runAction={runAction} />}
    </>}
  </section>;
}

export function reviewEditableEntity(entity: PlatformEntity | undefined): PlatformEntity | undefined {
  if (!entity || !entity.data?.reviewMetadata || !['rejected', 'withdrawn'].includes(String(entity.data.reviewStatus))) return entity;
  return { ...entity, data: { ...entity.data, ...(entity.data.reviewMetadata as Record<string, unknown>), status: entity.data.reviewTargetStatus ?? entity.status } };
}
