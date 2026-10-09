/** Website / installed-host purchase bridge. Credentials and Apple JWS never cross it. */
export const APPLE_MEMBERSHIP_PRODUCT_IDS = ['me.cuberoot.app.membership.monthly', 'me.cuberoot.app.membership.yearly'] as const;
export type AppleMembershipProductId = typeof APPLE_MEMBERSHIP_PRODUCT_IDS[number];
export interface AppleMembershipProduct { id: AppleMembershipProductId; displayName: string; displayPrice: string }
export interface AppleMembershipRequest {
  type: 'cuberoot:mobile:apple-membership';
  surface: 'account' | 'tools';
  requestId: string;
  expectedUid: number;
  action: 'products' | 'purchase' | 'restore' | 'manage' | 'sync';
  productId?: AppleMembershipProductId;
}
export interface AppleMembershipResult {
  type: 'cuberoot:mobile:apple-membership-result';
  requestId: string;
  status: 'success' | 'pending' | 'cancelled' | 'error';
  products?: AppleMembershipProduct[];
}
export function decodeAppleMembershipRequest(value: unknown): AppleMembershipRequest | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<AppleMembershipRequest>;
  if (v.type !== 'cuberoot:mobile:apple-membership' || !['account','tools'].includes(v.surface ?? '')
    || typeof v.requestId !== 'string' || v.requestId.length < 8 || v.requestId.length > 128
    || !Number.isSafeInteger(v.expectedUid) || v.expectedUid! <= 0
    || !['products','purchase','restore','manage','sync'].includes(v.action ?? '')
    || (v.action === 'purchase' && !APPLE_MEMBERSHIP_PRODUCT_IDS.includes(v.productId!))) return null;
  return v as AppleMembershipRequest;
}
export function decodeAppleMembershipResult(value: unknown): AppleMembershipResult | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<AppleMembershipResult>;
  if (v.type !== 'cuberoot:mobile:apple-membership-result' || typeof v.requestId !== 'string'
    || !['success','pending','cancelled','error'].includes(v.status ?? '')) return null;
  if (v.products && (!Array.isArray(v.products) || v.products.length > 2 || v.products.some(p =>
    !p || !APPLE_MEMBERSHIP_PRODUCT_IDS.includes(p.id) || typeof p.displayName !== 'string' || typeof p.displayPrice !== 'string'))) return null;
  return v as AppleMembershipResult;
}
