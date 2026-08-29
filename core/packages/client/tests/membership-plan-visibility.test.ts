import { describe, expect, it } from 'vitest';
import { reconcileVisiblePlan, type MembershipPlan } from '@/lib/membership-api';

function plan(slug: string, active: boolean, sort: number, priceCents: number): MembershipPlan {
  return {
    slug,
    active,
    sort,
    priceCents,
    nameZh: slug,
    nameEn: slug,
    period: 'month',
    periodCount: 1,
    currency: 'CNY',
    perks: [],
  };
}

describe('membership plan visibility', () => {
  it('removes a hidden plan from the public cards', () => {
    expect(reconcileVisiblePlan(
      [plan('monthly', true, 10, 1999), plan('yearly', true, 20, 9900)],
      plan('monthly', false, 10, 1999),
    ).map((item) => item.slug)).toEqual(['yearly']);
  });

  it('restores a visible plan in canonical order without duplication', () => {
    expect(reconcileVisiblePlan(
      [plan('yearly', true, 20, 9900)],
      plan('monthly', true, 10, 1999),
    ).map((item) => item.slug)).toEqual(['monthly', 'yearly']);
  });
});
