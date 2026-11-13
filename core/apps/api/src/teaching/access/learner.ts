import { type TeachingActor } from '../../utils/teaching_platform_assertion.js';
import { isTeachingOrganizationRole } from '@cuberoot/shared/teaching';
import { type Tx, type BoundSelfStudent, type ConversationActorScope, type OrganizationAccess } from '../types.js';
import { TeachingApiException, ConcealedTeachingPermissionDeniedException } from '../errors.js';
import { iso } from '../serialization/common.js';
import { lockAndCheckTeacherStudentScope } from './student.js';

export async function boundSelfStudentForUpdate(
  tx: Tx,
  actorUserId: number,
  slug: string,
): Promise<BoundSelfStudent> {
  const actors = await tx`
    SELECT id FROM app_users WHERE id = ${actorUserId} FOR KEY SHARE`;
  if (!actors.length) {
    throw new TeachingApiException('UNAUTHENTICATED', 401, 'Authentication required');
  }
  const rows = await tx`
    SELECT o.id AS organization_id, o.name AS organization_name,
           o.timezone AS organization_timezone,
           student.id AS student_id, student.display_name AS student_display_name,
           student.account_linked_at, clock_timestamp() AS database_now
    FROM organizations o
    JOIN student_profiles student
      ON student.organization_id = o.id
     AND student.account_user_id = ${actorUserId}
    WHERE o.slug = ${slug}
      AND o.status = 'active'
      AND student.status = 'active'
    FOR UPDATE OF student`;
  if (!rows.length) {
    throw new ConcealedTeachingPermissionDeniedException('Student account binding not found');
  }
  const row = rows[0] as Record<string, unknown>;
  return {
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name),
    organizationTimezone: String(row.organization_timezone),
    studentId: String(row.student_id),
    studentDisplayName: String(row.student_display_name),
    accountLinkedAt: iso(row.account_linked_at),
    databaseNow: iso(row.database_now),
  };
}

export async function lockConversationActorScope(
  tx: Tx,
  actor: TeachingActor,
  slug: string,
  studentId: string,
  mode: 'read' | 'write',
): Promise<ConversationActorScope> {
  const actorRows = await tx`
    SELECT COALESCE(NULLIF(wca_id, ''), 'u' || id::text) AS owner_key
    FROM app_users
    WHERE id = ${actor.userId}
    FOR KEY SHARE`;
  if (!actorRows.length) {
    throw new ConcealedTeachingPermissionDeniedException('Conversation student not found');
  }
  const actorOwnerKey = String(actorRows[0].owner_key);
  const contextRows = await tx`
    SELECT o.id, o.slug, o.name, o.timezone, o.status, o.version,
           student.id AS student_id, student.display_name, student.account_user_id
    FROM organizations o
    JOIN student_profiles student ON student.organization_id = o.id
    WHERE o.slug = ${slug} AND student.id = ${studentId} AND student.status = 'active'
    FOR SHARE OF o, student`;
  if (!contextRows.length) {
    throw new ConcealedTeachingPermissionDeniedException('Conversation student not found');
  }
  const row = contextRows[0] as Record<string, unknown>;
  const organization = {
    id: String(row.id), slug: String(row.slug), name: String(row.name),
    timezone: String(row.timezone), status: row.status as OrganizationAccess['status'],
    version: Number(row.version),
  };
  const student = { id: String(row.student_id), displayName: String(row.display_name) };
  const memberRows = await tx`
    SELECT role FROM organization_members
    WHERE organization_id = ${organization.id} AND user_id = ${actor.userId} AND status = 'active'
    FOR SHARE`;
  const memberRole = memberRows[0]?.role;
  if (isTeachingOrganizationRole(memberRole)) {
    const staffAccess: OrganizationAccess = { ...organization, role: memberRole };
    if (mode === 'write' && organization.status !== 'active') {
      throw new TeachingApiException('ORGANIZATION_SUSPENDED', 409, 'Organization is not active');
    }
    if (memberRole === 'owner' || memberRole === 'admin') {
      return {
        organization, student, actorOwnerKey,
        role: memberRole, relationship: null, staffAccess,
      };
    }
    if ((memberRole === 'teacher' || memberRole === 'assistant')
        && await lockAndCheckTeacherStudentScope(tx, staffAccess, actor, studentId)) {
      return {
        organization, student, actorOwnerKey,
        role: memberRole, relationship: null, staffAccess,
      };
    }
  }
  if (organization.status !== 'active') {
    throw new ConcealedTeachingPermissionDeniedException('Conversation student not found');
  }
  if (row.account_user_id != null && Number(row.account_user_id) === actor.userId) {
    return {
      organization, student, actorOwnerKey,
      role: 'student', relationship: null, staffAccess: null,
    };
  }
  const guardianRows = await tx`
    SELECT relationship
    FROM guardian_links
    WHERE organization_id = ${organization.id}
      AND student_id = ${studentId}
      AND guardian_user_id = ${actor.userId}
      AND status = 'active'
    ORDER BY id
    LIMIT 1
    FOR SHARE`;
  if (guardianRows.length) {
    return {
      organization, student, actorOwnerKey, role: 'guardian',
      relationship: String(guardianRows[0].relationship), staffAccess: null,
    };
  }
  throw new ConcealedTeachingPermissionDeniedException('Conversation student not found');
}

export function requireLearnerScope(scope: ConversationActorScope): void {
  if (scope.staffAccess !== null || (scope.role !== 'student' && scope.role !== 'guardian')) {
    throw new ConcealedTeachingPermissionDeniedException('Learner session not found');
  }
}
