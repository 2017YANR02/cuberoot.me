import { Status, Type, InAppOwnershipType, type JWSTransactionDecodedPayload, type JWSRenewalInfoDecodedPayload } from '@apple/app-store-server-library';
import { APPLE_MEMBERSHIP_PRODUCT_IDS } from '@cuberoot/shared/apple-membership';

export const APPLE_MEMBERSHIP_PRODUCTS = APPLE_MEMBERSHIP_PRODUCT_IDS;
export const APPLE_MEMBERSHIP_BUNDLE = 'me.cuberoot.app';
export const APPLE_MEMBERSHIP_APP_ID = 6816632957;
export function assertMembershipTransaction(t: JWSTransactionDecodedPayload): void {
  if (t.bundleId !== APPLE_MEMBERSHIP_BUNDLE || !APPLE_MEMBERSHIP_PRODUCTS.includes(t.productId as typeof APPLE_MEMBERSHIP_PRODUCTS[number])
    || t.type !== Type.AUTO_RENEWABLE_SUBSCRIPTION || t.inAppOwnershipType !== InAppOwnershipType.PURCHASED
    || !/^\d+$/.test(t.transactionId ?? '') || !/^\d+$/.test(t.originalTransactionId ?? '')
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.appAccountToken ?? '')
    || !Number.isSafeInteger(t.expiresDate) || !Number.isSafeInteger(t.signedDate)) {
    throw new Error('Invalid Apple membership transaction');
  }
}
/** Called only after both signatures and the current Apple API status are verified. */
export function appleMembershipExpiry(t: JWSTransactionDecodedPayload, r: JWSRenewalInfoDecodedPayload, status: number): number {
  assertMembershipTransaction(t);
  if (r.originalTransactionId !== t.originalTransactionId || r.environment !== t.environment
    || (r.appAccountToken && r.appAccountToken.toLowerCase() !== t.appAccountToken!.toLowerCase())) {
    throw new Error('Mismatched Apple renewal information');
  }
  if (![1, 2, 3, 4, 5].includes(status)) throw new Error('Unknown Apple subscription status');
  if (t.revocationDate || t.isUpgraded || (status !== Status.ACTIVE && status !== Status.BILLING_GRACE_PERIOD)) return 0;
  if (status === Status.BILLING_GRACE_PERIOD) {
    if (!Number.isSafeInteger(r.gracePeriodExpiresDate)) throw new Error('Missing Apple grace period');
    return Math.max(t.expiresDate!, r.gracePeriodExpiresDate!);
  }
  return t.expiresDate!;
}
