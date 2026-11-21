import type { Hono } from 'hono';
import { PLATFORM_HOME_AUTO_SECTIONS, PLATFORM_HOME_CONTENT_TYPES, isPlatformHomepageCover, type PlatformHomeAutoSection, type PlatformHomeContent, type PlatformHomeFeaturedItem, type PlatformHomepageSettings, type PlatformHomeReference, type PlatformHomeSlide } from '@cuberoot/shared/platform';
import { requirePlatformAdmin } from '../auth.js';
import { ACTIVE_COURSE_LEARNER_PREDICATE, PUBLIC_DIRECTORY_ENTRY_PREDICATE, platformDb, platformQuery, sendMutation, withIdempotency, type PlatformDb } from '../db.js';
import { badRequest } from '../errors.js';
import { privateNoStore, publicCache } from '../http.js';
import { enumField, isObject, isoTimestampField, nullableStringField, readJsonObject, stringArrayField, stringField } from '../validation.js';

const keyOf = ({ type, id }: PlatformHomeReference) => `${type}:${id}`;
const DEFAULT_SETTINGS: PlatformHomepageSettings = { featuredItems: [], sections: [...PLATFORM_HOME_AUTO_SECTIONS] };

async function readSettings(db: PlatformDb): Promise<PlatformHomepageSettings> {
  const [row] = await platformQuery<PlatformHomepageSettings & Record<string, unknown>>(db, `
    SELECT featured_items AS "featuredItems", sections FROM platform_homepage_settings WHERE singleton
  `);
  return row ?? DEFAULT_SETTINGS;
}

/** Only use the public directory, never private organization workspaces. */
async function readContent(db: PlatformDb, refs: PlatformHomeReference[] | null): Promise<PlatformHomeContent[]> {
  if (refs?.length === 0) return [];
  return platformQuery<PlatformHomeContent & Record<string, unknown>>(db, `
    WITH requested AS (SELECT type, id FROM jsonb_to_recordset(COALESCE($1::jsonb, '[]'::jsonb)) AS ref(type text, id text)),
    content AS (
      SELECT 'course'::text AS type, c.id::text AS id, r.title_zh AS "titleZh", r.title_en AS "titleEn",
        LEFT(r.summary_zh, 480) AS "summaryZh", LEFT(r.summary_en, 480) AS "summaryEn",
        COALESCE(NULLIF(r.presentation->>'coverUrl', ''), NULLIF(r.presentation->>'mobileCoverUrl', '')) AS "coverUrl",
        (SELECT string_agg(COALESCE(NULLIF(t.name_zh,''),NULLIF(t.name_en,''),i.display_name_snapshot), ' · ' ORDER BY i.display_name_snapshot)
         FROM platform_course_owners co JOIN platform_instructors i ON i.id=co.instructor_id
         LEFT JOIN teacher_directory_entries t ON t.id=i.teacher_entry_id AND t.kind='teacher'
         WHERE co.course_id=c.id AND co.status='active' AND i.status='active') AS "instructorNames"
      FROM platform_courses c JOIN platform_course_revisions r ON r.course_id=c.id AND r.revision=c.current_revision
      WHERE c.status='published'
      UNION ALL
      SELECT t.kind, t.id::text, t.name_zh, t.name_en, LEFT(t.description_zh, 480), LEFT(t.description_en, 480),
        (SELECT image->>'url' FROM jsonb_array_elements(t.images) image
         WHERE NULLIF(image->>'url', '') IS NOT NULL
         ORDER BY CASE WHEN image->>'kind' = CASE WHEN t.kind='teacher' THEN 'teaching' ELSE 'organization' END THEN 0
                       WHEN image->>'kind'='portrait' THEN 1 ELSE 2 END LIMIT 1), NULL::text
      FROM teacher_directory_entries t WHERE ${PUBLIC_DIRECTORY_ENTRY_PREDICATE}
      UNION ALL
      SELECT 'event', e.id::text, e.title_zh, e.title_en, LEFT(e.description_zh, 480), LEFT(e.description_en, 480), NULL::text, NULL::text
      FROM platform_events e WHERE e.status='published' AND e.ends_at>NOW()
    )
    SELECT content.* FROM content
    WHERE $1::jsonb IS NULL OR EXISTS (SELECT 1 FROM requested WHERE requested.type=content.type AND requested.id=content.id)
    ORDER BY type, "titleZh", "titleEn", id
  `, [refs]);
}

type RankedContent = PlatformHomeReference & { section: PlatformHomeAutoSection };
async function readRankedContent(db: PlatformDb): Promise<RankedContent[]> {
  return platformQuery<RankedContent & Record<string, unknown>>(db, `
    WITH learner_counts AS (
      SELECT e.course_id, COUNT(DISTINCT e.user_id) AS total,
        COUNT(DISTINCT e.user_id) FILTER (WHERE e.created_at >= (date_trunc('week', NOW() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai')) AS weekly
      FROM platform_course_entitlements e
      WHERE ${ACTIVE_COURSE_LEARNER_PREDICATE}
      GROUP BY e.course_id
    ), ranked AS (
      SELECT c.id::text AS id, c.published_at, COALESCE(l.total, 0) AS total, COALESCE(l.weekly, 0) AS weekly
      FROM platform_courses c LEFT JOIN learner_counts l ON l.course_id=c.id WHERE c.status='published'
    )
    (SELECT 'popular' AS section, 'course' AS type, id FROM ranked WHERE total>0 ORDER BY total DESC, published_at DESC, id LIMIT 1)
    UNION ALL
    (SELECT 'weekly', 'course', id FROM ranked WHERE weekly>0 ORDER BY weekly DESC, published_at DESC, id LIMIT 1)
    UNION ALL
    (SELECT 'latest', 'course', id FROM ranked ORDER BY published_at DESC, id LIMIT 1)
    UNION ALL
    (SELECT 'teacher', 'teacher', id::text FROM teacher_directory_entries t WHERE ${PUBLIC_DIRECTORY_ENTRY_PREDICATE} AND is_curated AND kind='teacher' ORDER BY updated_at DESC, id LIMIT 1)
    UNION ALL
    (SELECT 'organization', 'organization', id::text FROM teacher_directory_entries WHERE is_visible AND is_curated AND kind='organization' ORDER BY updated_at DESC, id LIMIT 1)
    UNION ALL
    (SELECT 'event', 'event', id::text FROM platform_events WHERE status='published' AND ends_at>NOW() ORDER BY starts_at, id LIMIT 1)
  `);
}

export function selectHomepageSlides(settings: PlatformHomepageSettings, ranks: RankedContent[], content: PlatformHomeContent[], now: number): PlatformHomeSlide[] {
  const sources = new Map(content.map(item => [keyOf(item), item]));
  const used = new Set<string>();
  const slides: PlatformHomeSlide[] = [];
  function add(ref: PlatformHomeReference, section: PlatformHomeSlide['section'], coverUrl?: string | null) {
    const key = keyOf(ref), item = sources.get(key);
    if (!item || used.has(key)) return;
    used.add(key);
    slides.push({ ...item, section, coverUrl: coverUrl || item.coverUrl });
  }
  for (const item of settings.featuredItems) {
    if ((item.startsAt && Date.parse(item.startsAt) > now) || (item.endsAt && Date.parse(item.endsAt) <= now)) continue;
    add(item, 'featured', item.coverUrl);
  }
  for (const section of settings.sections) {
    const rank = ranks.find(item => item.section === section);
    if (rank) add(rank, section);
  }
  return slides;
}

export function parseHomepageSettings(body: Record<string, unknown>): PlatformHomepageSettings {
  const sections = stringArrayField(body, 'sections', { maxItems: PLATFORM_HOME_AUTO_SECTIONS.length, maxLength: 20 });
  if (!sections || new Set(sections).size !== sections.length || sections.some(section => !PLATFORM_HOME_AUTO_SECTIONS.includes(section as PlatformHomeAutoSection))) badRequest('Invalid recommendation sections');
  if (!Array.isArray(body.featuredItems) || body.featuredItems.length > 12) badRequest('At most 12 featured items are allowed');
  const featuredItems: PlatformHomeFeaturedItem[] = body.featuredItems.map(item => {
    if (!isObject(item)) badRequest('Invalid featured item');
    const type = enumField(item, 'type', PLATFORM_HOME_CONTENT_TYPES, { required: true })!;
    const id = stringField(item, 'id', { required: true, max: 128, pattern: /^[A-Za-z0-9-]+$/ })!;
    const coverUrl = nullableStringField(item, 'coverUrl', { max: 2048 }) ?? null;
    if (coverUrl && !isPlatformHomepageCover(coverUrl)) badRequest('Invalid cover URL');
    const startsAt = isoTimestampField(item, 'startsAt') ?? null;
    const endsAt = isoTimestampField(item, 'endsAt') ?? null;
    if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) badRequest('End time must be after start time');
    return { type, id, coverUrl, startsAt, endsAt };
  });
  if (new Set(featuredItems.map(keyOf)).size !== featuredItems.length) badRequest('Duplicate featured content');
  return { featuredItems, sections: sections as PlatformHomeAutoSection[] };
}

export function registerHomepageRoutes(platformCatalogRoutes: Hono): void {
  platformCatalogRoutes.get('/platform/homepage', async c => {
    const db = platformDb();
    const settings = await readSettings(db);
    const ranks = settings.sections.length ? await readRankedContent(db) : [];
    const content = await readContent(db, [...settings.featuredItems, ...ranks]);
    const items = selectHomepageSlides(settings, ranks, content, Date.now());
    publicCache(c, items.length > 0);
    return c.json({ items });
  });
  platformCatalogRoutes.get('/platform/admin/homepage', async c => {
    await requirePlatformAdmin(c);
    const db = platformDb();
    const [settings, content] = await Promise.all([readSettings(db), readContent(db, null)]);
    privateNoStore(c);
    return c.json({ settings, content });
  });
  platformCatalogRoutes.put('/platform/admin/homepage', async c => {
    const actor = await requirePlatformAdmin(c);
    const settings = parseHomepageSettings(await readJsonObject(c));
    const result = await withIdempotency(c, actor, 'platform.admin.homepage.update', settings, async db => {
      const available = await readContent(db, settings.featuredItems);
      if (available.length !== settings.featuredItems.length) badRequest('Featured content must be public and available');
      await platformQuery(db, `INSERT INTO platform_homepage_settings (singleton, featured_items, sections)
        VALUES (TRUE, $1::jsonb, $2::jsonb) ON CONFLICT (singleton) DO UPDATE
        SET featured_items=EXCLUDED.featured_items, sections=EXCLUDED.sections, updated_at=NOW()`,
      [settings.featuredItems, settings.sections]);
      return { status: 200, body: { settings } };
    });
    return sendMutation(c, result);
  });
}
