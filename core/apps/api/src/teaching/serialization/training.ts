import { type JsonObject } from '../types.js';
import { iso } from './common.js';

export function trainingTemplateToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    description: String(row.description),
    status: String(row.status),
    latestVersionNumber: row.latest_version_number == null ? null : Number(row.latest_version_number),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function trainingTemplateVersionToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    templateId: String(row.template_id),
    versionNumber: Number(row.version_number),
    title: String(row.title),
    instructions: String(row.instructions),
    source: String(row.source),
    activity: String(row.activity),
    toolConfig: row.tool_config as JsonObject,
    publishedAt: iso(row.published_at),
  };
}

export function trainingAssignmentToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    templateVersionId: String(row.template_version_id),
    title: String(row.title),
    instructions: String(row.instructions),
    status: String(row.status),
    scheduleKind: String(row.schedule_kind),
    expectedCount: Number(row.expected_count),
    timezoneSnapshot: String(row.timezone_snapshot),
    startsAt: iso(row.starts_at),
    endsAt: row.ends_at == null ? null : iso(row.ends_at),
    publishedAt: row.published_at == null ? null : iso(row.published_at),
    closedAt: row.closed_at == null ? null : iso(row.closed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function trainingTargetToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    assignmentId: String(row.assignment_id),
    targetKind: String(row.target_kind),
    groupId: row.group_id == null ? null : String(row.group_id),
    sourceGroupId: row.source_group_id == null ? null : String(row.source_group_id),
    studentId: row.student_id == null ? null : String(row.student_id),
    groupNameSnapshot: row.group_name_snapshot == null ? null : String(row.group_name_snapshot),
    studentDisplayNameSnapshot: row.student_display_name_snapshot == null
      ? null
      : String(row.student_display_name_snapshot),
    studentExternalRefSnapshot: row.student_external_ref_snapshot == null
      ? null
      : String(row.student_external_ref_snapshot),
    evidenceCount: String(row.evidence_count),
    firstEvidenceAt: row.first_evidence_at == null ? null : iso(row.first_evidence_at),
    lastEvidenceAt: row.last_evidence_at == null ? null : iso(row.last_evidence_at),
    latestReviewRevision: Number(row.latest_review_revision),
    latestReviewStatus: row.latest_review_status == null ? null : String(row.latest_review_status),
  };
}

export function trainingGoalToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    assignmentId: String(row.assignment_id),
    metricKey: String(row.metric_key),
    operator: String(row.operator),
    targetValue: Number(row.target_value),
  };
}

export function trainingReviewToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    assignmentId: String(row.assignment_id),
    studentId: String(row.student_id),
    revision: Number(row.revision),
    reviewerUserId: row.reviewer_user_id == null ? null : Number(row.reviewer_user_id),
    reviewerUserIdSnapshot: Number(row.reviewer_user_id_snapshot),
    reviewerDisplayNameSnapshot: String(row.reviewer_display_name_snapshot),
    reviewerRoleSnapshot: String(row.reviewer_role_snapshot),
    status: String(row.status),
    rating: row.rating == null ? null : Number(row.rating),
    feedback: String(row.feedback),
    createdAt: iso(row.created_at),
  };
}

export function selfTrainingAssignmentToJson(row: Record<string, unknown>): JsonObject {
  return {
    assignment: {
      id: String(row.assignment_id),
      organizationId: String(row.organization_id),
      templateVersionId: String(row.template_version_id),
      title: String(row.assignment_title),
      instructions: String(row.assignment_instructions),
      status: String(row.assignment_status),
      scheduleKind: String(row.schedule_kind),
      expectedCount: Number(row.expected_count),
      timezoneSnapshot: String(row.timezone_snapshot),
      startsAt: iso(row.starts_at),
      endsAt: row.ends_at == null ? null : iso(row.ends_at),
      publishedAt: row.published_at == null ? null : iso(row.published_at),
      closedAt: row.closed_at == null ? null : iso(row.closed_at),
      createdAt: iso(row.assignment_created_at),
      updatedAt: iso(row.assignment_updated_at),
    },
    target: {
      id: String(row.target_id),
      organizationId: String(row.organization_id),
      assignmentId: String(row.assignment_id),
      targetKind: 'student',
      groupId: null,
      sourceGroupId: row.source_group_id == null ? null : String(row.source_group_id),
      studentId: String(row.student_id),
      groupNameSnapshot: null,
      studentDisplayNameSnapshot: String(row.student_display_name_snapshot),
      studentExternalRefSnapshot: row.student_external_ref_snapshot == null
        ? null
        : String(row.student_external_ref_snapshot),
      evidenceCount: String(row.evidence_count),
      firstEvidenceAt: row.first_evidence_at == null ? null : iso(row.first_evidence_at),
      lastEvidenceAt: row.last_evidence_at == null ? null : iso(row.last_evidence_at),
      latestReviewRevision: Number(row.latest_review_revision),
      latestReviewStatus: row.latest_review_status == null ? null : String(row.latest_review_status),
    },
    template: {
      id: String(row.template_id),
      name: String(row.template_name),
    },
    templateVersion: {
      id: String(row.template_version_id),
      organizationId: String(row.organization_id),
      templateId: String(row.template_id),
      versionNumber: Number(row.version_number),
      title: String(row.version_title),
      instructions: String(row.version_instructions),
      source: String(row.source),
      activity: String(row.activity),
      toolConfig: row.tool_config as JsonObject,
      publishedAt: iso(row.version_published_at),
    },
    goals: (row.goals as Array<Record<string, unknown>>).map((goal) => ({
      id: String(goal.id),
      organizationId: String(row.organization_id),
      assignmentId: String(row.assignment_id),
      metricKey: String(goal.metricKey),
      operator: String(goal.operator),
      targetValue: Number(goal.targetValue),
    })),
  };
}

export function trainingEvidenceToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studentId: String(row.student_id),
    source: String(row.source),
    sourceEventId: String(row.source_event_id),
    trustLevel: String(row.trust_level),
    occurredAt: iso(row.occurred_at),
    timezoneSnapshot: String(row.timezone_snapshot),
    localDate: row.local_date instanceof Date
      ? row.local_date.toISOString().slice(0, 10)
      : String(row.local_date).slice(0, 10),
    activity: String(row.activity),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    resultMs: row.result_ms == null ? null : Number(row.result_ms),
    success: row.success == null ? null : Boolean(row.success),
    payloadVersion: Number(row.payload_version),
    createdAt: iso(row.created_at),
  };
}

export function selfTrainingEvidenceReceipt(row: Record<string, unknown>): JsonObject {
  const evidence = trainingEvidenceToJson(row);
  return {
    id: evidence.id,
    source: evidence.source,
    sourceEventId: evidence.sourceEventId,
    trustLevel: evidence.trustLevel,
    occurredAt: evidence.occurredAt,
    localDate: evidence.localDate,
    durationMs: evidence.durationMs,
    resultMs: evidence.resultMs,
    success: evidence.success,
    createdAt: evidence.createdAt,
  };
}
