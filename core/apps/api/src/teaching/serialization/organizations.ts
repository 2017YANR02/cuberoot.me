import { type JsonObject } from '../types.js';
import { iso } from './common.js';

export function studentToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    accountUserId: row.account_user_id == null ? null : Number(row.account_user_id),
    externalRef: row.external_ref == null ? null : String(row.external_ref),
    displayName: String(row.display_name),
    status: String(row.status),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function campusToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    code: row.code == null ? null : String(row.code),
    name: String(row.name),
    timezone: row.timezone == null ? null : String(row.timezone),
    status: String(row.status),
    archivedAt: row.archived_at == null ? null : iso(row.archived_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function groupToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    campusId: row.campus_id == null ? null : String(row.campus_id),
    code: row.code == null ? null : String(row.code),
    name: String(row.name),
    status: String(row.status),
    archivedAt: row.archived_at == null ? null : iso(row.archived_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function membershipToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    groupId: String(row.group_id),
    effectiveFrom: iso(row.effective_from),
    effectiveTo: row.effective_to == null ? null : iso(row.effective_to),
    createdAt: iso(row.created_at),
    student: {
      id: String(row.student_id),
      displayName: String(row.student_display_name),
      externalRef: row.student_external_ref == null ? null : String(row.student_external_ref),
      status: String(row.student_status),
    },
  };
}

export function assignmentToJson(row: Record<string, unknown>): JsonObject {
  const liveUserId = row.teacher_user_id == null ? null : Number(row.teacher_user_id);
  return {
    id: String(row.id),
    teacherUserId: liveUserId,
    teacherUserIdSnapshot: Number(row.teacher_user_id_snapshot),
    groupId: row.group_id == null ? null : String(row.group_id),
    studentId: row.student_id == null ? null : String(row.student_id),
    effectiveFrom: iso(row.effective_from),
    effectiveTo: row.effective_to == null ? null : iso(row.effective_to),
    createdAt: iso(row.created_at),
    teacher: {
      userId: liveUserId,
      displayName: String(row.teacher_display_name_snapshot),
      role: String(row.teacher_role_snapshot),
      status: row.teacher_member_status == null ? null : String(row.teacher_member_status),
    },
  };
}
