'use client';

import { useRef } from 'react';
import { useAuthUser } from '@/lib/auth-store';
import { useEntryRouter } from '@/hooks/useEntryRouter';
import { useLang } from '@/i18n/tr';
import { isPlatformInstructorApplication } from '@/lib/platform-routes';
import { text, INSTRUCTOR_COURSE_FIELDS, INSTRUCTOR_COURSE_CREATE_FIELDS } from './PlatformFormDefinitions';
import { ActionButton, DomainForm } from './PlatformForm';
import { PlatformCourseContentManager } from './PlatformCourseManager';
import { type CommonProps } from './PlatformActionTypes';
import { PlatformInstructorApplication } from './PlatformInstructorApplication';
import { PlatformInstructorLessonCreate } from './PlatformInstructorLessonCreate';
import { PlatformContentReview, reviewEditableEntity } from './PlatformContentReview';

function InstructorCourseCreateForm({ definition, busy, runAction }: CommonProps) {
  const user = useAuthUser();
  const lang = useLang();
  const router = useEntryRouter();
  const generatedSlug = useRef<string | null>(null);
  const owner = user?.uid ?? user?.wcaId;
  const draftKey = owner == null ? undefined : `cuberoot:platform:course-create:v1:${owner}`;
  return <DomainForm key={draftKey} courseDraftKey={draftKey} definition={definition} busy={busy} runAction={(action, id, payload) => {
      if (payload && !payload.slug) {
        const prefix = String(payload.titleEn ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'course';
        generatedSlug.current ??= `${prefix}-${crypto.randomUUID()}`;
        return runAction(action, id, { ...payload, slug: generatedSlug.current });
      }
      return runAction(action, id, payload);
    }}
    spec={{ title: text('创建课程', 'Create course'), titleHidden: true, action: 'save-instructor-course', fields: INSTRUCTOR_COURSE_CREATE_FIELDS, submit: text('创建课程', 'Create course') }}
    onResult={result => {
      const id = result.course?.id ?? result.courseId ?? result.id;
      const root = `${lang === 'zh' ? '/zh' : ''}/platform/instructor/courses`;
      router.replace(typeof id === 'string' && id ? `${root}/${encodeURIComponent(id)}` : root);
    }} />;
}

export function PlatformInstructorActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  if (isPlatformInstructorApplication(definition.id)) {
    return <PlatformInstructorApplication {...props} />;
  }
  if (definition.id === 'instructor-course') {
    return (
      <div className="platform-domain-stack platform-instructor-course-management">
        <PlatformContentReview entity={entity} courseId={entity?.id ?? params.id} admin={false} busy={busy} runAction={runAction} />
        <PlatformCourseContentManager {...props} />
        <section className="platform-instructor-course-info">
          {entity?.data?.reviewStatus !== 'pending' && <DomainForm definition={definition} entity={reviewEditableEntity(entity)} resourceId={params.id} busy={busy} runAction={runAction}
            spec={{ title: text('课程信息', 'Course information'), action: 'save-instructor-course', fields: INSTRUCTOR_COURSE_FIELDS, submit: text('保存课程信息', 'Save course information') }}
            secondaryAction={<ActionButton action="delete-course" resourceId={entity?.id ?? params.id} label={text('归档课程', 'Archive course')}
              confirm={text('确定归档整门课程？归档后课程停止公开展示及学习访问，历史记录仍保留。', 'Archive this course? It will no longer be public or accessible for learning. History will be retained.')} secondary busy={busy} runAction={runAction} />} />}
        </section>
      </div>
    );
  }
  if (definition.id === 'instructor-course-new') {
    return <InstructorCourseCreateForm {...props} />;
  }
  if (definition.id === 'instructor-lesson-new') return <PlatformInstructorLessonCreate {...props} />;
  return null;
}
