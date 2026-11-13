import { sha256 } from '../encoding.js';
import { type Tx } from '../types.js';
import { ConcealedTeachingPermissionDeniedException, TeachingApiException } from '../errors.js';

export function refundLedgerIdempotencyKey(idempotencyKey: string): string {
  return `refund:v1:${sha256(idempotencyKey)}`;
}

export function reversalLedgerIdempotencyKey(ledgerId: string, idempotencyKey: string): string {
  return `reversal:v1:${ledgerId}:${sha256(idempotencyKey)}`;
}

export async function lockStudentPackageForCreditMutation(
  tx: Tx,
  organizationId: string,
  studentPackageId: string,
): Promise<Record<string, unknown>> {
  const packages = await tx`
    SELECT p.*
    FROM student_packages p
    WHERE p.organization_id = ${organizationId} AND p.id = ${studentPackageId}
    FOR UPDATE OF p`;
  if (packages.length) return packages[0] as Record<string, unknown>;

  const existing = await tx`
    SELECT organization_id
    FROM student_packages
    WHERE id = ${studentPackageId}`;
  if (existing.length && String(existing[0].organization_id) !== organizationId) {
    throw new ConcealedTeachingPermissionDeniedException('Student package not found');
  }
  throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student package not found');
}

export async function studentPackageCreditBalance(
  tx: Tx,
  organizationId: string,
  studentPackageId: string,
): Promise<number> {
  const rows = await tx`
    SELECT COALESCE(SUM(delta), 0)::bigint AS balance
    FROM lesson_credit_ledger
    WHERE organization_id = ${organizationId} AND student_package_id = ${studentPackageId}`;
  return Number(rows[0]?.balance ?? 0);
}
