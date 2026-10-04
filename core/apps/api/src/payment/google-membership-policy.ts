import { GOOGLE_MEMBERSHIP_PRODUCT_IDS } from '@cuberoot/shared/google-membership';

export const GOOGLE_MEMBERSHIP_PACKAGE = 'me.cuberoot.app';
export interface GoogleSubscription {
  subscriptionState?: string;
  acknowledgementState?: string;
  linkedPurchaseToken?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  testPurchase?: object;
  lineItems?: { productId?: string; expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled?: boolean }; offerDetails?: { basePlanId?: string } }[];
}
/** Input must come from subscriptionsv2.get, never from client purchase JSON or RTDN fields. */
export function googleMembershipGrant(purchase: GoogleSubscription, now = Date.now()) {
  const states = ['SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_PAUSED',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_ON_HOLD', 'SUBSCRIPTION_STATE_CANCELED',
    'SUBSCRIPTION_STATE_EXPIRED', 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'];
  if (!states.includes(purchase.subscriptionState ?? '') || purchase.lineItems?.length !== 1) throw new Error('Invalid Google subscription');
  const item = purchase.lineItems[0];
  if (!GOOGLE_MEMBERSHIP_PRODUCT_IDS.includes(item.productId as typeof GOOGLE_MEMBERSHIP_PRODUCT_IDS[number])) throw new Error('Unknown Google product');
  const pending = purchase.subscriptionState === 'SUBSCRIPTION_STATE_PENDING' || purchase.subscriptionState === 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED';
  const expiry = item.expiryTime ? Date.parse(item.expiryTime) : 0;
  if (!pending && (!Number.isFinite(expiry) || expiry <= 0)) throw new Error('Missing Google expiry');
  const eligible = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'].includes(purchase.subscriptionState!);
  return { productId: item.productId!, expiry: Number.isFinite(expiry) ? expiry : 0,
    active: eligible && expiry > now, autoRenew: item.autoRenewingPlan?.autoRenewEnabled === true, pending };
}
