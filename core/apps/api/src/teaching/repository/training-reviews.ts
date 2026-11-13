import { sql } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForWrite, requirePermission, requireWritable } from '../access/organization.js';
import { trainingResourceMissing, assertTrainingAssignmentScope, insertTrainingAudit } from '../training/assignments.js';
import { hasOrganizationTrainingScope, actorHasActiveStudentScope, lockAndCheckTeacherStudentScope } from '../access/student.js';
import { trainingTargetToJson, trainingEvidenceToJson, trainingReviewToJson } from '../serialization/training.js';
import { type PageResult, type MutationResult } from '../types.js';
import { TeachingApiException, ConcealedTeachingPermissionDeniedException, crmConflict } from '../errors.js';
import { consumeMutationAttempt, withRepeatableReadRetry, beginIdempotency, completeIdempotency } from '../transactions.js';
import { TRAINING_REVIEW_CREATE_OPERATION } from '../constants.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const trainingReviewsRepository: Pick<TeachingSaasRepository,
  'listTrainingAssignmentTargets' | 'listTrainingTargetEvidence' | 'listTrainingTargetReviews' | 'createTrainingTargetReview'> = {
  async listTrainingAssignmentTargets(actor, slug, assignmentId, filter, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const assignments = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!assignments.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(
          tx, access, actor, assignments[0] as Record<string, unknown>, 'read',
        );
        const kind = filter.targetKind;
        if (hasOrganizationTrainingScope(access.role)) {
          const totals = await tx`
            SELECT COUNT(*)::int AS total FROM training_assignment_targets target
            WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
              AND (${kind}::text IS NULL OR target.target_kind = ${kind})`;
          const rows = await tx`
            SELECT * FROM training_assignment_targets target
            WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
              AND (${kind}::text IS NULL OR target.target_kind = ${kind})
            ORDER BY target.target_kind, COALESCE(target.group_name_snapshot, target.student_display_name_snapshot), target.id
            LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
          return {
            items: rows.map(trainingTargetToJson), total: Number(totals[0]?.total ?? 0),
            page: pagination.page, pageSize: pagination.pageSize,
          };
        }
        const totals = await tx`
          WITH active_scope_actor AS (
            SELECT member.organization_id, member.user_id
            FROM organization_members member
            WHERE member.organization_id = ${access.id} AND member.user_id = ${actor.userId}
              AND member.status = 'active' AND member.role IN ('teacher', 'assistant')
          ), scoped_group_ids AS (
            SELECT assignment.group_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN teaching_groups teaching_group
              ON teaching_group.organization_id = assignment.organization_id
             AND teaching_group.id = assignment.group_id
             AND teaching_group.status = 'active'
            LEFT JOIN teaching_campuses campus
              ON campus.organization_id = teaching_group.organization_id
             AND campus.id = teaching_group.campus_id
            WHERE assignment.organization_id = ${access.id} AND assignment.group_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
              AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
          ), scoped_student_ids AS (
            SELECT assignment.student_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN student_profiles student
              ON student.organization_id = assignment.organization_id
             AND student.id = assignment.student_id AND student.status = 'active'
            WHERE assignment.organization_id = ${access.id} AND assignment.student_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
            UNION
            SELECT membership.student_id
            FROM scoped_group_ids scoped_group
            JOIN student_group_memberships membership
              ON membership.organization_id = ${access.id} AND membership.group_id = scoped_group.id
             AND membership.effective_from <= clock_timestamp()
             AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
            JOIN student_profiles student
              ON student.organization_id = membership.organization_id
             AND student.id = membership.student_id AND student.status = 'active'
          )
          SELECT COUNT(*)::int AS total FROM training_assignment_targets target
          WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
            AND (${kind}::text IS NULL OR target.target_kind = ${kind})
            AND ((target.target_kind = 'group' AND target.group_id IN (SELECT id FROM scoped_group_ids))
              OR (target.target_kind = 'student' AND target.student_id IN (SELECT id FROM scoped_student_ids)))`;
        const rows = await tx`
          WITH active_scope_actor AS (
            SELECT member.organization_id, member.user_id
            FROM organization_members member
            WHERE member.organization_id = ${access.id} AND member.user_id = ${actor.userId}
              AND member.status = 'active' AND member.role IN ('teacher', 'assistant')
          ), scoped_group_ids AS (
            SELECT assignment.group_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN teaching_groups teaching_group
              ON teaching_group.organization_id = assignment.organization_id
             AND teaching_group.id = assignment.group_id
             AND teaching_group.status = 'active'
            LEFT JOIN teaching_campuses campus
              ON campus.organization_id = teaching_group.organization_id
             AND campus.id = teaching_group.campus_id
            WHERE assignment.organization_id = ${access.id} AND assignment.group_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
              AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
          ), scoped_student_ids AS (
            SELECT assignment.student_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN student_profiles student
              ON student.organization_id = assignment.organization_id
             AND student.id = assignment.student_id AND student.status = 'active'
            WHERE assignment.organization_id = ${access.id} AND assignment.student_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
            UNION
            SELECT membership.student_id
            FROM scoped_group_ids scoped_group
            JOIN student_group_memberships membership
              ON membership.organization_id = ${access.id} AND membership.group_id = scoped_group.id
             AND membership.effective_from <= clock_timestamp()
             AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
            JOIN student_profiles student
              ON student.organization_id = membership.organization_id
             AND student.id = membership.student_id AND student.status = 'active'
          )
          SELECT * FROM training_assignment_targets target
          WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
            AND (${kind}::text IS NULL OR target.target_kind = ${kind})
            AND ((target.target_kind = 'group' AND target.group_id IN (SELECT id FROM scoped_group_ids))
              OR (target.target_kind = 'student' AND target.student_id IN (SELECT id FROM scoped_student_ids)))
          ORDER BY target.target_kind, COALESCE(target.group_name_snapshot, target.student_display_name_snapshot), target.id
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map(trainingTargetToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async listTrainingTargetEvidence(actor, slug, assignmentId, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.evidence.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const assignments = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!assignments.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(tx, access, actor, assignments[0] as Record<string, unknown>, 'read');
        const targets = await tx`
          SELECT 1 FROM training_assignment_targets
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND target_kind = 'student' AND student_id = ${studentId}`;
        if (!targets.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment target not found');
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        const totals = await tx`
          SELECT COUNT(*)::int AS total
          FROM training_evidence_assignments link
          WHERE link.organization_id = ${access.id} AND link.assignment_id = ${assignmentId}
            AND link.student_id = ${studentId}`;
        const rows = await tx`
          SELECT evidence.*
          FROM training_evidence_assignments link
          JOIN training_evidence evidence
            ON evidence.organization_id = link.organization_id AND evidence.id = link.evidence_id
          WHERE link.organization_id = ${access.id} AND link.assignment_id = ${assignmentId}
            AND link.student_id = ${studentId}
          ORDER BY evidence.occurred_at DESC, evidence.id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        return {
          items: rows.map(trainingEvidenceToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async listTrainingTargetReviews(actor, slug, assignmentId, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.review.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const assignments = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!assignments.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(tx, access, actor, assignments[0] as Record<string, unknown>, 'read');
        const targets = await tx`
          SELECT 1 FROM training_assignment_targets
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND target_kind = 'student' AND student_id = ${studentId}`;
        if (!targets.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment target not found');
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        const totals = await tx`
          SELECT COUNT(*)::int AS total FROM training_submission_reviews
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND student_id = ${studentId}`;
        const rows = await tx`
          SELECT * FROM training_submission_reviews
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND student_id = ${studentId}
          ORDER BY revision DESC, id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        return {
          items: rows.map(trainingReviewToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async createTrainingTargetReview(
    actor, slug, assignmentId, studentId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(
      actor.userId, TRAINING_REVIEW_CREATE_OPERATION, 240, '1 minute',
    );
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.review.create', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:review');
          const assignments = await tx`
            SELECT * FROM training_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!assignments.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          const targets = await tx`
            SELECT * FROM training_assignment_targets
            WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
              AND target_kind = 'student' AND student_id = ${studentId}
            FOR UPDATE`;
          if (!targets.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment target not found');
          if (!hasOrganizationTrainingScope(access.role)
              && !await lockAndCheckTeacherStudentScope(tx, access, actor, studentId)) {
            throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id,
            TRAINING_REVIEW_CREATE_OPERATION,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (!['published', 'closed'].includes(String(assignments[0].status))) {
            throw new TeachingApiException('CONFLICT', 409, 'Draft training assignments cannot be reviewed');
          }
          if (BigInt(String(targets[0].evidence_count)) < 1n) {
            throw new TeachingApiException('CONFLICT', 409, 'Training evidence is required before review');
          }
          const revision = Number(targets[0].latest_review_revision) + 1;
          const rows = await tx`
            INSERT INTO training_submission_reviews (
              organization_id, assignment_id, student_id, revision,
              reviewer_user_id, reviewer_user_id_snapshot, reviewer_display_name_snapshot,
              reviewer_role_snapshot, status, rating, feedback
            ) VALUES (
              ${access.id}, ${assignmentId}, ${studentId}, ${revision},
              ${actor.userId}, ${actor.userId}, ${actor.displayName}, ${access.role},
              ${input.status}, ${input.rating}, ${input.feedback}
            ) RETURNING *`;
          const reviewId = String(rows[0].id);
          const review = trainingReviewToJson(rows[0] as Record<string, unknown>);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.target.review.create',
            'training_submission_review', reviewId, requestId,
            { assignmentId, studentId, revision, status: input.status, rating: input.rating },
          );
          const result: MutationResult = { status: 201, body: { review } };
          await completeIdempotency(tx, idem.id, result, 'training_submission_review', reviewId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training review could not be created');
      }
    });
  },
};
