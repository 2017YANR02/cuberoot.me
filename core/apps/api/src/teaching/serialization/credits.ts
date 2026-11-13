import { type JsonObject, type JsonValue } from '../types.js';
import { iso } from './common.js';

export function studentPackageToJson(row: Record<string, unknown>, remainingCredits: number): JsonObject {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    productId: String(row.product_id),
    productCode: String(row.product_code_snapshot),
    productName: String(row.product_name_snapshot),
    creditUnit: String(row.credit_unit),
    creditType: String(row.credit_type),
    entitledCredits: Number(row.entitled_credits),
    remainingCredits,
    validityDays: row.validity_days_snapshot == null ? null : Number(row.validity_days_snapshot),
    priceAmountMinor: Number(row.price_amount_minor),
    currency: String(row.currency),
    status: String(row.lifecycle_status),
    acquisitionType: String(row.acquisition_type),
    validFrom: iso(row.valid_from),
    validUntil: row.valid_until == null ? null : iso(row.valid_until),
    sourceSystem: row.source_system == null ? null : String(row.source_system),
    sourceRef: row.source_ref == null ? null : String(row.source_ref),
    sourceLineRef: row.source_line_ref == null ? null : String(row.source_line_ref),
    createdAt: iso(row.created_at),
  };
}

export function creditLedgerEntryToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    entryType: String(row.entry_type),
    delta: Number(row.delta),
    attendanceId: row.attendance_id == null ? null : String(row.attendance_id),
    sessionId: row.session_id == null ? null : String(row.session_id),
    sourceSystem: row.source_system == null ? null : String(row.source_system),
    sourceRef: row.source_ref == null ? null : String(row.source_ref),
    sourceLineRef: row.source_line_ref == null ? null : String(row.source_line_ref),
    reversalOfLedgerId: row.reversal_of_ledger_id == null ? null : String(row.reversal_of_ledger_id),
    reversedByLedgerId: row.reversed_by_ledger_id == null ? null : String(row.reversed_by_ledger_id),
    reason: String(row.reason),
    actorRole: String(row.actor_role),
    actorDisplayName: String(row.actor_display_name),
    metadata: row.metadata as JsonValue,
    createdAt: iso(row.created_at),
  };
}

export function creditAdjustmentToJson(row: Record<string, unknown>): JsonObject {
  return {
    ledgerEntry: creditLedgerEntryToJson(row),
    student: {
      id: String(row.student_id),
      displayName: String(row.student_display_name),
    },
    studentPackage: {
      id: String(row.student_package_id),
      productCode: String(row.product_code_snapshot),
      productName: String(row.product_name_snapshot),
      creditUnit: String(row.credit_unit),
      creditType: String(row.credit_type),
    },
  };
}
