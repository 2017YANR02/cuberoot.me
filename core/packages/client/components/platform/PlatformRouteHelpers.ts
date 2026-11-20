import { productHref } from '@/lib/shop';
import { useT } from '@/hooks/useT';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';

export function titleFor(t: ReturnType<typeof useT>, definition: PlatformRouteDefinition): string {
  return t(definition.title.zh, definition.title.en);
}

export function instructorApplicationStatus(status: string, t: ReturnType<typeof useT>): string {
  switch (status) {
    case 'pending': return t('待审核', 'Pending review');
    case 'approved': return t('已通过', 'Approved');
    case 'rejected': return t('已拒绝', 'Rejected');
    case 'withdrawn': return t('已撤回', 'Withdrawn');
    default: return t('状态待确认', 'Status unavailable');
  }
}

export function localDetailHref(definition: PlatformRouteDefinition, entity: PlatformEntity): string | null {
  const base = `/platform/${definition.pattern}`.replace(/\/$/, '');
  if (definition.kind !== 'collection') return null;
  if (definition.id === 'shop') return productHref(entity);
  if (definition.id === 'teachers') return `/platform/teachers/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'community') return `/platform/community/posts/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'community-circle') return `/platform/community/posts/${encodeURIComponent(entity.id)}`;
  if (['courses', 'paths', 'events', 'news', 'orders'].includes(definition.id)) {
    return `${base}/${encodeURIComponent(entity.id)}`;
  }
  const adminCollections: Record<string, string> = {
    'admin-algorithms': 'algorithms',
    'admin-applications': 'teacher-applications',
    'admin-courses': 'courses',
    'admin-events': 'events',
    'admin-teachers': 'teachers',
    'admin-news': 'news',
    'admin-orders': 'orders',
    'admin-products': 'products',
    'admin-qr': 'qr',
  };
  if (adminCollections[definition.id]) return `/platform/admin/${adminCollections[definition.id]}/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'instructor-courses') return `/platform/instructor/courses/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'account-courses') return `/platform/courses/${encodeURIComponent(entity.id)}`;
  if (definition.id === 'account-favorites') {
    const targetType = entity.data?.targetType;
    if (targetType === 'course') return `/platform/courses/${encodeURIComponent(entity.id)}`;
    if (targetType === 'product') return productHref(entity);
    if (targetType === 'news') return `/platform/news/${encodeURIComponent(entity.id)}`;
    if (targetType === 'event') return `/platform/events/${encodeURIComponent(entity.id)}`;
  }
  if (definition.id === 'account-wishlist') return productHref(entity);
  return null;
}
