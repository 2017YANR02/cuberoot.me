'use client';

import { InstructorPayoutSettings } from './InstructorPayoutSettings';
import { text, INSTRUCTOR_COURSE_FIELDS, INSTRUCTOR_APPLICATION_FIELDS } from './PlatformFormDefinitions';
import { DomainForm } from './PlatformForm';
import { PlatformCourseContentManager } from './PlatformCourseManager';
import { type CommonProps } from './PlatformActionTypes';

export function PlatformInstructorActions(props: CommonProps) {
  const { definition, params, entity, busy, runAction } = props;
  if (definition.id === 'instructor-earnings') return <InstructorPayoutSettings />;
  if (definition.id === 'teacher-apply') {
    return <DomainForm definition={definition} entity={entity} busy={busy} runAction={runAction} spec={{ title: text('申请资料', 'Application'), action: 'apply-instructor', fields: INSTRUCTOR_APPLICATION_FIELDS }} />;
  }
  if (definition.id === 'instructor-course') {
    return (
      <div className="platform-domain-stack">
        <DomainForm definition={definition} entity={entity} resourceId={params.id} busy={busy} runAction={runAction} spec={{ title: text('讲师课程资料', 'Instructor course details'), action: 'save-instructor-course', fields: INSTRUCTOR_COURSE_FIELDS }} />
        <PlatformCourseContentManager {...props} />
      </div>
    );
  }
  if (definition.id === 'instructor-courses') {
    return <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{ title: text('创建讲师课程', 'Create instructor course'), action: 'save-instructor-course', fields: INSTRUCTOR_COURSE_FIELDS }} />;
  }
  return null;
}
