'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/hooks/useT';
import { loadPlatformManagedQuizzes } from '@/lib/platform-gateway';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import { PlatformLessonCoverEditor } from './PlatformLessonCoverEditor';
import { PlatformState } from './PlatformState';
import { type RunAction, type CommonProps } from './PlatformActionTypes';
import { text, LESSON_FIELDS, QUIZ_FIELDS, LESSON_EDIT_FIELDS } from './PlatformFormDefinitions';
import { DomainForm, ActionButton } from './PlatformForm';

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

export function PlatformCourseContentManager(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  const t = useT();
  const courseId = entity?.id ?? params.id;
  if (!courseId) return null;
  const lessons = (Array.isArray(entity?.data?.lessons) ? entity.data.lessons : [])
    .map((item, index) => entityFromRecord(item, `lesson-${index + 1}`))
    .filter((item): item is PlatformEntity => item !== null);
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
            <section className="platform-course-editor-section" key={lesson.id}>
              <DomainForm
                definition={definition}
                entity={lesson}
                resourceId={courseId}
                busy={busy}
                runAction={runAction}
                spec={{
                  title: text(`编辑课时：${lesson.title}`, `Edit lesson: ${lesson.title}`),
                  action: 'save-course-lesson',
                  payloadBase: { lessonId: lesson.id },
                  fields: LESSON_EDIT_FIELDS,
                }}
              />
              <PlatformLessonCoverEditor scope={definition.area === 'instructor' ? 'instructor' : 'admin'} courseId={courseId} lessonId={lesson.id} />
              <ActionButton
                action="delete-course-lesson"
                resourceId={courseId}
                payload={{ lessonId: lesson.id }}
                label={text('归档课时', 'Archive lesson')}
                confirm={text('确定归档这个课时吗？', 'Archive this lesson?')}
                busy={busy}
                runAction={runAction}
              />
              <PlatformManagedQuizPanel
                definition={definition}
                courseId={courseId}
                lessonId={lesson.id}
                busy={busy}
                runAction={runAction}
              />
            </section>
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
