// Server-safe helpers for the /recon/[id] detail page (metadata + SSR SEO HTML).
// These run in the RSC/metadata pass, so they must NOT pull in client-only
// singletons (i18n-client, zustand auth-store) or browser APIs. The full
// recon-api / wca-events modules do, so we keep a minimal, pure surface here.
//
// Locale comes from the route [lang] param (we can't read the client i18n
// singleton on the server). The tr()/zh:inject Traditional pipeline is
// client-only and keyed on i18n.language, so this server module authors
// Simplified + English and maps zh-Hant onto the Simplified branch. The strings
// live in lookup objects (picked by key, not inline literal ternaries) so they
// stay out of the client i18n discipline — and the visible UI is still rendered
// by the interactive client island (ReconDetailClient) with full Traditional.
// This server block is aria-hidden SEO markup, not the user-visible chrome.

import type { ReconSolve } from '@cuberoot/shared';
import { apiUrl } from './api-base';
import { displayCuberName } from './cuber-name-display';
import { localizeCompName } from './comp-localize';
import { formatReconSingle } from './recon-utils';

const REVALIDATE = 86400; // 24h

/** Cache tag for a single recon's SSR/ISR data. Mutations (submit/alt edit/
 *  delete) call revalidateRecon(id) to bust this so the 24h ISR cache doesn't
 *  serve a stale detail page after an edit. */
export function reconCacheTag(id: string | number): string {
  return `recon-${id}`;
}

/** Any Chinese locale (zh / zh-Hant) uses the Simplified server-SEO strings. */
export function isZhLang(lang: string): boolean {
  return lang.startsWith('zh');
}

type Bi = { en: string; zh: string };
function s(L: Bi, isZh: boolean): string {
  return isZh ? L.zh : L.en;
}

// Bilingual labels for the server-rendered SEO block (Simplified + English).
// Picked by object key (s()), never an inline literal ternary, so they live
// outside the client i18n/tr() pipeline (server component, no i18n singleton).
export const SEO_LABELS = {
  reconWord: { en: 'reconstruction', zh: '复盘' },
  official: { en: 'WCA competition', zh: 'WCA 官方比赛' },
  nonOfficial: { en: 'Non-WCA solve', zh: '非官方还原' },
  solver: { en: 'Solver', zh: '选手' },
  event: { en: 'Event', zh: '项目' },
  comp: { en: 'Competition', zh: '比赛' },
  date: { en: 'Date', zh: '日期' },
  time: { en: 'Time', zh: '成绩' },
  average: { en: 'Average', zh: '平均' },
  method: { en: 'Method', zh: '方法' },
  scramble: { en: 'Scramble', zh: '打乱' },
  solution: { en: 'Solution', zh: '解法' },
} as const;

export function seoLabel(key: keyof typeof SEO_LABELS, isZh: boolean): string {
  return s(SEO_LABELS[key], isZh);
}

// Pure event display name (no i18n-client dependency). Mirrors the common subset
// of wca-events.eventDisplayName for the events recon data actually carries.
const EVENT_ZH: Record<string, string> = {
  '3x3': '三阶', '2x2': '二阶', '4x4': '四阶', '5x5': '五阶', '6x6': '六阶', '7x7': '七阶',
  '3bld': '三盲', '4bld': '四盲', '5bld': '五盲', 'mbld': '多盲',
  'oh': '单手', 'fmc': '最少步', 'feet': '脚拧',
  'mega': '五魔', 'pyra': '金字塔', 'clock': '魔表', 'skewb': '斜转', 'sq1': 'SQ1',
};
const EVENT_EN: Record<string, string> = {
  '3x3': '3×3', '2x2': '2×2', '4x4': '4×4', '5x5': '5×5', '6x6': '6×6', '7x7': '7×7',
  '3bld': '3BLD', '4bld': '4BLD', '5bld': '5BLD', 'mbld': 'MBLD',
  'oh': 'OH', 'fmc': 'FMC', 'feet': 'Feet',
  'mega': 'Mega', 'pyra': 'Pyra', 'clock': 'Clock', 'skewb': 'Skewb', 'sq1': 'SQ1',
};

export function eventNameForSeo(event: string | undefined, isZh: boolean): string {
  if (!event) return '';
  return (isZh ? EVENT_ZH : EVENT_EN)[event] ?? event;
}

/** Single-time display: prefer the stored truncated value, else format rawTime.
 *  FMC(最少步)normalizes to an integer move count via formatReconSingle. */
export function reconTimeText(solve: ReconSolve): string {
  return formatReconSingle(solve.event, solve.value, solve.rawTime);
}

/** Server-side fetch of one recon by id with ISR caching.
 *  Returns:
 *   - the recon on success (public / unlisted — anyone with the link);
 *   - the string 'private' when the recon exists but is私享 (server 403 + {private})
 *     — the SSR fetch is unauthenticated so it can never see private content; the
 *     detail page renders a client gate that re-fetches with the viewer's token;
 *   - null on genuine 404 / network failure → callers notFound(). */
export async function fetchReconForSeo(id: string): Promise<ReconSolve | 'private' | null> {
  try {
    const res = await fetch(apiUrl(`/v1/recon/${encodeURIComponent(id)}`), {
      next: { revalidate: REVALIDATE, tags: [reconCacheTag(id)] },
    });
    if (res.status === 403) {
      const body = await res.json().catch(() => null) as { private?: boolean } | null;
      return body?.private ? 'private' : null;
    }
    if (!res.ok) return null;
    return (await res.json()) as ReconSolve;
  } catch {
    return null;
  }
}

/** Server-side fetch of the "same scramble" matches for a recon, so the detail
 *  page can SSR them into the initial HTML (instant paint, no post-mount full
 *  /list download). Returns [] on any failure. */
export async function fetchSameScrambleForSeo(id: string): Promise<ReconSolve[]> {
  try {
    const res = await fetch(apiUrl(`/v1/recon/${encodeURIComponent(id)}/same-scramble`), {
      next: { revalidate: REVALIDATE, tags: [reconCacheTag(id)] },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ReconSolve[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function reconTitleParts(solve: ReconSolve, isZh: boolean): {
  person: string; event: string; time: string; comp: string;
} {
  return {
    person: solve.person ? displayCuberName(solve.person, isZh) : '',
    event: eventNameForSeo(solve.event, isZh),
    time: reconTimeText(solve),
    comp: solve.comp ? localizeCompName(solve.compWcaId ?? '', solve.comp, isZh) : '',
  };
}

const DESC_TAIL: Bi = {
  en: '— step-by-step reconstruction with scramble, solution and stats.',
  zh: '的逐步还原复盘（打乱、解法、统计）。',
};
const DESC_DE: Bi = { en: ' ', zh: ' 的 ' };

/** Page <title>. zh: "选手 项目 成绩 比赛 复盘 | CubeRoot"; en: "Person event time reconstruction — comp | CubeRoot". */
export function buildReconTitle(solve: ReconSolve, isZh: boolean): string {
  const { person, event, time, comp } = reconTitleParts(solve, isZh);
  const reconWord = seoLabel('reconWord', isZh);
  if (!isZh) {
    const head = [person, event, time].filter(Boolean).join(' ');
    const core = head ? `${head} ${reconWord}` : 'Reconstruction';
    const withComp = comp ? `${core} — ${comp}` : core;
    return `${withComp} | CubeRoot`;
  }
  const head = [person, event, time].filter(Boolean).join(' ');
  const withComp = comp ? `${head} ${comp}`.trim() : head;
  const core = `${withComp ? withComp + ' ' : ''}${reconWord}`.trim();
  return `${core} | CubeRoot`;
}

/** One-line meta description: method, time, comp, date. */
export function buildReconDescription(solve: ReconSolve, isZh: boolean): string {
  const { person, event, time, comp } = reconTitleParts(solve, isZh);
  const method = solve.method ?? '';
  const date = solve.date ? solve.date.slice(0, 10) : '';
  if (!isZh) {
    const subject = [person, event].filter(Boolean).join(' ');
    const bits = [
      subject ? `${subject} solve` : 'Solve',
      time ? `in ${time}` : '',
      method ? `using ${method}` : '',
      comp ? `at ${comp}` : '',
      date,
    ].filter(Boolean);
    return `${bits.join(', ')} ${s(DESC_TAIL, false)}`;
  }
  const de = s(DESC_DE, true);
  const scoreWord = seoLabel('time', true);
  const methodWord = seoLabel('method', true);
  const bits = [
    person && event ? `${person}${de}${event}` : (person || event),
    time ? `${scoreWord} ${time}` : '',
    method ? `${methodWord} ${method}` : '',
    comp,
    date,
  ].filter(Boolean);
  return `${bits.join('，')} ${s(DESC_TAIL, true)}`;
}

/** Extract the numeric recon id from a route segment that may carry a cosmetic
 *  slug suffix (`<id>` or `<id>-<slug>`). The id is the LEADING digit run, so
 *  the slug is purely decorative and never affects which recon we fetch. */
export function parseReconId(seg: string): string {
  return seg.match(/^\d+/)?.[0] ?? seg;
}

// Minimal identity surface needed for a slug. Both ReconSolve and the lighter
// search-index / sitemap rows satisfy this structurally, so emit sites with only
// partial fields can still produce a (shorter) slug instead of falling to bare id.
export type ReconSlugInput = {
  id: number | string;
  person?: string;
  event?: string;
  comp?: string;
  compWcaId?: string;
  round?: string;
};

/** ASCII-only slug derived from the recon identity (solver / event / comp /
 *  round). Lowercased, non-[a-z0-9] runs collapsed to single '-', trimmed,
 *  capped ~60 chars. Returns '' when nothing usable (e.g. a CJK-only name with
 *  no ASCII, no event/comp). Chinese is dropped entirely — slugs are ASCII so
 *  the URL needs no percent-encoding; the page itself still serves zh.  */
export function reconSlug(solve: ReconSlugInput): string {
  const personAscii = solve.person
    ? displayCuberName(solve.person, false) // ASCII branch (strips parenthesized CJK)
    : '';
  const event = eventNameForSeo(solve.event, false);
  const comp = solve.comp || solve.compWcaId || '';
  const round = solve.round ?? '';
  const raw = [personAscii, event, comp, round].filter(Boolean).join(' ');
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) return '';
  // Cap at ~60 chars without leaving a trailing partial-word hyphen.
  if (slug.length <= 60) return slug;
  return slug.slice(0, 60).replace(/-+[^-]*$/, '').replace(/-+$/, '');
}

/** Route segment for a recon detail link: bare `<id>` when no slug is derivable,
 *  else the keyword-rich `<id>-<slug>`. */
export function reconPathSeg(solve: ReconSlugInput): string {
  const id = String(solve.id);
  const slug = reconSlug(solve);
  return slug ? `${id}-${slug}` : id;
}

/** Canonical absolute URL (Pattern B: en bare, zh under /zh).
 *  `seg` (optional) overrides the path segment with a slugged `<id>-<slug>` so
 *  the canonical points at the keyword-rich URL. Backward-compatible: callers
 *  (e.g. app/sitemap.ts) may still pass just the bare id. */
export function reconCanonical(id: string, lang: string, seg?: string): string {
  const prefix = isZhLang(lang) ? '/zh' : '';
  return `https://cuberoot.me${prefix}/recon/${seg ?? id}`;
}

/** Parse a YouTube video id from a watch / youtu.be / embed / shorts URL. null otherwise. */
export function youTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:[^&]*&)*v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

/** ISO uploadDate for schema.org: pass through yyyy-mm-dd (valid Date) or full ISO. */
function isoUploadDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const d = date.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
}

/**
 * schema.org VideoObject for the recon's YouTube video, or null. Returns an
 * object ONLY when a YouTube id is parseable from solve.videoUrl (so we can emit
 * a valid thumbnailUrl). Non-YouTube / missing video → null (Google flags
 * incomplete VideoObjects, so we don't emit a partial one).
 */
export function buildVideoJsonLd(solve: ReconSolve, lang: string): object | null {
  if (!solve.videoUrl) return null;
  const urls = solve.videoUrl.split('\n').map((u) => u.trim()).filter(Boolean);
  let id: string | null = null;
  for (const u of urls) {
    id = youTubeId(u);
    if (id) break;
  }
  if (!id) return null;
  const isZh = isZhLang(lang);
  const { person, event, time } = reconTitleParts(solve, isZh);
  const name =
    [person, event, time].filter(Boolean).join(' ') || seoLabel('reconWord', isZh);
  const description = buildReconDescription(solve, isZh);
  const uploadDate = isoUploadDate(solve.date);
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    ...(uploadDate ? { uploadDate } : {}),
    contentUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
  };
}
