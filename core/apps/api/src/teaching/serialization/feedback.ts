import { type JsonObject, type JsonValue } from '../types.js';
import { iso } from './common.js';

export function lessonFeedbackToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    studentId: String(row.student_id),
    revision: Number(row.revision),
    visibility: String(row.visibility),
    summary: String(row.summary),
    strengths: row.strengths == null ? null : String(row.strengths),
    challenges: row.challenges == null ? null : String(row.challenges),
    nextGoals: row.next_goals == null ? null : String(row.next_goals),
    internalNotes: row.internal_notes == null ? null : String(row.internal_notes),
    studentDisplayNameSnapshot: String(row.student_display_name_snapshot),
    attendanceStatusSnapshot: String(row.attendance_status_snapshot),
    creditCostSnapshot: Number(row.credit_cost_snapshot),
    authorUserId: row.author_user_id == null ? null : Number(row.author_user_id),
    authorUserIdSnapshot: Number(row.author_user_id_snapshot),
    authorDisplayNameSnapshot: String(row.author_display_name_snapshot),
    authorRoleSnapshot: String(row.author_role_snapshot),
    publishedAt: row.published_at == null ? null : iso(row.published_at),
    createdAt: iso(row.created_at),
  };
}

export function weeklyReportToJson(row: Record<string, unknown>, includeAggregate: boolean): JsonObject {
  const report: JsonObject = {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studentId: String(row.student_id),
    studentDisplayNameSnapshot: String(row.student_display_name_snapshot),
    studentExternalRefSnapshot: row.student_external_ref_snapshot == null
      ? null
      : String(row.student_external_ref_snapshot),
    weekStart: String(row.week_start),
    weekEnd: String(row.week_end),
    timezoneSnapshot: String(row.timezone_snapshot),
    revision: Number(row.revision),
    status: String(row.status),
    visibility: String(row.visibility),
    teacherSummary: String(row.teacher_summary),
    nextWeekPlan: String(row.next_week_plan),
    generatedByUserId: row.generated_by_user_id == null ? null : Number(row.generated_by_user_id),
    generatedByUserIdSnapshot: Number(row.generated_by_user_id_snapshot),
    generatedByDisplayNameSnapshot: String(row.generated_by_display_name_snapshot),
    generatedByRoleSnapshot: String(row.generated_by_role_snapshot),
    generatedAt: iso(row.generated_at),
    publishedByUserId: row.published_by_user_id == null ? null : Number(row.published_by_user_id),
    publishedByUserIdSnapshot: row.published_by_user_id_snapshot == null
      ? null
      : Number(row.published_by_user_id_snapshot),
    publishedByDisplayNameSnapshot: row.published_by_display_name_snapshot == null
      ? null
      : String(row.published_by_display_name_snapshot),
    publishedByRoleSnapshot: row.published_by_role_snapshot == null
      ? null
      : String(row.published_by_role_snapshot),
    publishedAt: row.published_at == null ? null : iso(row.published_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
  if (includeAggregate) report.aggregate = row.aggregate as JsonObject;
  return report;
}

export function learnerLessonFeedbackToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    studentId: String(row.student_id),
    revision: Number(row.revision),
    visibility: String(row.visibility),
    summary: String(row.summary),
    strengths: row.strengths == null ? null : String(row.strengths),
    challenges: row.challenges == null ? null : String(row.challenges),
    nextGoals: row.next_goals == null ? null : String(row.next_goals),
    studentDisplayNameSnapshot: String(row.student_display_name_snapshot),
    attendanceStatusSnapshot: String(row.attendance_status_snapshot),
    authorUserId: row.author_user_id == null ? null : Number(row.author_user_id),
    authorDisplayNameSnapshot: String(row.author_display_name_snapshot),
    authorRoleSnapshot: String(row.author_role_snapshot),
    publishedAt: iso(row.published_at),
    createdAt: iso(row.created_at),
  };
}

export function learnerWeeklyReportToJson(row: Record<string, unknown>, includeAggregate: boolean): JsonObject {
  const report: JsonObject = {
    id: String(row.id),
    studentId: String(row.student_id),
    studentDisplayNameSnapshot: String(row.student_display_name_snapshot),
    weekStart: String(row.week_start),
    weekEnd: String(row.week_end),
    timezoneSnapshot: String(row.timezone_snapshot),
    revision: Number(row.revision),
    status: 'published',
    visibility: String(row.visibility),
    teacherSummary: String(row.teacher_summary),
    nextWeekPlan: String(row.next_week_plan),
    publishedByDisplayNameSnapshot: String(row.published_by_display_name_snapshot),
    publishedByRoleSnapshot: String(row.published_by_role_snapshot),
    publishedAt: iso(row.published_at),
  };
  if (!includeAggregate) return report;

  const aggregate = row.aggregate as Record<string, JsonValue>;
  const lessonFeedback = aggregate.lessonFeedback as Record<string, JsonValue>;
  const visibleFeedback = Array.isArray(lessonFeedback.feedback)
    ? lessonFeedback.feedback.filter((item) => {
        if (item == null || typeof item !== 'object' || Array.isArray(item)) return false;
        const visibility = (item as Record<string, JsonValue>).visibility;
        return visibility === 'student_and_guardians'
          || (row.is_self === true && visibility === 'student');
      })
    : [];
  report.aggregate = {
    ...aggregate,
    lessonFeedback: {
      ...lessonFeedback,
      feedbackCount: visibleFeedback.length,
      feedback: visibleFeedback,
    },
  };
  return report;
}
