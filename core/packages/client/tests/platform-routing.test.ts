import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  executePlatformAction,
  loadPlatformLessonMedia,
  loadPlatformMembershipPlans,
  loadPlatformMemberships,
  loadPlatformPrivacyConsents,
  loadPlatformResource,
  PLATFORM_PRIVACY_POLICY_VERSION,
  PLATFORM_ACTION_LABELS,
} from '@/lib/platform-gateway';
import {
  fillPlatformParams,
  matchPlatformRoute,
  PLATFORM_NAV,
  PLATFORM_ROUTES,
} from '@/lib/platform-routes';
import { isPlatformPaymentAttemptResult } from '@/lib/platform-types';
import type {
  PlatformActionId,
  PlatformActionInput,
  PlatformResource,
  PlatformRouteDefinition,
} from '@/lib/platform-types';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const manifest = JSON.parse(readFileSync(join(REPO, 'docs', 'platform-capability-manifest.json'), 'utf8')) as {
  capabilities: Array<{ kind: string; mappings: [string, string][] }>;
};

function segmentsForTarget(target: string): string[] {
  return target
    .replace(/^\/platform\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => /^\[[^\]]+\]$/.test(part) ? 'sample-id' : part);
}

function response(body: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestPath(input: RequestInfo | URL): string {
  return new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).pathname
    + new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).search;
}

const defaultRoute = PLATFORM_ROUTES.find((route) => route.id === 'course-detail')!;
const routeById = (id: string): PlatformRouteDefinition => PLATFORM_ROUTES.find((route) => route.id === id)!;

interface ActionContract {
  action: PlatformActionId;
  route?: string;
  input?: Omit<PlatformActionInput, 'action'>;
  method: string;
  path: string;
  body?: Record<string, unknown>;
}

const actionContracts: ActionContract[] = [
  { action: 'favorite', input: { resourceId: 'resource id', payload: { targetType: 'course', active: true } }, method: 'PUT', path: '/v1/platform/me/favorites/resource%20id' },
  { action: 'wishlist', input: { resourceId: 'resource id', payload: { active: true } }, method: 'PUT', path: '/v1/platform/me/wishlist/resource%20id' },
  { action: 'save-note', input: { resourceId: 'lesson id', payload: { contentMarkdown: 'note' } }, method: 'PUT', path: '/v1/platform/me/notes/lesson%20id' },
  { action: 'delete-note', input: { resourceId: 'note id' }, method: 'DELETE', path: '/v1/platform/me/notes/note%20id' },
  { action: 'update-progress', input: { resourceId: 'lesson id', payload: { progressPercent: 50 } }, method: 'PUT', path: '/v1/platform/me/progress/lesson%20id' },
  { action: 'submit-quiz', input: { resourceId: 'lesson id', payload: { quizId: 'quiz-1', answers: { question1: ['choice1'] } } }, method: 'POST', path: '/v1/platform/learning/lessons/lesson%20id/quiz' },
  { action: 'enroll', input: { resourceId: 'course id' }, method: 'POST', path: '/v1/platform/courses/course%20id/enrollment' },
  { action: 'create-order', input: { payload: { sellableType: 'course', sellableId: 'course-1', quantity: 1 } }, method: 'POST', path: '/v1/platform/orders' },
  { action: 'start-payment', input: { resourceId: 'order id', payload: { provider: 'wechat' } }, method: 'POST', path: '/v1/platform/orders/order%20id/payment-attempts' },
  { action: 'cancel-order', input: { resourceId: 'order id' }, method: 'POST', path: '/v1/platform/orders/order%20id/cancel' },
  { action: 'apply-instructor', input: { payload: { experience: 'Teaching', specialties: ['3x3'], contact: 'mail@example.com' } }, method: 'POST', path: '/v1/platform/instructor/applications' },
  { action: 'save-instructor-course', route: 'instructor-course', input: { resourceId: 'course id', payload: { titleZh: '课程' } }, method: 'PATCH', path: '/v1/platform/instructor/courses/course%20id' },
  { action: 'delete-course', route: 'instructor-course', input: { resourceId: 'course id' }, method: 'DELETE', path: '/v1/platform/instructor/courses/course%20id' },
  { action: 'save-course-lesson', route: 'instructor-course', input: { resourceId: 'course id', payload: { titleZh: '课时' } }, method: 'POST', path: '/v1/platform/instructor/courses/course%20id/lessons' },
  { action: 'delete-course-lesson', route: 'instructor-course', input: { resourceId: 'course id', payload: { lessonId: 'lesson id' } }, method: 'DELETE', path: '/v1/platform/instructor/courses/course%20id/lessons/lesson%20id' },
  { action: 'save-course-quiz', route: 'instructor-course', input: { resourceId: 'course id', payload: { lessonId: 'lesson id', titleZh: '测验', questions: [] } }, method: 'POST', path: '/v1/platform/instructor/courses/course%20id/lessons/lesson%20id/quizzes' },
  { action: 'delete-course-quiz', route: 'instructor-course', input: { resourceId: 'course id', payload: { lessonId: 'lesson id', quizId: 'quiz id' } }, method: 'DELETE', path: '/v1/platform/instructor/courses/course%20id/lessons/lesson%20id/quizzes/quiz%20id' },
  { action: 'issue-certificate', input: { payload: { entitlementId: 'entitlement-1' } }, method: 'POST', path: '/v1/platform/instructor/certificates' },
  { action: 'submit-review', input: { resourceId: 'course id', payload: { rating: 5 } }, method: 'POST', path: '/v1/platform/courses/course%20id/reviews' },
  { action: 'check-in', input: { payload: { localDate: '2026-08-22' } }, method: 'POST', path: '/v1/platform/me/checkins' },
  { action: 'save-shipping-address', input: { resourceId: 'address id', payload: { recipientName: 'Cube', countryCode: 'CN' } }, method: 'PATCH', path: '/v1/platform/me/shipping-addresses/address%20id' },
  { action: 'delete-shipping-address', input: { resourceId: 'address id' }, method: 'DELETE', path: '/v1/platform/me/shipping-addresses/address%20id' },
  { action: 'admin-save', route: 'admin-coupons', input: { resourceId: 'coupon id', payload: { code: 'SAVE' } }, method: 'PATCH', path: '/v1/platform/admin/coupons/coupon%20id' },
  { action: 'admin-delete', route: 'admin-coupons', input: { resourceId: 'coupon id' }, method: 'DELETE', path: '/v1/platform/admin/coupons/coupon%20id' },
  { action: 'admin-review', route: 'admin-application', input: { resourceId: 'application id', payload: { decision: 'approved' } }, method: 'POST', path: '/v1/platform/admin/instructor-applications/application%20id/decision' },
  { action: 'admin-payout', route: 'admin-payouts', input: { resourceId: 'payout id', payload: { providerReference: 'provider-1' } }, method: 'POST', path: '/v1/platform/admin/instructor-payouts/payout%20id/paid' },
  { action: 'admin-payout-generate', route: 'admin-payouts', input: { payload: { instructorId: 'instructor-1', currency: 'CNY' } }, method: 'POST', path: '/v1/platform/admin/instructor-payouts/generate' },
  { action: 'admin-payout-approve', route: 'admin-payouts', input: { resourceId: 'payout id' }, method: 'POST', path: '/v1/platform/admin/instructor-payouts/payout%20id/approve' },
  { action: 'redeem-invite', input: { payload: { code: 'INVITE' } }, method: 'POST', path: '/v1/platform/invites/redeem' },
  { action: 'qr-duplicate', route: 'admin-qr-detail', input: { resourceId: 'qr id' }, method: 'POST', path: '/v1/platform/admin/qr/qr%20id/duplicate' },
  { action: 'qr-card-job', route: 'admin-qr', input: { payload: { qrIds: ['qr-1'] } }, method: 'POST', path: '/v1/platform/admin/qr/card-jobs' },
  { action: 'qr-toggle', route: 'admin-qr-detail', input: { resourceId: 'qr id', payload: { disabled: true } }, method: 'PATCH', path: '/v1/platform/admin/qr/qr%20id/disabled' },
  { action: 'qr-template-restore', route: 'admin-qr-prompts', input: { resourceId: 'prompt id' }, method: 'POST', path: '/v1/platform/admin/qr/prompts/prompt%20id/restore' },
  { action: 'qr-template-purge', route: 'admin-qr-prompts', input: { resourceId: 'prompt id' }, method: 'DELETE', path: '/v1/platform/admin/qr/prompts/prompt%20id/purge' },
  { action: 'qr-template-reorder', route: 'admin-qr-prompts', input: { payload: { orderedIds: ['prompt-1'] } }, method: 'POST', path: '/v1/platform/admin/qr/prompts/reorder' },
  { action: 'admin-refund', route: 'admin-order', input: { resourceId: 'order id', payload: { reasonCode: 'customer_request', providerRefundId: 'refund-1', evidenceReference: 'ticket-1' } }, method: 'POST', path: '/v1/platform/admin/orders/order%20id/refund' },
  { action: 'admin-ship-order-item', route: 'admin-order', input: { resourceId: 'order id', payload: { itemId: 'item id', quantity: 2, externalReference: 'shipment-1', carrier: 'carrier', trackingNumber: 'tracking', note: 'note' } }, method: 'POST', path: '/v1/platform/admin/orders/order%20id/items/item%20id/ship', body: { quantity: 2, externalReference: 'shipment-1', carrier: 'carrier', trackingNumber: 'tracking', note: 'note' } },
  { action: 'admin-deliver-order-item', route: 'admin-order', input: { resourceId: 'order id', payload: { itemId: 'item id', quantity: 1, externalReference: 'delivery-1' } }, method: 'POST', path: '/v1/platform/admin/orders/order%20id/items/item%20id/deliver', body: { quantity: 1, externalReference: 'delivery-1' } },
  { action: 'admin-return-order-item', route: 'admin-order', input: { resourceId: 'order id', payload: { itemId: 'item id', quantity: 1, externalReference: 'return-1' } }, method: 'POST', path: '/v1/platform/admin/orders/order%20id/items/item%20id/return', body: { quantity: 1, externalReference: 'return-1' } },
  { action: 'admin-reconcile-run', route: 'admin-reconcile', input: { payload: { provider: 'stripe', statementText: 'row' } }, method: 'POST', path: '/v1/platform/admin/reconciliation/runs' },
  { action: 'admin-reconcile', route: 'admin-reconcile', input: { resourceId: 'entry id', payload: { resolution: 'matched' } }, method: 'POST', path: '/v1/platform/admin/reconciliation/entry%20id/resolve' },
  { action: 'save-privacy-consent', route: 'account-privacy', input: { payload: { purpose: 'analytics', status: 'granted', policyVersion: PLATFORM_PRIVACY_POLICY_VERSION, source: 'account' } }, method: 'POST', path: '/v1/platform/me/privacy/consents' },
];

afterEach(() => vi.unstubAllGlobals());

describe('Platform route conservation', () => {
  it('matches all 95 legacy page mappings while allowing required new target routes', () => {
    const targets = manifest.capabilities
      .filter((capability) => capability.kind === 'page')
      .flatMap((capability) => capability.mappings.map(([, target]) => target));
    expect(targets).toHaveLength(95);
    expect(new Set(targets).size).toBe(94);
    expect(PLATFORM_ROUTES.length).toBeGreaterThanOrEqual(new Set(targets).size);
    expect(new Set(PLATFORM_ROUTES.map((route) => route.pattern)).size).toBe(PLATFORM_ROUTES.length);
    for (const target of targets) {
      expect(matchPlatformRoute(segmentsForTarget(target)), target).not.toBeNull();
    }
    expect(matchPlatformRoute(['account', 'privacy'])?.definition).toMatchObject({
      id: 'account-privacy',
      resource: 'account-privacy',
      access: 'account',
      actions: ['save-privacy-consent'],
    });
    expect(matchPlatformRoute(['account', 'shipping'])?.definition).toMatchObject({
      id: 'account-shipping',
      resource: 'shipping-addresses',
      access: 'account',
    });
    expect(matchPlatformRoute(['admin', 'orders', 'order-1'])?.definition).toMatchObject({
      id: 'admin-order',
      resource: 'admin-orders',
      access: 'admin',
    });
    expect(matchPlatformRoute(['membership'])?.definition).toMatchObject({
      id: 'membership', resource: 'membership-plans', access: 'public',
    });
    expect(matchPlatformRoute(['account', 'membership'])?.definition).toMatchObject({
      id: 'me-membership', resource: 'account-memberships', access: 'account',
    });
  });

  it('keeps the eight product domains and exact canonical main-site destinations', () => {
    expect(new Set(PLATFORM_NAV.map((entry) => entry.area)).size).toBe(8);
    expect(routeById('algorithms').canonicalHref).toBe('/alg');
    expect(routeById('algorithm-detail')).toMatchObject({ canonicalHref: '/alg', kind: 'canonical' });
    expect(routeById('algorithm-detail').description.en).toContain('auto-seeded demo data');
    expect(routeById('admin-community').canonicalHref).toBe('/forum/review');
    expect(routeById('org').canonicalHref).toBe('/org');
    expect(fillPlatformParams(routeById('org-class').canonicalHref!, { orgSlug: 'cube root', groupId: 'group/1' }))
      .toBe('/org/cube%20root/classes/group%2F1');
  });
});

describe('Platform gateway contracts', () => {
  it('provides a real GET for every native resource route', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ items: [] }));
    vi.stubGlobal('fetch', fetchMock);
    for (const route of PLATFORM_ROUTES.filter((candidate) => candidate.resource)) {
      await loadPlatformResource(route.resource as PlatformResource, {
        routeId: route.id,
        params: { id: 'resource id', code: 'qr code', lessonId: 'lesson id' },
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(PLATFORM_ROUTES.filter((route) => route.resource).length);
    for (const [input, init] of fetchMock.mock.calls) {
      expect(init?.method).toBeUndefined();
      expect(requestPath(input)).toMatch(/^\/v1\//);
      expect(requestPath(input)).not.toContain('/surfaces/');
    }
  });

  it('uses the signed lesson-media access endpoint', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({
      mediaId: 'media-1', mimeType: 'video/mp4', sizeBytes: 100,
      accessUrl: 'https://api.cuberoot.me/v1/platform/lessons/lesson%20id/media?token=signed',
      expiresAt: '2026-08-23T00:00:00.000Z',
    }));
    vi.stubGlobal('fetch', fetchMock);
    await loadPlatformLessonMedia('lesson id');
    const [input, init] = fetchMock.mock.calls[0];
    expect(requestPath(input)).toBe('/v1/platform/lessons/lesson%20id/media');
    expect(init?.method).toBeUndefined();
    expect(init?.cache).toBe('no-store');
  });

  it('loads the public membership catalog and preserves its typed price contract', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ items: [{
      id: 'plan-1', slug: 'annual', nameZh: '年度课程权益', nameEn: 'Annual learning access',
      descriptionZh: null, descriptionEn: null, periodUnit: 'year', periodCount: 1,
      amountMinor: 19900, currency: 'CNY', status: 'active',
    }] }));
    vi.stubGlobal('fetch', fetchMock);
    const plans = await loadPlatformMembershipPlans();
    expect(plans[0]).toMatchObject({ id: 'plan-1', periodUnit: 'year', amountMinor: 19900, currency: 'CNY' });
    const [input, init] = fetchMock.mock.calls[0];
    expect(requestPath(input)).toBe('/v1/platform/membership-plans');
    expect(init?.method).toBeUndefined();
    expect(init?.cache).toBeUndefined();
  });

  it('renders membership routes from route entities without a duplicate generic list', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ items: [{
      id: 'plan-1', slug: 'annual', nameZh: '年度课程权益', nameEn: 'Annual learning access',
      descriptionZh: null, descriptionEn: null, periodUnit: 'year', periodCount: 1,
      amountMinor: 19900, currency: 'CNY', status: 'active',
    }] }));
    vi.stubGlobal('fetch', fetchMock);
    const catalog = await loadPlatformResource('membership-plans', {
      routeId: 'membership', params: {},
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(catalog.items[0]).toMatchObject({ id: 'plan-1', title: '年度课程权益' });
    expect(fetchMock.mock.calls[0][1]?.cache).toBeUndefined();

    const routeViewSource = readFileSync(join(REPO, 'core', 'packages', 'client', 'components', 'platform', 'PlatformRouteView.tsx'), 'utf8');
    const membershipSource = readFileSync(join(REPO, 'core', 'packages', 'client', 'components', 'platform', 'PlatformDomainActions.tsx'), 'utf8');
    expect(routeViewSource).toContain("definition.id !== 'membership'");
    expect(routeViewSource).toContain("definition.id !== 'me-membership'");
    expect(routeViewSource).toContain("definition.id === 'membership' || definition.id === 'me-membership' ? null");
    expect(membershipSource).toContain('routeEntities.map(membershipPlanFromEntity)');
    expect(membershipSource).toContain('routeEntities.map(membershipFromEntity)');
    expect(membershipSource).toContain('membership.validFrom.slice(0, 10)');
    expect(membershipSource).toContain('membership.validUntil?.slice(0, 10)');
  });

  it('loads owner memberships and uses the server isActive decision for renewals', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ items: [{
      id: 'membership-1', planId: 'plan-1', planSlug: 'annual',
      planNameZh: '年度课程权益', planNameEn: 'Annual learning access',
      status: 'active', isActive: true, validFrom: '2026-08-22T00:00:00.000Z', validUntil: '2027-08-22T00:00:00.000Z',
    }] }));
    vi.stubGlobal('fetch', fetchMock);
    const memberships = await loadPlatformMemberships();
    expect(memberships[0]).toMatchObject({ planId: 'plan-1', status: 'active', isActive: true });
    const [input, init] = fetchMock.mock.calls[0];
    expect(requestPath(input)).toBe('/v1/platform/me/memberships');
    expect(init?.method).toBeUndefined();
    expect(init?.cache).toBe('no-store');
  });

  it('creates membership purchase and renewal orders with the membership plan contract', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ id: 'order-1', status: 'pending_payment' }));
    vi.stubGlobal('fetch', fetchMock);
    await executePlatformAction(routeById('membership'), {
      action: 'create-order', payload: { sellableType: 'platform_membership', sellableId: 'plan-1', quantity: 1 },
    });
    const [input, init] = fetchMock.mock.calls[0];
    expect(requestPath(input)).toBe('/v1/platform/orders');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ items: [{ membershipPlanId: 'plan-1', quantity: 1 }] });
    expect(new Headers(init?.headers).has('Idempotency-Key')).toBe(true);
  });

  it('keeps payment checkout and QR results typed', async () => {
    const payment = {
      id: 'attempt-1', provider: 'wechat', status: 'pending', expiresAt: '2026-08-23T00:00:00.000Z',
      checkoutUrl: 'https://pay.example/checkout', qrCodeDataUrl: 'data:image/png;base64,AA==',
    } as const;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response(payment));
    vi.stubGlobal('fetch', fetchMock);
    const result = await executePlatformAction(routeById('order-detail'), {
      action: 'start-payment', resourceId: 'order id', payload: { provider: 'wechat', clientType: 'pc' },
    });
    expect(isPlatformPaymentAttemptResult(result)).toBe(true);
    expect(result).toMatchObject(payment);
  });

  it('loads and writes the exact privacy-consent contract without emitting analytics', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({ items: [{
      id: 'consent-1', purpose: 'analytics', status: 'granted', policyVersion: PLATFORM_PRIVACY_POLICY_VERSION,
      source: 'account', decidedAt: '2026-08-22T00:00:00.000Z', expiresAt: null,
    }] }));
    vi.stubGlobal('fetch', fetchMock);

    const consents = await loadPlatformPrivacyConsents();
    expect(consents[0]).toMatchObject({ purpose: 'analytics', status: 'granted', expiresAt: null });
    let [input, init] = fetchMock.mock.calls[0];
    expect(requestPath(input)).toBe('/v1/platform/me/privacy/consents');
    expect(init?.method).toBeUndefined();
    expect(init?.cache).toBe('no-store');

    fetchMock.mockClear();
    await executePlatformAction(routeById('account-privacy'), {
      action: 'save-privacy-consent',
      payload: {
        purpose: 'analytics', status: 'withdrawn',
        policyVersion: PLATFORM_PRIVACY_POLICY_VERSION, source: 'account',
      },
    });
    [input, init] = fetchMock.mock.calls[0];
    expect(requestPath(input)).toBe('/v1/platform/me/privacy/consents');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      purpose: 'analytics', status: 'withdrawn',
      policyVersion: PLATFORM_PRIVACY_POLICY_VERSION, source: 'account',
    });
    expect(new Headers(init?.headers).has('Idempotency-Key')).toBe(true);
    expect(requestPath(input)).not.toBe('/v1/platform/analytics');

    const privacyUi = readFileSync(join(REPO, 'core', 'packages', 'client', 'components', 'platform', 'PlatformPrivacySettings.tsx'), 'utf8');
    expect(privacyUi).not.toContain("'/v1/platform/analytics'");
  });

  it('maps every declared write action to an exact resource method and path', async () => {
    expect(new Set(actionContracts.map((contract) => contract.action)))
      .toEqual(new Set(Object.keys(PLATFORM_ACTION_LABELS)));
    for (const contract of actionContracts) {
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response());
      vi.stubGlobal('fetch', fetchMock);
      await executePlatformAction(
        contract.route ? routeById(contract.route) : defaultRoute,
        { action: contract.action, ...contract.input },
      );
      expect(fetchMock).toHaveBeenCalledOnce();
      const [input, init] = fetchMock.mock.calls[0];
      expect(init?.method, contract.action).toBe(contract.method);
      expect(requestPath(input), contract.action).toBe(contract.path);
      expect(requestPath(input), contract.action).not.toContain('/actions/');
      expect(new Headers(init?.headers).has('Idempotency-Key'), contract.action).toBe(true);
      if (contract.body) expect(JSON.parse(String(init?.body)), contract.action).toEqual(contract.body);
    }
  });

  it('keeps the retired standalone package outside the workspace runtime', () => {
    const workspace = readFileSync(join(REPO, 'core', 'pnpm-workspace.yaml'), 'utf8');
    expect(workspace).toContain('!packages/platform');
  });
});
