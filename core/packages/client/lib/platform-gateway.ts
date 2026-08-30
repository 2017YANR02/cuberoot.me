import { authHeaders, handleApi } from '@/lib/admin-api';
import { apiUrl } from '@/lib/api-base';
import type { PlatformOrderWrite } from '@cuberoot/shared';
import type {
  PlatformActionId,
  PlatformActionInput,
  PlatformActionResult,
  PlatformEntity,
  PlatformMembership,
  PlatformMembershipPlan,
  PlatformPrivacyConsent,
  PlatformResource,
  PlatformResourceResult,
  PlatformRouteDefinition,
} from './platform-types';

export interface PlatformLoadOptions {
  routeId?: string;
  params: Record<string, string>;
  query?: string;
  sort?: 'title' | 'updated';
  owned?: boolean;
  signal?: AbortSignal;
}

export interface PlatformLessonMedia {
  mediaId: string;
  mimeType: string;
  sizeBytes: number;
  accessUrl: string;
  expiresAt: string;
}

export class PlatformPermissionError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? 'Authentication required.' : 'Permission denied.');
    this.name = 'PlatformPermissionError';
  }
}

function idFrom(options: PlatformLoadOptions): string | undefined {
  return options.params.id ?? options.params.code ?? options.params.lessonId;
}

function encodedId(options: PlatformLoadOptions): string | null {
  const id = idFrom(options);
  return id ? encodeURIComponent(id) : null;
}

function queryString(options: PlatformLoadOptions): string {
  const query = new URLSearchParams();
  if (options.query?.trim()) query.set('q', options.query.trim());
  if (options.sort) query.set('sort', options.sort);
  if (options.owned) query.set('owned', '1');
  const value = query.toString();
  return value ? `?${value}` : '';
}

/** Explicit resource URLs. Keep permissions and state machines visible at the API boundary. */
function readPath(resource: PlatformResource, options: PlatformLoadOptions): string {
  const id = encodedId(options);
  const query = queryString(options);
  switch (resource) {
    case 'search': return `/v1/platform/search${query}`;
    case 'leaderboard': return `/v1/platform/leaderboard${query}`;
    case 'teachers': return `/v1/teachers?v=4${id ? `&id=${id}` : ''}`;
    case 'community': return `/v1/forum/latest?limit=30`;
    case 'community-circle': return `/v1/forum/f/${encodeURIComponent(options.params.id ?? '')}?page=1&size=30&sort=activity`;
    case 'community-post': return `/v1/forum/t/${encodeURIComponent(options.params.id ?? '')}?page=1&size=30`;
    case 'notifications': return `/v1/notifications?limit=50`;
    case 'membership-plans': return '/v1/platform/membership-plans';
    case 'account-memberships': return '/v1/platform/me/memberships';
    case 'entitlements': return `/v1/platform/entitlements${query}`;
    case 'courses': return `/v1/platform/courses${id ? `/${id}` : ''}${query}`;
    case 'course-lesson': return `/v1/platform/courses/${encodeURIComponent(options.params.id ?? '')}/lessons/${encodeURIComponent(options.params.lessonId ?? '')}`;
    case 'paths': return `/v1/platform/paths${id ? `/${id}` : ''}${query}`;
    case 'events': return `/v1/platform/events${id ? `/${id}` : ''}${query}`;
    case 'news': return `/v1/platform/news${id ? `/${id}` : ''}${query}`;
    case 'products': return `/v1/platform/products${id ? `/${id}` : ''}${query}`;
    case 'orders': return `/v1/platform/orders${id ? `/${id}` : ''}${query}`;
    case 'certificate': return `/v1/platform/certificates/${encodeURIComponent(options.params.code ?? '')}`;
    case 'qr': return `/v1/platform/qr/${encodeURIComponent(options.params.code ?? '')}`;
    case 'account-courses': return `/v1/platform/me/courses${query}`;
    case 'account-badges': return `/v1/platform/me/badges${query}`;
    case 'account-favorites': return `/v1/platform/me/favorites${query}`;
    case 'account-notes': return `/v1/platform/me/notes${query}`;
    case 'account-wishlist': return `/v1/platform/me/wishlist${query}`;
    case 'account-invites': return `/v1/platform/me/invites${query}`;
    case 'account-progress': return `/v1/platform/me/progress${query}`;
    case 'account-privacy': return '/v1/platform/me/privacy/consents';
    case 'shipping-addresses': return '/v1/platform/me/shipping-addresses';
    case 'instructor-courses': return `/v1/platform/instructor/courses${id ? `/${id}` : ''}${query}`;
    case 'instructor-application': return '/v1/platform/instructor/applications/current';
    case 'instructor-students': return `/v1/platform/instructor/students${query}`;
    case 'instructor-earnings': return `/v1/platform/instructor/earnings${query}`;
    case 'admin-algorithms': return `/v1/platform/admin/algorithms${id ? `/${id}` : ''}${query}`;
    case 'admin-applications': return `/v1/platform/admin/instructor-applications${id ? `/${id}` : ''}${query}`;
    case 'admin-coupons': return `/v1/platform/admin/coupons${query}`;
    case 'admin-courses': return `/v1/platform/admin/courses${id ? `/${id}` : ''}${query}`;
    case 'admin-paths': return `/v1/platform/admin/paths${id ? `/${id}` : ''}${query}`;
    case 'admin-events': return `/v1/platform/admin/events${id ? `/${id}` : ''}${query}`;
    case 'admin-analytics': return `/v1/platform/admin/analytics${query}`;
    case 'admin-logs': return `/v1/platform/admin/logs${query}`;
    case 'admin-payouts': return `/v1/platform/admin/instructor-payouts${query}`;
    case 'admin-teachers': return `/v1/platform/admin/instructors${id ? `/${id}` : ''}${query}`;
    case 'admin-invites': return `/v1/platform/admin/invites${query}`;
    case 'admin-news': return `/v1/platform/admin/news${id ? `/${id}` : ''}${query}`;
    case 'admin-community': return `/v1/platform/admin/community-posts${query}`;
    case 'admin-orders': return `/v1/platform/admin/orders${id ? `/${id}` : ''}${query}`;
    case 'admin-reconcile': return `/v1/platform/admin/reconciliation${query}`;
    case 'admin-products': return `/v1/platform/admin/products${id ? `/${id}` : ''}${query}`;
    case 'admin-qr': {
      if (options.routeId === 'admin-qr-stats') return `/v1/platform/admin/qr/stats${query}`;
      if (options.routeId === 'admin-qr-prompts') return `/v1/platform/admin/qr/prompts?includeArchived=true${query ? `&${query.slice(1)}` : ''}`;
      if (options.routeId === 'admin-qr-cards') return `/v1/platform/admin/qr/cards?includeArchived=true${query ? `&${query.slice(1)}` : ''}`;
      return `/v1/platform/admin/qr${id ? `/${id}` : ''}${query}`;
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function entity(value: unknown, index: number): PlatformEntity | null {
  const item = asRecord(value);
  if (!item) return null;
  const id = stringValue(item.id)
    ?? (typeof item.id === 'number' && Number.isFinite(item.id) ? String(item.id) : null)
    ?? stringValue(item.code)
    ?? String(index + 1);
  const title = stringValue(item.title) ?? stringValue(item.titleZh) ?? stringValue(item.titleEn)
    ?? stringValue(item.name) ?? stringValue(item.nameZh) ?? stringValue(item.nameEn)
    ?? stringValue(item.planNameZh) ?? stringValue(item.planNameEn)
    ?? stringValue(item.displayName) ?? stringValue(item.label) ?? id;
  const reserved = new Set(['id', 'code', 'title', 'name', 'label', 'summary', 'description', 'status', 'href', 'url', 'eyebrow', 'updatedAt', 'updated_at']);
  const fields = Object.entries(item)
    .filter(([key, field]) => !reserved.has(key) && (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean'))
    .slice(0, 4)
    .map(([label, field]) => ({ label, value: String(field) }));
  return {
    id,
    title,
    summary: stringValue(item.summary) ?? stringValue(item.summaryZh) ?? stringValue(item.summaryEn)
      ?? stringValue(item.description) ?? stringValue(item.descriptionZh) ?? stringValue(item.descriptionEn),
    status: stringValue(item.status),
    href: stringValue(item.href) ?? stringValue(item.url),
    eyebrow: stringValue(item.eyebrow),
    updatedAt: stringValue(item.updatedAt) ?? stringValue(item.updated_at),
    fields,
    data: item,
  };
}

function normalizeResource(value: unknown): PlatformResourceResult {
  if (Array.isArray(value)) return { items: value.map(entity).filter((item): item is PlatformEntity => item !== null) };
  const envelope = asRecord(value);
  if (!envelope) return { items: [] };
  const direct = entity(
    envelope.item ?? envelope.data ?? envelope.result ?? envelope.course ?? envelope.path
      ?? envelope.event ?? envelope.article ?? envelope.product ?? envelope.order
      ?? envelope.certificate ?? envelope.qr ?? envelope.thread,
    0,
  );
  if (direct) return { items: [direct], total: 1 };
  const envelopeEntity = entity(envelope, 0);
  if (envelopeEntity && ['id', 'code', 'slug', 'title', 'titleZh', 'titleEn'].some((key) => envelope[key] != null)) {
    return { items: [envelopeEntity], total: 1 };
  }
  const array = Object.values(envelope).find(Array.isArray);
  const items = Array.isArray(array)
    ? array.map(entity).filter((item): item is PlatformEntity => item !== null)
    : [];
  return {
    items,
    total: typeof envelope.total === 'number' ? envelope.total : items.length,
    nextCursor: stringValue(envelope.nextCursor) ?? stringValue(envelope.next_cursor),
  };
}

export async function loadPlatformResource(
  resource: PlatformResource,
  options: PlatformLoadOptions,
): Promise<PlatformResourceResult> {
  const response = await fetch(apiUrl(readPath(resource, options)), {
    headers: authHeaders(false),
    ...(resource === 'membership-plans' ? {} : { cache: 'no-store' as const }),
    signal: options.signal,
  });
  if (response.status === 401 || response.status === 403) throw new PlatformPermissionError(response.status);
  const result = normalizeResource(await handleApi<unknown>(response));
  const id = idFrom(options);
  if (resource === 'teachers' && id) {
    return { ...result, items: result.items.filter((item) => item.id === id), total: result.items.some((item) => item.id === id) ? 1 : 0 };
  }
  return result;
}

export async function loadPlatformManagedQuizzes(options: {
  scope: 'admin' | 'instructor';
  courseId: string;
  lessonId: string;
  signal?: AbortSignal;
}): Promise<PlatformResourceResult> {
  const response = await fetch(apiUrl(
    `/v1/platform/${options.scope}/courses/${encodeURIComponent(options.courseId)}/lessons/${encodeURIComponent(options.lessonId)}/quizzes`,
  ), {
    headers: authHeaders(false),
    cache: 'no-store',
    signal: options.signal,
  });
  if (response.status === 401 || response.status === 403) throw new PlatformPermissionError(response.status);
  return normalizeResource(await handleApi<unknown>(response));
}

export async function loadPlatformShippingAddresses(signal?: AbortSignal): Promise<PlatformResourceResult> {
  const response = await fetch(apiUrl('/v1/platform/me/shipping-addresses'), {
    headers: authHeaders(false),
    cache: 'no-store',
    signal,
  });
  if (response.status === 401 || response.status === 403) throw new PlatformPermissionError(response.status);
  return normalizeResource(await handleApi<unknown>(response));
}

export async function loadPlatformMembershipPlans(signal?: AbortSignal): Promise<PlatformMembershipPlan[]> {
  const response = await fetch(apiUrl('/v1/platform/membership-plans'), {
    headers: authHeaders(false),
    signal,
  });
  if (response.status === 401 || response.status === 403) throw new PlatformPermissionError(response.status);
  const body = await handleApi<{ items: PlatformMembershipPlan[] }>(response);
  return Array.isArray(body.items) ? body.items : [];
}

export async function loadPlatformMemberships(signal?: AbortSignal): Promise<PlatformMembership[]> {
  const response = await fetch(apiUrl('/v1/platform/me/memberships'), {
    headers: authHeaders(false),
    cache: 'no-store',
    signal,
  });
  if (response.status === 401 || response.status === 403) throw new PlatformPermissionError(response.status);
  const body = await handleApi<{ items: PlatformMembership[] }>(response);
  return Array.isArray(body.items) ? body.items : [];
}

export async function loadPlatformLessonMedia(lessonId: string, signal?: AbortSignal): Promise<PlatformLessonMedia> {
  const response = await fetch(apiUrl(`/v1/platform/lessons/${encodeURIComponent(lessonId)}/media`), {
    headers: authHeaders(false),
    cache: 'no-store',
    signal,
  });
  if (response.status === 401 || response.status === 403) throw new PlatformPermissionError(response.status);
  return handleApi<PlatformLessonMedia>(response);
}

export const PLATFORM_PRIVACY_POLICY_VERSION = 'platform-privacy-v1';

export async function loadPlatformPrivacyConsents(signal?: AbortSignal): Promise<PlatformPrivacyConsent[]> {
  const response = await fetch(apiUrl('/v1/platform/me/privacy/consents'), {
    headers: authHeaders(false),
    cache: 'no-store',
    signal,
  });
  if (response.status === 401 || response.status === 403) throw new PlatformPermissionError(response.status);
  const body = await handleApi<{ items: PlatformPrivacyConsent[] }>(response);
  return Array.isArray(body.items) ? body.items : [];
}

function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `platform-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function writeHeaders(): HeadersInit {
  return { ...authHeaders(), 'Idempotency-Key': idempotencyKey() };
}

async function write(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', payload?: Record<string, unknown>): Promise<PlatformActionResult> {
  const response = await fetch(apiUrl(path), {
    method,
    headers: writeHeaders(),
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  if (response.status === 401 || response.status === 403) throw new PlatformPermissionError(response.status);
  return handleApi<PlatformActionResult>(response);
}

function requiredId(input: PlatformActionInput): string {
  if (!input.resourceId) throw new Error('A resource id is required for this action.');
  return encodeURIComponent(input.resourceId);
}

function requiredRawId(input: PlatformActionInput): string {
  if (!input.resourceId) throw new Error('A resource id is required for this action.');
  return input.resourceId;
}

function requiredPayloadId(payload: Record<string, unknown>, key: string): string {
  const value = typeof payload[key] === 'string' ? payload[key].trim() : '';
  if (!value) throw new Error(`${key} is required for this action.`);
  return encodeURIComponent(value);
}

function withoutPayloadKeys(payload: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !keys.includes(key)));
}

function shipmentPath(input: PlatformActionInput, operation: 'ship' | 'deliver' | 'return'): {
  path: string;
  payload: Record<string, unknown>;
} {
  const payload = input.payload ?? {};
  const itemId = requiredPayloadId(payload, 'itemId');
  return {
    path: `/v1/platform/admin/orders/${requiredId(input)}/items/${itemId}/${operation}`,
    payload: withoutPayloadKeys(payload, ['itemId']),
  };
}

function courseManagementScope(route: PlatformRouteDefinition): 'admin' | 'instructor' {
  if (route.area === 'admin') return 'admin';
  if (route.area === 'instructor') return 'instructor';
  throw new Error('This route cannot manage course content.');
}

function adminSavePath(route: PlatformRouteDefinition, resourceId?: string): string {
  const resource = route.resource;
  const suffix = resourceId ? `/${encodeURIComponent(resourceId)}` : '';
  switch (resource) {
    case 'admin-algorithms': return `/v1/platform/admin/algorithms${suffix}`;
    case 'admin-coupons': return `/v1/platform/admin/coupons${suffix}`;
    case 'admin-courses': return `/v1/platform/admin/courses${suffix}`;
    case 'admin-paths': return `/v1/platform/admin/paths${suffix}`;
    case 'admin-events': return `/v1/platform/admin/events${suffix}`;
    case 'admin-payouts': return `/v1/platform/admin/instructor-payouts${suffix}`;
    case 'admin-teachers': return `/v1/platform/admin/instructors${suffix}`;
    case 'admin-invites': return `/v1/platform/admin/invites${suffix}`;
    case 'admin-news': return `/v1/platform/admin/news${suffix}`;
    case 'admin-products': return `/v1/platform/admin/products${suffix}`;
    case 'admin-qr': {
      if (route.id === 'admin-qr-cards') return `/v1/platform/admin/qr/cards${suffix}`;
      if (route.id === 'admin-qr-prompts') return `/v1/platform/admin/qr/prompts${suffix}`;
      return `/v1/platform/admin/qr${suffix}`;
    }
    default: throw new Error('This resource does not support administrator saves.');
  }
}

function orderPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sellableType = payload.sellableType;
  const sellableId = typeof payload.sellableId === 'string' ? payload.sellableId.trim() : '';
  const quantity = Number(payload.quantity);
  if (!['course', 'product_variant', 'event_ticket', 'platform_membership'].includes(String(sellableType))) {
    throw new Error('A supported sellable type is required.');
  }
  if (!sellableId) throw new Error('A sellable item is required.');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Quantity must be an integer from 1 to 99.');
  const couponCode = typeof payload.couponCode === 'string' && payload.couponCode.trim() ? payload.couponCode.trim() : undefined;
  const shippingAddressId = typeof payload.shippingAddressId === 'string' && payload.shippingAddressId.trim() ? payload.shippingAddressId.trim() : undefined;
  const intent = {
    lines: [{ sellableType: sellableType as PlatformOrderWrite['lines'][number]['sellableType'], sellableId, quantity }],
    ...(couponCode ? { couponCode } : {}),
    ...(shippingAddressId ? { shippingAddressId } : {}),
  } satisfies PlatformOrderWrite;
  return {
    items: intent.lines.map((line) => ({
      ...(line.sellableType === 'course' ? { courseId: line.sellableId } : {}),
      ...(line.sellableType === 'product_variant' ? { productVariantId: line.sellableId } : {}),
      ...(line.sellableType === 'event_ticket' ? { eventTicketTypeId: line.sellableId } : {}),
      ...(line.sellableType === 'platform_membership' ? { membershipPlanId: line.sellableId } : {}),
      quantity: line.quantity,
    })),
    ...(intent.couponCode ? { couponCode: intent.couponCode } : {}),
    ...(intent.shippingAddressId ? { shippingAddressId: intent.shippingAddressId } : {}),
  };
}

/**
 * UI dispatcher only; every branch targets a resource-specific API contract.
 * There is deliberately no generic `/actions/:action` backend endpoint.
 */
export async function executePlatformAction(
  route: PlatformRouteDefinition,
  input: PlatformActionInput,
): Promise<PlatformActionResult> {
  const payload = input.payload ?? {};
  const id = input.resourceId;
  switch (input.action) {
    case 'favorite': {
      if (!['course', 'product', 'event'].includes(String(payload.targetType))) throw new Error('A favorite target type is required.');
      return write(`/v1/platform/me/favorites/${requiredId(input)}`, 'PUT', payload);
    }
    case 'wishlist': return write(`/v1/platform/me/wishlist/${requiredId(input)}`, 'PUT', payload);
    case 'save-note': return write(`/v1/platform/me/notes/${requiredId(input)}`, 'PUT', payload);
    case 'delete-note': return write(`/v1/platform/me/notes/${requiredId(input)}`, 'DELETE');
    case 'update-progress': return write(`/v1/platform/me/progress/${requiredId(input)}`, 'PUT', payload);
    case 'submit-quiz': return write(`/v1/platform/learning/lessons/${requiredId(input)}/quiz`, 'POST', payload);
    case 'enroll': return write(`/v1/platform/courses/${requiredId(input)}/enrollment`, 'POST', payload);
    case 'create-order': return write('/v1/platform/orders', 'POST', orderPayload(payload));
    case 'start-payment': return write(`/v1/platform/orders/${requiredId(input)}/payment-attempts`, 'POST', payload);
    case 'cancel-order': return write(`/v1/platform/orders/${requiredId(input)}/cancel`, 'POST', payload);
    case 'apply-instructor': return write('/v1/platform/instructor/applications', 'POST', payload);
    case 'save-instructor-course': return write(`/v1/platform/instructor/courses${id ? `/${encodeURIComponent(id)}` : ''}`, id ? 'PATCH' : 'POST', payload);
    case 'delete-course': return write(`/v1/platform/${courseManagementScope(route)}/courses/${requiredId(input)}`, 'DELETE');
    case 'save-course-lesson': {
      const courseId = requiredId(input);
      const lessonId = typeof payload.lessonId === 'string' && payload.lessonId.trim()
        ? encodeURIComponent(payload.lessonId.trim())
        : null;
      return write(
        `/v1/platform/${courseManagementScope(route)}/courses/${courseId}/lessons${lessonId ? `/${lessonId}` : ''}`,
        lessonId ? 'PATCH' : 'POST',
        withoutPayloadKeys(payload, ['lessonId']),
      );
    }
    case 'delete-course-lesson': {
      const lessonId = requiredPayloadId(payload, 'lessonId');
      return write(`/v1/platform/${courseManagementScope(route)}/courses/${requiredId(input)}/lessons/${lessonId}`, 'DELETE');
    }
    case 'save-course-quiz': {
      const lessonId = requiredPayloadId(payload, 'lessonId');
      const quizId = typeof payload.quizId === 'string' && payload.quizId.trim()
        ? encodeURIComponent(payload.quizId.trim())
        : null;
      return write(
        `/v1/platform/${courseManagementScope(route)}/courses/${requiredId(input)}/lessons/${lessonId}/quizzes${quizId ? `/${quizId}` : ''}`,
        quizId ? 'PATCH' : 'POST',
        withoutPayloadKeys(payload, ['lessonId', 'quizId']),
      );
    }
    case 'delete-course-quiz': {
      const lessonId = requiredPayloadId(payload, 'lessonId');
      const quizId = requiredPayloadId(payload, 'quizId');
      return write(`/v1/platform/${courseManagementScope(route)}/courses/${requiredId(input)}/lessons/${lessonId}/quizzes/${quizId}`, 'DELETE');
    }
    case 'issue-certificate': return write('/v1/platform/instructor/certificates', 'POST', payload);
    case 'submit-review': return write(`/v1/platform/courses/${requiredId(input)}/reviews`, 'POST', payload);
    case 'check-in': return write('/v1/platform/me/checkins', 'POST', payload);
    case 'save-shipping-address': return write(`/v1/platform/me/shipping-addresses${id ? `/${encodeURIComponent(id)}` : ''}`, id ? 'PATCH' : 'POST', payload);
    case 'delete-shipping-address': return write(`/v1/platform/me/shipping-addresses/${requiredId(input)}`, 'DELETE');
    case 'admin-save': {
      if (!route.resource) throw new Error('This route has no writable resource.');
      return write(adminSavePath(route, id), id ? 'PATCH' : 'POST', payload);
    }
    case 'admin-delete': {
      if (!route.resource) throw new Error('This route has no writable resource.');
      return write(adminSavePath(route, requiredRawId(input)), 'DELETE');
    }
    case 'admin-review': return route.resource === 'admin-community'
      ? write(`/v1/platform/admin/community-posts/${requiredId(input)}/decision`, 'POST', payload)
      : write(`/v1/platform/admin/instructor-applications/${requiredId(input)}/decision`, 'POST', payload);
    case 'admin-payout': return write(`/v1/platform/admin/instructor-payouts/${requiredId(input)}/paid`, 'POST', payload);
    case 'admin-payout-generate': return write('/v1/platform/admin/instructor-payouts/generate', 'POST', payload);
    case 'admin-payout-approve': return write(`/v1/platform/admin/instructor-payouts/${requiredId(input)}/approve`, 'POST', payload);
    case 'redeem-invite': return write('/v1/platform/invites/redeem', 'POST', payload);
    case 'admin-invite-batch': return write('/v1/platform/admin/invites/batch', 'POST', payload);
    case 'admin-invite-order': return write(`/v1/platform/admin/invites/${requiredId(input)}/order-reference`, 'PATCH', payload);
    case 'admin-invite-revoke': return write(`/v1/platform/admin/invites/${requiredId(input)}/revoke`, 'POST', payload);
    case 'qr-duplicate': return write(`/v1/platform/admin/qr/${requiredId(input)}/duplicate`, 'POST', payload);
    case 'qr-card-job': return write('/v1/platform/admin/qr/card-jobs', 'POST', payload);
    case 'qr-toggle': return write(`/v1/platform/admin/qr/${requiredId(input)}/disabled`, 'PATCH', payload);
    case 'qr-template-restore': return write(`${adminSavePath(route, requiredRawId(input))}/restore`, 'POST', payload);
    case 'qr-template-purge': return write(`${adminSavePath(route, requiredRawId(input))}/purge`, 'DELETE');
    case 'qr-template-reorder': return write(`${adminSavePath(route)}/reorder`, 'POST', payload);
    case 'admin-refund': return write(`/v1/platform/admin/orders/${requiredId(input)}/refund`, 'POST', payload);
    case 'admin-ship-order-item': {
      const shipment = shipmentPath(input, 'ship');
      return write(shipment.path, 'POST', shipment.payload);
    }
    case 'admin-deliver-order-item': {
      const shipment = shipmentPath(input, 'deliver');
      return write(shipment.path, 'POST', shipment.payload);
    }
    case 'admin-return-order-item': {
      const shipment = shipmentPath(input, 'return');
      return write(shipment.path, 'POST', shipment.payload);
    }
    case 'admin-reconcile-run': return write('/v1/platform/admin/reconciliation/runs', 'POST', payload);
    case 'admin-reconcile': return write(`/v1/platform/admin/reconciliation/${requiredId(input)}/resolve`, 'POST', payload);
    case 'save-privacy-consent': return write('/v1/platform/me/privacy/consents', 'POST', payload);
  }
}

export const PLATFORM_ACTION_LABELS: Record<PlatformActionId, { zh: string; en: string }> = {
  favorite: { zh: '更新收藏', en: 'Update favorite' },
  wishlist: { zh: '更新心愿单', en: 'Update wishlist' },
  'save-note': { zh: '保存笔记', en: 'Save note' },
  'delete-note': { zh: '删除笔记', en: 'Delete note' },
  'update-progress': { zh: '更新进度', en: 'Update progress' },
  'submit-quiz': { zh: '提交测验', en: 'Submit quiz' },
  enroll: { zh: '报名课程', en: 'Enroll' },
  'create-order': { zh: '创建订单', en: 'Create order' },
  'start-payment': { zh: '发起支付', en: 'Start payment' },
  'cancel-order': { zh: '取消订单', en: 'Cancel order' },
  'apply-instructor': { zh: '提交讲师申请', en: 'Submit instructor application' },
  'save-instructor-course': { zh: '保存讲师课程', en: 'Save instructor course' },
  'delete-course': { zh: '归档课程', en: 'Archive course' },
  'save-course-lesson': { zh: '保存课时', en: 'Save lesson' },
  'delete-course-lesson': { zh: '归档课时', en: 'Archive lesson' },
  'save-course-quiz': { zh: '保存测验', en: 'Save quiz' },
  'delete-course-quiz': { zh: '归档测验', en: 'Archive quiz' },
  'issue-certificate': { zh: '签发证书', en: 'Issue certificate' },
  'submit-review': { zh: '提交评价', en: 'Submit review' },
  'check-in': { zh: '今日签到', en: 'Check in today' },
  'save-shipping-address': { zh: '保存收货地址', en: 'Save shipping address' },
  'delete-shipping-address': { zh: '删除收货地址', en: 'Delete shipping address' },
  'admin-save': { zh: '保存', en: 'Save' },
  'admin-delete': { zh: '删除', en: 'Delete' },
  'admin-review': { zh: '提交审核结果', en: 'Submit review' },
  'admin-payout': { zh: '标记已结算', en: 'Mark paid' },
  'admin-payout-generate': { zh: '生成结算单', en: 'Generate payout' },
  'admin-payout-approve': { zh: '批准结算单', en: 'Approve payout' },
  'redeem-invite': { zh: '兑换课程码', en: 'Redeem course code' },
  'admin-invite-batch': { zh: '批量生成兑换码', en: 'Generate code batch' },
  'admin-invite-order': { zh: '绑定订单号', en: 'Bind order reference' },
  'admin-invite-revoke': { zh: '撤销兑换码', en: 'Revoke code' },
  'qr-duplicate': { zh: '复制二维码', en: 'Duplicate QR code' },
  'qr-card-job': { zh: '生成卡片', en: 'Generate card' },
  'qr-toggle': { zh: '更新二维码状态', en: 'Update QR status' },
  'qr-template-restore': { zh: '恢复模板', en: 'Restore template' },
  'qr-template-purge': { zh: '永久删除模板', en: 'Permanently delete template' },
  'qr-template-reorder': { zh: '保存模板排序', en: 'Save template order' },
  'admin-refund': { zh: '发起退款', en: 'Issue refund' },
  'admin-ship-order-item': { zh: '登记发货', en: 'Record shipment' },
  'admin-deliver-order-item': { zh: '确认送达', en: 'Confirm delivery' },
  'admin-return-order-item': { zh: '确认退货并入库', en: 'Confirm return and restock' },
  'admin-reconcile-run': { zh: '导入对账单', en: 'Import statement' },
  'admin-reconcile': { zh: '解决差异', en: 'Resolve difference' },
  'save-privacy-consent': { zh: '保存隐私设置', en: 'Save privacy setting' },
};
