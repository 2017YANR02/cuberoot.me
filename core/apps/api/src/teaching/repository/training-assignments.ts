import { query, sql } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requirePermission, accessForWrite, requireWritable } from '../access/organization.js';
import { hasOrganizationTrainingScope, ACTIVE_TRAINING_SCOPE_CTE, activeTrainingScopeParams, touchTrainingRelationLock } from '../access/student.js';
import { trainingAssignmentToJson } from '../serialization/training.js';
import { trainingResourceMissing, assertTrainingAssignmentScope, trainingAssignmentEnvelope, lockAndValidateTrainingSelectors, replaceTrainingAssignmentDraft, insertTrainingAudit } from '../training/assignments.js';
import { type JsonObject, type MutationResult } from '../types.js';
import { consumeMutationAttempt, withRepeatableReadRetry, beginIdempotency, completeIdempotency } from '../transactions.js';
import { TeachingApiException, crmConflict } from '../errors.js';
import { iso } from '../serialization/common.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const trainingAssignmentsRepository: Pick<TeachingSaasRepository,
  'listTrainingAssignments' | 'getTrainingAssignment' | 'createTrainingAssignment' | 'reviseTrainingAssignment' | 'publishTrainingAssignment' | 'closeTrainingAssignment'> = {
  async listTrainingAssignments(actor, slug, filter, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'training:assignment:read');
      const statusSql = filter.status === null ? '' : ' AND assignment.status = ?';
      const statusParams = filter.status === null ? [] : [filter.status];
      const organizationScope = hasOrganizationTrainingScope(access.role);
      const scopeCte = organizationScope ? '' : `${ACTIVE_TRAINING_SCOPE_CTE},`;
      const scopeSql = organizationScope ? '' : ` AND EXISTS (
        SELECT 1 FROM training_assignment_targets visible_target
        WHERE visible_target.organization_id = assignment.organization_id
          AND visible_target.assignment_id = assignment.id
          AND (
            (visible_target.target_kind = 'group' AND visible_target.group_id IN (SELECT id FROM scoped_group_ids))
            OR (visible_target.target_kind = 'student' AND visible_target.student_id IN (SELECT id FROM scoped_student_ids))
          )
      )`;
      const scopeParams = organizationScope ? [] : activeTrainingScopeParams(access, actor);
      const countRows = await query<Record<string, unknown>>(
        `${scopeCte} SELECT COUNT(*)::int AS total
         FROM training_assignments assignment
         WHERE assignment.organization_id = ?${statusSql}${scopeSql}`,
        [...scopeParams, access.id, ...statusParams],
      );
      const rows = await query<Record<string, unknown>>(
        `${scopeCte} SELECT assignment.*
         FROM training_assignments assignment
         WHERE assignment.organization_id = ?${statusSql}${scopeSql}
         ORDER BY assignment.starts_at DESC, assignment.id DESC
         LIMIT ? OFFSET ?`,
        [...scopeParams, access.id, ...statusParams, pagination.pageSize, pagination.offset],
      );
      return {
        items: rows.map(trainingAssignmentToJson), total: Number(countRows[0]?.total ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getTrainingAssignment(actor, slug, assignmentId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.read', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const rows = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!rows.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(
          tx, access, actor, rows[0] as Record<string, unknown>, 'read',
        );
        const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
        await assertTrainingAssignmentScope(
          tx, access, actor, rows[0] as Record<string, unknown>, 'read',
        );
        return body;
      }) as JsonObject;
    });
  },

  async createTrainingAssignment(actor, slug, input, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, 'training.assignment.create', 180, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.create', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, 'training.assignment.create', idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          await lockAndValidateTrainingSelectors(tx, access, actor, input);
          const rows = await tx`
            INSERT INTO training_assignments (
              organization_id, template_version_id, title, instructions, schedule_kind,
              expected_count, timezone_snapshot, starts_at, ends_at, created_by_user_id
            ) VALUES (
              ${access.id}, ${input.templateVersionId}, ${input.title}, ${input.instructions},
              ${input.scheduleKind}, ${input.expectedCount}, ${access.timezone},
              ${input.startsAt}, ${input.endsAt}, ${actor.userId}
            ) RETURNING *`;
          const assignmentId = String(rows[0].id);
          await replaceTrainingAssignmentDraft(tx, access, assignmentId, input);
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.create', 'training_assignment', assignmentId,
            requestId, { groupCount: input.groupIds.length, studentCount: input.studentIds.length, goalCount: input.goals.length },
          );
          const result: MutationResult = { status: 201, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be created');
      }
    });
  },

  async reviseTrainingAssignment(
    actor, slug, assignmentId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `training.assignment.revise:${assignmentId}`, 180, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.revise', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const rows = await tx`
            SELECT * FROM training_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!rows.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          await assertTrainingAssignmentScope(
            tx, access, actor, rows[0] as Record<string, unknown>, 'manage',
          );
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.assignment.revise:${assignmentId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(rows[0].status) !== 'draft') {
            throw new TeachingApiException('CONFLICT', 409, 'Only draft training assignments can be revised');
          }
          await lockAndValidateTrainingSelectors(tx, access, actor, input);
          await tx`
            UPDATE training_assignments
            SET template_version_id = ${input.templateVersionId}, title = ${input.title},
                instructions = ${input.instructions}, schedule_kind = ${input.scheduleKind},
                expected_count = ${input.expectedCount}, starts_at = ${input.startsAt},
                ends_at = ${input.endsAt}
            WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
          await replaceTrainingAssignmentDraft(tx, access, assignmentId, input);
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.revise', 'training_assignment', assignmentId,
            requestId, { groupCount: input.groupIds.length, studentCount: input.studentIds.length, goalCount: input.goals.length },
          );
          const result: MutationResult = { status: 200, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be revised');
      }
    });
  },

  async publishTrainingAssignment(
    actor, slug, assignmentId, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `training.assignment.publish:${assignmentId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.publish', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const assignments = await tx`
            SELECT assignment.*, version.source, version.activity
            FROM training_assignments assignment
            JOIN training_template_versions version
              ON version.organization_id = assignment.organization_id
             AND version.id = assignment.template_version_id
            WHERE assignment.organization_id = ${access.id} AND assignment.id = ${assignmentId}
            FOR UPDATE OF assignment`;
          if (!assignments.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          const assignment = assignments[0] as Record<string, unknown>;
          await assertTrainingAssignmentScope(tx, access, actor, assignment, 'manage');
          const selectorRows = await tx`
            SELECT target_kind, group_id, student_id
            FROM training_assignment_targets
            WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
              AND (target_kind = 'group' OR source_group_id IS NULL)
            ORDER BY target_kind, COALESCE(group_id, student_id)`;
          const groupIds = selectorRows
            .filter((row) => row.target_kind === 'group')
            .map((row) => String(row.group_id))
            .sort();
          const directStudentIds = selectorRows
            .filter((row) => row.target_kind === 'student')
            .map((row) => String(row.student_id))
            .sort();
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.assignment.publish:${assignmentId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(assignment.status) !== 'draft') {
            throw new TeachingApiException('CONFLICT', 409, 'Only draft training assignments can be published');
          }
          const instantRows = await tx`SELECT clock_timestamp() AS published_at`;
          const publishedAt = iso(instantRows[0].published_at);

          for (const groupId of groupIds) {
            await touchTrainingRelationLock(tx, access.id, 'student_group', '*', groupId);
          }
          const groupNames = new Map<string, string>();
          for (const groupId of groupIds) {
            const groups = await tx`
              SELECT teaching_group.id, teaching_group.name
              FROM teaching_groups teaching_group
              LEFT JOIN teaching_campuses campus
                ON campus.organization_id = teaching_group.organization_id
               AND campus.id = teaching_group.campus_id
              WHERE teaching_group.organization_id = ${access.id}
                AND teaching_group.id = ${groupId}
                AND teaching_group.status = 'active'
                AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
              FOR UPDATE OF teaching_group`;
            if (!groups.length) {
              throw new TeachingApiException('CONFLICT', 409, 'A selected training group is no longer active');
            }
            groupNames.set(groupId, String(groups[0].name));
          }

          const groupSourceByStudent = new Map<string, string>();
          for (const groupId of groupIds) {
            const memberships = await tx`
              SELECT membership.student_id
              FROM student_group_memberships membership
              JOIN student_profiles student
                ON student.organization_id = membership.organization_id
               AND student.id = membership.student_id
               AND student.status = 'active'
              WHERE membership.organization_id = ${access.id}
                AND membership.group_id = ${groupId}
                AND membership.effective_from <= ${publishedAt}
                AND (membership.effective_to IS NULL OR membership.effective_to > ${publishedAt})
              ORDER BY membership.student_id`;
            for (const membership of memberships) {
              const studentId = String(membership.student_id);
              const previous = groupSourceByStudent.get(studentId);
              if (previous === undefined || groupId < previous) groupSourceByStudent.set(studentId, groupId);
            }
          }
          const directStudents = new Set(directStudentIds);
          const allStudentIds = [...new Set([...directStudentIds, ...groupSourceByStudent.keys()])].sort();
          if (!allStudentIds.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Published training assignments require at least one active student');
          }
          const studentSnapshots = new Map<string, { displayName: string; externalRef: string | null }>();
          for (const studentId of allStudentIds) {
            const students = await tx`
              SELECT id, display_name, external_ref
              FROM student_profiles
              WHERE organization_id = ${access.id} AND id = ${studentId} AND status = 'active'
              FOR UPDATE`;
            if (!students.length) {
              throw new TeachingApiException('CONFLICT', 409, 'A selected training student is no longer active');
            }
            studentSnapshots.set(studentId, {
              displayName: String(students[0].display_name),
              externalRef: students[0].external_ref == null ? null : String(students[0].external_ref),
            });
          }

          for (const [groupId, groupName] of groupNames) {
            await tx`
              UPDATE training_assignment_targets
              SET group_name_snapshot = ${groupName}
              WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
                AND target_kind = 'group' AND group_id = ${groupId}`;
          }
          for (const studentId of directStudentIds) {
            const snapshot = studentSnapshots.get(studentId)!;
            await tx`
              UPDATE training_assignment_targets
              SET student_display_name_snapshot = ${snapshot.displayName},
                  student_external_ref_snapshot = ${snapshot.externalRef}
              WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
                AND target_kind = 'student' AND student_id = ${studentId}
                AND source_group_id IS NULL`;
          }
          await tx`
            DELETE FROM training_assignment_targets
            WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
              AND target_kind = 'student' AND source_group_id IS NOT NULL`;
          for (const studentId of allStudentIds) {
            if (directStudents.has(studentId)) continue;
            const snapshot = studentSnapshots.get(studentId)!;
            const sourceGroupId = groupSourceByStudent.get(studentId)!;
            await tx`
              INSERT INTO training_assignment_targets (
                organization_id, assignment_id, target_kind, source_group_id, student_id,
                student_display_name_snapshot, student_external_ref_snapshot
              ) VALUES (
                ${access.id}, ${assignmentId}, 'student', ${sourceGroupId},
                ${studentId}, ${snapshot.displayName}, ${snapshot.externalRef}
              )`;
          }
          await tx`
            UPDATE training_assignments
            SET status = 'published', published_at = ${publishedAt}, published_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.publish', 'training_assignment', assignmentId,
            requestId, { groupCount: groupIds.length, directStudentCount: directStudentIds.length, studentCount: allStudentIds.length },
          );
          const result: MutationResult = { status: 200, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be published');
      }
    });
  },

  async closeTrainingAssignment(actor, slug, assignmentId, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, `training.assignment.close:${assignmentId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.close', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const rows = await tx`
            SELECT * FROM training_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!rows.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          await assertTrainingAssignmentScope(tx, access, actor, rows[0] as Record<string, unknown>, 'manage');
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.assignment.close:${assignmentId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(rows[0].status) !== 'published') {
            throw new TeachingApiException('CONFLICT', 409, 'Only published training assignments can be closed');
          }
          await tx`
            UPDATE training_assignments
            SET status = 'closed', closed_at = clock_timestamp(), closed_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.close', 'training_assignment', assignmentId,
            requestId, {},
          );
          const result: MutationResult = { status: 200, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be closed');
      }
    });
  },
};
