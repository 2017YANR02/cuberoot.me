/** CFOP 之后的课程池：公开读取，管理员维护。Schema: migration 0127。 */
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

const COLUMNS = `id, track, position, title_zh, title_en,
  description_zh, description_en, minutes, created_at, updated_at`;

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
