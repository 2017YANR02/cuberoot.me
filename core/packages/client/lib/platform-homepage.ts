import { isPlatformHomepageCover, type PlatformHomeContent, type PlatformHomeContentType, type PlatformHomepageSettings, type PlatformHomeSlide } from '@cuberoot/shared/platform';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { sessionFetch } from './session-fetch';
import { loadPlatformResource } from './platform-gateway';
import { courseCatalogDetails } from './platform-course-catalog';
import type { PlatformEntity } from './platform-types';

export const homeContentLabels: Record<PlatformHomeContentType, { zh: string; en: string }> = {
  course: { zh: '课程', en: 'Course' }, teacher: { zh: '讲师', en: 'Instructor' },
  organization: { zh: '机构', en: 'School' }, event: { zh: '活动', en: 'Event' },
};
export const homeSectionLabels = {
  featured: { zh: '精选推荐', en: 'Featured' }, popular: { zh: '人气课程', en: 'Popular course' },
  weekly: { zh: '本周热门', en: 'Trending this week' }, latest: { zh: '最新课程', en: 'New course' },
  teacher: { zh: '讲师推荐', en: 'Recommended instructor' }, organization: { zh: '机构推荐', en: 'Recommended school' },
  event: { zh: '近期活动', en: 'Upcoming event' },
  catalog: { zh: '课程推荐', en: 'Explore courses' },
} as const;
export const homeContentKey = (item: Pick<PlatformHomeContent, 'type' | 'id'>) => `${item.type}:${item.id}`;
export function homeContentHref(item: PlatformHomeContent) {
  return item.type === 'course' ? `/platform/courses/${encodeURIComponent(item.id)}`
    : item.type === 'event' ? `/platform/events/${encodeURIComponent(item.id)}`
      : `/platform/teachers/${encodeURIComponent(item.id)}`;
}
export function safeHomepageCover(value: string | null | undefined): string | null {
  return value && isPlatformHomepageCover(value) ? value : null;
}

export function homepageCatalogSlide(item: PlatformEntity): PlatformHomeSlide {
  const details = courseCatalogDetails(item);
  return { type: 'course', section: 'catalog', id: item.id,
    titleZh: String(item.data?.titleZh || item.title), titleEn: String(item.data?.titleEn || item.title),
    summaryZh: String(item.data?.summaryZh || item.summary || ''), summaryEn: String(item.data?.summaryEn || item.summary || ''),
    coverUrl: details.coverUrl ?? null, instructorNames: details.instructors.join(' · ') || null };
}

export async function loadHomepageSlides(signal: AbortSignal): Promise<PlatformHomeSlide[]> {
  const response = await sessionFetch(apiUrl('/v1/platform/homepage'), { signal, cache: 'no-store' });
  // During a staged web/API deployment, show a real catalog entry, not an invented ranking.
  if (response.status === 404) {
    const { items } = await loadPlatformResource('courses', { params: {}, page: 1, pageSize: 1, sort: 'updated', signal });
    return items.filter(item => item.status === 'published').map(homepageCatalogSlide);
  }
  return (await handleApi<{ items: PlatformHomeSlide[] }>(response)).items;
}

export async function loadHomepageSettings(signal: AbortSignal) {
  return handleApi<{ settings: PlatformHomepageSettings; content: PlatformHomeContent[] }>(await sessionFetch(apiUrl('/v1/platform/admin/homepage'), {
    signal, cache: 'no-store', headers: authHeaders(false),
  }));
}
export async function saveHomepageSettings(settings: PlatformHomepageSettings) {
  return handleApi<{ settings: PlatformHomepageSettings }>(await sessionFetch(apiUrl('/v1/platform/admin/homepage'), {
    method: 'PUT', cache: 'no-store', headers: { ...authHeaders(), 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(settings),
  }));
}
