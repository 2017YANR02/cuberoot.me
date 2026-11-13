import { type TeachingActor } from '../../utils/teaching_platform_assertion.js';
import { type TeachingOrganizationRole } from '@cuberoot/shared/teaching';
import { type OrganizationAccess, type Tx } from '../types.js';

export const ACTIVE_STUDENT_SCOPE_CTE = `
  WITH active_scope_actor AS (
    SELECT member.organization_id, member.user_id
    FROM organization_members member
    WHERE member.organization_id = ?
      AND member.user_id = ?
      AND member.status = 'active'
      AND member.role IN ('teacher', 'assistant')
  ), scoped_student_ids AS (
    SELECT ta.student_id AS id
    FROM teacher_assignments ta
    JOIN active_scope_actor actor
      ON actor.organization_id = ta.organization_id AND actor.user_id = ta.teacher_user_id
    JOIN student_profiles direct_student
      ON direct_student.organization_id = ta.organization_id AND direct_student.id = ta.student_id
    WHERE ta.organization_id = ?
      AND ta.student_id IS NOT NULL
      AND ta.effective_from <= NOW()
      AND (ta.effective_to IS NULL OR ta.effective_to > NOW())
      AND direct_student.status = 'active'
    UNION
    SELECT membership.student_id AS id
    FROM teacher_assignments ta
    JOIN active_scope_actor actor
      ON actor.organization_id = ta.organization_id AND actor.user_id = ta.teacher_user_id
    JOIN teaching_groups teaching_group
      ON teaching_group.organization_id = ta.organization_id AND teaching_group.id = ta.group_id
    LEFT JOIN teaching_campuses campus
      ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
    JOIN student_group_memberships membership
      ON membership.organization_id = teaching_group.organization_id AND membership.group_id = teaching_group.id
    JOIN student_profiles group_student
      ON group_student.organization_id = membership.organization_id AND group_student.id = membership.student_id
    WHERE ta.organization_id = ?
      AND ta.group_id IS NOT NULL
      AND ta.effective_from <= NOW()
      AND (ta.effective_to IS NULL OR ta.effective_to > NOW())
      AND membership.effective_from <= NOW()
      AND (membership.effective_to IS NULL OR membership.effective_to > NOW())
      AND teaching_group.status = 'active'
      AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
      AND group_student.status = 'active'
  )`;

export const ACTIVE_TRAINING_SCOPE_CTE = `
  WITH active_scope_actor AS (
    SELECT member.organization_id, member.user_id
    FROM organization_members member
    WHERE member.organization_id = ? AND member.user_id = ?
      AND member.status = 'active' AND member.role IN ('teacher', 'assistant')
  ), scoped_group_ids AS (
    SELECT assignment.group_id AS id
    FROM teacher_assignments assignment
    JOIN active_scope_actor actor
      ON actor.organization_id = assignment.organization_id
     AND actor.user_id = assignment.teacher_user_id
    JOIN teaching_groups teaching_group
      ON teaching_group.organization_id = assignment.organization_id
     AND teaching_group.id = assignment.group_id
     AND teaching_group.status = 'active'
    LEFT JOIN teaching_campuses campus
      ON campus.organization_id = teaching_group.organization_id
     AND campus.id = teaching_group.campus_id
    WHERE assignment.organization_id = ? AND assignment.group_id IS NOT NULL
      AND assignment.effective_from <= NOW()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
      AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
  ), scoped_student_ids AS (
    SELECT assignment.student_id AS id
    FROM teacher_assignments assignment
    JOIN active_scope_actor actor
      ON actor.organization_id = assignment.organization_id
     AND actor.user_id = assignment.teacher_user_id
    JOIN student_profiles student
      ON student.organization_id = assignment.organization_id
     AND student.id = assignment.student_id AND student.status = 'active'
    WHERE assignment.organization_id = ? AND assignment.student_id IS NOT NULL
      AND assignment.effective_from <= NOW()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
    UNION
    SELECT membership.student_id
    FROM scoped_group_ids scoped_group
    JOIN student_group_memberships membership ON membership.group_id = scoped_group.id
    JOIN student_profiles student
      ON student.organization_id = membership.organization_id
     AND student.id = membership.student_id AND student.status = 'active'
    WHERE membership.organization_id = ?
      AND membership.effective_from <= NOW()
      AND (membership.effective_to IS NULL OR membership.effective_to > NOW())
  )`;

export function activeTrainingScopeParams(access: OrganizationAccess, actor: TeachingActor): unknown[] {
  return [access.id, actor.userId, access.id, access.id, access.id];
}

export function activeStudentScopeParams(access: OrganizationAccess, actor: TeachingActor): unknown[] {
  return [access.id, actor.userId, access.id, access.id];
}

export function hasOrganizationTrainingScope(role: TeachingOrganizationRole): boolean {
  return role === 'owner' || role === 'admin';
}

export async function actorHasActiveStudentScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  studentId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
        AND EXISTS (
          SELECT 1 FROM student_profiles scoped_student
          WHERE scoped_student.organization_id = member.organization_id
            AND scoped_student.id = ${studentId}
            AND scoped_student.status = 'active'
        )
        AND (
          EXISTS (
            SELECT 1 FROM teacher_assignments direct_scope
            WHERE direct_scope.organization_id = member.organization_id
              AND direct_scope.teacher_user_id = member.user_id
              AND direct_scope.student_id = ${studentId}
              AND direct_scope.effective_from <= clock_timestamp()
              AND (direct_scope.effective_to IS NULL OR direct_scope.effective_to > clock_timestamp())
          )
          OR EXISTS (
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
             AND membership.student_id = ${studentId}
             AND membership.effective_from <= clock_timestamp()
             AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
            WHERE group_scope.organization_id = member.organization_id
              AND group_scope.teacher_user_id = member.user_id
              AND group_scope.effective_from <= clock_timestamp()
              AND (group_scope.effective_to IS NULL OR group_scope.effective_to > clock_timestamp())
              AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
          )
        )
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

export async function actorHasActiveGroupScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  groupId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      JOIN teacher_assignments group_scope
        ON group_scope.organization_id = member.organization_id
       AND group_scope.teacher_user_id = member.user_id
       AND group_scope.group_id = ${groupId}
       AND group_scope.effective_from <= clock_timestamp()
       AND (group_scope.effective_to IS NULL OR group_scope.effective_to > clock_timestamp())
      JOIN teaching_groups teaching_group
        ON teaching_group.organization_id = group_scope.organization_id
       AND teaching_group.id = group_scope.group_id
       AND teaching_group.status = 'active'
      LEFT JOIN teaching_campuses campus
        ON campus.organization_id = teaching_group.organization_id
       AND campus.id = teaching_group.campus_id
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
        AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

export async function touchTrainingRelationLock(
  tx: Tx,
  organizationId: string,
  relationKind: 'student_group' | 'teacher_group' | 'teacher_student',
  subjectKey: string,
  targetKey: string,
): Promise<void> {
  await tx`
    INSERT INTO teaching_relation_locks (
      organization_id, relation_kind, subject_key, target_key
    ) VALUES (${organizationId}, ${relationKind}, ${subjectKey}, ${targetKey})
    ON CONFLICT (organization_id, relation_kind, subject_key, target_key)
    DO UPDATE SET revision = teaching_relation_locks.revision + 1,
                  touched_at = clock_timestamp()`;
}

export async function lockAndCheckTeacherGroupScope(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  groupId: string,
): Promise<boolean> {
  await touchTrainingRelationLock(tx, access.id, 'teacher_group', String(actor.userId), groupId);
  return actorHasActiveGroupScope(tx, access.id, actor.userId, groupId);
}

async function actorHasExactDirectStudentScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  studentId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      JOIN teacher_assignments assignment
        ON assignment.organization_id = member.organization_id
       AND assignment.teacher_user_id = member.user_id
       AND assignment.student_id = ${studentId}
       AND assignment.effective_from <= clock_timestamp()
       AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
      JOIN student_profiles student
        ON student.organization_id = assignment.organization_id
       AND student.id = assignment.student_id
       AND student.status = 'active'
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

async function actorHasExactGroupStudentScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  groupId: string,
  studentId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      JOIN teacher_assignments assignment
        ON assignment.organization_id = member.organization_id
       AND assignment.teacher_user_id = member.user_id
       AND assignment.group_id = ${groupId}
       AND assignment.effective_from <= clock_timestamp()
       AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
      JOIN teaching_groups teaching_group
        ON teaching_group.organization_id = assignment.organization_id
       AND teaching_group.id = assignment.group_id
       AND teaching_group.status = 'active'
      LEFT JOIN teaching_campuses campus
        ON campus.organization_id = teaching_group.organization_id
       AND campus.id = teaching_group.campus_id
      JOIN student_group_memberships membership
        ON membership.organization_id = assignment.organization_id
       AND membership.group_id = assignment.group_id
       AND membership.student_id = ${studentId}
       AND membership.effective_from <= clock_timestamp()
       AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
      JOIN student_profiles student
        ON student.organization_id = membership.organization_id
       AND student.id = membership.student_id
       AND student.status = 'active'
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
        AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

export async function lockAndCheckTeacherStudentScope(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  studentId: string,
): Promise<boolean> {
  const candidateRows = await tx`
    SELECT NULL::uuid AS group_id, 0 AS priority
    FROM teacher_assignments assignment
    JOIN organization_members member
      ON member.organization_id = assignment.organization_id
     AND member.user_id = assignment.teacher_user_id
     AND member.status = 'active'
     AND member.role IN ('teacher', 'assistant')
    JOIN student_profiles student
      ON student.organization_id = assignment.organization_id
     AND student.id = assignment.student_id
     AND student.status = 'active'
    WHERE assignment.organization_id = ${access.id}
      AND assignment.teacher_user_id = ${actor.userId}
      AND assignment.student_id = ${studentId}
      AND assignment.effective_from <= clock_timestamp()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
    UNION ALL
    SELECT assignment.group_id, 1 AS priority
    FROM teacher_assignments assignment
    JOIN organization_members member
      ON member.organization_id = assignment.organization_id
     AND member.user_id = assignment.teacher_user_id
     AND member.status = 'active'
     AND member.role IN ('teacher', 'assistant')
    JOIN teaching_groups teaching_group
      ON teaching_group.organization_id = assignment.organization_id
     AND teaching_group.id = assignment.group_id
     AND teaching_group.status = 'active'
    LEFT JOIN teaching_campuses campus
      ON campus.organization_id = teaching_group.organization_id
     AND campus.id = teaching_group.campus_id
    JOIN student_group_memberships membership
      ON membership.organization_id = assignment.organization_id
     AND membership.group_id = assignment.group_id
     AND membership.student_id = ${studentId}
     AND membership.effective_from <= clock_timestamp()
     AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
    JOIN student_profiles student
      ON student.organization_id = membership.organization_id
     AND student.id = membership.student_id
     AND student.status = 'active'
    WHERE assignment.organization_id = ${access.id}
      AND assignment.teacher_user_id = ${actor.userId}
      AND assignment.group_id IS NOT NULL
      AND assignment.effective_from <= clock_timestamp()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
      AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
    ORDER BY priority, group_id NULLS FIRST
    LIMIT 1`;
  if (!candidateRows.length) return false;
  const groupId = candidateRows[0].group_id == null ? null : String(candidateRows[0].group_id);
  if (groupId === null) {
    await touchTrainingRelationLock(tx, access.id, 'teacher_student', String(actor.userId), studentId);
    return actorHasExactDirectStudentScope(tx, access.id, actor.userId, studentId);
  } else {
    await touchTrainingRelationLock(tx, access.id, 'teacher_group', String(actor.userId), groupId);
    await touchTrainingRelationLock(tx, access.id, 'student_group', studentId, groupId);
    return actorHasExactGroupStudentScope(tx, access.id, actor.userId, groupId, studentId);
  }
}
