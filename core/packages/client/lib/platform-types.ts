export type PlatformLocaleText = Readonly<{ zh: string; en: string }>;

export type PlatformArea =
  | 'discover'
  | 'learning'
  | 'community'
  | 'commerce'
  | 'account'
  | 'instructor'
  | 'organization'
  | 'admin';

export type PlatformAccess = 'public' | 'account' | 'instructor' | 'admin';
export type PlatformViewKind = 'landing' | 'collection' | 'detail' | 'form' | 'dashboard' | 'canonical';

export type PlatformResource =
  | 'search'
  | 'leaderboard'
  | 'teachers'
  | 'community'
  | 'community-circle'
  | 'community-post'
  | 'notifications'
  | 'membership-plans'
  | 'account-memberships'
  | 'entitlements'
  | 'courses'
  | 'course-lesson'
  | 'paths'
  | 'events'
  | 'news'
  | 'products'
  | 'orders'
  | 'certificate'
  | 'qr'
  | 'account-courses'
  | 'account-badges'
  | 'account-favorites'
  | 'account-notes'
  | 'account-wishlist'
  | 'account-invites'
  | 'account-progress'
  | 'account-privacy'
  | 'shipping-addresses'
  | 'instructor-courses'
  | 'instructor-application'
  | 'instructor-students'
  | 'instructor-earnings'
  | 'admin-algorithms'
  | 'admin-applications'
  | 'admin-coupons'
  | 'admin-courses'
  | 'admin-paths'
  | 'admin-events'
  | 'admin-analytics'
  | 'admin-logs'
  | 'admin-payouts'
  | 'admin-teachers'
  | 'admin-invites'
  | 'admin-news'
  | 'admin-community'
  | 'admin-orders'
  | 'admin-reconcile'
  | 'admin-products'
  | 'admin-qr';

export interface PlatformRouteDefinition {
  id: string;
  pattern: string;
  area: PlatformArea;
  access: PlatformAccess;
  kind: PlatformViewKind;
  title: PlatformLocaleText;
  description: PlatformLocaleText;
  resource?: PlatformResource;
  canonicalHref?: string;
  canonicalLabel?: PlatformLocaleText;
  actions?: readonly PlatformActionId[];
}

export interface PlatformRouteMatch {
  definition: PlatformRouteDefinition;
  params: Record<string, string>;
}

export interface PlatformEntity {
  id: string;
  title: string;
  summary?: string | null;
  status?: string | null;
  href?: string | null;
  eyebrow?: string | null;
  updatedAt?: string | null;
  fields?: ReadonlyArray<{ label: string; value: string }>;
  /** Original resource payload for domain-specific views and edit defaults. */
  data?: Readonly<Record<string, unknown>>;
}

export interface PlatformResourceResult {
  items: PlatformEntity[];
  total?: number;
  nextCursor?: string | null;
}

export type PlatformActionId =
  | 'favorite'
  | 'wishlist'
  | 'save-note'
  | 'delete-note'
  | 'update-progress'
  | 'submit-quiz'
  | 'enroll'
  | 'create-order'
  | 'start-payment'
  | 'cancel-order'
  | 'apply-instructor'
  | 'save-instructor-course'
  | 'delete-course'
  | 'save-course-lesson'
  | 'delete-course-lesson'
  | 'save-course-quiz'
  | 'delete-course-quiz'
  | 'issue-certificate'
  | 'submit-review'
  | 'check-in'
  | 'save-shipping-address'
  | 'delete-shipping-address'
  | 'admin-save'
  | 'admin-delete'
  | 'admin-review'
  | 'admin-payout'
  | 'admin-payout-generate'
  | 'admin-payout-approve'
  | 'redeem-invite'
  | 'admin-invite-batch'
  | 'admin-invite-order'
  | 'admin-invite-revoke'
  | 'qr-duplicate'
  | 'qr-card-job'
  | 'qr-toggle'
  | 'qr-template-restore'
  | 'qr-template-purge'
  | 'qr-template-reorder'
  | 'admin-refund'
  | 'admin-ship-order-item'
  | 'admin-deliver-order-item'
  | 'admin-return-order-item'
  | 'admin-reconcile-run'
  | 'admin-reconcile'
  | 'save-privacy-consent';

export type PlatformPrivacyConsentPurpose = 'analytics' | 'marketing';
export type PlatformPrivacyConsentStatus = 'granted' | 'denied' | 'withdrawn';

export interface PlatformPrivacyConsent {
  id: string;
  purpose: PlatformPrivacyConsentPurpose;
  status: PlatformPrivacyConsentStatus;
  policyVersion: string;
  source: string;
  decidedAt: string;
  expiresAt: string | null;
}

export interface PlatformPrivacyConsentWrite {
  purpose: PlatformPrivacyConsentPurpose;
  status: PlatformPrivacyConsentStatus;
  policyVersion: string;
  source?: string;
  expiresAt?: string;
}

export interface PlatformActionInput {
  action: PlatformActionId;
  resourceId?: string;
  payload?: Record<string, unknown>;
}

export interface PlatformActionResult {
  ok?: boolean;
  message?: string;
  entity?: PlatformEntity;
  id?: string;
  status?: string;
  orderId?: string;
  itemId?: string;
  type?: 'ship' | 'deliver' | 'return';
  quantity?: number;
  externalReference?: string;
  orderStatus?: string;
  provider?: 'wechat' | 'alipay';
  expiresAt?: string;
  checkoutUrl?: string;
  qrCodeDataUrl?: string;
  batchReference?: string;
  count?: number;
  codes?: Array<{ id: string; code: string }>;
}

export interface PlatformPaymentAttemptResult extends PlatformActionResult {
  id: string;
  provider: 'wechat' | 'alipay';
  status: 'pending';
  expiresAt: string;
}

export interface PlatformMembershipPlan {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
  periodUnit: 'day' | 'month' | 'year' | 'lifetime';
  periodCount: number;
  amountMinor: number;
  currency: string;
  status: 'active';
}

export interface PlatformMembership {
  id: string;
  planId: string;
  planSlug: string;
  planNameZh: string;
  planNameEn: string;
  status: 'active' | 'expired' | 'cancelled' | 'revoked';
  isActive: boolean;
  validFrom: string;
  validUntil: string | null;
}

export function isPlatformPaymentAttemptResult(value: PlatformActionResult): value is PlatformPaymentAttemptResult {
  return typeof value.id === 'string'
    && (value.provider === 'wechat' || value.provider === 'alipay')
    && value.status === 'pending'
    && typeof value.expiresAt === 'string';
}
