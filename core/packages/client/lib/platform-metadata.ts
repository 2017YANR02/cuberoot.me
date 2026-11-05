import type { Metadata } from 'next';
import { apiUrl } from './api-base';
import { metadataFromEntry } from './page-meta';
import { fillPlatformParams, matchPlatformRoute } from './platform-routes';
import { findShopDesign } from './shop-designs';

async function detailMetadata(id: string, resourceId: string | undefined) {
  const resources: Record<string, string> = { 'course-detail': 'courses', 'path-detail': 'paths', 'event-detail': 'events', 'news-detail': 'news', 'product-detail': 'products' };
  if (!resources[id] || !resourceId) return null;
  try {
    const response = await fetch(apiUrl('/v1/platform/' + resources[id] + '/' + encodeURIComponent(resourceId) + '?v=3'), { next: { revalidate: 60 }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const payload = await response.json() as Record<string, unknown>;
    const record = (payload.course ?? payload.path ?? payload.event ?? payload.article ?? payload.product ?? payload.item ?? payload) as Record<string, unknown>;
    const titleZh = typeof record.titleZh === 'string' ? record.titleZh : '';
    const titleEn = typeof record.titleEn === 'string' ? record.titleEn : '';
    if (!titleZh && !titleEn) return null;
    const description = (language: 'Zh' | 'En') => {
      for (const key of ['summary', 'excerpt', 'description']) {
        const value = record[key + language];
        if (typeof value === 'string' && value.trim()) return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').slice(0, 180);
      }
      return '';
    };
    const zh = description('Zh'); const en = description('En');
    return { title: { zh: titleZh || titleEn, en: titleEn || titleZh }, description: { zh: zh || en, en: en || zh } };
  } catch { return null; }
}

export async function platformPageMetadata(lang: string, segments: string[]): Promise<Metadata> {
  const match = matchPlatformRoute(segments);
  if (!match) return { robots: { index: false, follow: false } };

  const noindex = match.definition.access !== 'public'
    || ['shop-cart', 'shop-checkout'].includes(match.definition.id)
    || ['search', 'offline', 'login', 'notifications', 'online-competition-preview', 'course-lesson', 'course-section-introduction', 'course-section-trial', 'course-section-core', 'certificate', 'qr'].includes(match.definition.id);
  const detail = noindex ? null : await detailMetadata(match.definition.id, match.params.id);
  const design = match.definition.id === 'product-detail' ? findShopDesign(match.params.id) : undefined;
  const metadata = metadataFromEntry(detail ?? (design ? { title: design.title, description: design.summary } : {
    title: match.definition.title,
    description: match.definition.description,
  }), lang);
  const canonicalPath = match.definition.canonicalHref
    ? fillPlatformParams(match.definition.canonicalHref, match.params)
    : `/platform/${segments.map(encodeURIComponent).join('/')}`;
  const en = `https://cuberoot.me${canonicalPath}`;
  const zh = `https://cuberoot.me/zh${canonicalPath}`;

  return {
    ...metadata,
    ...(match.definition.id === 'order-detail' ? { referrer: 'origin' as const } : {}),
    alternates: noindex ? undefined : {
      canonical: lang === 'zh' ? zh : en,
      languages: { en, zh, 'x-default': en },
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
