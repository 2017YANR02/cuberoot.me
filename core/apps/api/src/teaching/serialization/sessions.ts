import { type JsonObject } from '../types.js';
import { actorSnapshotToJson } from './common.js';

export function attendanceToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.attendance_id ?? row.id),
    studentId: String(row.student_id),
    studentPackageId: row.student_package_id == null ? null : String(row.student_package_id),
    status: String(row.attendance_status ?? row.status),
    creditCost: Number(row.credit_cost),
    notes: row.notes == null ? null : String(row.notes),
    updatedAt: new Date(String(row.attendance_updated_at ?? row.updated_at)).toISOString(),
  };
}

export function leaveRequestToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    sessionId: String(row.session_id),
    attendanceId: String(row.attendance_id),
    studentId: String(row.student_id),
    status: String(row.status),
    reason: String(row.reason),
    decisionReason: row.decision_reason == null ? null : String(row.decision_reason),
    requestedBy: actorSnapshotToJson(row, 'requested_by'),
    decidedBy: actorSnapshotToJson(row, 'decided_by'),
    decidedAt: row.decided_at == null ? null : new Date(String(row.decided_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export function makeupAttemptToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    sourceSessionId: String(row.source_session_id),
    sourceAttendanceId: String(row.source_attendance_id),
    targetSessionId: String(row.target_session_id),
    targetAttendanceId: String(row.target_attendance_id),
    studentId: String(row.student_id),
    studentPackageId: String(row.student_package_id),
    creditCost: Number(row.credit_cost),
    status: String(row.status),
    reason: String(row.reason),
    createdBy: actorSnapshotToJson(row, 'created_by'),
    resolvedBy: actorSnapshotToJson(row, 'resolved_by'),
    resolutionReason: row.resolution_reason == null ? null : String(row.resolution_reason),
    resolvedAt: row.resolved_at == null ? null : new Date(String(row.resolved_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}
