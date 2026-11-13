import { TEACHING_FEEDBACK_VISIBILITIES, type TeachingFeedbackVisibility, type GenerateTeachingWeeklyReportInput, type PublishTeachingWeeklyReportInput, TEACHING_WEEKLY_REPORT_VISIBILITIES, TEACHING_AUDIT_OUTCOMES, type TeachingAuditOutcome } from '@cuberoot/shared/teaching';
import { type Context } from 'hono';
import { type JsonObject, type CreateLessonFeedbackInput, type WeeklyReportFilter, type AuditEventFilter } from '../types.js';
import { assertOnlyKeys, requiredString, optionalString, requiredUuid, requiredMonday, uuidParam } from './common.js';
import { TeachingApiException } from '../errors.js';

export function parseLessonFeedbackInput(body: JsonObject): CreateLessonFeedbackInput {
  assertOnlyKeys(
    body,
    ['visibility', 'summary', 'strengths', 'challenges', 'nextGoals', 'internalNotes'],
    'lesson feedback input',
  );
  if (!TEACHING_FEEDBACK_VISIBILITIES.includes(body.visibility as TeachingFeedbackVisibility)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'visibility is not supported');
  }
  return {
    visibility: body.visibility as TeachingFeedbackVisibility,
    summary: requiredString(body, 'summary', 2_000),
    strengths: optionalString(body, 'strengths', 4_000),
    challenges: optionalString(body, 'challenges', 4_000),
    nextGoals: optionalString(body, 'nextGoals', 4_000),
    internalNotes: optionalString(body, 'internalNotes', 4_000),
  };
}

export function parseGenerateWeeklyReportInput(body: JsonObject): GenerateTeachingWeeklyReportInput {
  assertOnlyKeys(body, ['studentId', 'weekStart'], 'weekly report generate input');
  return {
    studentId: requiredUuid(body, 'studentId'),
    weekStart: requiredMonday(body, 'weekStart'),
  };
}

export function parsePublishWeeklyReportInput(body: JsonObject): PublishTeachingWeeklyReportInput {
  assertOnlyKeys(body, ['teacherSummary', 'nextWeekPlan', 'visibility'], 'weekly report publish input');
  if (!TEACHING_WEEKLY_REPORT_VISIBILITIES.includes(
    body.visibility as PublishTeachingWeeklyReportInput['visibility'],
  )) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'visibility is not supported');
  }
  return {
    teacherSummary: requiredString(body, 'teacherSummary', 5_000),
    nextWeekPlan: requiredString(body, 'nextWeekPlan', 5_000),
    visibility: body.visibility as PublishTeachingWeeklyReportInput['visibility'],
  };
}

export function weeklyReportFilterOf(c: Context): WeeklyReportFilter {
  const rawStudentId = c.req.query('studentId');
  return { studentId: rawStudentId === undefined ? null : uuidParam(rawStudentId, 'studentId') };
}

export function auditEventFilterOf(c: Context): AuditEventFilter {
  const qRaw = c.req.query('q');
  const q = qRaw === undefined ? null : qRaw.trim();
  if (q !== null && (q === '' || q.length > 100)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'q must be 1 to 100 characters after trimming');
  }
  const outcomeRaw = c.req.query('outcome');
  if (
    outcomeRaw !== undefined &&
    !TEACHING_AUDIT_OUTCOMES.includes(outcomeRaw as TeachingAuditOutcome)
  ) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'outcome is not supported');
  }
  return {
    q,
    outcome: outcomeRaw === undefined ? null : outcomeRaw as TeachingAuditOutcome,
  };
}
