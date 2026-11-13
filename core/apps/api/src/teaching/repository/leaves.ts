import { query, sql } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requireSessionScope, accessForWrite, requireWritable } from '../access/organization.js';
import { ConcealedTeachingPermissionDeniedException, TeachingApiException, crmConflict } from '../errors.js';
import { leaveRequestToJson, attendanceToJson } from '../serialization/sessions.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency } from '../transactions.js';
import { lockManagedSession } from '../access/session.js';
import { insertTrainingAudit } from '../training/assignments.js';
import { type MutationResult } from '../types.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const leavesRepository: Pick<TeachingSaasRepository,
  'listLeaveRequests' | 'createLeaveRequest' | 'decideLeaveRequest' | 'cancelLeaveRequest'> = {
  async listLeaveRequests(actor, slug, sessionId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'leave_request.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const assigned = scope === 'assigned'
        ? `AND EXISTS (SELECT 1 FROM session_teachers assigned
             WHERE assigned.organization_id = session.organization_id
               AND assigned.session_id = session.id AND assigned.teacher_user_id = ?)`
        : '';
      const params = scope === 'assigned' ? [access.id, sessionId, actor.userId] : [access.id, sessionId];
      const sessions = await query<Record<string, unknown>>(
        `SELECT 1 FROM teaching_sessions session
         WHERE session.organization_id = ? AND session.id = ? ${assigned}`,
        params,
      );
      if (!sessions.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
      const [counts, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM leave_requests WHERE organization_id = ? AND session_id = ?',
          [access.id, sessionId],
        ),
        query<Record<string, unknown>>(
          `SELECT * FROM leave_requests
           WHERE organization_id = ? AND session_id = ?
           ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
          [access.id, sessionId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(leaveRequestToJson), total: Number(counts[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createLeaveRequest(
    actor, slug, sessionId, attendanceId, input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'leave_request.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'leave_request.create', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          const session = await lockManagedSession(tx, access, actor, sessionId);
          const attendance = await tx`
            SELECT * FROM attendance_records
            WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND id = ${attendanceId}
            FOR UPDATE`;
          if (!attendance.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `leave_request.create:${attendanceId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (!['scheduled', 'in_progress'].includes(String(session.status))) {
            throw new TeachingApiException('CONFLICT', 409, 'Leave can only be requested for an open session');
          }
          const rows = await tx`
            INSERT INTO leave_requests (
              organization_id, session_id, attendance_id, student_id, reason,
              requested_by_user_id, requested_by_user_id_snapshot,
              requested_by_display_name_snapshot, requested_by_role_snapshot
            ) VALUES (
              ${access.id}, ${sessionId}, ${attendanceId}, ${String(attendance[0].student_id)}, ${input.reason},
              ${actor.userId}, ${actor.userId}, ${actor.displayName}, ${access.role}
            ) RETURNING *`;
          const leaveRequest = leaveRequestToJson(rows[0] as Record<string, unknown>);
          await tx`INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'leave_requested', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId}, ${sql.json({ leaveRequestId: String(rows[0].id), attendanceId })}
          )`;
          await insertTrainingAudit(
            tx, access, actor, 'leave_request.create', 'leave_request', String(rows[0].id), requestId,
            { sessionId, attendanceId },
          );
          const result: MutationResult = {
            status: 201, body: { leaveRequest, attendance: attendanceToJson(attendance[0] as Record<string, unknown>) },
          };
          await completeIdempotency(tx, idem.id, result, 'leave_request', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Leave request conflicts with the current attendance state');
      }
    });
  },

  async decideLeaveRequest(
    actor, slug, sessionId, attendanceId, leaveRequestId,
    input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'leave_request.decide', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'leave_request.decide', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const session = await lockManagedSession(tx, access, actor, sessionId);
        const attendance = await tx`
          SELECT * FROM attendance_records
          WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND id = ${attendanceId}
          FOR UPDATE`;
        if (!attendance.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
        const requests = await tx`
          SELECT * FROM leave_requests
          WHERE organization_id = ${access.id} AND session_id = ${sessionId}
            AND attendance_id = ${attendanceId} AND id = ${leaveRequestId}
          FOR UPDATE`;
        if (!requests.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Leave request not found');
        const idem = await beginIdempotency(
          tx, actor.userId, access.id, `leave_request.decide:${leaveRequestId}`,
          idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        if (!['scheduled', 'in_progress'].includes(String(session.status))) {
          throw new TeachingApiException('CONFLICT', 409, 'Leave requests cannot be decided after session closure');
        }
        if (requests[0].status !== 'pending') {
          throw new TeachingApiException('CONFLICT', 409, 'Leave request has already been decided');
        }
        if (input.decision === 'approved') {
          if (attendance[0].status !== 'expected') {
            throw new TeachingApiException('CONFLICT', 409, 'Approved leave requires expected attendance');
          }
          await tx`
            UPDATE attendance_records SET status = 'excused', recorded_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND id = ${attendanceId}`;
        }
        const rows = await tx`
          UPDATE leave_requests SET
            status = ${input.decision}, decision_reason = ${input.reason},
            decided_by_user_id = ${actor.userId}, decided_by_user_id_snapshot = ${actor.userId},
            decided_by_display_name_snapshot = ${actor.displayName},
            decided_by_role_snapshot = ${access.role}, decided_at = NOW()
          WHERE organization_id = ${access.id} AND id = ${leaveRequestId}
          RETURNING *`;
        const savedAttendance = await tx`
          SELECT * FROM attendance_records WHERE organization_id = ${access.id} AND id = ${attendanceId}`;
        await tx`INSERT INTO session_events (
          organization_id, session_id, event_type, actor_user_id, actor_role,
          actor_display_name, request_id, metadata
        ) VALUES (
          ${access.id}, ${sessionId}, 'leave_decided', ${actor.userId}, ${access.role},
          ${actor.displayName}, ${requestId},
          ${sql.json({ leaveRequestId, attendanceId, decision: input.decision })}
        )`;
        await insertTrainingAudit(
          tx, access, actor, 'leave_request.decide', 'leave_request', leaveRequestId, requestId,
          { sessionId, attendanceId, decision: input.decision },
        );
        const result: MutationResult = {
          status: 200,
          body: {
            leaveRequest: leaveRequestToJson(rows[0] as Record<string, unknown>),
            attendance: attendanceToJson(savedAttendance[0] as Record<string, unknown>),
          },
        };
        await completeIdempotency(tx, idem.id, result, 'leave_request', leaveRequestId);
        return result;
      }) as MutationResult;
    });
  },

  async cancelLeaveRequest(
    actor, slug, sessionId, attendanceId, leaveRequestId,
    input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'leave_request.cancel', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'leave_request.cancel', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const session = await lockManagedSession(tx, access, actor, sessionId);
        const attendance = await tx`
          SELECT * FROM attendance_records
          WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND id = ${attendanceId}
          FOR UPDATE`;
        if (!attendance.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
        const requests = await tx`
          SELECT * FROM leave_requests
          WHERE organization_id = ${access.id} AND session_id = ${sessionId}
            AND attendance_id = ${attendanceId} AND id = ${leaveRequestId}
          FOR UPDATE`;
        if (!requests.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Leave request not found');
        const idem = await beginIdempotency(
          tx, actor.userId, access.id, `leave_request.cancel:${leaveRequestId}`,
          idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        if (!['scheduled', 'in_progress'].includes(String(session.status))) {
          throw new TeachingApiException('CONFLICT', 409, 'Leave requests cannot be cancelled after session closure');
        }
        if (requests[0].status !== 'pending') {
          throw new TeachingApiException('CONFLICT', 409, 'Only a pending leave request can be cancelled');
        }
        const rows = await tx`
          UPDATE leave_requests SET
            status = 'cancelled', decision_reason = ${input.reason},
            decided_by_user_id = ${actor.userId}, decided_by_user_id_snapshot = ${actor.userId},
            decided_by_display_name_snapshot = ${actor.displayName},
            decided_by_role_snapshot = ${access.role}, decided_at = NOW()
          WHERE organization_id = ${access.id} AND id = ${leaveRequestId}
          RETURNING *`;
        await tx`INSERT INTO session_events (
          organization_id, session_id, event_type, actor_user_id, actor_role,
          actor_display_name, request_id, metadata
        ) VALUES (
          ${access.id}, ${sessionId}, 'leave_cancelled', ${actor.userId}, ${access.role},
          ${actor.displayName}, ${requestId}, ${sql.json({ leaveRequestId, attendanceId })}
        )`;
        await insertTrainingAudit(
          tx, access, actor, 'leave_request.cancel', 'leave_request', leaveRequestId, requestId,
          { sessionId, attendanceId },
        );
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
};
