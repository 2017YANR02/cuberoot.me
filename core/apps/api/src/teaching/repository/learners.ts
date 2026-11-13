import { query, sql } from '../../db/connection.js';
import { type JsonObject, type JsonValue, type MutationResult } from '../types.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { lockConversationActorScope, requireLearnerScope } from '../access/learner.js';
import { ConcealedTeachingPermissionDeniedException, TeachingApiException, crmConflict } from '../errors.js';
import { leaveRequestToJson, attendanceToJson } from '../serialization/sessions.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency } from '../transactions.js';
import { conversationDisplayName } from '../serialization/conversations.js';
import { learnerWeeklyReportToJson, learnerLessonFeedbackToJson } from '../serialization/feedback.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const learnersRepository: Pick<TeachingSaasRepository,
  'listLearningContexts' | 'listLearnerSessions' | 'listLearnerLeaveRequests' | 'createLearnerLeaveRequest' | 'cancelLearnerLeaveRequest' | 'listLearnerWeeklyReports' | 'getLearnerWeeklyReport' | 'listLearnerLessonFeedback'> = {
  async listLearningContexts(actor, slug, requestId) {
    const rows = await query<Record<string, unknown>>(
      `SELECT context.organization_slug, context.organization_name,
              context.student_id, context.student_display_name,
              context.relationship_kind, context.guardian_link_id, context.relationship
       FROM (
         SELECT organization.slug AS organization_slug,
                organization.name AS organization_name,
                student.id AS student_id,
                student.display_name AS student_display_name,
                'student'::text AS relationship_kind,
                NULL::uuid AS guardian_link_id,
                NULL::text AS relationship,
                0 AS relationship_order
         FROM student_profiles student
         JOIN organizations organization ON organization.id = student.organization_id
         WHERE student.account_user_id = ?
           AND student.status = 'active'
           AND organization.status = 'active'
           AND (?::text IS NULL OR organization.slug = ?)
         UNION ALL
         SELECT organization.slug AS organization_slug,
                organization.name AS organization_name,
                student.id AS student_id,
                student.display_name AS student_display_name,
                'guardian'::text AS relationship_kind,
                guardian.id AS guardian_link_id,
                guardian.relationship,
                1 AS relationship_order
         FROM guardian_links guardian
         JOIN organizations organization ON organization.id = guardian.organization_id
         JOIN student_profiles student
           ON student.organization_id = guardian.organization_id
          AND student.id = guardian.student_id
         WHERE guardian.guardian_user_id = ?
           AND guardian.status = 'active'
           AND student.status = 'active'
           AND organization.status = 'active'
           AND (?::text IS NULL OR organization.slug = ?)
       ) context
       ORDER BY context.organization_slug,
                context.student_display_name, context.student_id,
                context.relationship_order, context.guardian_link_id`,
      [actor.userId, slug, slug, actor.userId, slug, slug],
    );
    const contexts: JsonObject[] = [];
    let previousKey: string | null = null;
    for (const row of rows) {
      const key = `${String(row.organization_slug)}:${String(row.student_id)}`;
      if (key !== previousKey) {
        contexts.push({
          organization: {
            slug: String(row.organization_slug),
            name: String(row.organization_name),
          },
          student: {
            id: String(row.student_id),
            displayName: String(row.student_display_name),
          },
          relationships: [],
        });
        previousKey = key;
      }
      const relationships = contexts[contexts.length - 1].relationships as JsonObject[];
      relationships.push(row.relationship_kind === 'student'
        ? { kind: 'student' }
        : {
            kind: 'guardian',
            guardianLinkId: String(row.guardian_link_id),
            relationship: String(row.relationship),
          });
    }
    return contexts;
  },

  async listLearnerSessions(actor, slug, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'learner.session.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        requireLearnerScope(scope);
        const rows = await tx`
          SELECT session.*, attendance.id AS attendance_id,
                 attendance.status AS attendance_status, attendance.credit_cost,
                 attendance.updated_at AS attendance_updated_at,
                 COUNT(*) OVER()::int AS total,
                 COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                   'displayName', teacher.teacher_display_name_snapshot,
                   'role', CASE teacher.role WHEN 'lead' THEN 'teacher' ELSE 'assistant' END
                 ) ORDER BY CASE teacher.role WHEN 'lead' THEN 0 ELSE 1 END,
                   teacher.teacher_display_name_snapshot, teacher.id)
                  FROM session_teachers teacher
                  WHERE teacher.organization_id = session.organization_id
                    AND teacher.session_id = session.id AND teacher.role IN ('lead', 'assistant')),
                  '[]'::jsonb) AS teachers,
                 active_leave.active_leave_request
          FROM attendance_records attendance
          JOIN teaching_sessions session
            ON session.organization_id = attendance.organization_id
           AND session.id = attendance.session_id
          LEFT JOIN LATERAL (
            SELECT JSONB_BUILD_OBJECT(
              'id', leave_request.id::text,
              'organizationId', leave_request.organization_id::text,
              'sessionId', leave_request.session_id::text,
              'attendanceId', leave_request.attendance_id::text,
              'studentId', leave_request.student_id::text,
              'status', leave_request.status,
              'reason', leave_request.reason,
              'decisionReason', leave_request.decision_reason,
              'requestedBy', JSONB_BUILD_OBJECT(
                'userId', leave_request.requested_by_user_id_snapshot::text,
                'displayName', leave_request.requested_by_display_name_snapshot,
                'role', leave_request.requested_by_role_snapshot,
                'relationship', leave_request.requested_by_relationship_snapshot
              ),
              'decidedBy', CASE WHEN leave_request.decided_by_user_id_snapshot IS NULL THEN NULL
                ELSE JSONB_BUILD_OBJECT(
                  'userId', leave_request.decided_by_user_id_snapshot::text,
                  'displayName', leave_request.decided_by_display_name_snapshot,
                  'role', leave_request.decided_by_role_snapshot,
                  'relationship', NULL
                ) END,
              'decidedAt', leave_request.decided_at,
              'createdAt', leave_request.created_at,
              'updatedAt', leave_request.updated_at
            ) AS active_leave_request
            FROM leave_requests leave_request
            WHERE leave_request.organization_id = attendance.organization_id
              AND leave_request.attendance_id = attendance.id
              AND leave_request.status IN ('pending', 'approved')
            ORDER BY leave_request.created_at DESC, leave_request.id DESC LIMIT 1
          ) active_leave ON TRUE
          WHERE attendance.organization_id = ${scope.organization.id}
            AND attendance.student_id = ${studentId}
          ORDER BY session.starts_at DESC, session.id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map((row) => ({
            id: String(row.id), title: String(row.title),
            startsAt: new Date(String(row.starts_at)).toISOString(),
            endsAt: new Date(String(row.ends_at)).toISOString(), timezone: String(row.timezone),
            status: String(row.status), teachers: row.teachers as JsonValue,
            attendance: {
              id: String(row.attendance_id),
              status: String(row.attendance_status),
              creditCost: Number(row.credit_cost),
              updatedAt: new Date(String(row.attendance_updated_at)).toISOString(),
            },
            activeLeaveRequest: (row.active_leave_request as JsonValue | null) ?? null,
          })),
          total: Number(rows[0]?.total ?? 0), page: pagination.page, pageSize: pagination.pageSize,
        };
      });
    });
  },

  async listLearnerLeaveRequests(actor, slug, studentId, sessionId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'learner.leave_request.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        requireLearnerScope(scope);
        const attendance = await tx`
          SELECT id FROM attendance_records
          WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
            AND student_id = ${studentId}`;
        if (!attendance.length) throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
        const [counts, rows] = await Promise.all([
          tx`SELECT COUNT(*)::int AS count FROM leave_requests
             WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
               AND student_id = ${studentId}`,
          tx`SELECT * FROM leave_requests
             WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
               AND student_id = ${studentId}
             ORDER BY created_at DESC, id DESC
             LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`,
        ]);
        return {
          items: rows.map((row) => leaveRequestToJson(row as Record<string, unknown>)),
          total: Number(counts[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
        };
      });
    });
  },

  async createLearnerLeaveRequest(
    actor, slug, studentId, sessionId, attendanceId,
    input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'learner.leave_request.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'learner.leave_request.create', 60, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'write');
          requireLearnerScope(scope);
          const sessions = await tx`
            SELECT * FROM teaching_sessions
            WHERE organization_id = ${scope.organization.id} AND id = ${sessionId}
            FOR UPDATE`;
          if (!sessions.length) throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
          const attendance = await tx`
            SELECT * FROM attendance_records
            WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
              AND id = ${attendanceId} AND student_id = ${studentId}
            FOR UPDATE`;
          if (!attendance.length) throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
          const idem = await beginIdempotency(
            tx, actor.userId, scope.organization.id,
            `learner.leave_request.create:${studentId}:${attendanceId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (!['scheduled', 'in_progress'].includes(String(sessions[0].status))
              || attendance[0].status !== 'expected') {
            throw new TeachingApiException('CONFLICT', 409, 'Leave requires expected attendance in an open session');
          }
          const displayName = conversationDisplayName(actor, scope);
          const rows = await tx`
            INSERT INTO leave_requests (
              organization_id, session_id, attendance_id, student_id, reason,
              requested_by_user_id, requested_by_user_id_snapshot,
              requested_by_display_name_snapshot, requested_by_role_snapshot,
              requested_by_relationship_snapshot
            ) VALUES (
              ${scope.organization.id}, ${sessionId}, ${attendanceId}, ${studentId}, ${input.reason},
              ${actor.userId}, ${actor.userId}, ${displayName}, ${scope.role}, ${scope.relationship}
            ) RETURNING *`;
          const leaveRequestId = String(rows[0].id);
          await tx`INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${scope.organization.id}, ${sessionId}, 'leave_requested', ${actor.userId}, ${scope.role},
            ${displayName}, ${requestId}, ${sql.json({ leaveRequestId, attendanceId, studentId })}
          )`;
          await tx`INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${scope.organization.id}, ${actor.userId}, ${scope.role}, ${displayName},
            'learner.leave_request.create', 'leave_request', ${leaveRequestId}, ${requestId},
            ${sql.json({ sessionId, attendanceId, studentId })}
          )`;
          const result: MutationResult = {
            status: 201,
            body: {
              leaveRequest: leaveRequestToJson(rows[0] as Record<string, unknown>),
              attendance: attendanceToJson(attendance[0] as Record<string, unknown>),
            },
          };
          await completeIdempotency(tx, idem.id, result, 'leave_request', leaveRequestId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Leave request conflicts with the current attendance state');
      }
    });
  },

  async cancelLearnerLeaveRequest(
    actor, slug, studentId, sessionId, attendanceId, leaveRequestId,
    input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'learner.leave_request.cancel', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'learner.leave_request.cancel', 60, '1 minute');
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'write');
        requireLearnerScope(scope);
        const sessions = await tx`SELECT id, status FROM teaching_sessions
          WHERE organization_id = ${scope.organization.id} AND id = ${sessionId} FOR UPDATE`;
        if (!sessions.length) throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
        const attendance = await tx`
          SELECT * FROM attendance_records
          WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
            AND id = ${attendanceId} AND student_id = ${studentId}
          FOR UPDATE`;
        if (!attendance.length) throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
        const requests = await tx`
          SELECT * FROM leave_requests
          WHERE organization_id = ${scope.organization.id} AND session_id = ${sessionId}
            AND attendance_id = ${attendanceId} AND id = ${leaveRequestId}
            AND student_id = ${studentId} AND requested_by_user_id_snapshot = ${actor.userId}
          FOR UPDATE`;
        if (!requests.length) throw new ConcealedTeachingPermissionDeniedException('Leave request not found');
        const idem = await beginIdempotency(
          tx, actor.userId, scope.organization.id,
          `learner.leave_request.cancel:${studentId}:${leaveRequestId}`,
          idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        if (!['scheduled', 'in_progress'].includes(String(sessions[0].status))) {
          throw new TeachingApiException('CONFLICT', 409, 'Leave requests cannot be cancelled after session closure');
        }
        if (requests[0].status !== 'pending') {
          throw new TeachingApiException('CONFLICT', 409, 'Only a pending leave request can be cancelled');
        }
        const displayName = conversationDisplayName(actor, scope);
        const rows = await tx`
          UPDATE leave_requests SET
            status = 'cancelled', decision_reason = ${input.reason},
            decided_by_user_id = ${actor.userId}, decided_by_user_id_snapshot = ${actor.userId},
            decided_by_display_name_snapshot = ${displayName},
            decided_by_role_snapshot = ${scope.role}, decided_at = NOW()
          WHERE organization_id = ${scope.organization.id} AND id = ${leaveRequestId}
          RETURNING *`;
        await tx`INSERT INTO session_events (
          organization_id, session_id, event_type, actor_user_id, actor_role,
          actor_display_name, request_id, metadata
        ) VALUES (
          ${scope.organization.id}, ${sessionId}, 'leave_cancelled', ${actor.userId}, ${scope.role},
          ${displayName}, ${requestId}, ${sql.json({ leaveRequestId, attendanceId, studentId })}
        )`;
        await tx`INSERT INTO teaching_audit_events (
          organization_id, actor_user_id, actor_role, actor_display_name,
          action, entity_type, entity_id, request_id, metadata
        ) VALUES (
          ${scope.organization.id}, ${actor.userId}, ${scope.role}, ${displayName},
          'learner.leave_request.cancel', 'leave_request', ${leaveRequestId}, ${requestId},
          ${sql.json({ sessionId, attendanceId, studentId })}
        )`;
        const result: MutationResult = {
          status: 200,
          body: {
            leaveRequest: leaveRequestToJson(rows[0] as Record<string, unknown>),
            attendance: attendanceToJson(attendance[0] as Record<string, unknown>),
          },
        };
        await completeIdempotency(tx, idem.id, result, 'leave_request', leaveRequestId);
        return result;
      }) as MutationResult;
    });
  },

  async listLearnerWeeklyReports(actor, slug, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'weekly_report.learner.list', requestId, async () => {
      const commonParams = [slug, studentId, actor.userId, actor.userId];
      const visibilitySql = `report.status = 'published'
        AND report.published_at IS NOT NULL
        AND report.visibility IN ('student', 'student_and_guardians')
        AND (
          student.account_user_id = ?
          OR (
            report.visibility = 'student_and_guardians'
            AND EXISTS (
              SELECT 1 FROM guardian_links guardian
              WHERE guardian.organization_id = student.organization_id
                AND guardian.student_id = student.id
                AND guardian.guardian_user_id = ?
                AND guardian.status = 'active'
            )
          )
        )`;
      const totals = await query<Record<string, unknown>>(
        `SELECT COUNT(*)::int AS total
         FROM teaching_weekly_reports report
         JOIN organizations organization ON organization.id = report.organization_id
         JOIN student_profiles student
           ON student.organization_id = report.organization_id AND student.id = report.student_id
         WHERE organization.slug = ? AND organization.status = 'active'
           AND student.id = ? AND student.status = 'active'
           AND ${visibilitySql}`,
        commonParams,
      );
      const rows = await query<Record<string, unknown>>(
        `SELECT report.*, (student.account_user_id = ?) AS is_self
         FROM teaching_weekly_reports report
         JOIN organizations organization ON organization.id = report.organization_id
         JOIN student_profiles student
           ON student.organization_id = report.organization_id AND student.id = report.student_id
         WHERE organization.slug = ? AND organization.status = 'active'
           AND student.id = ? AND student.status = 'active'
           AND ${visibilitySql}
         ORDER BY report.week_start DESC, report.revision DESC, report.id
         LIMIT ? OFFSET ?`,
        [actor.userId, ...commonParams, pagination.pageSize, pagination.offset],
      );
      return {
        items: rows.map((row) => learnerWeeklyReportToJson(row, false)),
        total: Number(totals[0]?.total ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async getLearnerWeeklyReport(actor, slug, studentId, reportId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'weekly_report.learner.read', requestId, async () => {
      const rows = await query<Record<string, unknown>>(
        `SELECT report.*, (student.account_user_id = ?) AS is_self
         FROM teaching_weekly_reports report
         JOIN organizations organization ON organization.id = report.organization_id
         JOIN student_profiles student
           ON student.organization_id = report.organization_id AND student.id = report.student_id
         WHERE organization.slug = ? AND organization.status = 'active'
           AND student.id = ? AND student.status = 'active'
           AND report.id = ?
           AND report.status = 'published' AND report.published_at IS NOT NULL
           AND report.visibility IN ('student', 'student_and_guardians')
           AND (
             student.account_user_id = ?
             OR (
               report.visibility = 'student_and_guardians'
               AND EXISTS (
                 SELECT 1 FROM guardian_links guardian
                 WHERE guardian.organization_id = student.organization_id
                   AND guardian.student_id = student.id
                   AND guardian.guardian_user_id = ?
                   AND guardian.status = 'active'
               )
             )
           )`,
        [actor.userId, slug, studentId, reportId, actor.userId, actor.userId],
      );
      if (!rows.length) {
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Weekly report not found');
      }
      return learnerWeeklyReportToJson(rows[0], true);
    });
  },

  async listLearnerLessonFeedback(actor, slug, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'lesson_feedback.learner.list', requestId, async () => {
      const visibleFeedbackSql = `organization.slug = ? AND organization.status = 'active'
        AND student.id = ? AND student.status = 'active'
        AND feedback.published_at IS NOT NULL
        AND feedback.visibility IN ('student', 'student_and_guardians')
        AND (
          student.account_user_id = ?
          OR (
            feedback.visibility = 'student_and_guardians'
            AND EXISTS (
              SELECT 1 FROM guardian_links guardian
              WHERE guardian.organization_id = student.organization_id
                AND guardian.student_id = student.id
                AND guardian.guardian_user_id = ?
                AND guardian.status = 'active'
            )
          )
        )`;
      const params = [slug, studentId, actor.userId, actor.userId];
      const totals = await query<Record<string, unknown>>(
        `WITH visible AS (
           SELECT feedback.id,
                  ROW_NUMBER() OVER (
                    PARTITION BY feedback.session_id, feedback.student_id
                    ORDER BY feedback.revision DESC, feedback.id DESC
                  ) AS visible_revision_rank
           FROM lesson_feedback feedback
           JOIN organizations organization ON organization.id = feedback.organization_id
           JOIN student_profiles student
             ON student.organization_id = feedback.organization_id AND student.id = feedback.student_id
           WHERE ${visibleFeedbackSql}
         )
         SELECT COUNT(*)::int AS total FROM visible WHERE visible_revision_rank = 1`,
        params,
      );
      const rows = await query<Record<string, unknown>>(
        `WITH visible AS (
           SELECT feedback.*,
                  ROW_NUMBER() OVER (
                    PARTITION BY feedback.session_id, feedback.student_id
                    ORDER BY feedback.revision DESC, feedback.id DESC
                  ) AS visible_revision_rank
           FROM lesson_feedback feedback
           JOIN organizations organization ON organization.id = feedback.organization_id
           JOIN student_profiles student
             ON student.organization_id = feedback.organization_id AND student.id = feedback.student_id
           WHERE ${visibleFeedbackSql}
         )
         SELECT * FROM visible
         WHERE visible_revision_rank = 1
         ORDER BY published_at DESC, session_id DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...params, pagination.pageSize, pagination.offset],
      );
      return {
        items: rows.map(learnerLessonFeedbackToJson),
        total: Number(totals[0]?.total ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },
};
