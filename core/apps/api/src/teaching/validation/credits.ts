import { TEACHING_CREDIT_UNITS, type TeachingCreditUnit, TEACHING_PACKAGE_ACQUISITION_TYPES, type TeachingPackageAcquisitionType } from '@cuberoot/shared/teaching';
import { type JsonObject, type CreatePackageProductInput, type CreateStudentPackageInput, type CreateCreditRefundInput, type CreateCreditReversalInput } from '../types.js';
import { requiredString, requiredInteger, optionalString, requiredUuid, requiredTimestamp, assertOnlyKeys } from './common.js';
import { TeachingApiException } from '../errors.js';

export function parsePackageProductInput(body: JsonObject): CreatePackageProductInput {
  const code = requiredString(body, 'code', 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(code)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'code must use lowercase letters, numbers, underscores, or hyphens');
  }
  if (!TEACHING_CREDIT_UNITS.includes(body.creditUnit as TeachingCreditUnit)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'creditUnit must be lesson or minute');
  }
  const creditType = requiredString(body, 'creditType', 64).toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(creditType)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'creditType must be a normalized identifier');
  }
  const validityDays = body.validityDays == null
    ? null
    : requiredInteger(body, 'validityDays', 1, 36_500);
  const currency = requiredString(body, 'currency', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'currency must be a three-letter ISO currency code');
  }
  return {
    code,
    name: requiredString(body, 'name', 160),
    creditUnit: body.creditUnit as TeachingCreditUnit,
    creditType,
    totalCredits: requiredInteger(body, 'totalCredits', 1, 1_000_000),
    validityDays,
    priceAmountMinor: requiredInteger(body, 'priceAmountMinor', 0, Number.MAX_SAFE_INTEGER),
    currency,
  };
}

export function parseStudentPackageInput(body: JsonObject): CreateStudentPackageInput {
  if (!TEACHING_PACKAGE_ACQUISITION_TYPES.includes(body.acquisitionType as TeachingPackageAcquisitionType)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'acquisitionType must be purchase, grant, or migration');
  }
  const sourceSystem = optionalString(body, 'sourceSystem', 64);
  const sourceRef = optionalString(body, 'sourceRef', 160);
  const sourceLineRef = optionalString(body, 'sourceLineRef', 160);
  if ((sourceSystem === null) !== (sourceRef === null) || (sourceLineRef !== null && sourceSystem === null)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'sourceSystem and sourceRef must be provided together');
  }
  return {
    productId: requiredUuid(body, 'productId'),
    acquisitionType: body.acquisitionType as TeachingPackageAcquisitionType,
    validFrom: body.validFrom === undefined ? new Date().toISOString() : requiredTimestamp(body, 'validFrom'),
    sourceSystem,
    sourceRef,
    sourceLineRef,
  };
}

export function parseCreditRefundInput(body: JsonObject): CreateCreditRefundInput {
  assertOnlyKeys(
    body,
    ['credits', 'reason', 'sourceSystem', 'sourceRef', 'sourceLineRef'],
    'credit refund input',
  );
  return {
    credits: requiredInteger(body, 'credits', 1, 1_000_000),
    reason: requiredString(body, 'reason', 500),
    sourceSystem: requiredString(body, 'sourceSystem', 64),
    sourceRef: requiredString(body, 'sourceRef', 160),
    sourceLineRef: optionalString(body, 'sourceLineRef', 160),
  };
}

export function parseCreditReversalInput(body: JsonObject): CreateCreditReversalInput {
  assertOnlyKeys(body, ['reason'], 'credit reversal input');
  return { reason: requiredString(body, 'reason', 500) };
}
