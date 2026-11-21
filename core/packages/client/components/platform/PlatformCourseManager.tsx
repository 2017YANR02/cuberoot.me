'use client';

import { useEffect, useId, useState } from 'react';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { entityStatusLabel } from '@/components/teaching/TeachingUi';
import { useT } from '@/hooks/useT';
import { loadPlatformManagedQuizzes } from '@/lib/platform-gateway';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import { PlatformLessonCoverEditor } from './PlatformLessonCoverEditor';
import { PlatformState } from './PlatformState';
import { type RunAction, type CommonProps } from './PlatformActionTypes';
import { text, LESSON_FIELDS, QUIZ_FIELDS, LESSON_EDIT_FIELDS } from './PlatformFormDefinitions';
import { DomainForm, ActionButton } from './PlatformForm';
import { PlatformContentReview, ContentReviewBadge, reviewEditableEntity } from './PlatformContentReview';

const INSTRUCTOR_LESSON_EDIT_FIELDS = LESSON_FIELDS.filter(field => !['accessScope', 'durationSeconds'].includes(field.key)).map(field => field.key === 'status'
  ? { ...field, options: field.options?.map(option => option.value === 'published' ? { ...option, label: text('提交审核后发布', 'Publish after approval') } : option) }
  : field.key === 'bodyZh' || field.key === 'bodyEn' ? { ...field, kind: 'markdown' as const, required: false, label: field.key === 'bodyZh' ? text('中文图文内容', 'Chinese lesson content') : text('英文图文内容', 'English lesson content') } : field);

function entityFromRecord(value: unknown, fallbackId: string): PlatformEntity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const id = typeof data.id === 'string' ? data.id : fallbackId;
  return {
    id,
    title: typeof data.titleZh === 'string' ? data.titleZh : typeof data.titleEn === 'string' ? data.titleEn : id,
    status: typeof data.status === 'string' ? data.status : null,
    data,
  };
}

function PlatformManagedQuizPanel({ definition, courseId, lessonId, busy, runAction }: {
  definition: PlatformRouteDefinition;
  courseId: string;
  lessonId: string;
  busy: string | null;
  runAction: RunAction;
}) {
  const t = useT();
  const [result, setResult] = useState<PlatformEntity[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);
  const scope = definition.area === 'admin' ? 'admin' : 'instructor';

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
    setRevision((value) => value + 1);
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
            <div className="platform-course-editor-item" key={quiz.id}>
              <DomainForm
                definition={definition}
                entity={quiz}
                resourceId={courseId}
                busy={busy}
                runAction={refreshingAction}
                spec={{
                  title: text(`编辑测验：${quiz.title}`, `Edit quiz: ${quiz.title}`),
                  action: 'save-course-quiz',
                  payloadBase: { lessonId, quizId: quiz.id },
                  fields: QUIZ_FIELDS,
                }}
              />
              <ActionButton
                action="delete-course-quiz"
                resourceId={courseId}
                payload={{ lessonId, quizId: quiz.id }}
                label={text('归档测验', 'Archive quiz')}
                confirm={text('确定归档这个测验吗？', 'Archive this quiz?')}
                busy={busy}
                runAction={refreshingAction}
              />
            </div>
          ))}
        </div>
      )}
      <DomainForm
        definition={definition}
        resourceId={courseId}
        busy={busy}
        runAction={refreshingAction}
        spec={{
          title: text('新建测验', 'Create quiz'),
          action: 'save-course-quiz',
          payloadBase: { lessonId },
          fields: QUIZ_FIELDS,
        }}
      />
    </section>
  );
}

function PlatformManagedLessonEditor({ definition, courseId, lesson, busy, runAction, onSaved, compact = false }: {
  definition: PlatformRouteDefinition; courseId: string; lesson: PlatformEntity; busy: string | null; runAction: RunAction; onSaved?: () => void; compact?: boolean;
}) {
  return <section className={`platform-course-editor-section${compact ? ' platform-instructor-lesson-editor' : ''}`}>
    <PlatformContentReview entity={lesson} courseId={courseId} lesson admin={definition.area === 'admin'} busy={busy} runAction={runAction} />
    {lesson.data?.reviewStatus !== 'pending' && <><DomainForm definition={definition} entity={reviewEditableEntity(lesson)} resourceId={courseId} busy={busy} runAction={runAction}
      spec={{ title: text(`编辑课时：${lesson.title}`, `Edit lesson: ${lesson.title}`), titleHidden: compact, action: 'save-course-lesson', payloadBase: { lessonId: lesson.id }, fields: compact ? INSTRUCTOR_LESSON_EDIT_FIELDS : LESSON_EDIT_FIELDS }} />
    <PlatformLessonCoverEditor scope={definition.area === 'instructor' ? 'instructor' : 'admin'} courseId={courseId} lessonId={lesson.id} onCoverUpdated={() => onSaved?.()} />
    <ActionButton action="delete-course-lesson" resourceId={courseId} payload={{ lessonId: lesson.id }}
      label={text('归档课时', 'Archive lesson')} confirm={text('确定归档这个课时吗？', 'Archive this lesson?')}
      secondary={compact} busy={busy} runAction={runAction} /></>}
    <PlatformManagedQuizPanel definition={definition} courseId={courseId} lessonId={lesson.id} busy={busy} runAction={runAction} />
  </section>;
}

export function PlatformCourseContentManager(props: CommonProps) {
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
          <MoreTogglePanel id={controls} expanded={expanded} className="platform-instructor-lesson-panel">
            <PlatformManagedLessonEditor definition={definition} courseId={courseId} lesson={lesson} busy={busy} runAction={runAction} onSaved={props.onSaved} compact />
          </MoreTogglePanel>
        </li>;
      })}
    </ol>
  </section>;
  return (
    <section className="platform-course-editor">
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
    </section>
  );
}
