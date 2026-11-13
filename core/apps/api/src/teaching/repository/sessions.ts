import { query, sql } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requireSessionScope, accessForWrite, requireWritable, requirePermission } from '../access/organization.js';
import { type JsonValue, type JsonObject, type MutationResult } from '../types.js';
import { ConcealedTeachingPermissionDeniedException, TeachingApiException } from '../errors.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency } from '../transactions.js';
import { lockManagedCancellationGraph } from '../access/session.js';
import { insertTrainingAudit } from '../training/assignments.js';
import { attendanceToJson, makeupAttemptToJson } from '../serialization/sessions.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const sessionsRepository: Pick<TeachingSaasRepository,
  'listSessions' | 'getSession' | 'createSession' | 'saveAttendanceBatch' | 'completeSession' | 'cancelSession'> = {
  async listSessions(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const countQuery = scope === 'organization'
        ? query<Record<string, unknown>>(
            'SELECT COUNT(*)::int AS count FROM teaching_sessions WHERE organization_id = ?',
            [access.id],
          )
        : query<Record<string, unknown>>(
            `SELECT COUNT(*)::int AS count
             FROM teaching_sessions s
             WHERE s.organization_id = ?
               AND EXISTS (
                 SELECT 1 FROM session_teachers assigned
                 WHERE assigned.organization_id = s.organization_id
                   AND assigned.session_id = s.id
                   AND assigned.teacher_user_id = ?
               )`,
            [access.id, actor.userId],
          );
      const sessionsQuery = scope === 'organization'
        ? query<Record<string, unknown>>(
            `SELECT s.*,
             COALESCE((
               SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                 'userId', st.teacher_user_id_snapshot,
                 'displayName', st.teacher_display_name_snapshot,
                 'role', st.role
               ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                          st.teacher_display_name_snapshot, st.id)
               FROM session_teachers st
               WHERE st.organization_id = s.organization_id AND st.session_id = s.id
             ), '[]'::jsonb) AS teachers,
             (SELECT COUNT(*)::int FROM attendance_records a
              WHERE a.organization_id = s.organization_id AND a.session_id = s.id) AS attendance_count
           FROM teaching_sessions s
           WHERE s.organization_id = ?
           ORDER BY s.starts_at DESC, s.id
           LIMIT ? OFFSET ?`,
            [access.id, pagination.pageSize, pagination.offset],
          )
        : query<Record<string, unknown>>(
            `SELECT s.*,
             COALESCE((
               SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                 'userId', st.teacher_user_id_snapshot,
                 'displayName', st.teacher_display_name_snapshot,
                 'role', st.role
               ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                          st.teacher_display_name_snapshot, st.id)
               FROM session_teachers st
               WHERE st.organization_id = s.organization_id AND st.session_id = s.id
             ), '[]'::jsonb) AS teachers,
             (SELECT COUNT(*)::int FROM attendance_records a
              WHERE a.organization_id = s.organization_id AND a.session_id = s.id) AS attendance_count
           FROM teaching_sessions s
           WHERE s.organization_id = ?
             AND EXISTS (
               SELECT 1 FROM session_teachers assigned
               WHERE assigned.organization_id = s.organization_id
                 AND assigned.session_id = s.id
                 AND assigned.teacher_user_id = ?
             )
           ORDER BY s.starts_at DESC, s.id
           LIMIT ? OFFSET ?`,
            [access.id, actor.userId, pagination.pageSize, pagination.offset],
          );
      const [countRows, rows] = await Promise.all([countQuery, sessionsQuery]);
      return {
        items: rows.map((row) => ({
          id: String(row.id), title: String(row.title),
          startsAt: new Date(String(row.starts_at)).toISOString(),
          endsAt: new Date(String(row.ends_at)).toISOString(),
          timezone: String(row.timezone), status: String(row.status), version: Number(row.version),
          startedAt: row.started_at == null ? null : new Date(String(row.started_at)).toISOString(),
          completedAt: row.completed_at == null ? null : new Date(String(row.completed_at)).toISOString(),
          cancelledAt: row.cancelled_at == null ? null : new Date(String(row.cancelled_at)).toISOString(),
          teachers: row.teachers as JsonValue, attendanceCount: Number(row.attendance_count),
          createdAt: new Date(String(row.created_at)).toISOString(),
          updatedAt: new Date(String(row.updated_at)).toISOString(),
        })),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getSession(actor, slug, sessionId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const rows = scope === 'organization'
        ? await query<Record<string, unknown>>(
            `SELECT s.*,
           COALESCE((
             SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
               'userId', st.teacher_user_id_snapshot,
               'displayName', st.teacher_display_name_snapshot,
               'role', st.role
             ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                        st.teacher_display_name_snapshot, st.id)
             FROM session_teachers st
             WHERE st.organization_id = s.organization_id AND st.session_id = s.id
           ), '[]'::jsonb) AS teachers
         FROM teaching_sessions s
         WHERE s.organization_id = ? AND s.id = ?`,
            [access.id, sessionId],
          )
        : await query<Record<string, unknown>>(
            `SELECT s.*,
           COALESCE((
             SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
               'userId', st.teacher_user_id_snapshot,
               'displayName', st.teacher_display_name_snapshot,
               'role', st.role
             ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                        st.teacher_display_name_snapshot, st.id)
             FROM session_teachers st
             WHERE st.organization_id = s.organization_id AND st.session_id = s.id
           ), '[]'::jsonb) AS teachers
         FROM teaching_sessions s
         WHERE s.organization_id = ? AND s.id = ?
           AND EXISTS (
             SELECT 1 FROM session_teachers assigned
             WHERE assigned.organization_id = s.organization_id
               AND assigned.session_id = s.id
               AND assigned.teacher_user_id = ?
           )`,
            [access.id, sessionId, actor.userId],
          );
      if (!rows.length) {
        if (scope === 'assigned') {
          const existing = await query<Record<string, unknown>>(
            'SELECT 1 FROM teaching_sessions WHERE organization_id = ? AND id = ?',
            [access.id, sessionId],
          );
          if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
        }
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
      }
      const row = rows[0];
      const attendance = await query<Record<string, unknown>>(
        `SELECT a.id, a.student_id, p.display_name, a.student_package_id,
                a.status, a.credit_cost, a.notes, a.updated_at
         FROM attendance_records a
         JOIN student_profiles p
           ON p.organization_id = a.organization_id AND p.id = a.student_id
         WHERE a.organization_id = ? AND a.session_id = ?
         ORDER BY p.display_name, a.student_id`,
        [access.id, sessionId],
      );
      return {
        id: String(row.id), title: String(row.title),
        startsAt: new Date(String(row.starts_at)).toISOString(),
        endsAt: new Date(String(row.ends_at)).toISOString(),
        timezone: String(row.timezone), status: String(row.status), version: Number(row.version),
        startedAt: row.started_at == null ? null : new Date(String(row.started_at)).toISOString(),
        completedAt: row.completed_at == null ? null : new Date(String(row.completed_at)).toISOString(),
        cancelledAt: row.cancelled_at == null ? null : new Date(String(row.cancelled_at)).toISOString(),
        teachers: row.teachers as JsonValue,
        attendance: attendance.map((item) => ({
          id: String(item.id), studentId: String(item.student_id), displayName: String(item.display_name),
          studentPackageId: item.student_package_id == null ? null : String(item.student_package_id),
          status: String(item.status), creditCost: Number(item.credit_cost), notes: String(item.notes),
          updatedAt: new Date(String(item.updated_at)).toISOString(),
        })),
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
      };
    });
  },

  async createSession(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'session.create', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        requirePermission(access, 'session:create');
        const idem = await beginIdempotency(tx, actor.userId, access.id, 'session.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        const rows = await tx`
          INSERT INTO teaching_sessions (
            organization_id, title, starts_at, ends_at, timezone, created_by_user_id
          ) VALUES (
            ${access.id}, ${input.title}, ${input.startsAt}, ${input.endsAt},
            ${input.timezone ?? access.timezone}, ${actor.userId}
          )
          RETURNING id, title, starts_at, ends_at, timezone, status, version, created_at, updated_at`;
        const session = rows[0] as Record<string, unknown>;
        const sessionId = String(session.id);
        const teachers: JsonObject[] = [];
        for (let index = 0; index < input.teacherUserIds.length; index += 1) {
          const teacherUserId = input.teacherUserIds[index];
          const members = await tx`
            SELECT m.user_id, m.role, u.display_name
            FROM organization_members m
            JOIN app_users u ON u.id = m.user_id
            WHERE m.organization_id = ${access.id} AND m.user_id = ${teacherUserId}
              AND m.status = 'active' AND m.role IN ('owner', 'admin', 'teacher', 'assistant')`;
          if (!members.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Assigned teacher is not an active teaching member');
          }
          const member = members[0] as Record<string, unknown>;
          const role = index === 0 ? 'lead' : 'assistant';
          await tx`
            INSERT INTO session_teachers (
              organization_id, session_id, teacher_user_id, teacher_user_id_snapshot,
              teacher_display_name_snapshot, role
            ) VALUES (
              ${access.id}, ${sessionId}, ${teacherUserId}, ${teacherUserId},
              ${String(member.display_name)}, ${role}
            )`;
          teachers.push({ userId: teacherUserId, displayName: String(member.display_name), role });
        }
        const attendance: JsonObject[] = [];
        for (const attendee of input.attendees) {
          const packages = await tx`
            SELECT p.id, s.display_name
            FROM student_packages p
            JOIN student_profiles s
              ON s.organization_id = p.organization_id AND s.id = p.student_id
            WHERE p.organization_id = ${access.id} AND p.id = ${attendee.studentPackageId}
              AND p.student_id = ${attendee.studentId} AND p.lifecycle_status = 'active'
              AND p.valid_from <= ${input.startsAt}::timestamptz
              AND (p.valid_until IS NULL OR p.valid_until > ${input.startsAt}::timestamptz)`;
          if (!packages.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Active student package not found for an attendee');
          }
          const rows = await tx`
            INSERT INTO attendance_records (
              organization_id, session_id, student_id, student_package_id,
              status, credit_cost, notes, recorded_by_user_id
            ) VALUES (
              ${access.id}, ${sessionId}, ${attendee.studentId}, ${attendee.studentPackageId},
              'expected', ${attendee.creditCost}, '', ${actor.userId}
            )
            RETURNING id, student_id, student_package_id, status, credit_cost, notes, updated_at`;
          const row = rows[0] as Record<string, unknown>;
          attendance.push({
            id: String(row.id), studentId: String(row.student_id),
            displayName: String(packages[0].display_name), studentPackageId: String(row.student_package_id),
            status: String(row.status), creditCost: Number(row.credit_cost), notes: String(row.notes),
            updatedAt: new Date(String(row.updated_at)).toISOString(),
          });
        }
        await tx`
          INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'scheduled', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId},
            ${sql.json({ teacherUserIds: input.teacherUserIds, attendeeCount: attendance.length })}
          )`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'session.create', 'teaching_session', ${sessionId}, ${requestId},
            ${sql.json({ startsAt: input.startsAt, teacherCount: teachers.length, attendeeCount: attendance.length })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: { session: {
            id: sessionId, title: String(session.title),
            startsAt: new Date(String(session.starts_at)).toISOString(),
            endsAt: new Date(String(session.ends_at)).toISOString(),
            timezone: String(session.timezone), status: String(session.status), version: Number(session.version),
            teachers, attendance, attendanceCount: attendance.length,
            startedAt: null, completedAt: null, cancelledAt: null,
            createdAt: new Date(String(session.created_at)).toISOString(),
            updatedAt: new Date(String(session.updated_at)).toISOString(),
          } },
        };
        await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
        return result;
      }) as MutationResult;
    });
  },

  async saveAttendanceBatch(actor, slug, sessionId, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.attendance.batch', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'session.attendance.batch', 240, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const scope = requireSessionScope(access, 'session:manage');
        const sessions = scope === 'organization'
          ? await tx`
              SELECT s.id, s.status FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
              FOR UPDATE OF s`
          : await tx`
              SELECT s.id, s.status FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
                AND EXISTS (
                  SELECT 1 FROM session_teachers assigned
                  WHERE assigned.organization_id = s.organization_id
                    AND assigned.session_id = s.id
                    AND assigned.teacher_user_id = ${actor.userId}
                )
              FOR UPDATE OF s`;
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
          tx, actor.userId, access.id, `session.attendance.batch:${sessionId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        if (!['scheduled', 'in_progress'].includes(String(sessions[0].status))) {
          throw new TeachingApiException('CONFLICT', 409, 'Attendance cannot change after the session is closed');
        }
        const attendanceIds = [...input.records.map((item) => item.attendanceId)].sort();
        const lockedAttendance = await tx`
          SELECT id, student_package_id FROM attendance_records
          WHERE organization_id = ${access.id} AND session_id = ${sessionId}
            AND id IN ${sql(attendanceIds)}
          ORDER BY student_package_id NULLS LAST, id
          FOR UPDATE`;
        if (lockedAttendance.length !== attendanceIds.length) {
          throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
        }
        const protectedLeave = await tx`
          SELECT attendance_id FROM leave_requests
          WHERE organization_id = ${access.id}
            AND attendance_id IN ${sql(attendanceIds)}
            AND status IN ('pending', 'approved')
          ORDER BY attendance_id
          FOR UPDATE`;
        if (protectedLeave.length) {
          throw new TeachingApiException(
            'CONFLICT', 409,
            'Pending or approved leave attendance must be changed through the leave workflow',
          );
        }
        const saved: JsonObject[] = [];
        for (const item of input.records) {
          const rows = await tx`
            UPDATE attendance_records
            SET status = ${item.status}, recorded_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND id = ${item.attendanceId}
            RETURNING id, student_id, student_package_id, status, credit_cost, notes, updated_at`;
          if (!rows.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
          const row = rows[0] as Record<string, unknown>;
          saved.push({
            id: String(row.id), studentId: String(row.student_id),
            studentPackageId: row.student_package_id == null ? null : String(row.student_package_id),
            status: String(row.status), creditCost: Number(row.credit_cost),
            notes: row.notes == null ? null : String(row.notes),
            updatedAt: new Date(String(row.updated_at)).toISOString(),
          });
        }
        await tx`
          INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'attendance_updated', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId}, ${sql.json({ count: saved.length })}
          )`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'session.attendance.batch', 'teaching_session', ${sessionId}, ${requestId},
            ${sql.json({ count: saved.length })}
          )`;
        const result: MutationResult = { status: 200, body: { attendance: saved } };
        await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
        return result;
      }) as MutationResult;
    });
  },

  async completeSession(actor, slug, sessionId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.complete', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'session.complete', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const scope = requireSessionScope(access, 'session:manage');
        const sessions = scope === 'organization'
          ? await tx`
              SELECT s.id, s.status, s.starts_at, s.completed_at
              FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
              FOR UPDATE OF s`
          : await tx`
              SELECT s.id, s.status, s.starts_at, s.completed_at
              FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
                AND EXISTS (
                  SELECT 1 FROM session_teachers assigned
                  WHERE assigned.organization_id = s.organization_id
                    AND assigned.session_id = s.id
                    AND assigned.teacher_user_id = ${actor.userId}
                )
              FOR UPDATE OF s`;
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
          tx, actor.userId, access.id, `session.complete:${sessionId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        const session = sessions[0] as Record<string, unknown>;
        if (session.status === 'cancelled') {
          throw new TeachingApiException('CONFLICT', 409, 'A cancelled session cannot be completed');
        }
        if (session.status === 'completed') {
          const totals = await tx`
            SELECT COUNT(*)::int AS attendance_count, COALESCE(-SUM(delta), 0)::int AS total_credits
            FROM lesson_credit_ledger
            WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND entry_type = 'consume'`;
          const result: MutationResult = {
            status: 200,
            body: { session: { id: sessionId, status: 'completed', completedAt: new Date(String(session.completed_at)).toISOString() },
              consumption: { attendanceCount: Number(totals[0].attendance_count), totalCredits: Number(totals[0].total_credits) } },
          };
          await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
          return result;
        }
        const attendanceRows = await tx`
          SELECT id, student_id, student_package_id, status, credit_cost
          FROM attendance_records
          WHERE organization_id = ${access.id} AND session_id = ${sessionId}
          ORDER BY student_package_id NULLS LAST, id
          FOR UPDATE`;
        if (!attendanceRows.length) {
          throw new TeachingApiException('CONFLICT', 409, 'Session needs attendance before completion');
        }
        const pendingLeaves = await tx`
          SELECT id FROM leave_requests
          WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND status = 'pending'
          ORDER BY attendance_id, id
          FOR UPDATE`;
        if (pendingLeaves.length) {
          throw new TeachingApiException('CONFLICT', 409, 'Resolve pending leave requests before completion');
        }
        if (attendanceRows.some((row) => row.status === 'expected')) {
          throw new TeachingApiException('CONFLICT', 409, 'Resolve all expected attendance before completion');
        }
        await tx`
          SELECT id FROM makeup_attempts
          WHERE organization_id = ${access.id} AND target_session_id = ${sessionId}
            AND status = 'scheduled'
          ORDER BY id FOR UPDATE`;
        const billable = attendanceRows.filter((row) => row.status === 'present' || row.status === 'late');
        const packageIds = [...new Set(billable.map((row) => String(row.student_package_id)))].sort();
        const lockedPackages = packageIds.length
          ? await tx`
              SELECT id, student_id, lifecycle_status, valid_from, valid_until
              FROM student_packages
              WHERE organization_id = ${access.id} AND id IN ${sql(packageIds)}
              ORDER BY id
              FOR UPDATE`
          : [];
        const completed = await tx`
          UPDATE teaching_sessions
          SET status = 'completed', completed_at = NOW(), version = version + 1
          WHERE organization_id = ${access.id} AND id = ${sessionId}
          RETURNING completed_at`;
        let totalCredits = 0;
        for (const attendance of billable) {
          const packageId = String(attendance.student_package_id);
          const studentPackage = lockedPackages.find((row) => (
            String(row.id) === packageId && String(row.student_id) === String(attendance.student_id)
          )) as Record<string, unknown> | undefined;
          if (!studentPackage) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student package not found');
          const sessionStartsAt = new Date(String(session.starts_at)).getTime();
          if (
            studentPackage.lifecycle_status !== 'active' ||
            new Date(String(studentPackage.valid_from)).getTime() > sessionStartsAt ||
            (studentPackage.valid_until != null && new Date(String(studentPackage.valid_until)).getTime() <= sessionStartsAt)
          ) {
            throw new TeachingApiException('CONFLICT', 409, 'Student package is not active for the session time');
          }
          const balances = await tx`
            SELECT COALESCE(SUM(delta), 0)::int AS balance
            FROM lesson_credit_ledger
            WHERE organization_id = ${access.id} AND student_package_id = ${packageId}`;
          const creditCost = Number(attendance.credit_cost);
          if (Number(balances[0].balance) < creditCost) {
            throw new TeachingApiException('CONFLICT', 409, 'Student package has insufficient credits');
          }
          await tx`
            INSERT INTO lesson_credit_ledger (
              organization_id, student_package_id, student_id, entry_type, delta,
              attendance_id, session_id, idempotency_key, reason, actor_user_id,
              actor_role, actor_display_name, metadata
            ) VALUES (
              ${access.id}, ${packageId}, ${String(attendance.student_id)}, 'consume', ${-creditCost},
              ${String(attendance.id)}, ${sessionId}, ${`attendance:${String(attendance.id)}`},
              'Session attendance', ${actor.userId}, ${access.role}, ${actor.displayName},
              ${sql.json({ attendanceStatus: String(attendance.status) })}
            )`;
          totalCredits += creditCost;
        }
        const resolvedMakeups = await tx`
          UPDATE makeup_attempts attempt
          SET status = CASE attendance.status
                WHEN 'present' THEN 'fulfilled'
                WHEN 'late' THEN 'fulfilled'
                ELSE 'failed'
              END,
              resolved_by_user_id = ${actor.userId},
              resolved_by_user_id_snapshot = ${actor.userId},
              resolved_by_display_name_snapshot = ${actor.displayName},
              resolved_by_role_snapshot = ${access.role},
              resolution_reason = CASE attendance.status
                WHEN 'present' THEN 'Target attendance completed'
                WHEN 'late' THEN 'Target attendance completed'
                ELSE 'Target attendance was not billable'
              END,
              resolved_at = NOW()
          FROM attendance_records attendance
          WHERE attempt.organization_id = ${access.id}
            AND attempt.target_session_id = ${sessionId}
            AND attempt.status = 'scheduled'
            AND attendance.organization_id = attempt.organization_id
            AND attendance.id = attempt.target_attendance_id
            AND attendance.status IN ('present', 'late', 'absent', 'excused')
          RETURNING attempt.id, attempt.status, attempt.source_session_id`;
        for (const makeup of resolvedMakeups) {
          await tx`INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId},
            ${makeup.status === 'fulfilled' ? 'makeup_fulfilled' : 'makeup_failed'},
            ${actor.userId}, ${access.role}, ${actor.displayName}, ${requestId},
            ${sql.json({ makeupAttemptId: String(makeup.id), sourceSessionId: String(makeup.source_session_id) })}
          )`;
        }
        await tx`
          INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'completed', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId},
            ${sql.json({ attendanceCount: billable.length, totalCredits })}
          )`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'session.complete', 'teaching_session', ${sessionId}, ${requestId},
            ${sql.json({ attendanceCount: billable.length, totalCredits })}
          )`;
        const result: MutationResult = {
          status: 200,
          body: { session: { id: sessionId, status: 'completed', completedAt: new Date(String(completed[0].completed_at)).toISOString() },
            consumption: { attendanceCount: billable.length, totalCredits } },
        };
        await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
        return result;
      }) as MutationResult;
    });
  },

  async cancelSession(actor, slug, sessionId, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.cancel', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'session.cancel', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const cancellation = await lockManagedCancellationGraph(tx, access, actor, sessionId);
        const { session } = cancellation;
        const attendanceRows = await tx`
          SELECT attendance.*, student.display_name
          FROM attendance_records attendance
          JOIN student_profiles student
            ON student.organization_id = attendance.organization_id
           AND student.id = attendance.student_id
          WHERE attendance.organization_id = ${access.id} AND attendance.session_id = ${sessionId}
          ORDER BY attendance.student_package_id NULLS LAST, attendance.id
          FOR UPDATE OF attendance`;
        const leaveRows = await tx`
          SELECT * FROM leave_requests
          WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND status = 'pending'
          ORDER BY attendance_id, id FOR UPDATE`;
        const attemptRows = await tx`
          SELECT * FROM makeup_attempts
          WHERE organization_id = ${access.id} AND status = 'scheduled'
            AND (source_session_id = ${sessionId} OR target_session_id = ${sessionId})
          ORDER BY id FOR UPDATE`;
        const idem = await beginIdempotency(
          tx, actor.userId, access.id, `session.cancel:${sessionId}`,
          idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        if (session.status === 'completed') {
          throw new TeachingApiException('CONFLICT', 409, 'A completed session cannot be cancelled');
        }
        if (session.status !== 'cancelled') {
          await tx`
            UPDATE leave_requests SET
              status = 'cancelled', decision_reason = ${input.reason},
              decided_by_user_id = ${actor.userId}, decided_by_user_id_snapshot = ${actor.userId},
              decided_by_display_name_snapshot = ${actor.displayName},
              decided_by_role_snapshot = ${access.role}, decided_at = NOW()
            WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND status = 'pending'`;
          await tx`
            UPDATE makeup_attempts SET
              status = 'cancelled', resolved_by_user_id = ${actor.userId},
              resolved_by_user_id_snapshot = ${actor.userId},
              resolved_by_display_name_snapshot = ${actor.displayName},
              resolved_by_role_snapshot = ${access.role},
              resolution_reason = ${input.reason}, resolved_at = NOW()
            WHERE organization_id = ${access.id} AND status = 'scheduled'
              AND (source_session_id = ${sessionId} OR target_session_id = ${sessionId})`;
          await tx`
            UPDATE teaching_sessions
            SET status = 'cancelled', cancelled_at = NOW(), version = version + 1
            WHERE organization_id = ${access.id} AND id = ${sessionId}`;
          if (leaveRows.length) {
            await tx`INSERT INTO session_events (
              organization_id, session_id, event_type, actor_user_id, actor_role,
              actor_display_name, request_id, metadata
            ) VALUES (
              ${access.id}, ${sessionId}, 'leave_cancelled', ${actor.userId}, ${access.role},
              ${actor.displayName}, ${requestId}, ${sql.json({ count: leaveRows.length, reason: input.reason })}
            )`;
          }
          if (attemptRows.length) {
            await tx`INSERT INTO session_events (
              organization_id, session_id, event_type, actor_user_id, actor_role,
              actor_display_name, request_id, metadata
            ) VALUES (
              ${access.id}, ${sessionId}, 'makeup_cancelled', ${actor.userId}, ${access.role},
              ${actor.displayName}, ${requestId}, ${sql.json({ count: attemptRows.length, reason: input.reason })}
            )`;
          }
          await tx`INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'cancelled', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId}, ${sql.json({ reason: input.reason })}
          )`;
          await insertTrainingAudit(
            tx, access, actor, 'session.cancel', 'teaching_session', sessionId, requestId,
            { reason: input.reason, leaveRequestCount: leaveRows.length, makeupAttemptCount: attemptRows.length },
          );
        }
        const details = await tx`
          SELECT session.*,
            COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
              'userId', teacher.teacher_user_id_snapshot,
              'displayName', teacher.teacher_display_name_snapshot,
              'role', teacher.role
            ) ORDER BY CASE teacher.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
              teacher.teacher_display_name_snapshot, teacher.id)
             FROM session_teachers teacher
             WHERE teacher.organization_id = session.organization_id
               AND teacher.session_id = session.id), '[]'::jsonb) AS teachers
          FROM teaching_sessions session
          WHERE session.organization_id = ${access.id} AND session.id = ${sessionId}`;
        const detail = details[0] as Record<string, unknown>;
        const resolvedAttempts = attemptRows.length
          ? await tx`
              SELECT * FROM makeup_attempts
              WHERE organization_id = ${access.id}
                AND id IN ${sql(attemptRows.map((row) => String(row.id)))}
              ORDER BY created_at DESC, id DESC`
          : [];
        const sessionJson: JsonObject = {
          id: sessionId, title: String(detail.title),
          startsAt: new Date(String(detail.starts_at)).toISOString(),
          endsAt: new Date(String(detail.ends_at)).toISOString(), timezone: String(detail.timezone),
          status: String(detail.status), version: Number(detail.version),
          startedAt: detail.started_at == null ? null : new Date(String(detail.started_at)).toISOString(),
          completedAt: detail.completed_at == null ? null : new Date(String(detail.completed_at)).toISOString(),
          cancelledAt: detail.cancelled_at == null ? null : new Date(String(detail.cancelled_at)).toISOString(),
          teachers: detail.teachers as JsonValue,
          attendance: attendanceRows.map((row) => ({
            ...attendanceToJson(row as Record<string, unknown>), displayName: String(row.display_name),
          })),
          attendanceCount: attendanceRows.length,
          createdAt: new Date(String(detail.created_at)).toISOString(),
          updatedAt: new Date(String(detail.updated_at)).toISOString(),
        };
        const result: MutationResult = {
          status: 200,
          body: { session: sessionJson, makeupAttempts: resolvedAttempts.map(makeupAttemptToJson) },
        };
        await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
        return result;
      }) as MutationResult;
    });
  },
};
