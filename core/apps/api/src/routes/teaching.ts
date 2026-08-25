/** 课程可维护内容：公开读取，管理员维护。Schema: migrations 0127、0133、0134。 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { getIp } from '../utils/analytics_helpers.js';
import { checkRateLimit, requireAdminOrApiKey } from '../utils/recon_helpers.js';

export const teachingRoutes = new Hono();

type Track = '333' | '222';

interface LessonRow {
  id: number | string;
  track: Track;
  position: number;
  title_zh: string;
  title_en: string;
  description_zh: string;
  description_en: string;
  minutes: number;
  created_at: Date;
  updated_at: Date;
}

interface LessonInput {
  track?: unknown;
  titleZh?: unknown;
  titleEn?: unknown;
  descriptionZh?: unknown;
  descriptionEn?: unknown;
  minutes?: unknown;
}

interface TrialLessonRow {
  lesson_id: string;
  title_zh: string;
  outcome_zh: string;
  title_en: string | null;
  outcome_en: string | null;
  minutes: number;
  shots_zh: string[];
  script_zh: string[];
  shots_en: string[] | null;
  script_en: string[] | null;
  english_stale: boolean;
  content_revision: number;
  created_at: Date;
  updated_at: Date;
}

interface TrialLessonInput {
  titleZh?: unknown;
  outcomeZh?: unknown;
  minutes?: unknown;
  shotsZh?: unknown;
  scriptZh?: unknown;
}

interface TrialLessonEnglishInput {
  titleEn?: unknown;
  outcomeEn?: unknown;
  shotsEn?: unknown;
  scriptEn?: unknown;
  sourceRevision?: unknown;
}

const COLUMNS = `id, track, position, title_zh, title_en,
  description_zh, description_en, minutes, created_at, updated_at`;
const TRIAL_COLUMNS = `lesson_id, title_zh, outcome_zh, title_en, outcome_en, minutes,
  shots_zh, script_zh, shots_en, script_en, english_stale, content_revision, created_at, updated_at`;

function noStore(c: { header: (key: string, value: string) => void }) {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
}

function rowToJson(row: LessonRow) {
  return {
    id: Number(row.id),
    track: row.track,
    position: Number(row.position),
    titleZh: row.title_zh,
    titleEn: row.title_en,
    descriptionZh: row.description_zh,
    descriptionEn: row.description_en,
    minutes: Number(row.minutes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function textField(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.length > max) return null;
  return value.trim();
}

function normalizeLesson(body: LessonInput, requireTrack: boolean) {
  const track = body.track === '333' || body.track === '222' ? body.track : null;
  const titleZh = textField(body.titleZh, 200);
  const titleEn = textField(body.titleEn, 200);
  const descriptionZh = textField(body.descriptionZh ?? '', 20000);
  const descriptionEn = textField(body.descriptionEn ?? '', 20000);
  const minutes = Number(body.minutes);
  if ((requireTrack && !track) || !titleZh || !titleEn || descriptionZh === null || descriptionEn === null) return null;
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) return null;
  return { track, titleZh, titleEn, descriptionZh, descriptionEn, minutes };
}

function textList(value: unknown, maxItems: number, maxItemLength: number): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxItems) return null;
  const items = value.map((item) => textField(item, maxItemLength));
  if (items.some((item) => !item)) return null;
  return items as string[];
}

function normalizeTrialLesson(body: TrialLessonInput) {
  const titleZh = textField(body.titleZh, 200);
  const outcomeZh = textField(body.outcomeZh, 1000);
  const minutes = Number(body.minutes);
  const shotsZh = textList(body.shotsZh, 30, 2000);
  const scriptZh = textList(body.scriptZh, 100, 5000);
  if (!titleZh || !outcomeZh || !shotsZh || !scriptZh) return null;
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) return null;
  return { titleZh, outcomeZh, minutes, shotsZh, scriptZh };
}

function normalizeTrialLessonEnglish(body: TrialLessonEnglishInput) {
  const titleEn = textField(body.titleEn, 200);
  const outcomeEn = textField(body.outcomeEn, 1000);
  const shotsEn = textList(body.shotsEn, 30, 2000);
  const scriptEn = textList(body.scriptEn, 100, 5000);
  const sourceRevision = Number(body.sourceRevision);
  if (!titleEn || !outcomeEn || !shotsEn || !scriptEn) return null;
  if (!Number.isInteger(sourceRevision) || sourceRevision < 1) return null;
  return { titleEn, outcomeEn, shotsEn, scriptEn, sourceRevision };
}

function validTrialLessonId(lessonId: string) {
  return lessonId.length <= 80 && /^trial-[a-z0-9-]+$/.test(lessonId);
}

function trialRowToJson(row: TrialLessonRow) {
  return {
    lessonId: row.lesson_id,
    titleZh: row.title_zh,
    outcomeZh: row.outcome_zh,
    titleEn: row.title_en,
    outcomeEn: row.outcome_en,
    minutes: Number(row.minutes),
    shotsZh: row.shots_zh,
    scriptZh: row.script_zh,
    shotsEn: row.shots_en,
    scriptEn: row.script_en,
    needsEnglishSync: row.english_stale,
    contentRevision: Number(row.content_revision),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

teachingRoutes.get('/teaching/trial', async (c) => {
  noStore(c);
  const rows = await query<TrialLessonRow>(
    `SELECT ${TRIAL_COLUMNS}
     FROM teaching_trial_lesson_overrides ORDER BY lesson_id`,
  );
  return c.json(rows.map(trialRowToJson));
});

teachingRoutes.put('/teaching/trial/:lessonId/english', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);
  const lessonId = c.req.param('lessonId');
  if (!validTrialLessonId(lessonId)) return c.json({ error: 'Invalid trial lesson id' }, 400);
  const lesson = normalizeTrialLessonEnglish(await c.req.json<TrialLessonEnglishInput>());
  if (!lesson) return c.json({ error: 'Invalid English trial lesson' }, 400);

  const current = await query<{ shots_count: number | string; script_count: number | string }>(
    `SELECT jsonb_array_length(shots_zh) AS shots_count,
       jsonb_array_length(script_zh) AS script_count
     FROM teaching_trial_lesson_overrides WHERE lesson_id = ?`,
    [lessonId],
  );
  if (current.length === 0) return c.json({ error: 'Trial lesson not found' }, 404);
  if (Number(current[0].shots_count) !== lesson.shotsEn.length
    || Number(current[0].script_count) !== lesson.scriptEn.length) {
    return c.json({ error: 'English item counts must match Chinese content' }, 409);
  }

  const rows = await query<TrialLessonRow>(
    `UPDATE teaching_trial_lesson_overrides SET
       title_en = ?, outcome_en = ?, shots_en = ?::jsonb, script_en = ?::jsonb,
       english_stale = FALSE
     WHERE lesson_id = ? AND content_revision = ? RETURNING ${TRIAL_COLUMNS}`,
    [lesson.titleEn, lesson.outcomeEn, lesson.shotsEn, lesson.scriptEn, lessonId, lesson.sourceRevision],
  );
  if (rows.length === 0) return c.json({ error: 'Chinese content changed during translation; refetch and retry' }, 409);
  return c.json(trialRowToJson(rows[0]));
});

teachingRoutes.put('/teaching/trial/:lessonId', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);
  const lessonId = c.req.param('lessonId');
  if (!validTrialLessonId(lessonId)) return c.json({ error: 'Invalid trial lesson id' }, 400);
  const lesson = normalizeTrialLesson(await c.req.json<TrialLessonInput>());
  if (!lesson) return c.json({ error: 'Invalid trial lesson' }, 400);

  const rows = await query<TrialLessonRow>(
    `INSERT INTO teaching_trial_lesson_overrides
       (lesson_id, title_zh, outcome_zh, minutes, shots_zh, script_zh)
     VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb)
     ON CONFLICT (lesson_id) DO UPDATE SET
       title_zh = EXCLUDED.title_zh,
       outcome_zh = EXCLUDED.outcome_zh,
       minutes = EXCLUDED.minutes,
       shots_zh = EXCLUDED.shots_zh,
       script_zh = EXCLUDED.script_zh,
       title_en = CASE
         WHEN jsonb_array_length(teaching_trial_lesson_overrides.shots_zh) = jsonb_array_length(EXCLUDED.shots_zh)
          AND jsonb_array_length(teaching_trial_lesson_overrides.script_zh) = jsonb_array_length(EXCLUDED.script_zh)
         THEN teaching_trial_lesson_overrides.title_en ELSE NULL END,
       outcome_en = CASE
         WHEN jsonb_array_length(teaching_trial_lesson_overrides.shots_zh) = jsonb_array_length(EXCLUDED.shots_zh)
          AND jsonb_array_length(teaching_trial_lesson_overrides.script_zh) = jsonb_array_length(EXCLUDED.script_zh)
         THEN teaching_trial_lesson_overrides.outcome_en ELSE NULL END,
       shots_en = CASE
         WHEN jsonb_array_length(teaching_trial_lesson_overrides.shots_zh) = jsonb_array_length(EXCLUDED.shots_zh)
          AND jsonb_array_length(teaching_trial_lesson_overrides.script_zh) = jsonb_array_length(EXCLUDED.script_zh)
         THEN teaching_trial_lesson_overrides.shots_en ELSE NULL END,
       script_en = CASE
         WHEN jsonb_array_length(teaching_trial_lesson_overrides.shots_zh) = jsonb_array_length(EXCLUDED.shots_zh)
          AND jsonb_array_length(teaching_trial_lesson_overrides.script_zh) = jsonb_array_length(EXCLUDED.script_zh)
         THEN teaching_trial_lesson_overrides.script_en ELSE NULL END,
       english_stale = TRUE,
       content_revision = teaching_trial_lesson_overrides.content_revision + 1
     RETURNING ${TRIAL_COLUMNS}`,
    [lessonId, lesson.titleZh, lesson.outcomeZh, lesson.minutes, lesson.shotsZh, lesson.scriptZh],
  );
  return c.json(trialRowToJson(rows[0]));
});

teachingRoutes.get('/teaching/advanced', async (c) => {
  noStore(c);
  const rows = await query<LessonRow>(
    `SELECT ${COLUMNS} FROM teaching_advanced_lessons ORDER BY track DESC, position, id`,
  );
  return c.json(rows.map(rowToJson));
});

teachingRoutes.post('/teaching/advanced', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);
  const lesson = normalizeLesson(await c.req.json<LessonInput>(), true);
  if (!lesson || !lesson.track) return c.json({ error: 'Invalid lesson' }, 400);

  const rows = await query<LessonRow>(
    `INSERT INTO teaching_advanced_lessons
       (track, position, title_zh, title_en, description_zh, description_en, minutes)
     VALUES (?, COALESCE((SELECT MAX(position) + 1 FROM teaching_advanced_lessons WHERE track = ?), 0), ?, ?, ?, ?, ?)
     RETURNING ${COLUMNS}`,
    [lesson.track, lesson.track, lesson.titleZh, lesson.titleEn, lesson.descriptionZh, lesson.descriptionEn, lesson.minutes],
  );
  return c.json(rowToJson(rows[0]), 201);
});

teachingRoutes.put('/teaching/advanced/reorder', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);
  const body = await c.req.json<{ track?: unknown; ids?: unknown }>();
  const track = body.track === '333' || body.track === '222' ? body.track : null;
  if (!track || !Array.isArray(body.ids) || body.ids.length === 0) {
    return c.json({ error: 'track and non-empty ids are required' }, 400);
  }
  const ids = body.ids.map(Number);
  if (ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    return c.json({ error: 'ids must be unique positive integers' }, 400);
  }
  const current = await query<{ id: number | string }>(
    'SELECT id FROM teaching_advanced_lessons WHERE track = ? ORDER BY position, id',
    [track],
  );
  const actual = current.map((row) => Number(row.id)).sort((a, b) => a - b);
  const requested = [...ids].sort((a, b) => a - b);
  if (actual.length !== requested.length || actual.some((id, index) => id !== requested[index])) {
    return c.json({ error: 'ids must contain every lesson in the track exactly once' }, 400);
  }

  const cases = ids.map(() => 'WHEN ? THEN ?').join(' ');
  const placeholders = ids.map(() => '?').join(', ');
  const params: unknown[] = [];
  ids.forEach((id, position) => params.push(id, position));
  params.push(track, ...ids);
  await query(
    `UPDATE teaching_advanced_lessons
     SET position = CASE id ${cases} END, updated_at = NOW()
     WHERE track = ? AND id IN (${placeholders})`,
    params,
  );
  return c.json({ ok: true });
});

teachingRoutes.put('/teaching/advanced/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid lesson id' }, 400);
  const lesson = normalizeLesson(await c.req.json<LessonInput>(), false);
  if (!lesson) return c.json({ error: 'Invalid lesson' }, 400);

  const rows = await query<LessonRow>(
    `UPDATE teaching_advanced_lessons SET
       title_zh = ?, title_en = ?, description_zh = ?, description_en = ?, minutes = ?
     WHERE id = ? RETURNING ${COLUMNS}`,
    [lesson.titleZh, lesson.titleEn, lesson.descriptionZh, lesson.descriptionEn, lesson.minutes, id],
  );
  if (rows.length === 0) return c.json({ error: 'Lesson not found' }, 404);
  return c.json(rowToJson(rows[0]));
});

teachingRoutes.delete('/teaching/advanced/:id', async (c) => {
  noStore(c);
  checkRateLimit(getIp(c));
  await requireAdminOrApiKey(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid lesson id' }, 400);
  const rows = await query<{ id: number | string }>(
    'DELETE FROM teaching_advanced_lessons WHERE id = ? RETURNING id',
    [id],
  );
  if (rows.length === 0) return c.json({ error: 'Lesson not found' }, 404);
  return c.json({ ok: true });
});
