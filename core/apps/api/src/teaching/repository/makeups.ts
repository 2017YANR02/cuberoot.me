import { query, sql } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requireSessionScope, accessForWrite, requireWritable } from '../access/organization.js';
import { ConcealedTeachingPermissionDeniedException, TeachingApiException, crmConflict } from '../errors.js';
import { makeupAttemptToJson, attendanceToJson } from '../serialization/sessions.js';
import { type JsonValue, type MutationResult } from '../types.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency } from '../transactions.js';
import { insertTrainingAudit } from '../training/assignments.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const makeupsRepository: Pick<TeachingSaasRepository,
  'listMakeupAttempts' | 'listMakeupCandidates' | 'scheduleMakeup'> = {
  async listMakeupAttempts(actor, slug, sessionId, attendanceId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'makeup_attempt.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const sessionParams = scope === 'assigned'
        ? [access.id, sessionId, actor.userId, attendanceId]
        : [access.id, sessionId, attendanceId];
      const assigned = scope === 'assigned'
        ? `AND EXISTS (SELECT 1 FROM session_teachers assigned
             WHERE assigned.organization_id = session.organization_id
               AND assigned.session_id = session.id AND assigned.teacher_user_id = ?)`
        : '';
      const source = await query<Record<string, unknown>>(
        `SELECT attendance.id FROM teaching_sessions session
         JOIN attendance_records attendance
           ON attendance.organization_id = session.organization_id AND attendance.session_id = session.id
         WHERE session.organization_id = ? AND session.id = ? ${assigned}
           AND attendance.id = ?`,
        sessionParams,
      );
      if (!source.length) throw new ConcealedTeachingPermissionDeniedException('Attendance record not found');
      const [counts, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM makeup_attempts WHERE organization_id = ? AND source_attendance_id = ?',
          [access.id, attendanceId],
        ),
        query<Record<string, unknown>>(
          `SELECT * FROM makeup_attempts
           WHERE organization_id = ? AND source_attendance_id = ?
           ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
          [access.id, attendanceId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(makeupAttemptToJson), total: Number(counts[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async listMakeupCandidates(actor, slug, sessionId, attendanceId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'makeup_attempt.candidates', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const source = await query<Record<string, unknown>>(
        `SELECT source.ends_at, attendance.student_id, attendance.student_package_id,
                attendance.credit_cost
         FROM teaching_sessions source
         JOIN attendance_records attendance
           ON attendance.organization_id = source.organization_id AND attendance.session_id = source.id
         JOIN leave_requests leave_request
           ON leave_request.organization_id = attendance.organization_id
          AND leave_request.attendance_id = attendance.id AND leave_request.status = 'approved'
         WHERE source.organization_id = ? AND source.id = ? AND attendance.id = ?
           AND source.status IN ('scheduled', 'in_progress', 'completed')
           ${scope === 'assigned' ? `AND EXISTS (
             SELECT 1 FROM session_teachers assigned
             WHERE assigned.organization_id = source.organization_id
               AND assigned.session_id = source.id AND assigned.teacher_user_id = ?
           )` : ''}`,
        scope === 'assigned'
          ? [access.id, sessionId, attendanceId, actor.userId]
          : [access.id, sessionId, attendanceId],
      );
      if (!source.length) throw new ConcealedTeachingPermissionDeniedException('Attendance record not found');
      const sourceRow = source[0];
      const rows = await query<Record<string, unknown>>(
        `SELECT target.id AS session_id, target.title, target.starts_at, target.ends_at, target.timezone,
                target_attendance.id AS attendance_id,
                COUNT(*) OVER()::int AS total,
                COALESCE((
                  SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                    'userId', teacher.teacher_user_id_snapshot::text,
                    'displayName', teacher.teacher_display_name_snapshot,
                    'role', CASE teacher.role WHEN 'lead' THEN 'teacher' ELSE 'assistant' END
                  ) ORDER BY CASE teacher.role WHEN 'lead' THEN 0 ELSE 1 END,
                    teacher.teacher_display_name_snapshot, teacher.id)
                  FROM session_teachers teacher
                  WHERE teacher.organization_id = target.organization_id
                    AND teacher.session_id = target.id AND teacher.role IN ('lead', 'assistant')
                ), '[]'::jsonb) AS teachers
         FROM teaching_sessions target
         JOIN student_packages package
           ON package.organization_id = target.organization_id AND package.id = ?
          AND package.student_id = ? AND package.lifecycle_status = 'active'
          AND package.valid_from <= target.starts_at
          AND (package.valid_until IS NULL OR package.valid_until > target.starts_at)
         LEFT JOIN attendance_records target_attendance
           ON target_attendance.organization_id = target.organization_id
          AND target_attendance.session_id = target.id
          AND target_attendance.student_id = ?
         WHERE target.organization_id = ? AND target.status = 'scheduled'
           AND target.id <> ? AND target.starts_at > NOW() AND target.starts_at > ?
           AND (target_attendance.id IS NULL OR (
             target_attendance.status = 'expected'
             AND target_attendance.student_package_id = ?
             AND target_attendance.credit_cost = ?
           ))
           AND NOT EXISTS (
             SELECT 1 FROM makeup_attempts nested
             WHERE nested.organization_id = target.organization_id
               AND (
                 nested.target_attendance_id = ?
                 OR (nested.source_attendance_id = ? AND nested.status IN ('scheduled', 'fulfilled'))
                 OR (target_attendance.id IS NOT NULL AND (
                   nested.source_attendance_id = target_attendance.id
                   OR nested.target_attendance_id = target_attendance.id
                 ))
               )
           )
           ${scope === 'assigned' ? `AND EXISTS (
             SELECT 1 FROM session_teachers assigned
             WHERE assigned.organization_id = target.organization_id
               AND assigned.session_id = target.id AND assigned.teacher_user_id = ?
           )` : ''}
         ORDER BY target.starts_at, target.id LIMIT ? OFFSET ?`,
        scope === 'assigned'
          ? [sourceRow.student_package_id, sourceRow.student_id,
              sourceRow.student_id, access.id, sessionId, sourceRow.ends_at,
              sourceRow.student_package_id, sourceRow.credit_cost, attendanceId, attendanceId, actor.userId,
              pagination.pageSize, pagination.offset]
          : [sourceRow.student_package_id, sourceRow.student_id,
              sourceRow.student_id, access.id, sessionId, sourceRow.ends_at,
              sourceRow.student_package_id, sourceRow.credit_cost, attendanceId, attendanceId,
              pagination.pageSize, pagination.offset],
      );
      return {
        items: rows.map((row) => ({
          sessionId: String(row.session_id), title: String(row.title),
          startsAt: new Date(String(row.starts_at)).toISOString(),
          endsAt: new Date(String(row.ends_at)).toISOString(), timezone: String(row.timezone),
          teachers: row.teachers as JsonValue,
          attendanceId: row.attendance_id == null ? null : String(row.attendance_id),
        })),
        total: Number(rows[0]?.total ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async scheduleMakeup(
    actor, slug, sessionId, attendanceId, input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'makeup_attempt.schedule', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'makeup_attempt.schedule', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          const scope = requireSessionScope(access, 'session:manage');
          const sessionIds = [sessionId, input.targetSessionId].sort();
          const sessions = await tx`
            SELECT session.*, TRANSACTION_TIMESTAMP() AS operation_now FROM teaching_sessions session
            WHERE organization_id = ${access.id} AND id IN ${sql(sessionIds)}
            ORDER BY id FOR UPDATE`;
          if (sessions.length !== 2) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
          if (scope === 'assigned') {
            const assigned = await tx`
              SELECT session_id FROM session_teachers
              WHERE organization_id = ${access.id} AND session_id IN ${sql(sessionIds)}
                AND teacher_user_id = ${actor.userId}
              ORDER BY session_id, id FOR SHARE`;
            if (new Set(assigned.map((row) => String(row.session_id))).size !== 2) {
              throw new ConcealedTeachingPermissionDeniedException('Session not found');
            }
          }
          const sourceSession = sessions.find((row) => String(row.id) === sessionId) as Record<string, unknown>;
          const targetSession = sessions.find((row) => String(row.id) === input.targetSessionId) as Record<string, unknown>;
          const attendanceRows = await tx`
            SELECT attendance.*
            FROM attendance_records attendance
            JOIN attendance_records source
              ON source.organization_id = attendance.organization_id
             AND source.session_id = ${sessionId} AND source.id = ${attendanceId}
            WHERE attendance.organization_id = ${access.id}
              AND (
                attendance.id = source.id
                OR (
                  attendance.session_id = ${input.targetSessionId}
                  AND attendance.student_id = source.student_id
                )
              )
            ORDER BY attendance.id
            FOR UPDATE OF attendance`;
          const sourceAttendanceRows = attendanceRows.filter((row) => String(row.id) === attendanceId);
          if (!sourceAttendanceRows.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
          }
          const sourceAttendance = sourceAttendanceRows[0] as Record<string, unknown>;
          const targetAttendanceRows = attendanceRows.filter(
            (row) => String(row.session_id) === input.targetSessionId
              && String(row.student_id) === String(sourceAttendance.student_id),
          );
          const targetAttendanceId = targetAttendanceRows[0]?.id == null
            ? null
            : String(targetAttendanceRows[0].id);
          const existingAttempts = await tx`
            SELECT id, status, source_attendance_id, target_attendance_id FROM makeup_attempts
            WHERE organization_id = ${access.id}
              AND (
                target_attendance_id = ${attendanceId}
                OR (source_attendance_id = ${attendanceId} AND status IN ('scheduled', 'fulfilled'))
                OR (${targetAttendanceId}::uuid IS NOT NULL AND (
                  source_attendance_id = ${targetAttendanceId}
                  OR target_attendance_id = ${targetAttendanceId}
                ))
              )
            ORDER BY id FOR UPDATE`;
          const approvedLeave = await tx`
            SELECT id FROM leave_requests
            WHERE organization_id = ${access.id} AND attendance_id = ${attendanceId} AND status = 'approved'
            FOR UPDATE`;
          const packageId = sourceAttendance.student_package_id == null
            ? null
            : String(sourceAttendance.student_package_id);
          const packageRows = packageId === null
            ? []
            : await tx`SELECT id, lifecycle_status, valid_from, valid_until FROM student_packages
              WHERE organization_id = ${access.id} AND id = ${packageId}
                AND student_id = ${String(sourceAttendance.student_id)}
              FOR SHARE`;
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `makeup_attempt.schedule:${attendanceId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (!approvedLeave.length || sourceAttendance.status !== 'excused' || packageId === null) {
            throw new TeachingApiException('CONFLICT', 409, 'Makeup requires approved excused attendance with a package');
          }
          if (!['scheduled', 'in_progress', 'completed'].includes(String(sourceSession.status))) {
            throw new TeachingApiException('CONFLICT', 409, 'Source session cannot accept a makeup');
          }
          if (targetSession.status !== 'scheduled'
              || new Date(String(targetSession.starts_at)).getTime()
                <= new Date(String(targetSession.operation_now)).getTime()
              || new Date(String(targetSession.starts_at)).getTime() <= new Date(String(sourceSession.ends_at)).getTime()) {
            throw new TeachingApiException('CONFLICT', 409, 'Target session must be a later future scheduled session');
          }
          const studentPackage = packageRows[0] as Record<string, unknown> | undefined;
          const targetStartsAt = new Date(String(targetSession.starts_at)).getTime();
          if (!studentPackage || studentPackage.lifecycle_status !== 'active'
              || new Date(String(studentPackage.valid_from)).getTime() > targetStartsAt
              || (studentPackage.valid_until != null
                && new Date(String(studentPackage.valid_until)).getTime() <= targetStartsAt)) {
            throw new TeachingApiException('CONFLICT', 409, 'Student package is not active for the target session');
          }
          if (existingAttempts.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Attendance is already part of a makeup chain');
          }
          let targetAttendance: Record<string, unknown>;
          if (targetAttendanceRows.length) {
            targetAttendance = targetAttendanceRows[0] as Record<string, unknown>;
            if (targetAttendance.status !== 'expected'
                || String(targetAttendance.student_package_id) !== packageId
                || Number(targetAttendance.credit_cost) !== Number(sourceAttendance.credit_cost)) {
              throw new TeachingApiException('CONFLICT', 409, 'Existing target attendance does not match the source');
            }
          } else {
            const insertedAttendance = await tx`
              INSERT INTO attendance_records (
                organization_id, session_id, student_id, student_package_id,
                status, credit_cost, notes
              ) VALUES (
                ${access.id}, ${input.targetSessionId}, ${String(sourceAttendance.student_id)},
                ${packageId}, 'expected', ${Number(sourceAttendance.credit_cost)}, ''
              ) RETURNING *`;
            targetAttendance = insertedAttendance[0] as Record<string, unknown>;
          }
          const rows = await tx`
            INSERT INTO makeup_attempts (
              organization_id, source_session_id, source_attendance_id,
              target_session_id, target_attendance_id, student_id, student_package_id,
              credit_cost, reason, created_by_user_id, created_by_user_id_snapshot,
              created_by_display_name_snapshot, created_by_role_snapshot
            ) VALUES (
              ${access.id}, ${sessionId}, ${attendanceId}, ${input.targetSessionId},
              ${String(targetAttendance.id)}, ${String(sourceAttendance.student_id)}, ${packageId},
              ${Number(sourceAttendance.credit_cost)}, ${input.reason}, ${actor.userId}, ${actor.userId},
              ${actor.displayName}, ${access.role}
            ) RETURNING *`;
          const makeupAttemptId = String(rows[0].id);
          await tx`INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${input.targetSessionId}, 'makeup_scheduled', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId},
            ${sql.json({ makeupAttemptId, sourceSessionId: sessionId, sourceAttendanceId: attendanceId })}
          )`;
          await insertTrainingAudit(
            tx, access, actor, 'makeup_attempt.schedule', 'makeup_attempt', makeupAttemptId, requestId,
            { sourceSessionId: sessionId, sourceAttendanceId: attendanceId, targetSessionId: input.targetSessionId },
          );
          const result: MutationResult = {
            status: 201,
            body: {
              makeupAttempt: makeupAttemptToJson(rows[0] as Record<string, unknown>),
              attendance: attendanceToJson(targetAttendance),
            },
          };
          await completeIdempotency(tx, idem.id, result, 'makeup_attempt', makeupAttemptId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Makeup scheduling conflicts with the current attendance state');
      }
    });
  },
};
