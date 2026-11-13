import { type Tx, type OrganizationAccess, type JsonObject } from '../types.js';
import { iso } from '../serialization/common.js';

export async function buildWeeklyReportAggregate(
  tx: Tx,
  access: OrganizationAccess,
  studentId: string,
  weekStart: string,
): Promise<JsonObject> {
  const attendanceRows = await tx`
    SELECT COUNT(*)::int AS session_count,
           COUNT(*) FILTER (WHERE session.status = 'completed')::int AS completed_session_count,
           COUNT(*) FILTER (WHERE attendance.status = 'present')::int AS present_count,
           COUNT(*) FILTER (WHERE attendance.status = 'late')::int AS late_count,
           COUNT(*) FILTER (WHERE attendance.status = 'absent')::int AS absent_count,
           COUNT(*) FILTER (WHERE attendance.status = 'excused')::int AS excused_count
    FROM attendance_records attendance
    JOIN teaching_sessions session
      ON session.organization_id = attendance.organization_id
     AND session.id = attendance.session_id
    WHERE attendance.organization_id = ${access.id}
      AND attendance.student_id = ${studentId}
      AND session.starts_at >= (${weekStart}::date::timestamp AT TIME ZONE ${access.timezone})
      AND session.starts_at < ((${weekStart}::date + 7)::timestamp AT TIME ZONE ${access.timezone})`;
  const attendance = attendanceRows[0] as Record<string, unknown>;

  const creditRows = await tx`
    SELECT COUNT(*)::int AS ledger_entry_count,
           COALESCE(SUM(-delta) FILTER (WHERE entry_type = 'consume'), 0)::text AS consumed_credits,
           COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0)::text AS credited_credits,
           COALESCE(SUM(delta), 0)::text AS net_credit_delta
    FROM lesson_credit_ledger
    WHERE organization_id = ${access.id}
      AND student_id = ${studentId}
      AND created_at >= (${weekStart}::date::timestamp AT TIME ZONE ${access.timezone})
      AND created_at < ((${weekStart}::date + 7)::timestamp AT TIME ZONE ${access.timezone})`;
  const credits = creditRows[0] as Record<string, unknown>;

  const trainingRows = await tx`
    SELECT source, activity, trust_level,
           SUM(evidence_count)::text AS evidence_count,
           SUM(duration_ms)::text AS duration_ms,
           SUM(success_count)::text AS success_count
    FROM daily_training_rollups
    WHERE organization_id = ${access.id}
      AND student_id = ${studentId}
      AND local_date BETWEEN ${weekStart}::date AND (${weekStart}::date + 6)
    GROUP BY source, activity, trust_level
    ORDER BY source, activity, trust_level`;
  const trainingDayRows = await tx`
    SELECT COUNT(DISTINCT local_date)::int AS active_day_count
    FROM daily_training_rollups
    WHERE organization_id = ${access.id}
      AND student_id = ${studentId}
      AND local_date BETWEEN ${weekStart}::date AND (${weekStart}::date + 6)
      AND evidence_count > 0`;
  const dimensions = trainingRows.map((row) => ({
    source: String(row.source),
    activity: String(row.activity),
    trustLevel: String(row.trust_level),
    evidenceCount: String(row.evidence_count),
    durationMs: String(row.duration_ms),
    successCount: String(row.success_count),
  }));

  const assignmentRows = await tx`
    SELECT assignment.id, assignment.title, assignment.status, assignment.schedule_kind,
           assignment.expected_count, assignment.starts_at, assignment.ends_at,
           target.evidence_count, target.latest_review_revision, target.latest_review_status
    FROM training_assignment_targets target
    JOIN training_assignments assignment
      ON assignment.organization_id = target.organization_id
     AND assignment.id = target.assignment_id
    WHERE target.organization_id = ${access.id}
      AND target.student_id = ${studentId}
      AND target.target_kind = 'student'
      AND assignment.status IN ('published', 'closed')
      AND assignment.starts_at < ((${weekStart}::date + 7)::timestamp AT TIME ZONE ${access.timezone})
      AND (assignment.ends_at IS NULL
        OR assignment.ends_at > (${weekStart}::date::timestamp AT TIME ZONE ${access.timezone}))
    ORDER BY assignment.starts_at, assignment.id`;
  const assignments = assignmentRows.map((row) => ({
    assignmentId: String(row.id),
    title: String(row.title),
    status: String(row.status),
    scheduleKind: String(row.schedule_kind),
    expectedCount: Number(row.expected_count),
    evidenceCount: String(row.evidence_count),
    latestReviewRevision: Number(row.latest_review_revision),
    latestReviewStatus: row.latest_review_status == null ? null : String(row.latest_review_status),
    startsAt: iso(row.starts_at),
    endsAt: row.ends_at == null ? null : iso(row.ends_at),
  }));

  const feedbackRows = await tx`
    SELECT DISTINCT ON (feedback.session_id)
           feedback.id, feedback.session_id, feedback.revision, feedback.visibility,
           feedback.summary, feedback.strengths, feedback.challenges, feedback.next_goals,
           feedback.published_at, feedback.created_at
    FROM lesson_feedback feedback
    JOIN teaching_sessions session
      ON session.organization_id = feedback.organization_id
     AND session.id = feedback.session_id
    WHERE feedback.organization_id = ${access.id}
      AND feedback.student_id = ${studentId}
      AND feedback.visibility IN ('student', 'student_and_guardians')
      AND session.starts_at >= (${weekStart}::date::timestamp AT TIME ZONE ${access.timezone})
      AND session.starts_at < ((${weekStart}::date + 7)::timestamp AT TIME ZONE ${access.timezone})
    ORDER BY feedback.session_id, feedback.revision DESC`;
  const feedback = feedbackRows.map((row) => ({
    feedbackId: String(row.id),
    sessionId: String(row.session_id),
    revision: Number(row.revision),
    visibility: String(row.visibility),
    summary: String(row.summary),
    strengths: row.strengths == null ? null : String(row.strengths),
    challenges: row.challenges == null ? null : String(row.challenges),
    nextGoals: row.next_goals == null ? null : String(row.next_goals),
    publishedAt: row.published_at == null ? null : iso(row.published_at),
    createdAt: iso(row.created_at),
  }));

  const sumDimension = (key: 'evidenceCount' | 'durationMs' | 'successCount'): string =>
    dimensions.reduce((total, dimension) => total + BigInt(dimension[key]), 0n).toString();
  return {
    attendance: {
      sessionCount: Number(attendance.session_count),
      completedSessionCount: Number(attendance.completed_session_count),
      presentCount: Number(attendance.present_count),
      lateCount: Number(attendance.late_count),
      absentCount: Number(attendance.absent_count),
      excusedCount: Number(attendance.excused_count),
    },
    credits: {
      ledgerEntryCount: Number(credits.ledger_entry_count),
      consumedCredits: String(credits.consumed_credits),
      creditedCredits: String(credits.credited_credits),
      netCreditDelta: String(credits.net_credit_delta),
    },
    training: {
      activeDayCount: Number(trainingDayRows[0]?.active_day_count ?? 0),
      evidenceCount: sumDimension('evidenceCount'),
      durationMs: sumDimension('durationMs'),
      successCount: sumDimension('successCount'),
      dimensions,
    },
    assignments: { assignmentCount: assignments.length, assignments },
    lessonFeedback: { feedbackCount: feedback.length, feedback },
  };
}
