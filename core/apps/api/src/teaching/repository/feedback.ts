import { query, sql } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requireSessionScope, accessForWrite, requireWritable, requireReportScope } from '../access/organization.js';
import { ConcealedTeachingPermissionDeniedException, TeachingApiException, crmConflict } from '../errors.js';
import { lessonFeedbackToJson, weeklyReportToJson } from '../serialization/feedback.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency, withWeeklyReportGenerateRetry, withRepeatableReadRetry } from '../transactions.js';
import { LESSON_FEEDBACK_CREATE_OPERATION } from '../constants.js';
import { type MutationResult, type PageResult, type JsonObject } from '../types.js';
import { actorHasActiveStudentScope, lockAndCheckTeacherStudentScope } from '../access/student.js';
import { buildWeeklyReportAggregate } from '../feedback/aggregate.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const feedbackRepository: Pick<TeachingSaasRepository,
  'listLessonFeedback' | 'createLessonFeedback' | 'listWeeklyReports' | 'getWeeklyReport' | 'generateWeeklyReport' | 'publishWeeklyReport'> = {
  async listLessonFeedback(actor, slug, sessionId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'lesson_feedback.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'feedback:read');
      const sessions = scope === 'organization'
        ? await query<Record<string, unknown>>(
            'SELECT 1 FROM teaching_sessions WHERE organization_id = ? AND id = ?',
            [access.id, sessionId],
          )
        : await query<Record<string, unknown>>(
            `SELECT 1
             FROM teaching_sessions session
             WHERE session.organization_id = ? AND session.id = ?
               AND EXISTS (
                 SELECT 1 FROM session_teachers assigned
                 WHERE assigned.organization_id = session.organization_id
                   AND assigned.session_id = session.id
                   AND assigned.teacher_user_id = ?
               )`,
            [access.id, sessionId, actor.userId],
          );
      if (!sessions.length) {
        if (scope === 'assigned') {
          const existing = await query<Record<string, unknown>>(
            'SELECT 1 FROM teaching_sessions WHERE organization_id = ? AND id = ?',
            [access.id, sessionId],
          );
          if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
        }
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
      }
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count
           FROM lesson_feedback
           WHERE organization_id = ? AND session_id = ?`,
          [access.id, sessionId],
        ),
        query<Record<string, unknown>>(
          `SELECT *
           FROM lesson_feedback
           WHERE organization_id = ? AND session_id = ?
           ORDER BY created_at DESC, revision DESC, id DESC
           LIMIT ? OFFSET ?`,
          [access.id, sessionId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(lessonFeedbackToJson),
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async createLessonFeedback(
    actor, slug, sessionId, studentId, input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'lesson_feedback.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, LESSON_FEEDBACK_CREATE_OPERATION, 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          const scope = requireSessionScope(access, 'feedback:manage');
          const sessions = scope === 'organization'
            ? await tx`
                SELECT session.id, session.status
                FROM teaching_sessions session
                WHERE session.organization_id = ${access.id} AND session.id = ${sessionId}
                FOR UPDATE OF session`
            : await tx`
                SELECT session.id, session.status
                FROM teaching_sessions session
                WHERE session.organization_id = ${access.id} AND session.id = ${sessionId}
                  AND EXISTS (
                    SELECT 1 FROM session_teachers assigned
                    WHERE assigned.organization_id = session.organization_id
                      AND assigned.session_id = session.id
                      AND assigned.teacher_user_id = ${actor.userId}
                  )
                FOR UPDATE OF session`;
          if (!sessions.length) {
            if (scope === 'assigned') {
              const existing = await tx`
                SELECT 1 FROM teaching_sessions
                WHERE organization_id = ${access.id} AND id = ${sessionId}`;
              if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
            }
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
          }
          const idem = await beginIdempotency(
            tx,
            actor.userId,
            access.id,
            LESSON_FEEDBACK_CREATE_OPERATION,
            idempotencyKey,
            requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (sessions[0].status !== 'completed') {
            throw new TeachingApiException('CONFLICT', 409, 'Lesson feedback requires a completed session');
          }
          const attendance = await tx`
            SELECT 1
            FROM attendance_records
            WHERE organization_id = ${access.id}
              AND session_id = ${sessionId}
              AND student_id = ${studentId}
            FOR UPDATE`;
          if (!attendance.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session attendance not found');
          }
          const rows = await tx`
            INSERT INTO lesson_feedback (
              organization_id, session_id, student_id, visibility,
              summary, strengths, challenges, next_goals, internal_notes,
              author_user_id
            ) VALUES (
              ${access.id}, ${sessionId}, ${studentId}, ${input.visibility},
              ${input.summary}, ${input.strengths}, ${input.challenges},
              ${input.nextGoals}, ${input.internalNotes}, ${actor.userId}
            )
            RETURNING *`;
          const feedback = lessonFeedbackToJson(rows[0] as Record<string, unknown>);
          const feedbackId = String(rows[0].id);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'lesson_feedback.create', 'lesson_feedback', ${feedbackId}, ${requestId},
              ${sql.json({
                sessionId,
                studentId,
                revision: Number(rows[0].revision),
                visibility: input.visibility,
              })}
            )`;
          const result: MutationResult = { status: 201, body: { feedback } };
          await completeIdempotency(tx, idem.id, result, 'lesson_feedback', feedbackId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Lesson feedback could not be created');
      }
    });
  },

  async listWeeklyReports(actor, slug, filter, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'weekly_report.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireReportScope(access, 'report:read');
      return await sql.begin(async (tx) => {
        if (scope === 'assigned' && filter.studentId !== null
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, filter.studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Weekly report student not found');
        }
        const scopeClause = scope === 'assigned'
          ? sql`AND EXISTS (
              SELECT 1
              FROM student_profiles active_student
              WHERE active_student.organization_id = report.organization_id
                AND active_student.id = report.student_id
                AND active_student.status = 'active'
            )
            AND EXISTS (
              SELECT 1 FROM teacher_assignments direct_scope
              WHERE direct_scope.organization_id = report.organization_id
                AND direct_scope.teacher_user_id = ${actor.userId}
                AND direct_scope.student_id = report.student_id
                AND direct_scope.effective_from <= clock_timestamp()
                AND (direct_scope.effective_to IS NULL OR direct_scope.effective_to > clock_timestamp())
              UNION ALL
              SELECT 1
              FROM teacher_assignments group_scope
              JOIN teaching_groups teaching_group
                ON teaching_group.organization_id = group_scope.organization_id
               AND teaching_group.id = group_scope.group_id
               AND teaching_group.status = 'active'
              LEFT JOIN teaching_campuses campus
                ON campus.organization_id = teaching_group.organization_id
               AND campus.id = teaching_group.campus_id
              JOIN student_group_memberships membership
                ON membership.organization_id = group_scope.organization_id
               AND membership.group_id = group_scope.group_id
               AND membership.student_id = report.student_id
               AND membership.effective_from <= clock_timestamp()
               AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
              WHERE group_scope.organization_id = report.organization_id
                AND group_scope.teacher_user_id = ${actor.userId}
                AND group_scope.effective_from <= clock_timestamp()
                AND (group_scope.effective_to IS NULL OR group_scope.effective_to > clock_timestamp())
                AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
            )`
          : sql``;
        const studentClause = filter.studentId === null
          ? sql``
          : sql`AND report.student_id = ${filter.studentId}`;
        const totals = await tx`
          SELECT COUNT(*)::int AS total
          FROM teaching_weekly_reports report
          WHERE report.organization_id = ${access.id}
          ${studentClause}
          ${scopeClause}`;
        const rows = await tx`
          SELECT report.*
          FROM teaching_weekly_reports report
          WHERE report.organization_id = ${access.id}
          ${studentClause}
          ${scopeClause}
          ORDER BY report.week_start DESC, report.student_display_name_snapshot, report.revision DESC, report.id
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map((row) => weeklyReportToJson(row as Record<string, unknown>, false)),
          total: Number(totals[0]?.total ?? 0),
          page: pagination.page,
          pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async getWeeklyReport(actor, slug, reportId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'weekly_report.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireReportScope(access, 'report:read');
      return await sql.begin(async (tx) => {
        const rows = await tx`
          SELECT * FROM teaching_weekly_reports
          WHERE organization_id = ${access.id} AND id = ${reportId}`;
        if (!rows.length) {
          throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Weekly report not found');
        }
        const report = rows[0] as Record<string, unknown>;
        if (scope === 'assigned'
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, String(report.student_id))) {
          throw new ConcealedTeachingPermissionDeniedException('Weekly report not found');
        }
        return weeklyReportToJson(report, true);
      }) as JsonObject;
    });
  },

  async generateWeeklyReport(actor, slug, input, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, 'weekly_report.generate', 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'weekly_report.generate', requestId, async () => {
      try {
        return await withWeeklyReportGenerateRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          const scope = requireReportScope(access, 'report:manage');
          if (scope === 'assigned'
              && !await lockAndCheckTeacherStudentScope(tx, access, actor, input.studentId)) {
            throw new ConcealedTeachingPermissionDeniedException('Weekly report student not found');
          }
          const students = await tx`
            SELECT id, display_name, external_ref
            FROM student_profiles
            WHERE organization_id = ${access.id} AND id = ${input.studentId} AND status = 'active'
            FOR UPDATE`;
          if (!students.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Weekly report student not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, 'weekly_report.generate', idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          const aggregate = await buildWeeklyReportAggregate(tx, access, input.studentId, input.weekStart);
          const drafts = await tx`
            SELECT id FROM teaching_weekly_reports
            WHERE organization_id = ${access.id} AND student_id = ${input.studentId}
              AND week_start = ${input.weekStart}::date AND status = 'draft'
            FOR UPDATE`;
          const rows = drafts.length
            ? await tx`
                UPDATE teaching_weekly_reports
                SET aggregate = ${sql.json(aggregate)}, generated_by_user_id = ${actor.userId}
                WHERE organization_id = ${access.id} AND id = ${String(drafts[0].id)}
                RETURNING *`
            : await tx`
                INSERT INTO teaching_weekly_reports (
                  organization_id, student_id, student_display_name_snapshot,
                  student_external_ref_snapshot, week_start, week_end, timezone_snapshot,
                  revision, aggregate, generated_by_user_id, generated_by_user_id_snapshot,
                  generated_by_display_name_snapshot, generated_by_role_snapshot
                ) VALUES (
                  ${access.id}, ${input.studentId}, ${String(students[0].display_name)},
                  ${students[0].external_ref == null ? null : String(students[0].external_ref)},
                  ${input.weekStart}::date, (${input.weekStart}::date + 6), ${access.timezone},
                  1, ${sql.json(aggregate)}, ${actor.userId}, ${actor.userId},
                  ${actor.displayName}, ${access.role}
                ) RETURNING *`;
          const report = weeklyReportToJson(rows[0] as Record<string, unknown>, true);
          const reportId = String(rows[0].id);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'weekly_report.generate', 'teaching_weekly_report', ${reportId}, ${requestId},
              ${sql.json({
                studentId: input.studentId,
                weekStart: input.weekStart,
                revision: Number(rows[0].revision),
                recomputed: drafts.length > 0,
              })}
            )`;
          const result: MutationResult = {
            status: drafts.length ? 200 : 201,
            body: { weeklyReport: report },
          };
          await completeIdempotency(tx, idem.id, result, 'teaching_weekly_report', reportId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Weekly report could not be generated');
      }
    });
  },

  async publishWeeklyReport(
    actor, slug, reportId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, 'weekly_report.publish', 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'weekly_report.publish', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          const scope = requireReportScope(access, 'report:manage');
          const reports = await tx`
            SELECT * FROM teaching_weekly_reports
            WHERE organization_id = ${access.id} AND id = ${reportId}
            FOR UPDATE`;
          if (!reports.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Weekly report not found');
          }
          const report = reports[0] as Record<string, unknown>;
          if (scope === 'assigned'
              && !await lockAndCheckTeacherStudentScope(tx, access, actor, String(report.student_id))) {
            throw new ConcealedTeachingPermissionDeniedException('Weekly report not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `weekly_report.publish:${reportId}`, idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (report.status !== 'draft') {
            throw new TeachingApiException('CONFLICT', 409, 'Weekly report is already published');
          }
          const rows = await tx`
            UPDATE teaching_weekly_reports
            SET status = 'published', visibility = ${input.visibility},
                teacher_summary = ${input.teacherSummary}, next_week_plan = ${input.nextWeekPlan},
                published_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND id = ${reportId}
            RETURNING *`;
          const published = weeklyReportToJson(rows[0] as Record<string, unknown>, true);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'weekly_report.publish', 'teaching_weekly_report', ${reportId}, ${requestId},
              ${sql.json({
                studentId: String(report.student_id),
                weekStart: String(report.week_start),
                revision: Number(report.revision),
                visibility: input.visibility,
              })}
            )`;
          const result: MutationResult = { status: 200, body: { weeklyReport: published } };
          await completeIdempotency(tx, idem.id, result, 'teaching_weekly_report', reportId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Weekly report could not be published');
      }
    });
  },
};
