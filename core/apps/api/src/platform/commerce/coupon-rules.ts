import { badRequest } from '../errors.js';
import { resourceId, stringField, enumField, integerField, isoTimestampField, objectField } from '../validation.js';
import { type PricedItem } from './types.js';

export interface CouponDefinition {
  code: string;
  status: 'draft' | 'active' | 'paused' | 'expired' | 'archived';
  discountType: 'fixed' | 'percent';
  discountAmountMinor: number | null;
  discountBps: number | null;
  currency: string | null;
  minimumOrderAmountMinor: number;
  maxRedemptions: number | null;
  perUserLimit: number;
  startsAt: string | null;
  endsAt: string | null;
  eligibility: Record<string, unknown>;
}

const COUPON_ELIGIBILITY_LISTS = [
  'courseIds',
  'productIds',
  'productVariantIds',
  'eventIds',
  'eventTicketTypeIds',
  'membershipPlanIds',
] as const;

type CouponEligibilityList = typeof COUPON_ELIGIBILITY_LISTS[number];

type CouponEligibility = { memberOnly: boolean } & Record<CouponEligibilityList, string[]>;

export function couponEligibility(raw: Record<string, unknown>): CouponEligibility {
  const allowed = new Set<string>(['memberOnly', ...COUPON_ELIGIBILITY_LISTS]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) badRequest(`eligibility.${key} is unsupported`);
  }
  if (raw.memberOnly != null && typeof raw.memberOnly !== 'boolean') {
    badRequest('eligibility.memberOnly must be a boolean');
  }
  const result = { memberOnly: raw.memberOnly === true } as CouponEligibility;
  for (const key of COUPON_ELIGIBILITY_LISTS) {
    const value = raw[key];
    if (value == null) {
      result[key] = [];
      continue;
    }
    if (!Array.isArray(value) || value.length > 500) {
      badRequest(`eligibility.${key} must be an array with at most 500 items`);
    }
    result[key] = [...new Set(value.map((entry, index) => {
      if (typeof entry !== 'string') badRequest(`eligibility.${key}[${index}] must be a string`);
      return resourceId(entry, `eligibility.${key}[${index}]`);
    }))];
  }
  return result;
}

export function couponEligibleSubtotal(items: PricedItem[], eligibility: CouponEligibility, member: boolean): number {
  if (eligibility.memberOnly && !member) badRequest('Coupon is available to active members only');
  const hasResourceRules = COUPON_ELIGIBILITY_LISTS.some((key) => eligibility[key].length > 0);
  if (!hasResourceRules) return items.reduce((sum, item) => sum + item.amountMinor * item.quantity, 0);
  const eligible = items.reduce((sum, item) => {
    const snapshot = item.snapshot;
    const matches = (item.courseId != null && eligibility.courseIds.includes(item.courseId))
      || (item.productVariantId != null && eligibility.productVariantIds.includes(item.productVariantId))
      || (typeof snapshot.productId === 'string' && eligibility.productIds.includes(snapshot.productId))
      || (item.eventTicketTypeId != null && eligibility.eventTicketTypeIds.includes(item.eventTicketTypeId))
      || (typeof snapshot.eventId === 'string' && eligibility.eventIds.includes(snapshot.eventId))
      || (item.membershipPlanId != null && eligibility.membershipPlanIds.includes(item.membershipPlanId));
    return matches ? sum + item.amountMinor * item.quantity : sum;
  }, 0);
  if (eligible === 0) badRequest('Coupon does not apply to any order item');
  return eligible;
}

export function couponDefinition(body: Record<string, unknown>, current?: CouponDefinition): CouponDefinition {
  const merged = { status: 'draft', ...(current ?? {}), ...body };
  const code = stringField(merged, 'code', { required: true, min: 3, max: 64, pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/ })!.toUpperCase();
  const status = enumField(merged, 'status', ['draft', 'active', 'paused', 'expired', 'archived'] as const, { required: true })!;
  const discountType = enumField(merged, 'discountType', ['fixed', 'percent'] as const, { required: true })!;
  const discountAmountMinor = discountType === 'fixed'
    ? integerField(merged, 'discountAmountMinor', { required: true, min: 1 })!
    : null;
  const discountBps = discountType === 'percent'
    ? integerField(merged, 'discountBps', { required: true, min: 1, max: 10_000 })!
    : null;
  const currency = discountType === 'fixed'
    ? stringField(merged, 'currency', { required: true, max: 3, pattern: /^[A-Za-z]{3}$/ })!.toUpperCase()
    : null;
  const minimumOrderAmountMinor = integerField(merged, 'minimumOrderAmountMinor', { min: 0 }) ?? 0;
  const maxRedemptions = integerField(merged, 'maxRedemptions', { min: 1, max: 1_000_000_000 }) ?? null;
  const perUserLimit = integerField(merged, 'perUserLimit', { min: 1, max: 1_000_000 }) ?? 1;
  const startsAt = isoTimestampField(merged, 'startsAt') ?? null;
  const endsAt = isoTimestampField(merged, 'endsAt') ?? null;
  if (startsAt && endsAt && endsAt <= startsAt) badRequest('endsAt must be after startsAt');
  const eligibility = couponEligibility(objectField(merged, 'eligibility') ?? {});
  return { code, status, discountType, discountAmountMinor, discountBps, currency, minimumOrderAmountMinor, maxRedemptions, perUserLimit, startsAt, endsAt, eligibility };
}
