import { query, sql } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requirePermission, hasOrganizationCrmScope, accessForWrite, requireWritable } from '../access/organization.js';
import { groupToJson, membershipToJson, assignmentToJson } from '../serialization/organizations.js';
import { ConcealedTeachingPermissionDeniedException, TeachingApiException, crmConflict } from '../errors.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency } from '../transactions.js';
import { type MutationResult } from '../types.js';
import { iso } from '../serialization/common.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const groupsRepository: Pick<TeachingSaasRepository,
  'listGroups' | 'getGroup' | 'createGroup' | 'archiveGroup' | 'listGroupStudents' | 'createStudentGroupMembership' | 'revokeStudentGroupMembership' | 'listTeacherAssignments' | 'createTeacherAssignment' | 'revokeTeacherAssignment'> = {
  async listGroups(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'group:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const scopeSql = organizationScope ? '' : `
        AND teaching_group.status = 'active'
        AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
        AND EXISTS (
          SELECT 1 FROM teacher_assignments assignment
           WHERE assignment.organization_id = teaching_group.organization_id
             AND assignment.group_id = teaching_group.id
             AND assignment.teacher_user_id = ?
             AND EXISTS (
               SELECT 1 FROM organization_members scoped_member
               WHERE scoped_member.organization_id = assignment.organization_id
                 AND scoped_member.user_id = assignment.teacher_user_id
                 AND scoped_member.status = 'active'
                 AND scoped_member.role IN ('teacher', 'assistant')
             )
             AND assignment.effective_from <= NOW()
            AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
        )`;
      const baseParams: unknown[] = organizationScope ? [access.id] : [access.id, actor.userId];
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count FROM teaching_groups teaching_group
           LEFT JOIN teaching_campuses campus
             ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
           WHERE teaching_group.organization_id = ? ${scopeSql}`,
          baseParams,
        ),
        query<Record<string, unknown>>(
          `SELECT teaching_group.id, teaching_group.campus_id, teaching_group.code, teaching_group.name,
                  teaching_group.status, teaching_group.archived_at,
                  teaching_group.created_at, teaching_group.updated_at
           FROM teaching_groups teaching_group
           LEFT JOIN teaching_campuses campus
             ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
           WHERE teaching_group.organization_id = ? ${scopeSql}
           ORDER BY CASE teaching_group.status WHEN 'active' THEN 0 ELSE 1 END,
                    teaching_group.name, teaching_group.id
           LIMIT ? OFFSET ?`,
          [...baseParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(groupToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getGroup(actor, slug, groupId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'group:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const rows = await query<Record<string, unknown>>(
        `SELECT teaching_group.id, teaching_group.campus_id, teaching_group.code, teaching_group.name,
                teaching_group.status, teaching_group.archived_at,
                teaching_group.created_at, teaching_group.updated_at
         FROM teaching_groups teaching_group
         LEFT JOIN teaching_campuses campus
           ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
         WHERE teaching_group.organization_id = ? AND teaching_group.id = ?
           ${organizationScope ? '' : `AND teaching_group.status = 'active'
             AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
             AND EXISTS (
               SELECT 1 FROM teacher_assignments assignment
                WHERE assignment.organization_id = teaching_group.organization_id
                  AND assignment.group_id = teaching_group.id
                  AND assignment.teacher_user_id = ?
                  AND EXISTS (
                    SELECT 1 FROM organization_members scoped_member
                    WHERE scoped_member.organization_id = assignment.organization_id
                      AND scoped_member.user_id = assignment.teacher_user_id
                      AND scoped_member.status = 'active'
                      AND scoped_member.role IN ('teacher', 'assistant')
                  )
                  AND assignment.effective_from <= NOW()
                 AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
             )`}`,
        organizationScope ? [access.id, groupId] : [access.id, groupId, actor.userId],
      );
      if (!rows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM teaching_groups WHERE organization_id = ? AND id = ?', [access.id, groupId],
        );
        if (exists.length && !organizationScope) throw new ConcealedTeachingPermissionDeniedException('Group not found');
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Group not found');
      }
      return groupToJson(rows[0]);
    });
  },

  async createGroup(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.create', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO teaching_groups (organization_id, campus_id, code, name, created_by_user_id)
            VALUES (${access.id}, ${input.campusId}, ${input.code}, ${input.name}, ${actor.userId})
            RETURNING id, campus_id, code, name, status, archived_at, created_at, updated_at`;
          const group = groupToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.create', 'group', ${String(rows[0].id)}, ${requestId}, ${sql.json({ campusId: input.campusId, code: input.code })}
            )`;
          const result: MutationResult = { status: 201, body: { group } };
          await completeIdempotency(tx, idem.id, result, 'group', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Group code already exists or its campus is unavailable');
      }
    });
  },

  async archiveGroup(actor, slug, groupId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.archive', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.archive', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.archive', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, status FROM teaching_groups
            WHERE organization_id = ${access.id} AND id = ${groupId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Group not found');
          if (existing[0].status !== 'active') throw new TeachingApiException('CONFLICT', 409, 'Group is already archived');
          const rows = await tx`
            UPDATE teaching_groups SET status = 'archived', archived_at = NOW()
            WHERE organization_id = ${access.id} AND id = ${groupId}
            RETURNING id, campus_id, code, name, status, archived_at, created_at, updated_at`;
          const group = groupToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.archive', 'group', ${groupId}, ${requestId}, ${sql.json({ reason: 'manual_archive' })}
            )`;
          const result: MutationResult = { status: 200, body: { group } };
          await completeIdempotency(tx, idem.id, result, 'group', groupId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Group cannot be archived');
      }
    });
  },

  async listGroupStudents(actor, slug, groupId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.student.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'group:read');
      requirePermission(access, 'student:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const groupRows = await query<Record<string, unknown>>(
        `SELECT teaching_group.id
         FROM teaching_groups teaching_group
         LEFT JOIN teaching_campuses campus
           ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
         WHERE teaching_group.organization_id = ? AND teaching_group.id = ?
           ${organizationScope ? '' : `AND teaching_group.status = 'active'
             AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
             AND EXISTS (
               SELECT 1 FROM teacher_assignments assignment
                WHERE assignment.organization_id = teaching_group.organization_id
                  AND assignment.group_id = teaching_group.id
                  AND assignment.teacher_user_id = ?
                  AND EXISTS (
                    SELECT 1 FROM organization_members scoped_member
                    WHERE scoped_member.organization_id = assignment.organization_id
                      AND scoped_member.user_id = assignment.teacher_user_id
                      AND scoped_member.status = 'active'
                      AND scoped_member.role IN ('teacher', 'assistant')
                  )
                  AND assignment.effective_from <= NOW()
                 AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
             )`}`,
        organizationScope ? [access.id, groupId] : [access.id, groupId, actor.userId],
      );
      if (!groupRows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM teaching_groups WHERE organization_id = ? AND id = ?', [access.id, groupId],
        );
        if (exists.length && !organizationScope) throw new ConcealedTeachingPermissionDeniedException('Group not found');
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Group not found');
      }
      const activeOnly = organizationScope ? '' : `
        AND membership.effective_from <= NOW()
        AND (membership.effective_to IS NULL OR membership.effective_to > NOW())
        AND student.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM teacher_assignments assignment
          JOIN organization_members scoped_member
            ON scoped_member.organization_id = assignment.organization_id
           AND scoped_member.user_id = assignment.teacher_user_id
          WHERE assignment.organization_id = membership.organization_id
            AND assignment.group_id = membership.group_id
            AND assignment.teacher_user_id = ?
            AND assignment.effective_from <= NOW()
            AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
            AND scoped_member.status = 'active'
            AND scoped_member.role IN ('teacher', 'assistant')
        )`;
      const relationParams: unknown[] = organizationScope
        ? [access.id, groupId]
        : [access.id, groupId, actor.userId];
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count
           FROM student_group_memberships membership
           JOIN student_profiles student
             ON student.organization_id = membership.organization_id AND student.id = membership.student_id
           WHERE membership.organization_id = ? AND membership.group_id = ? ${activeOnly}`,
          relationParams,
        ),
        query<Record<string, unknown>>(
          `SELECT membership.id, membership.group_id, membership.effective_from, membership.effective_to,
                  membership.created_at, student.id AS student_id,
                  student.display_name AS student_display_name,
                  student.external_ref AS student_external_ref, student.status AS student_status
           FROM student_group_memberships membership
           JOIN student_profiles student
             ON student.organization_id = membership.organization_id AND student.id = membership.student_id
           WHERE membership.organization_id = ? AND membership.group_id = ? ${activeOnly}
           ORDER BY membership.effective_from DESC, membership.id
           LIMIT ? OFFSET ?`,
          [...relationParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(membershipToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createStudentGroupMembership(actor, slug, groupId, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.student.assign', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.student.assign', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.student.assign', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            WITH inserted AS (
              INSERT INTO student_group_memberships (
                organization_id, group_id, student_id, effective_from, effective_to, created_by_user_id
              ) VALUES (
                ${access.id}, ${groupId}, ${input.studentId}, ${input.effectiveFrom}, ${input.effectiveTo}, ${actor.userId}
              )
              RETURNING id, organization_id, group_id, student_id, effective_from, effective_to, created_at
            )
            SELECT inserted.*, student.display_name AS student_display_name,
                   student.external_ref AS student_external_ref, student.status AS student_status
            FROM inserted
            JOIN student_profiles student
              ON student.organization_id = inserted.organization_id AND student.id = inserted.student_id`;
          const membership = membershipToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.student.assign', 'student_group_membership', ${String(rows[0].id)}, ${requestId},
              ${sql.json({ groupId, studentId: input.studentId, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo })}
            )`;
          const result: MutationResult = { status: 201, body: { membership } };
          await completeIdempotency(tx, idem.id, result, 'student_group_membership', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Student membership overlaps or targets an unavailable resource');
      }
    });
  },

  async revokeStudentGroupMembership(actor, slug, membershipId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.student.revoke', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.student.revoke', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.student.revoke', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, effective_from, effective_to
            FROM student_group_memberships
            WHERE organization_id = ${access.id} AND id = ${membershipId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Membership not found');
          if (existing[0].effective_to != null && new Date(String(existing[0].effective_to)).getTime() <= Date.now()) {
            throw new TeachingApiException('CONFLICT', 409, 'Membership has already ended');
          }
          const rows = await tx`
            WITH ended AS (
              UPDATE student_group_memberships
              SET effective_to = LEAST(
                COALESCE(effective_to, GREATEST(NOW(), effective_from)),
                GREATEST(NOW(), effective_from)
              )
              WHERE organization_id = ${access.id} AND id = ${membershipId}
              RETURNING *, clock_timestamp() AS cancelled_at
            )
            SELECT ended.*, student.display_name AS student_display_name,
                   student.external_ref AS student_external_ref, student.status AS student_status
            FROM ended
            JOIN student_profiles student
              ON student.organization_id = ended.organization_id AND student.id = ended.student_id`;
          const membership = membershipToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.student.revoke', 'student_group_membership', ${membershipId}, ${requestId},
              ${sql.json({ reason: 'manual_revocation', cancelledAt: iso(rows[0].cancelled_at), effectiveTo: membership.effectiveTo })}
            )`;
          const result: MutationResult = { status: 200, body: { membership } };
          await completeIdempotency(tx, idem.id, result, 'student_group_membership', membershipId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Membership could not be ended');
      }
    });
  },

  async listTeacherAssignments(actor, slug, target, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'teacher_assignment.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'assignment:manage');
      const targetSql = target.groupId !== null ? 'assignment.group_id = ?' : 'assignment.student_id = ?';
      const targetId = (target.groupId ?? target.studentId) as string;
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count FROM teacher_assignments assignment
           WHERE assignment.organization_id = ? AND ${targetSql}`,
          [access.id, targetId],
        ),
        query<Record<string, unknown>>(
          `SELECT assignment.id, assignment.teacher_user_id, assignment.teacher_user_id_snapshot,
                  assignment.teacher_display_name_snapshot, assignment.teacher_role_snapshot,
                  assignment.group_id, assignment.student_id, assignment.effective_from,
                  assignment.effective_to, assignment.created_at,
                  member.status AS teacher_member_status
           FROM teacher_assignments assignment
           LEFT JOIN organization_members member
             ON member.organization_id = assignment.organization_id
            AND member.user_id = assignment.teacher_user_id
           WHERE assignment.organization_id = ? AND ${targetSql}
           ORDER BY assignment.effective_from DESC, assignment.id
           LIMIT ? OFFSET ?`,
          [access.id, targetId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(assignmentToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createTeacherAssignment(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'teacher_assignment.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'teacher_assignment.create', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'assignment:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'teacher_assignment.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            WITH inserted AS (
              INSERT INTO teacher_assignments (
                organization_id, teacher_user_id, teacher_user_id_snapshot,
                teacher_display_name_snapshot, teacher_role_snapshot,
                group_id, student_id, effective_from, effective_to, created_by_user_id
              )
              SELECT ${access.id}, member.user_id, member.user_id, app_user.display_name, member.role,
                     ${input.groupId}, ${input.studentId}, ${input.effectiveFrom}, ${input.effectiveTo}, ${actor.userId}
              FROM organization_members member
              JOIN app_users app_user ON app_user.id = member.user_id
              WHERE member.organization_id = ${access.id}
                AND member.user_id = ${input.teacherUserId}
                AND member.status = 'active'
                AND member.role IN ('owner', 'admin', 'teacher', 'assistant')
              RETURNING *
            )
            SELECT inserted.*, member.status AS teacher_member_status
            FROM inserted
            LEFT JOIN organization_members member
              ON member.organization_id = inserted.organization_id
             AND member.user_id = inserted.teacher_user_id`;
          if (!rows.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Teacher must be an active teaching member');
          }
          const assignment = assignmentToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'teacher_assignment.create', 'teacher_assignment', ${String(rows[0].id)}, ${requestId},
              ${sql.json({ teacherUserId: input.teacherUserId, groupId: input.groupId, studentId: input.studentId, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo })}
            )`;
          const result: MutationResult = { status: 201, body: { assignment } };
          await completeIdempotency(tx, idem.id, result, 'teacher_assignment', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Teacher assignment overlaps or targets an unavailable resource');
      }
    });
  },

  async revokeTeacherAssignment(actor, slug, assignmentId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'teacher_assignment.revoke', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'teacher_assignment.revoke', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'assignment:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'teacher_assignment.revoke', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, effective_from, effective_to
            FROM teacher_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Assignment not found');
          if (existing[0].effective_to != null && new Date(String(existing[0].effective_to)).getTime() <= Date.now()) {
            throw new TeachingApiException('CONFLICT', 409, 'Assignment has already ended');
          }
          const rows = await tx`
            WITH ended AS (
              UPDATE teacher_assignments
              SET effective_to = LEAST(
                COALESCE(effective_to, GREATEST(NOW(), effective_from)),
                GREATEST(NOW(), effective_from)
              )
              WHERE organization_id = ${access.id} AND id = ${assignmentId}
              RETURNING *, clock_timestamp() AS cancelled_at
            )
            SELECT ended.*, member.status AS teacher_member_status
            FROM ended
            LEFT JOIN organization_members member
              ON member.organization_id = ended.organization_id
             AND member.user_id = ended.teacher_user_id`;
          const assignment = assignmentToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'teacher_assignment.revoke', 'teacher_assignment', ${assignmentId}, ${requestId},
              ${sql.json({ reason: 'manual_revocation', cancelledAt: iso(rows[0].cancelled_at), effectiveTo: assignment.effectiveTo })}
            )`;
          const result: MutationResult = { status: 200, body: { assignment } };
          await completeIdempotency(tx, idem.id, result, 'teacher_assignment', assignmentId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Teacher assignment could not be ended');
      }
    });
  },
};
