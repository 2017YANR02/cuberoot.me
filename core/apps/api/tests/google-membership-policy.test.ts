import { describe, it, expect } from 'vitest';
import { googleMembershipGrant, type GoogleSubscription } from '../src/payment/google-membership-policy.js';
const now = Date.parse('2026-10-04T00:00:00Z');
const purchase: GoogleSubscription = { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  lineItems: [{ productId: 'me.cuberoot.app.membership.monthly', expiryTime: '2026-11-04T00:00:00Z', autoRenewingPlan: { autoRenewEnabled: true } }] };
describe('Google subscription entitlement policy', () => {
  it.each(['ACTIVE', 'IN_GRACE_PERIOD', 'CANCELED'])('%s retains the valid paid period', state => {
    expect(googleMembershipGrant({ ...purchase, subscriptionState: `SUBSCRIPTION_STATE_${state}` }, now).active).toBe(true);
  });
  it.each(['PENDING', 'PAUSED', 'ON_HOLD', 'EXPIRED', 'PENDING_PURCHASE_CANCELED'])('%s cannot grant membership', state => {
    expect(googleMembershipGrant({ ...purchase, subscriptionState: `SUBSCRIPTION_STATE_${state}` }, now).active).toBe(false);
  });
  it('does not resurrect an expired cancelled subscription', () => {
    expect(googleMembershipGrant({ ...purchase, subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' }, Date.parse('2026-12-01')).active).toBe(false);
  });
  it('rejects unknown products, states, multi-line items and malformed expiry', () => {
    for (const change of [{ subscriptionState: 'unknown' }, { lineItems: [] }, { lineItems: [purchase.lineItems![0], purchase.lineItems![0]] },
      { lineItems: [{ productId: 'other', expiryTime: '2027-01-01' }] }, { lineItems: [{ ...purchase.lineItems![0], expiryTime: 'broken' }] }]) {
      expect(() => googleMembershipGrant({ ...purchase, ...change }, now)).toThrow();
    }
  });
});
