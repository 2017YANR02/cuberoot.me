import {
  type TeachingWeeklyReportTrainingDimension,
  TRAINING_EVIDENCE_SOURCES,
  isTrainingSourceActivity,
  TRAINING_TRUST_LEVELS,
  type TeachingWeeklyReportAssignmentItem,
  TRAINING_ASSIGNMENT_STATUSES,
  TRAINING_SCHEDULE_KINDS,
  TRAINING_REVIEW_STATUSES,
  type TeachingWeeklyReportLessonFeedbackItem,
  TEACHING_FEEDBACK_VISIBILITIES,
  type TeachingWeeklyReportAggregate,
  type TeachingWeeklyReportSummary,
  TEACHING_WEEKLY_REPORT_STATUSES,
  TEACHING_WEEKLY_REPORT_VISIBILITIES,
  type TeachingWeeklyReport,
  type TeachingLearnerWeeklyReport,
  type TeachingLearnerLessonFeedback,
  TEACHING_ATTENDANCE_STATUSES,
  type GenerateTeachingWeeklyReportInput,
  type PublishTeachingWeeklyReportInput,
  type TeachingFeedbackVisibility,
} from '@cuberoot/shared/teaching';
import {
  record,
  enumValue,
  string,
  integer,
  nullableString,
  nullableInteger,
} from './validation';
import { TeachingApiError } from './errors';
import { type TeachingPage, type TeachingLessonFeedback } from './types';
import { page, orgPath, pageQuery } from './pagination';
import { request, post } from './transport';
import { lessonFeedback } from './sessions';

const WEEKLY_REPORT_AUTHOR_ROLES = ['owner', 'admin', 'teacher', 'assistant'] as const;

function weeklyReportTrainingDimension(value: unknown): TeachingWeeklyReportTrainingDimension {
  const item = record(value, 'weeklyReport.aggregate.training.dimension');
  const source = enumValue(item.source, TRAINING_EVIDENCE_SOURCES, 'weeklyReport.aggregate.training.dimension.source');
  const activity = string(item.activity, 'weeklyReport.aggregate.training.dimension.activity');
  if (!isTrainingSourceActivity(source, activity)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'weeklyReport.aggregate.training.dimension.activity is invalid');
  }
  return {
    source,
    activity,
    trustLevel: enumValue(item.trustLevel, TRAINING_TRUST_LEVELS, 'weeklyReport.aggregate.training.dimension.trustLevel'),
    evidenceCount: string(item.evidenceCount, 'weeklyReport.aggregate.training.dimension.evidenceCount'),
    durationMs: string(item.durationMs, 'weeklyReport.aggregate.training.dimension.durationMs'),
    successCount: string(item.successCount, 'weeklyReport.aggregate.training.dimension.successCount'),
  };
}

function weeklyReportAssignment(value: unknown): TeachingWeeklyReportAssignmentItem {
  const item = record(value, 'weeklyReport.aggregate.assignments.assignment');
  return {
    assignmentId: string(item.assignmentId, 'weeklyReport.aggregate.assignments.assignment.assignmentId'),
    title: string(item.title, 'weeklyReport.aggregate.assignments.assignment.title'),
    status: enumValue(item.status, TRAINING_ASSIGNMENT_STATUSES, 'weeklyReport.aggregate.assignments.assignment.status'),
    scheduleKind: enumValue(item.scheduleKind, TRAINING_SCHEDULE_KINDS, 'weeklyReport.aggregate.assignments.assignment.scheduleKind'),
    expectedCount: integer(item.expectedCount, 'weeklyReport.aggregate.assignments.assignment.expectedCount', 1),
    evidenceCount: string(item.evidenceCount, 'weeklyReport.aggregate.assignments.assignment.evidenceCount'),
    latestReviewRevision: integer(item.latestReviewRevision, 'weeklyReport.aggregate.assignments.assignment.latestReviewRevision'),
    latestReviewStatus: item.latestReviewStatus === null
      ? null
      : enumValue(item.latestReviewStatus, TRAINING_REVIEW_STATUSES, 'weeklyReport.aggregate.assignments.assignment.latestReviewStatus'),
    startsAt: string(item.startsAt, 'weeklyReport.aggregate.assignments.assignment.startsAt'),
    endsAt: nullableString(item.endsAt, 'weeklyReport.aggregate.assignments.assignment.endsAt'),
  };
}

function weeklyReportLessonFeedback(value: unknown): TeachingWeeklyReportLessonFeedbackItem {
  const item = record(value, 'weeklyReport.aggregate.lessonFeedback.feedback');
  return {
    feedbackId: string(item.feedbackId, 'weeklyReport.aggregate.lessonFeedback.feedback.feedbackId'),
    sessionId: string(item.sessionId, 'weeklyReport.aggregate.lessonFeedback.feedback.sessionId'),
    revision: integer(item.revision, 'weeklyReport.aggregate.lessonFeedback.feedback.revision', 1),
    visibility: enumValue(item.visibility, TEACHING_FEEDBACK_VISIBILITIES, 'weeklyReport.aggregate.lessonFeedback.feedback.visibility'),
    summary: string(item.summary, 'weeklyReport.aggregate.lessonFeedback.feedback.summary'),
    strengths: nullableString(item.strengths, 'weeklyReport.aggregate.lessonFeedback.feedback.strengths'),
    challenges: nullableString(item.challenges, 'weeklyReport.aggregate.lessonFeedback.feedback.challenges'),
    nextGoals: nullableString(item.nextGoals, 'weeklyReport.aggregate.lessonFeedback.feedback.nextGoals'),
    publishedAt: nullableString(item.publishedAt, 'weeklyReport.aggregate.lessonFeedback.feedback.publishedAt'),
    createdAt: string(item.createdAt, 'weeklyReport.aggregate.lessonFeedback.feedback.createdAt'),
  };
}

function weeklyReportAggregate(value: unknown): TeachingWeeklyReportAggregate {
  const aggregate = record(value, 'weeklyReport.aggregate');
  const attendance = record(aggregate.attendance, 'weeklyReport.aggregate.attendance');
  const credits = record(aggregate.credits, 'weeklyReport.aggregate.credits');
  const training = record(aggregate.training, 'weeklyReport.aggregate.training');
  const assignments = record(aggregate.assignments, 'weeklyReport.aggregate.assignments');
  const lessonFeedback = record(aggregate.lessonFeedback, 'weeklyReport.aggregate.lessonFeedback');
  if (!Array.isArray(training.dimensions)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'weeklyReport.aggregate.training.dimensions is invalid');
  }
  if (!Array.isArray(assignments.assignments)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'weeklyReport.aggregate.assignments.assignments is invalid');
  }
  if (!Array.isArray(lessonFeedback.feedback)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'weeklyReport.aggregate.lessonFeedback.feedback is invalid');
  }
  return {
    attendance: {
      sessionCount: integer(attendance.sessionCount, 'weeklyReport.aggregate.attendance.sessionCount'),
      completedSessionCount: integer(attendance.completedSessionCount, 'weeklyReport.aggregate.attendance.completedSessionCount'),
      presentCount: integer(attendance.presentCount, 'weeklyReport.aggregate.attendance.presentCount'),
      lateCount: integer(attendance.lateCount, 'weeklyReport.aggregate.attendance.lateCount'),
      absentCount: integer(attendance.absentCount, 'weeklyReport.aggregate.attendance.absentCount'),
      excusedCount: integer(attendance.excusedCount, 'weeklyReport.aggregate.attendance.excusedCount'),
    },
    credits: {
      ledgerEntryCount: integer(credits.ledgerEntryCount, 'weeklyReport.aggregate.credits.ledgerEntryCount'),
      consumedCredits: string(credits.consumedCredits, 'weeklyReport.aggregate.credits.consumedCredits'),
      creditedCredits: string(credits.creditedCredits, 'weeklyReport.aggregate.credits.creditedCredits'),
      netCreditDelta: string(credits.netCreditDelta, 'weeklyReport.aggregate.credits.netCreditDelta'),
    },
    training: {
      activeDayCount: integer(training.activeDayCount, 'weeklyReport.aggregate.training.activeDayCount'),
      evidenceCount: string(training.evidenceCount, 'weeklyReport.aggregate.training.evidenceCount'),
      durationMs: string(training.durationMs, 'weeklyReport.aggregate.training.durationMs'),
      successCount: string(training.successCount, 'weeklyReport.aggregate.training.successCount'),
      dimensions: training.dimensions.map(weeklyReportTrainingDimension),
    },
    assignments: {
      assignmentCount: integer(assignments.assignmentCount, 'weeklyReport.aggregate.assignments.assignmentCount'),
      assignments: assignments.assignments.map(weeklyReportAssignment),
    },
    lessonFeedback: {
      feedbackCount: integer(lessonFeedback.feedbackCount, 'weeklyReport.aggregate.lessonFeedback.feedbackCount'),
      feedback: lessonFeedback.feedback.map(weeklyReportLessonFeedback),
    },
  };
}

function weeklyReportSummary(value: unknown): TeachingWeeklyReportSummary {
  const item = record(value, 'weeklyReport');
  return {
    id: string(item.id, 'weeklyReport.id'),
    organizationId: string(item.organizationId, 'weeklyReport.organizationId'),
    studentId: string(item.studentId, 'weeklyReport.studentId'),
    studentDisplayNameSnapshot: string(item.studentDisplayNameSnapshot, 'weeklyReport.studentDisplayNameSnapshot'),
    studentExternalRefSnapshot: nullableString(item.studentExternalRefSnapshot, 'weeklyReport.studentExternalRefSnapshot'),
    weekStart: string(item.weekStart, 'weeklyReport.weekStart'),
    weekEnd: string(item.weekEnd, 'weeklyReport.weekEnd'),
    timezoneSnapshot: string(item.timezoneSnapshot, 'weeklyReport.timezoneSnapshot'),
    revision: integer(item.revision, 'weeklyReport.revision', 1),
    status: enumValue(item.status, TEACHING_WEEKLY_REPORT_STATUSES, 'weeklyReport.status'),
    visibility: enumValue(item.visibility, TEACHING_WEEKLY_REPORT_VISIBILITIES, 'weeklyReport.visibility'),
    teacherSummary: string(item.teacherSummary, 'weeklyReport.teacherSummary'),
    nextWeekPlan: string(item.nextWeekPlan, 'weeklyReport.nextWeekPlan'),
    generatedByUserId: nullableInteger(item.generatedByUserId, 'weeklyReport.generatedByUserId', 1),
    generatedByUserIdSnapshot: integer(item.generatedByUserIdSnapshot, 'weeklyReport.generatedByUserIdSnapshot', 1),
    generatedByDisplayNameSnapshot: string(item.generatedByDisplayNameSnapshot, 'weeklyReport.generatedByDisplayNameSnapshot'),
    generatedByRoleSnapshot: enumValue(item.generatedByRoleSnapshot, WEEKLY_REPORT_AUTHOR_ROLES, 'weeklyReport.generatedByRoleSnapshot'),
    generatedAt: string(item.generatedAt, 'weeklyReport.generatedAt'),
    publishedByUserId: nullableInteger(item.publishedByUserId, 'weeklyReport.publishedByUserId', 1),
    publishedByUserIdSnapshot: nullableInteger(item.publishedByUserIdSnapshot, 'weeklyReport.publishedByUserIdSnapshot', 1),
    publishedByDisplayNameSnapshot: nullableString(item.publishedByDisplayNameSnapshot, 'weeklyReport.publishedByDisplayNameSnapshot'),
    publishedByRoleSnapshot: item.publishedByRoleSnapshot === null
      ? null
      : enumValue(item.publishedByRoleSnapshot, WEEKLY_REPORT_AUTHOR_ROLES, 'weeklyReport.publishedByRoleSnapshot'),
    publishedAt: nullableString(item.publishedAt, 'weeklyReport.publishedAt'),
    createdAt: string(item.createdAt, 'weeklyReport.createdAt'),
    updatedAt: string(item.updatedAt, 'weeklyReport.updatedAt'),
  };
}

function weeklyReport(value: unknown): TeachingWeeklyReport {
  const item = record(value, 'weeklyReport');
  return { ...weeklyReportSummary(item), aggregate: weeklyReportAggregate(item.aggregate) };
}

function learnerWeeklyReport(value: unknown, requireAggregate: boolean): TeachingLearnerWeeklyReport {
  const item = record(value, 'learnerWeeklyReport');
  const visibility = enumValue(
    item.visibility,
    ['student', 'student_and_guardians'] as const,
    'learnerWeeklyReport.visibility',
  );
  if (item.status !== 'published') {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learnerWeeklyReport.status is invalid');
  }
  if (requireAggregate && item.aggregate === undefined) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learnerWeeklyReport.aggregate is invalid');
  }
  return {
    id: string(item.id, 'learnerWeeklyReport.id'),
    studentId: string(item.studentId, 'learnerWeeklyReport.studentId'),
    studentDisplayNameSnapshot: string(item.studentDisplayNameSnapshot, 'learnerWeeklyReport.studentDisplayNameSnapshot'),
    weekStart: string(item.weekStart, 'learnerWeeklyReport.weekStart'),
    weekEnd: string(item.weekEnd, 'learnerWeeklyReport.weekEnd'),
    timezoneSnapshot: string(item.timezoneSnapshot, 'learnerWeeklyReport.timezoneSnapshot'),
    revision: integer(item.revision, 'learnerWeeklyReport.revision', 1),
    status: 'published',
    visibility,
    teacherSummary: string(item.teacherSummary, 'learnerWeeklyReport.teacherSummary'),
    nextWeekPlan: string(item.nextWeekPlan, 'learnerWeeklyReport.nextWeekPlan'),
    publishedByDisplayNameSnapshot: string(item.publishedByDisplayNameSnapshot, 'learnerWeeklyReport.publishedByDisplayNameSnapshot'),
    publishedByRoleSnapshot: enumValue(item.publishedByRoleSnapshot, WEEKLY_REPORT_AUTHOR_ROLES, 'learnerWeeklyReport.publishedByRoleSnapshot'),
    publishedAt: string(item.publishedAt, 'learnerWeeklyReport.publishedAt'),
    ...(item.aggregate === undefined ? {} : { aggregate: weeklyReportAggregate(item.aggregate) }),
  };
}

function learnerLessonFeedback(value: unknown): TeachingLearnerLessonFeedback {
  const item = record(value, 'learnerLessonFeedback');
  return {
    id: string(item.id, 'learnerLessonFeedback.id'),
    sessionId: string(item.sessionId, 'learnerLessonFeedback.sessionId'),
    studentId: string(item.studentId, 'learnerLessonFeedback.studentId'),
    revision: integer(item.revision, 'learnerLessonFeedback.revision', 1),
    visibility: enumValue(
      item.visibility,
      ['student', 'student_and_guardians'] as const,
      'learnerLessonFeedback.visibility',
    ),
    summary: string(item.summary, 'learnerLessonFeedback.summary'),
    strengths: nullableString(item.strengths, 'learnerLessonFeedback.strengths'),
    challenges: nullableString(item.challenges, 'learnerLessonFeedback.challenges'),
    nextGoals: nullableString(item.nextGoals, 'learnerLessonFeedback.nextGoals'),
    studentDisplayNameSnapshot: string(item.studentDisplayNameSnapshot, 'learnerLessonFeedback.studentDisplayNameSnapshot'),
    attendanceStatusSnapshot: enumValue(item.attendanceStatusSnapshot, TEACHING_ATTENDANCE_STATUSES, 'learnerLessonFeedback.attendanceStatusSnapshot'),
    authorUserId: nullableInteger(item.authorUserId, 'learnerLessonFeedback.authorUserId', 1),
    authorDisplayNameSnapshot: string(item.authorDisplayNameSnapshot, 'learnerLessonFeedback.authorDisplayNameSnapshot'),
    authorRoleSnapshot: enumValue(item.authorRoleSnapshot, WEEKLY_REPORT_AUTHOR_ROLES, 'learnerLessonFeedback.authorRoleSnapshot'),
    publishedAt: string(item.publishedAt, 'learnerLessonFeedback.publishedAt'),
    createdAt: string(item.createdAt, 'learnerLessonFeedback.createdAt'),
  };
}

export async function listTeachingLessonFeedback(
  orgSlug: string,
  sessionId: string,
  pageNumber = 1,
  pageSize = 100,
): Promise<TeachingPage<TeachingLessonFeedback>> {
  return page(
    await request(orgPath(orgSlug, `/sessions/${encodeURIComponent(sessionId)}/feedback${pageQuery(pageNumber, pageSize)}`)),
    'feedback',
    lessonFeedback,
  );
}

export async function listTeachingWeeklyReports(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
  studentId?: string,
): Promise<TeachingPage<TeachingWeeklyReportSummary>> {
  const query = new URLSearchParams(pageQuery(pageNumber, pageSize).slice(1));
  if (studentId) query.set('studentId', studentId);
  return page(
    await request(orgPath(orgSlug, `/weekly-reports?${query}`)),
    'weeklyReports',
    weeklyReportSummary,
  );
}

export async function generateTeachingWeeklyReport(
  orgSlug: string,
  input: GenerateTeachingWeeklyReportInput,
  idempotencyKey: string,
): Promise<TeachingWeeklyReport> {
  const envelope = record(
    await post(
      orgPath(orgSlug, '/weekly-reports/generate'),
      { studentId: input.studentId, weekStart: input.weekStart },
      idempotencyKey,
    ),
    'weekly report generate',
  );
  return weeklyReport(envelope.weeklyReport);
}

export async function getTeachingWeeklyReport(orgSlug: string, reportId: string): Promise<TeachingWeeklyReport> {
  const envelope = record(
    await request(orgPath(orgSlug, `/weekly-reports/${encodeURIComponent(reportId)}`)),
    'weekly report',
  );
  return weeklyReport(envelope.weeklyReport);
}

export async function publishTeachingWeeklyReport(
  orgSlug: string,
  reportId: string,
  input: PublishTeachingWeeklyReportInput,
  idempotencyKey: string,
): Promise<TeachingWeeklyReport> {
  const envelope = record(
    await post(
      orgPath(orgSlug, `/weekly-reports/${encodeURIComponent(reportId)}/publish`),
      {
        teacherSummary: input.teacherSummary,
        nextWeekPlan: input.nextWeekPlan,
        visibility: input.visibility,
      },
      idempotencyKey,
    ),
    'weekly report publish',
  );
  return weeklyReport(envelope.weeklyReport);
}

export async function createTeachingLessonFeedback(
  orgSlug: string,
  sessionId: string,
  studentId: string,
  input: {
    visibility: TeachingFeedbackVisibility;
    summary: string;
    strengths?: string | null;
    challenges?: string | null;
    nextGoals?: string | null;
    internalNotes?: string | null;
  },
  idempotencyKey: string,
): Promise<TeachingLessonFeedback> {
  const envelope = record(
    await post(
      orgPath(orgSlug, `/sessions/${encodeURIComponent(sessionId)}/students/${encodeURIComponent(studentId)}/feedback`),
      input,
      idempotencyKey,
    ),
    'lesson feedback create',
  );
  return lessonFeedback(envelope.feedback);
}

export async function listLearnerTeachingWeeklyReports(
  orgSlug: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingLearnerWeeklyReport>> {
  return page(
    await request(orgPath(
      orgSlug,
      `/me/students/${encodeURIComponent(studentId)}/weekly-reports${pageQuery(pageNumber, pageSize)}`,
    )),
    'weeklyReports',
    (value) => learnerWeeklyReport(value, false),
  );
}

export async function getLearnerTeachingWeeklyReport(
  orgSlug: string,
  studentId: string,
  reportId: string,
): Promise<TeachingLearnerWeeklyReport> {
  const envelope = record(await request(orgPath(
    orgSlug,
    `/me/students/${encodeURIComponent(studentId)}/weekly-reports/${encodeURIComponent(reportId)}`,
  )), 'learner weekly report');
  return learnerWeeklyReport(envelope.weeklyReport, true);
}

export async function listLearnerTeachingLessonFeedback(
  orgSlug: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingLearnerLessonFeedback>> {
  return page(
    await request(orgPath(
      orgSlug,
      `/me/students/${encodeURIComponent(studentId)}/lesson-feedback${pageQuery(pageNumber, pageSize)}`,
    )),
    'feedback',
    learnerLessonFeedback,
  );
}
