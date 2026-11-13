import { type TeachingActor } from '../../utils/teaching_platform_assertion.js';
import { sql } from '../../db/connection.js';
import { isTrainingGoalRegistered, type TrainingEvidenceSource } from '@cuberoot/shared/teaching';
import { type Tx, type JsonObject, type OrganizationAccess, type WriteTrainingAssignmentInput } from '../types.js';
import { TeachingApiException, ConcealedTeachingPermissionDeniedException } from '../errors.js';
import { trainingAssignmentToJson, trainingTemplateVersionToJson, trainingGoalToJson } from '../serialization/training.js';
import { hasOrganizationTrainingScope, lockAndCheckTeacherGroupScope, lockAndCheckTeacherStudentScope, actorHasActiveGroupScope, actorHasActiveStudentScope } from '../access/student.js';

export async function trainingAssignmentEnvelope(
  tx: Tx,
  organizationId: string,
  assignmentId: string,
): Promise<JsonObject> {
  const assignments = await tx`
    SELECT assignment.*, version.id AS version_id, version.template_id,
           version.version_number, version.title AS version_title,
           version.instructions AS version_instructions, version.source,
           version.activity, version.tool_config, version.published_at AS version_published_at
    FROM training_assignments assignment
    JOIN training_template_versions version
      ON version.organization_id = assignment.organization_id
     AND version.id = assignment.template_version_id
    WHERE assignment.organization_id = ${organizationId}
      AND assignment.id = ${assignmentId}`;
  if (!assignments.length) {
    throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment not found');
  }
  const goals = await tx`
    SELECT * FROM training_assignment_goal_metrics
    WHERE organization_id = ${organizationId} AND assignment_id = ${assignmentId}
    ORDER BY metric_key`;
  const row = assignments[0] as Record<string, unknown>;
  return {
    assignment: trainingAssignmentToJson(row),
    templateVersion: trainingTemplateVersionToJson({
      id: row.version_id,
      organization_id: row.organization_id,
      template_id: row.template_id,
      version_number: row.version_number,
      title: row.version_title,
      instructions: row.version_instructions,
      source: row.source,
      activity: row.activity,
      tool_config: row.tool_config,
      published_at: row.version_published_at,
    }),
    goals: goals.map((goal) => trainingGoalToJson(goal as Record<string, unknown>)),
  };
}

export async function trainingResourceMissing(
  tx: Tx,
  table: 'training_templates' | 'training_assignments',
  id: string,
  message: string,
): Promise<never> {
  const rows = table === 'training_templates'
    ? await tx`SELECT 1 FROM training_templates WHERE id = ${id}`
    : await tx`SELECT 1 FROM training_assignments WHERE id = ${id}`;
  if (rows.length) throw new ConcealedTeachingPermissionDeniedException(message);
  throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, message);
}

async function trainingSelectorMissing(
  tx: Tx,
  access: OrganizationAccess,
  table: 'training_template_versions' | 'teaching_groups' | 'student_profiles',
  id: string,
  message: string,
): Promise<never> {
  const rows = table === 'training_template_versions'
    ? await tx`SELECT organization_id FROM training_template_versions WHERE id = ${id}`
    : table === 'teaching_groups'
      ? await tx`SELECT organization_id FROM teaching_groups WHERE id = ${id}`
      : await tx`SELECT organization_id FROM student_profiles WHERE id = ${id}`;
  if (rows.length && String(rows[0].organization_id) !== access.id) {
    throw new ConcealedTeachingPermissionDeniedException(message);
  }
  throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, message);
}

export async function assertTrainingAssignmentScope(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  assignment: Record<string, unknown>,
  mode: 'read' | 'manage',
): Promise<void> {
  if (hasOrganizationTrainingScope(access.role)) return;
  const selectors = await tx`
    SELECT target_kind, group_id, student_id, source_group_id
    FROM training_assignment_targets
    WHERE organization_id = ${access.id} AND assignment_id = ${String(assignment.id)}
      AND (target_kind = 'group' OR source_group_id IS NULL)
    ORDER BY target_kind, COALESCE(group_id, student_id)`;
  if (mode === 'manage') {
    if (access.role !== 'teacher') {
      throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
    }
    for (const selector of selectors) {
      const allowed = selector.target_kind === 'group'
        ? await lockAndCheckTeacherGroupScope(tx, access, actor, String(selector.group_id))
        : await lockAndCheckTeacherStudentScope(tx, access, actor, String(selector.student_id));
      if (!allowed) throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
    }
    if (!selectors.length) throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
    return;
  }
  for (const selector of selectors) {
    const allowed = selector.target_kind === 'group'
      ? await actorHasActiveGroupScope(tx, access.id, actor.userId, String(selector.group_id))
      : await actorHasActiveStudentScope(tx, access.id, actor.userId, String(selector.student_id));
    if (allowed) return;
  }
  const expanded = await tx`
    SELECT student_id FROM training_assignment_targets
    WHERE organization_id = ${access.id} AND assignment_id = ${String(assignment.id)}
      AND target_kind = 'student' AND source_group_id IS NOT NULL
    ORDER BY student_id`;
  for (const target of expanded) {
    if (await actorHasActiveStudentScope(tx, access.id, actor.userId, String(target.student_id))) return;
  }
  throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
}

export async function replaceTrainingAssignmentDraft(
  tx: Tx,
  access: OrganizationAccess,
  assignmentId: string,
  input: WriteTrainingAssignmentInput,
): Promise<void> {
  await tx`DELETE FROM training_assignment_goal_metrics
           WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}`;
  await tx`DELETE FROM training_assignment_targets
           WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}`;
  for (const groupId of input.groupIds) {
    const groups = await tx`SELECT name FROM teaching_groups
      WHERE organization_id = ${access.id} AND id = ${groupId}`;
    await tx`INSERT INTO training_assignment_targets (
      organization_id, assignment_id, target_kind, group_id, group_name_snapshot
    ) VALUES (${access.id}, ${assignmentId}, 'group', ${groupId}, ${String(groups[0].name)})`;
  }
  for (const studentId of input.studentIds) {
    const students = await tx`SELECT display_name, external_ref FROM student_profiles
      WHERE organization_id = ${access.id} AND id = ${studentId}`;
    await tx`INSERT INTO training_assignment_targets (
      organization_id, assignment_id, target_kind, student_id,
      student_display_name_snapshot, student_external_ref_snapshot
    ) VALUES (
      ${access.id}, ${assignmentId}, 'student', ${studentId},
      ${String(students[0].display_name)}, ${students[0].external_ref == null ? null : String(students[0].external_ref)}
    )`;
  }
  for (const goal of input.goals) {
    await tx`INSERT INTO training_assignment_goal_metrics (
      organization_id, assignment_id, metric_key, operator, target_value
    ) VALUES (${access.id}, ${assignmentId}, ${goal.metricKey}, ${goal.operator}, ${goal.targetValue})`;
  }
}

export async function insertTrainingAudit(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  action: string,
  entityType: string,
  entityId: string,
  requestId: string,
  metadata: JsonObject,
): Promise<void> {
  await tx`INSERT INTO teaching_audit_events (
    organization_id, actor_user_id, actor_role, actor_display_name,
    action, entity_type, entity_id, request_id, metadata
  ) VALUES (
    ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
    ${action}, ${entityType}, ${entityId}, ${requestId}, ${sql.json(metadata)}
  )`;
}

export async function lockAndValidateTrainingSelectors(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  input: WriteTrainingAssignmentInput,
): Promise<Record<string, unknown>> {
  const versions = await tx`
    SELECT version.*, template.status AS template_status
    FROM training_template_versions version
    JOIN training_templates template
      ON template.organization_id = version.organization_id
     AND template.id = version.template_id
    WHERE version.organization_id = ${access.id}
      AND version.id = ${input.templateVersionId}
    FOR UPDATE OF template`;
  if (!versions.length || versions[0].template_status !== 'active') {
    await trainingSelectorMissing(
      tx, access, 'training_template_versions', input.templateVersionId,
      'Training template version not found',
    );
  }
  const version = versions[0] as Record<string, unknown>;
  for (const goal of input.goals) {
    if (!isTrainingGoalRegistered(
      String(version.source) as TrainingEvidenceSource,
      String(version.activity),
      goal.metricKey,
      goal.operator,
    )) {
      throw new TeachingApiException('INVALID_INPUT', 400, `${goal.metricKey}/${goal.operator} is not registered for this training activity`);
    }
  }
  for (const groupId of input.groupIds) {
    if (!hasOrganizationTrainingScope(access.role)
        && !await lockAndCheckTeacherGroupScope(tx, access, actor, groupId)) {
      throw new ConcealedTeachingPermissionDeniedException('Training group selector not found');
    }
    const groups = await tx`
      SELECT teaching_group.id
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
      await trainingSelectorMissing(tx, access, 'teaching_groups', groupId, 'Training group selector not found');
    }
  }
  for (const studentId of input.studentIds) {
    if (!hasOrganizationTrainingScope(access.role)
        && !await lockAndCheckTeacherStudentScope(tx, access, actor, studentId)) {
      throw new ConcealedTeachingPermissionDeniedException('Training student selector not found');
    }
    const students = await tx`
      SELECT id FROM student_profiles
      WHERE organization_id = ${access.id} AND id = ${studentId} AND status = 'active'
      FOR UPDATE`;
    if (!students.length) {
      await trainingSelectorMissing(tx, access, 'student_profiles', studentId, 'Training student selector not found');
    }
  }
  return version;
}
