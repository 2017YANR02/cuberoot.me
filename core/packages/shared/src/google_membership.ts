/** Only product metadata crosses the website bridge; purchase tokens stay in the native host. */
export const GOOGLE_MEMBERSHIP_PRODUCT_IDS = ['me.cuberoot.app.membership.monthly', 'me.cuberoot.app.membership.yearly'] as const;
export type GoogleMembershipProductId = typeof GOOGLE_MEMBERSHIP_PRODUCT_IDS[number];
export interface GoogleMembershipProduct { id: GoogleMembershipProductId; displayName: string; displayPrice: string }
export interface GoogleMembershipRequest {
  type: 'cuberoot:mobile:google-membership';
  surface: 'account' | 'tools';
  requestId: string;
  expectedUid: number;
  action: 'products' | 'purchase' | 'restore' | 'manage' | 'sync';
  productId?: GoogleMembershipProductId;
}
export interface GoogleMembershipResult {
  type: 'cuberoot:mobile:google-membership-result';
  requestId: string;
  status: 'success' | 'pending' | 'cancelled' | 'error';
  products?: GoogleMembershipProduct[];
}
export function decodeGoogleMembershipRequest(value: unknown): GoogleMembershipRequest | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<GoogleMembershipRequest>;
  if (v.type !== 'cuberoot:mobile:google-membership' || !['account', 'tools'].includes(v.surface ?? '')
    || typeof v.requestId !== 'string' || v.requestId.length < 8 || v.requestId.length > 128
    || !Number.isSafeInteger(v.expectedUid) || v.expectedUid! <= 0
    || !['products', 'purchase', 'restore', 'manage', 'sync'].includes(v.action ?? '')
    || (v.action === 'purchase' && !GOOGLE_MEMBERSHIP_PRODUCT_IDS.includes(v.productId!))) return null;
  return v as GoogleMembershipRequest;
}
export function decodeGoogleMembershipResult(value: unknown): GoogleMembershipResult | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<GoogleMembershipResult>;
  if (v.type !== 'cuberoot:mobile:google-membership-result' || typeof v.requestId !== 'string'
    || !['success', 'pending', 'cancelled', 'error'].includes(v.status ?? '')) return null;
  if (v.products && (!Array.isArray(v.products) || v.products.length > 2 || v.products.some(p =>
    !p || !GOOGLE_MEMBERSHIP_PRODUCT_IDS.includes(p.id) || typeof p.displayName !== 'string' || typeof p.displayPrice !== 'string'))) return null;
  return v as GoogleMembershipResult;
}
