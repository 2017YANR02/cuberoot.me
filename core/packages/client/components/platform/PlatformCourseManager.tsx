'use client';

import { useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { commerceRecord } from '@/lib/platform-commerce-format';
import { entityStatusLabel } from '@/components/teaching/TeachingUi';
import { useT } from '@/hooks/useT';
import { loadPlatformManagedQuizzes } from '@/lib/platform-gateway';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import { PlatformLessonVideoUpload } from './PlatformInstructorLessonCreate';
import { PlatformLessonCoverEditor } from './PlatformLessonCoverEditor';
import { PlatformState } from './PlatformState';
import { type RunAction, type CommonProps } from './PlatformActionTypes';
import { text, field, LESSON_FIELDS, QUIZ_FIELDS, LESSON_EDIT_FIELDS } from './PlatformFormDefinitions';
import { DomainForm, ActionButton } from './PlatformForm';
import { PlatformContentReview, ContentReviewBadge, reviewEditableEntity } from './PlatformContentReview';

const INSTRUCTOR_LESSON_EDIT_FIELDS = LESSON_EDIT_FIELDS
  .filter(field => !['slug', 'ordinal', 'driveVideo'].includes(field.key))
  .map(field => field.key === 'status'
    ? { ...field, options: field.options?.map(option => option.value === 'published' ? { ...option, label: text('提交审核后发布', 'Publish after approval') } : option) }
    : field);
const MANAGED_QUIZ_FIELDS = QUIZ_FIELDS.filter(field => field.key !== 'slug');
const INSTRUCTOR_QUIZ_FIELDS = MANAGED_QUIZ_FIELDS.map(field => field.key === 'status' ? {
  ...field,
  options: field.options?.filter(option => option.value !== 'archived').map(option => option.value === 'published'
    ? { ...option, label: text('提交发布审核', 'Submit for publication review') } : option),
} : field);

function entityFromRecord(value: unknown, fallbackId: string): PlatformEntity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const id = typeof data.id === 'string' ? data.id : fallbackId;
  return {
    id,
    title: [data.titleZh, data.titleEn].find((title): title is string => typeof title === 'string' && Boolean(title.trim())) ?? id,
    status: typeof data.status === 'string' ? data.status : null,
    data,
  };
}

function PlatformManagedQuizPanel({ definition, courseId, lessonId, busy, runAction, parentPending }: {
  definition: PlatformRouteDefinition;
  courseId: string;
  lessonId: string;
  busy: string | null;
  runAction: RunAction;
  parentPending: boolean;
}) {
  const t = useT();
  const [result, setResult] = useState<PlatformEntity[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);
  const admin = definition.area === 'admin';
  const scope = admin ? 'admin' : 'instructor';
  const canEdit = admin || !parentPending;
  const fields = admin ? MANAGED_QUIZ_FIELDS : INSTRUCTOR_QUIZ_FIELDS;

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError(null);
    void loadPlatformManagedQuizzes({ scope, courseId, lessonId, signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) setResult(response.items); })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason)));
      });
    return () => controller.abort();
  }, [courseId, lessonId, revision, scope]);

  const refreshingAction: RunAction = async (action, id, payload) => {
    const actionResult = await runAction(action, id, payload);
    if (actionResult) setRevision((value) => value + 1);
    return actionResult;
  };

  return (
    <section className="platform-course-editor-section">
      <h3>{t('课时测验', 'Lesson quizzes')}</h3>
      {error instanceof Error ? (
        <PlatformState kind="error" message={error.message} onRetry={() => setRevision((value) => value + 1)} />
      ) : result === null ? <PlatformState kind="loading" /> : result.length === 0 ? <PlatformState kind="empty" /> : (
        <div className="platform-domain-stack">
          {result.map((quiz) => (
            <div className="platform-course-editor-item" key={quiz.id} id={`quiz-${quiz.id}`}>
              <PlatformContentReview entity={quiz} courseId={courseId} quiz admin={admin} busy={busy} runAction={refreshingAction} />
              {canEdit && quiz.data?.reviewStatus !== 'pending' && <><DomainForm
                definition={definition}
                entity={{ ...quiz, data: { ...quiz.data, status: quiz.data?.editStatus ?? quiz.status } }}
                resourceId={courseId}
                busy={busy}
                runAction={refreshingAction}
                spec={{
                  title: text(`编辑测验：${quiz.title}`, `Edit quiz: ${quiz.title}`),
                  action: 'save-course-quiz',
                  payloadBase: { lessonId, quizId: quiz.id },
                  fields,
                }}
              />
              {(admin || quiz.status !== 'published') && <ActionButton
                action="delete-course-quiz"
                resourceId={courseId}
                payload={{ lessonId, quizId: quiz.id }}
                label={text('归档测验', 'Archive quiz')}
                confirm={text('确定归档这个测验吗？', 'Archive this quiz?')}
                busy={busy}
                runAction={refreshingAction}
              />}</>}
            </div>
          ))}
        </div>
      )}
      {canEdit && <DomainForm
        definition={definition}
        resourceId={courseId}
        busy={busy}
        runAction={refreshingAction}
        spec={{
          title: text('新建测验', 'Create quiz'),
          action: 'save-course-quiz',
          payloadBase: { lessonId },
          fields,
        }}
      />}
    </section>
  );
}

function PlatformManagedLessonEditor({ definition, courseId, lesson, busy, runAction, onSaved, compact = false, coursePending = false }: {
  definition: PlatformRouteDefinition; courseId: string; lesson: PlatformEntity; busy: string | null; runAction: RunAction; onSaved?: () => void; compact?: boolean; coursePending?: boolean;
}) {
  const t = useT();
  const [replaceVideo, setReplaceVideo] = useState(false);
  const [upload, setUpload] = useState<ComponentProps<typeof PlatformLessonVideoUpload>['video']>();
  const [duration, setDuration] = useState<number | null>(null);
  const pending = lesson.data?.reviewStatus === 'pending';
  return <section className={`platform-course-editor-section${compact ? ' platform-instructor-lesson-editor' : ''}`} id={`lesson-${lesson.id}`}>
    <PlatformContentReview entity={lesson} courseId={courseId} lesson admin={definition.area === 'admin'} busy={busy} runAction={runAction} preview={compact} />
    {!pending && <>
      {compact && <><button className="platform-button" type="button" disabled={!!busy} aria-expanded={replaceVideo} onClick={() => { setReplaceVideo(value => !value); setUpload(undefined); setDuration(null); }}>{t('替换课时视频', 'Replace lesson video')}</button>
        {replaceVideo && <PlatformLessonVideoUpload courseId={courseId} video={upload} disabled={!!busy}
          onVideoChange={(next, same) => { setUpload(next); if (!same) setDuration(null); }} onDuration={setDuration} />}</>}
      <DomainForm definition={definition} entity={reviewEditableEntity(lesson)} resourceId={courseId}
        busy={replaceVideo && !upload?.nodeId ? `save-course-lesson:${courseId}` : busy} runAction={runAction}
        onResult={() => { setReplaceVideo(false); setUpload(undefined); }}
        spec={{ title: text(`编辑课时：${lesson.title}`, `Edit lesson: ${lesson.title}`), titleHidden: compact, action: 'save-course-lesson',
          payloadBase: { lessonId: lesson.id, ...(replaceVideo && upload?.nodeId ? { driveVideo: upload.nodeId, durationSeconds: duration } : {}) },
          fields: compact ? INSTRUCTOR_LESSON_EDIT_FIELDS : LESSON_EDIT_FIELDS }} />
      <PlatformLessonCoverEditor scope={definition.area === 'instructor' ? 'instructor' : 'admin'} courseId={courseId} lessonId={lesson.id} onCoverUpdated={() => onSaved?.()} />
      <ActionButton action="delete-course-lesson" resourceId={courseId} payload={{ lessonId: lesson.id }}
        label={text('归档课时', 'Archive lesson')} confirm={text('确定归档这个课时吗？', 'Archive this lesson?')}
        secondary={compact} busy={busy} runAction={runAction} />
    </>}
    {lesson.status !== 'archived' && <PlatformManagedQuizPanel definition={definition} courseId={courseId} lessonId={lesson.id} busy={busy} runAction={runAction} parentPending={pending || coursePending} />}
  </section>;
}

export function PlatformCourseContentManager(props: CommonProps & { courseEditor?: ReactNode }) {
  const { definition, params, entity, busy, runAction } = props;
  const t = useT();
  const courseId = entity?.id ?? params.id;
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const panelId = useId();
  if (!courseId) return null;
  const lessons = (Array.isArray(entity?.data?.lessons) ? entity.data.lessons : [])
    .map((item, index) => entityFromRecord(item, `lesson-${index + 1}`))
    .filter((item): item is PlatformEntity => item !== null);
  const compact = definition.id === 'instructor-course';
  const ordered = lessons.filter(lesson => lesson.status !== 'archived');
  if (compact && lessons.length === 0) return null;
  if (compact) return <section className="platform-course-editor platform-instructor-lesson-manager">
    <div className="platform-course-editor-heading">
      <div className="platform-instructor-editor-title"><h2>{t('课时与测验', 'Lessons and quizzes')}</h2><span>{t(`共 ${lessons.length} 个课时`, `${lessons.length} ${lessons.length === 1 ? 'lesson' : 'lessons'}`)}</span></div>
    </div>
    <ol className="platform-instructor-lesson-list">
      {lessons.map((lesson, index) => {
        const data = lesson.data ?? {};
        const title = t(String(data.titleZh || data.titleEn || lesson.title), String(data.titleEn || data.titleZh || lesson.title));
        const expanded = expandedLesson === lesson.id;
        const controls = `${panelId}-lesson-${index}`;
        const scope = data.accessScope === 'public' ? t('公开', 'Public') : data.accessScope === 'entitled' ? t('需课程权益', 'Entitled learners') : '';
        return <li className="platform-instructor-lesson-row" key={lesson.id}>
          <MoreToggle className="platform-instructor-lesson-toggle" aria-controls={controls} expanded={expanded}
            onToggle={() => setExpandedLesson(expanded ? null : lesson.id)}>
            <span className="platform-instructor-lesson-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="platform-instructor-lesson-title"><strong>{title}</strong>{scope && <small>{scope}</small>}</span>
            <span className="platform-instructor-lesson-statuses">{lesson.status && <span className="platform-status" data-lesson-status={lesson.status}>{entityStatusLabel(lesson.status, t)}</span>}<ContentReviewBadge entity={lesson} /></span>
          </MoreToggle>
          {lesson.status !== 'archived' && <div className="platform-write-actions">
            {(['up', 'down'] as const).map(move => {
              const neighbor = ordered[ordered.indexOf(lesson) + (move === 'up' ? -1 : 1)];
              return <button className="platform-button" type="button" key={move}
                disabled={!!busy || !neighbor || data.reviewStatus === 'pending' || neighbor.data?.reviewStatus === 'pending'}
                onClick={() => void runAction('save-course-lesson', courseId, { lessonId: lesson.id, move })}>
                {move === 'up' ? t('上移', 'Move up') : t('下移', 'Move down')}
              </button>;
            })}
          </div>}
          <MoreTogglePanel id={controls} expanded={expanded} className="platform-instructor-lesson-panel">
            <PlatformManagedLessonEditor definition={definition} courseId={courseId} lesson={lesson} busy={busy} runAction={runAction} onSaved={props.onSaved} compact coursePending={entity?.data?.reviewStatus === 'pending'} />
          </MoreTogglePanel>
        </li>;
      })}
    </ol>
  </section>;
  const awaiting = lessons.filter(lesson => lesson.data?.reviewStatus === 'pending');
  const needsReview = entity?.data?.reviewStatus === 'pending';
  const pendingQuizzes = Array.isArray(entity?.data?.pendingQuizzes) ? entity.data.pendingQuizzes.map(commerceRecord) : [];
  const reviewPage = props.moderationPage ?? 1;
  const moreReviews = entity?.data?.reviewModerationHasMore === true;
  const reviews = Array.isArray(entity?.data?.reviewsForModeration) ? entity.data.reviewsForModeration.map(commerceRecord) : [];
  return (
    <section className="platform-course-editor">
      {(needsReview || awaiting.length > 0 || pendingQuizzes.length > 0) && <section className="platform-domain-content" data-site-surface="panel">
        <h2>{t('待审核内容', 'Pending content')}</h2>
        <ul>
          {needsReview && <li><a href="#course-publication-review">{t('课程发布审核', 'Course publication review')}</a></li>}
          {pendingQuizzes.map(quiz => {
            const title = t(String(quiz.titleZh || quiz.titleEn || quiz.id), String(quiz.titleEn || quiz.titleZh || quiz.id));
            return <li key={String(quiz.id)}><a href={`#quiz-${quiz.id}`}>{t(`测验：${title}`, `Quiz: ${title}`)}</a></li>;
          })}
          {awaiting.map(lesson => <li key={lesson.id}><a href={`#lesson-${lesson.id}`}>{lesson.title}</a></li>)}
        </ul>
        <ActionButton action="approve-course-reviews" resourceId={courseId} busy={busy} runAction={runAction}
          label={text('通过本课程全部待审内容', 'Approve all pending content')}
          confirm={text('确定通过并发布本课程的全部待审核内容？', 'Approve and publish all pending content for this course?')} />
      </section>}
      {props.courseEditor}
      <div className="platform-course-editor-heading">
        <h2>{t('课时与测验', 'Lessons and quizzes')}</h2>
        <ActionButton
          action="delete-course"
          resourceId={courseId}
          label={text('归档课程', 'Archive course')}
          confirm={text('确定归档整门课程吗？', 'Archive this entire course?')}
          busy={busy}
          runAction={runAction}
        />
      </div>
      {lessons.length === 0 ? <PlatformState kind="empty" /> : (
        <div className="platform-domain-stack">
          {lessons.map((lesson) => (
            <PlatformManagedLessonEditor key={lesson.id} definition={definition} courseId={courseId} lesson={lesson} busy={busy} runAction={runAction} onSaved={props.onSaved} />
          ))}
        </div>
      )}
      <DomainForm
        definition={definition}
        resourceId={courseId}
        busy={busy}
        runAction={runAction}
        spec={{ title: text('新建课时', 'Create lesson'), action: 'save-course-lesson', fields: LESSON_FIELDS }}
      />
      {(reviews.length > 0 || reviewPage > 1) && <section className="platform-domain-content">
        <h2>{t('学员评价治理', 'Course review moderation')}</h2>
        {reviews.map(review => <article className="platform-course-editor-item" key={String(review.id)}>
          <h3>{String(review.title || review.authorName || t('学员评价', 'Learner review'))} · {String(review.rating)}/5</h3>
          {review.body ? <p>{String(review.body)}</p> : null}
          {review.status === 'hidden' ? <p>{t('已隐藏', 'Hidden')} · {String(review.moderationNote ?? '')}</p>
            : <details><MoreToggle as="summary">{t('隐藏评价', 'Hide review')}</MoreToggle>
              <DomainForm definition={definition} resourceId={courseId} busy={busy} runAction={runAction}
                spec={{ title: text('隐藏评价', 'Hide review'), titleHidden: true, action: 'hide-course-review',
                  payloadBase: { reviewId: review.id }, fields: [field('note', '隐藏原因', 'Reason for hiding', { kind: 'textarea', required: true, maxLength: 4000 })] }} />
            </details>}
        </article>)}
        {(reviewPage > 1 || moreReviews) && <nav className="platform-write-actions" aria-label={t('评价分页', 'Course review pages')}>
          <button type="button" className="platform-button" disabled={reviewPage <= 1} onClick={() => props.onModerationPage?.(reviewPage - 1)}>{t('上一页', 'Previous page')}</button>
          <span>{t(`第 ${reviewPage} 页`, `Page ${reviewPage}`)}</span>
          <button type="button" className="platform-button" disabled={!moreReviews} onClick={() => props.onModerationPage?.(reviewPage + 1)}>{t('下一页', 'Next page')}</button>
        </nav>}
      </section>}
    </section>
  );
}
