import { ALL_EVENT_IDS } from './event-constants';
import { CSTIMER_SOLVABLE_IDS } from './cstimer-scramble';
import { commerceRecord } from './platform-commerce-format';
import { loadPlatformResource } from './platform-gateway';
import type { PlatformEntity, PlatformResourceResult } from './platform-types';
import { eventDisplayName } from './wca-events';
import { platformTrialLessonIds } from '@cuberoot/shared/platform';
import { platformCourseLessonSection } from './platform-routes';

export const COURSE_TOPICS = {
  beginner: { zh: '入门复原', en: 'Beginner solving' },
  speed: { zh: '速度提升', en: 'Speed improvement' },
  practice: { zh: '专项训练', en: 'Focused practice' },
  theory: { zh: '理论知识', en: 'Theory' },
} as const;

export type CourseTopic = keyof typeof COURSE_TOPICS;
export const COURSE_TOPIC_IDS = Object.keys(COURSE_TOPICS) as CourseTopic[];
export const COURSE_FILTER_THRESHOLD = 6;
const PUZZLE_IDS = new Set([...ALL_EVENT_IDS, ...CSTIMER_SOLVABLE_IDS]);

export function isCourseCatalogTag(tag: string): boolean {
  const value = tag.trim();
  return value.startsWith('puzzle:') && PUZZLE_IDS.has(value.slice(7))
    || COURSE_TOPIC_IDS.some(topic => value === `topic:${topic}`);
}

function nonEmptyText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function courseCoverUrl(value: unknown): string | undefined {
  const url = nonEmptyText(value);
  return /^(?:\/(?![/\\])|https?:\/\/)/i.test(url) ? url : undefined;
}

export function courseCatalogDetails(course: PlatformEntity) {
  const data = course.data ?? {};
  const presentation = commerceRecord(data.presentation);
  // Use the catalog's existing editable tags, with one entry per puzzle or topic.
  const tags = Array.isArray(presentation.tags) ? presentation.tags.map(nonEmptyText) : [];
  const puzzles = tags.filter(tag => tag.startsWith('puzzle:')).map(tag => tag.slice(7)).filter(id => PUZZLE_IDS.has(id));
  const topics = COURSE_TOPIC_IDS.filter(topic => tags.includes(`topic:${topic}`));
  const ruiminCourse = data.slug === 'yan-ruimin-3x3-beginner';
  const coverUrl = courseCoverUrl(presentation.coverUrl);
  const mobileCoverUrl = courseCoverUrl(presentation.mobileCoverUrl);
  const instructorRecords = Array.isArray(data.instructors) ? data.instructors.map(commerceRecord) : [];
  const instructorNames = (language: 'Zh' | 'En', other: 'Zh' | 'En') => instructorRecords
    .map(instructor => nonEmptyText(instructor[`displayName${language}`]) || nonEmptyText(instructor[`displayName${other}`]) || nonEmptyText(instructor.displayName))
    .filter(Boolean);
  const instructors = instructorNames('Zh', 'En');
  const instructorsEn = instructorNames('En', 'Zh');
  const lessonCount = Number(data.lessonCount);
  return {
    puzzles: ruiminCourse && !puzzles.length ? ['333'] : puzzles,
    topics: ruiminCourse && !topics.length ? ['beginner' as const] : topics,
    coverUrl: coverUrl ?? (ruiminCourse ? '/images/ruimin/gallery/photo-03.webp' : mobileCoverUrl),
    mobileCoverUrl: mobileCoverUrl ?? (ruiminCourse && !coverUrl ? '/images/ruimin/gallery/course-cover-portrait.webp' : undefined),
    instructors: instructors.length || !ruiminCourse ? instructors : ['颜瑞民'],
    instructorsEn: instructorsEn.length || !ruiminCourse ? instructorsEn : ['Yan Ruimin'],
    lessonCount: data.lessonCount != null && Number.isInteger(lessonCount) && lessonCount >= 0 ? lessonCount : undefined,
    level: nonEmptyText(presentation.level),
    tags,
  };
}

export function matchesCourseCatalog(
  course: PlatformEntity,
  details: ReturnType<typeof courseCatalogDetails>,
  filters: { q: string; puzzle: string; category: string; trialOnly?: boolean },
): boolean {
  if (filters.puzzle && !details.puzzles.includes(filters.puzzle)) return false;
  if (filters.category && !details.topics.some(topic => topic === filters.category)) return false;
  if (filters.trialOnly && !hasCourseTrial(course)) return false;
  const terms = filters.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const data = course.data ?? {};
  const searchable = [
    course.title, course.summary, data.titleZh, data.titleEn, data.summaryZh, data.summaryEn,
    ...details.instructors, ...details.instructorsEn, details.level, ...details.tags,
    ...details.topics.flatMap(topic => [COURSE_TOPICS[topic].zh, COURSE_TOPICS[topic].en]),
    ...details.puzzles.flatMap(id => [eventDisplayName(id, true), eventDisplayName(id, false)]),
  ].join(' ').toLowerCase();
  return terms.every(term => searchable.includes(term));
}

/** Catalog metadata advertises previews; detail data confirms their public scope. */
export function hasCourseTrial(course: PlatformEntity): boolean {
  const ids = platformTrialLessonIds(course.data?.presentation);
  const lessons = course.data?.lessons;
  return Array.isArray(lessons)
    ? lessons.map(commerceRecord).some(lesson => lesson.accessScope === 'public' && platformCourseLessonSection(lesson, ids) === 'trial')
    : Boolean(ids?.length);
}

/** The public endpoint paginates at 60 courses. Filters and facets need the entire snapshot. */
export async function loadCourseCatalog(signal: AbortSignal): Promise<PlatformEntity[]> {
  const items = new Map<string, PlatformEntity>();
  let count = 0;
  for (let page = 1; ; page++) {
    const batch = await loadPlatformResource('courses', { params: {}, page, pageSize: 60, sort: 'updated', signal });
    if (signal.aborted) return [];
    for (const item of batch.items) items.set(item.id, item);
    count += batch.items.length;
    if (!batch.items.length || (batch.total === undefined ? batch.items.length < (batch.pageSize ?? 60) : count >= batch.total)) break;
  }
  return [...items.values()];
}

/** Legacy public catalog rows may omit trial IDs. Resolve only missing
 * metadata from the existing public detail endpoint, without blocking the list. */
export async function loadLegacyCatalogPreviews(items: PlatformEntity[], signal: AbortSignal): Promise<PlatformEntity[]> {
  const missing = items.filter(item => platformTrialLessonIds(item.data?.presentation) === undefined && !Array.isArray(item.data?.lessons));
  if (!missing.length) return items;
  const resolved = new Map<string, string[]>();
  for (let offset = 0; offset < missing.length && !signal.aborted; offset += 6) {
    await Promise.allSettled(missing.slice(offset, offset + 6).map(async item => {
      const result = await loadPlatformResource('courses', { params: { id: item.id }, signal });
      const detail = result.items.find(course => course.id === item.id)?.data;
      if (!Array.isArray(detail?.lessons)) return;
      const trialIds = platformTrialLessonIds(detail.presentation);
      resolved.set(item.id, detail.lessons.map(commerceRecord)
        .flatMap(lesson => typeof lesson.id === 'string' && lesson.accessScope === 'public' && platformCourseLessonSection(lesson, trialIds) === 'trial' ? [lesson.id] : []));
    }));
  }
  if (signal.aborted || !resolved.size) return items;
  return items.map(item => {
    const ids = resolved.get(item.id);
    return ids ? { ...item, data: { ...item.data, presentation: { ...commerceRecord(item.data?.presentation), trialLessonIds: ids } } } : item;
  });
}

export function courseLessonAccess(data: Record<string, unknown>) {
  const entries = Array.isArray(data.lessonAccess) ? data.lessonAccess.map(commerceRecord) : [];
  const allowed = new Set(entries.map(lesson => lesson.id));
  return {
    entries,
    canWatch: (id: string, scope: unknown) => scope == null || scope === 'public' || allowed.has(id),
  };
}

/** Older API versions check access at the lesson endpoint and omit the course access list. */
export async function loadLegacyCourseLessonAccess(result: PlatformResourceResult, signal: AbortSignal): Promise<PlatformResourceResult> {
  const course = result.items[0];
  const data = course?.data;
  if (!data || Array.isArray(data.lessonAccess) || !Array.isArray(data.lessons)) return result;

  const entitledIds = data.lessons.map(commerceRecord)
    .filter(lesson => lesson.accessScope === 'entitled')
    .flatMap(lesson => typeof lesson.id === 'string' ? [lesson.id] : []);
  const lessonAccess: { id: string }[] = [];
  const batchSize = 6;
  for (let offset = 0; offset < entitledIds.length && !signal.aborted; offset += batchSize) {
    const ids = entitledIds.slice(offset, offset + batchSize);
    const checks = await Promise.allSettled(ids.map(lessonId => loadPlatformResource('course-lesson', {
      params: { id: course.id, lessonId },
      signal,
    })));
    for (const [index, check] of checks.entries()) {
      const id = ids[index]!;
      if (check.status === 'fulfilled' && check.value.items.some(lesson => lesson.id === id)) {
        lessonAccess.push({ id });
      }
    }
  }
  if (signal.aborted) return result;
  return { ...result, items: [{ ...course, data: { ...data, lessonAccess } }, ...result.items.slice(1)] };
}
