import {
  TEACHING_PACKAGE_PRODUCT_STATUSES,
  TEACHING_CREDIT_UNITS,
  TEACHING_STUDENT_PACKAGE_STATUSES,
  TEACHING_PACKAGE_ACQUISITION_TYPES,
  type TeachingCreditLedgerEntry,
  TEACHING_CREDIT_LEDGER_ENTRY_TYPES,
  type TeachingCreditAdjustment,
  type TeachingCreditUnit,
  type TeachingPackageAcquisitionType,
} from '@cuberoot/shared/teaching';
import {
  type TeachingPackageProduct,
  type TeachingStudentPackage,
  type TeachingCreditLedgerMutationResult,
  type TeachingPage,
} from './types';
import {
  record,
  string,
  enumValue,
  integer,
  exactRecord,
  nullableString,
  positiveBigIntString,
  jsonValue,
  isoTimestamp,
} from './validation';
import { TeachingApiError } from './errors';
import {
  exactPage,
  orgPath,
  pageQuery,
  page,
} from './pagination';
import { request, post } from './transport';

function packageProduct(value: unknown): TeachingPackageProduct {
  const item = record(value, 'packageProduct');
  return {
    id: string(item.id, 'packageProduct.id'),
    code: string(item.code, 'packageProduct.code'),
    name: string(item.name, 'packageProduct.name'),
    status: enumValue(item.status, TEACHING_PACKAGE_PRODUCT_STATUSES, 'packageProduct.status'),
    creditUnit: enumValue(item.creditUnit, TEACHING_CREDIT_UNITS, 'packageProduct.creditUnit'),
    creditType: string(item.creditType, 'packageProduct.creditType'),
    totalCredits: integer(item.totalCredits, 'packageProduct.totalCredits', 1),
    validityDays: item.validityDays === null ? null : integer(item.validityDays, 'packageProduct.validityDays', 1),
    priceAmountMinor: integer(item.priceAmountMinor, 'packageProduct.priceAmountMinor'),
    currency: string(item.currency, 'packageProduct.currency'),
    createdAt: string(item.createdAt, 'packageProduct.createdAt'),
    updatedAt: string(item.updatedAt, 'packageProduct.updatedAt'),
  };
}

function studentPackage(value: unknown): TeachingStudentPackage {
  const item = exactRecord(
    value,
    [
      'id', 'studentId', 'productId', 'productCode', 'productName', 'creditUnit', 'creditType',
      'entitledCredits', 'remainingCredits', 'validityDays', 'priceAmountMinor', 'currency',
      'status', 'acquisitionType', 'validFrom', 'validUntil', 'sourceSystem', 'sourceRef',
      'sourceLineRef', 'createdAt',
    ],
    'studentPackage',
  );
  return {
    id: string(item.id, 'studentPackage.id'),
    studentId: string(item.studentId, 'studentPackage.studentId'),
    productId: string(item.productId, 'studentPackage.productId'),
    productCode: string(item.productCode, 'studentPackage.productCode'),
    productName: string(item.productName, 'studentPackage.productName'),
    creditUnit: enumValue(item.creditUnit, TEACHING_CREDIT_UNITS, 'studentPackage.creditUnit'),
    creditType: string(item.creditType, 'studentPackage.creditType'),
    entitledCredits: integer(item.entitledCredits, 'studentPackage.entitledCredits', 1),
    remainingCredits: integer(item.remainingCredits, 'studentPackage.remainingCredits'),
    validityDays: item.validityDays === null ? null : integer(item.validityDays, 'studentPackage.validityDays', 1),
    priceAmountMinor: integer(item.priceAmountMinor, 'studentPackage.priceAmountMinor'),
    currency: string(item.currency, 'studentPackage.currency'),
    status: enumValue(item.status, TEACHING_STUDENT_PACKAGE_STATUSES, 'studentPackage.status'),
    acquisitionType: enumValue(item.acquisitionType, TEACHING_PACKAGE_ACQUISITION_TYPES, 'studentPackage.acquisitionType'),
    validFrom: string(item.validFrom, 'studentPackage.validFrom'),
    validUntil: nullableString(item.validUntil, 'studentPackage.validUntil'),
    sourceSystem: nullableString(item.sourceSystem, 'studentPackage.sourceSystem'),
    sourceRef: nullableString(item.sourceRef, 'studentPackage.sourceRef'),
    sourceLineRef: nullableString(item.sourceLineRef, 'studentPackage.sourceLineRef'),
    createdAt: string(item.createdAt, 'studentPackage.createdAt'),
  };
}

function creditLedgerEntry(value: unknown): TeachingCreditLedgerEntry {
  const item = exactRecord(
    value,
    [
      'id', 'studentId', 'entryType', 'delta', 'attendanceId', 'sessionId', 'sourceSystem',
      'sourceRef', 'sourceLineRef', 'reversalOfLedgerId', 'reversedByLedgerId', 'reason',
      'actorRole', 'actorDisplayName', 'metadata', 'createdAt',
    ],
    'ledgerEntry',
  );
  const parsed: TeachingCreditLedgerEntry = {
    id: positiveBigIntString(item.id, 'ledgerEntry.id'),
    studentId: string(item.studentId, 'ledgerEntry.studentId'),
    entryType: enumValue(item.entryType, TEACHING_CREDIT_LEDGER_ENTRY_TYPES, 'ledgerEntry.entryType'),
    delta: integer(item.delta, 'ledgerEntry.delta', -1_000_000),
    attendanceId: nullableString(item.attendanceId, 'ledgerEntry.attendanceId'),
    sessionId: nullableString(item.sessionId, 'ledgerEntry.sessionId'),
    sourceSystem: nullableString(item.sourceSystem, 'ledgerEntry.sourceSystem'),
    sourceRef: nullableString(item.sourceRef, 'ledgerEntry.sourceRef'),
    sourceLineRef: nullableString(item.sourceLineRef, 'ledgerEntry.sourceLineRef'),
    reversalOfLedgerId: item.reversalOfLedgerId === null
      ? null
      : positiveBigIntString(item.reversalOfLedgerId, 'ledgerEntry.reversalOfLedgerId'),
    reversedByLedgerId: item.reversedByLedgerId === null
      ? null
      : positiveBigIntString(item.reversedByLedgerId, 'ledgerEntry.reversedByLedgerId'),
    reason: string(item.reason, 'ledgerEntry.reason'),
    actorRole: string(item.actorRole, 'ledgerEntry.actorRole'),
    actorDisplayName: string(item.actorDisplayName, 'ledgerEntry.actorDisplayName'),
    metadata: jsonValue(item.metadata, 'ledgerEntry.metadata'),
    createdAt: isoTimestamp(item.createdAt, 'ledgerEntry.createdAt'),
  };

  const hasSourcePair = parsed.sourceSystem !== null && parsed.sourceRef !== null;
  const hasNoSource = parsed.sourceSystem === null
    && parsed.sourceRef === null
    && parsed.sourceLineRef === null;
  const sourcesAreCanonical = (
    (parsed.sourceSystem === null || (
      parsed.sourceSystem.length >= 1
      && parsed.sourceSystem.length <= 64
      && parsed.sourceSystem.trim() === parsed.sourceSystem
    ))
    && (parsed.sourceRef === null || (
      parsed.sourceRef.length >= 1
      && parsed.sourceRef.length <= 160
      && parsed.sourceRef.trim() === parsed.sourceRef
    ))
    && (parsed.sourceLineRef === null || (
      parsed.sourceLineRef.length >= 1
      && parsed.sourceLineRef.length <= 160
      && parsed.sourceLineRef.trim() === parsed.sourceLineRef
    ))
  );
  const reasonIsCanonical = parsed.reason.length >= 1
    && parsed.reason.length <= 500
    && parsed.reason.trim() === parsed.reason;
  if (
    parsed.delta === 0
    || parsed.delta > 1_000_000
    || (parsed.sourceSystem === null) !== (parsed.sourceRef === null)
    || (parsed.sourceLineRef !== null && !hasSourcePair)
    || !sourcesAreCanonical
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'ledgerEntry response is invalid');
  }

  const hasAttendance = parsed.attendanceId !== null;
  const hasSession = parsed.sessionId !== null;
  const hasReversalTarget = parsed.reversalOfLedgerId !== null;
  const standardShape = !hasAttendance && !hasSession && !hasReversalTarget;
  const validEntryShape = (
    ((parsed.entryType === 'purchase' || parsed.entryType === 'grant') && parsed.delta > 0 && standardShape)
    || (parsed.entryType === 'consume' && parsed.delta < 0 && hasAttendance && hasSession && !hasReversalTarget)
    || (parsed.entryType === 'refund' && parsed.delta < 0 && standardShape && hasSourcePair && reasonIsCanonical)
    || (parsed.entryType === 'adjustment' && standardShape)
    || (parsed.entryType === 'expiration' && parsed.delta < 0 && standardShape)
    || (parsed.entryType === 'reversal' && parsed.delta !== 0 && !hasAttendance && !hasSession && hasReversalTarget && hasNoSource && reasonIsCanonical)
  );
  if (!validEntryShape) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'ledgerEntry response is invalid');
  }
  return parsed;
}

function creditAdjustment(value: unknown): TeachingCreditAdjustment {
  const item = exactRecord(value, ['ledgerEntry', 'student', 'studentPackage'], 'creditAdjustment');
  const adjustmentStudent = exactRecord(item.student, ['id', 'displayName'], 'creditAdjustment.student');
  const adjustmentPackage = exactRecord(
    item.studentPackage,
    ['id', 'productCode', 'productName', 'creditUnit', 'creditType'],
    'creditAdjustment.studentPackage',
  );
  const ledgerEntry = creditLedgerEntry(item.ledgerEntry);
  const studentId = string(adjustmentStudent.id, 'creditAdjustment.student.id');
  if (
    ledgerEntry.studentId !== studentId
    || !(['adjustment', 'refund', 'reversal', 'expiration'] as const).includes(
      ledgerEntry.entryType as 'adjustment' | 'refund' | 'reversal' | 'expiration',
    )
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'creditAdjustment response is invalid');
  }
  return {
    ledgerEntry,
    student: {
      id: studentId,
      displayName: string(adjustmentStudent.displayName, 'creditAdjustment.student.displayName'),
    },
    studentPackage: {
      id: string(adjustmentPackage.id, 'creditAdjustment.studentPackage.id'),
      productCode: string(adjustmentPackage.productCode, 'creditAdjustment.studentPackage.productCode'),
      productName: string(adjustmentPackage.productName, 'creditAdjustment.studentPackage.productName'),
      creditUnit: enumValue(
        adjustmentPackage.creditUnit,
        TEACHING_CREDIT_UNITS,
        'creditAdjustment.studentPackage.creditUnit',
      ),
      creditType: string(adjustmentPackage.creditType, 'creditAdjustment.studentPackage.creditType'),
    },
  };
}

function creditLedgerMutationResult(value: unknown): TeachingCreditLedgerMutationResult {
  const envelope = exactRecord(value, ['ledgerEntry', 'studentPackage'], 'credit ledger mutation');
  return {
    ledgerEntry: creditLedgerEntry(envelope.ledgerEntry),
    studentPackage: studentPackage(envelope.studentPackage),
  };
}

export async function listTeachingCreditAdjustments(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingCreditAdjustment>> {
  return exactPage(
    await request(orgPath(orgSlug, `/operations/credit-adjustments${pageQuery(pageNumber, pageSize)}`)),
    'creditAdjustments',
    creditAdjustment,
  );
}

export async function listTeachingPackageProducts(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingPackageProduct>> {
  return page(await request(orgPath(orgSlug, `/package-products${pageQuery(pageNumber, pageSize)}`)), 'packageProducts', packageProduct);
}

export async function createTeachingPackageProduct(
  orgSlug: string,
  input: {
    code: string;
    name: string;
    creditUnit: TeachingCreditUnit;
    creditType: string;
    totalCredits: number;
    validityDays: number | null;
    priceAmountMinor: number;
    currency: string;
  },
  idempotencyKey: string,
): Promise<TeachingPackageProduct> {
  const envelope = record(await post(orgPath(orgSlug, '/package-products'), input, idempotencyKey), 'package product create');
  return packageProduct(envelope.packageProduct);
}

export async function listTeachingStudentPackages(
  orgSlug: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingStudentPackage>> {
  return page(
    await request(orgPath(orgSlug, `/students/${encodeURIComponent(studentId)}/packages${pageQuery(pageNumber, pageSize)}`)),
    'studentPackages',
    studentPackage,
  );
}

export async function createTeachingStudentPackage(
  orgSlug: string,
  studentId: string,
  input: {
    productId: string;
    acquisitionType: TeachingPackageAcquisitionType;
    validFrom?: string;
    sourceSystem?: string | null;
    sourceRef?: string | null;
    sourceLineRef?: string | null;
  },
  idempotencyKey: string,
): Promise<TeachingStudentPackage> {
  const envelope = record(
    await post(orgPath(orgSlug, `/students/${encodeURIComponent(studentId)}/packages`), input, idempotencyKey),
    'student package create',
  );
  return studentPackage(envelope.studentPackage);
}

export async function listTeachingStudentPackageLedger(
  orgSlug: string,
  studentPackageId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingCreditLedgerEntry>> {
  return exactPage(
    await request(orgPath(orgSlug, `/student-packages/${encodeURIComponent(studentPackageId)}/ledger${pageQuery(pageNumber, pageSize)}`)),
    'ledger',
    creditLedgerEntry,
  );
}

export async function refundTeachingStudentPackage(
  orgSlug: string,
  studentPackageId: string,
  input: {
    credits: number;
    reason: string;
    sourceSystem: string;
    sourceRef: string;
    sourceLineRef: string | null;
  },
  idempotencyKey: string,
): Promise<TeachingCreditLedgerMutationResult> {
  const result = creditLedgerMutationResult(await post(
    orgPath(orgSlug, `/student-packages/${encodeURIComponent(studentPackageId)}/refunds`),
    input,
    idempotencyKey,
  ));
  if (
    result.studentPackage.id !== studentPackageId
    || result.studentPackage.studentId !== result.ledgerEntry.studentId
    || result.ledgerEntry.entryType !== 'refund'
    || result.ledgerEntry.delta !== -input.credits
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'credit refund response is invalid');
  }
  return result;
}

export async function reverseTeachingCreditLedgerEntry(
  orgSlug: string,
  studentPackageId: string,
  ledgerId: string,
  input: { reason: string },
  idempotencyKey: string,
): Promise<TeachingCreditLedgerMutationResult> {
  const result = creditLedgerMutationResult(await post(
    orgPath(
      orgSlug,
      `/student-packages/${encodeURIComponent(studentPackageId)}/ledger/${encodeURIComponent(ledgerId)}/reversal`,
    ),
    input,
    idempotencyKey,
  ));
  if (
    result.studentPackage.id !== studentPackageId
    || result.studentPackage.studentId !== result.ledgerEntry.studentId
    || result.ledgerEntry.entryType !== 'reversal'
    || result.ledgerEntry.reversalOfLedgerId !== ledgerId
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'credit reversal response is invalid');
  }
  return result;
}
