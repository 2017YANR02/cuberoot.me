/**
 * WCA 选手按项目登记老师关系。
 *
 *   GET    /v1/wca/teachers?students=...&events=... — 公开批量读取
 *   PUT    /v1/wca/teachers/:studentId/:eventId    — 有效会员登记自己；管理员可指定任意老师
 *   DELETE /v1/wca/teachers/:studentId/:eventId    — 老师本人撤销；管理员可撤销任意关系
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { ADMIN_WCA_IDS, requireAuth } from '../utils/recon_helpers.js';
import { hasActiveMembership } from '../utils/membership.js';
import {
  mayReplaceTeacher,
  normalizeWcaEventId,
  normalizeWcaId,
  parseTeacherLookupEvents,
  parseTeacherLookupIds,
} from '../utils/wca_teachers.js';

export const wcaTeacherRoutes = new Hono();

interface TeacherRow {
  student_wca_id: string;
  event_id: string;
  teacher_wca_id: string;
  teacher_name: string;
}

function toJson(row: TeacherRow) {
  return {
    studentWcaId: row.student_wca_id,
    eventId: row.event_id,
    teacherWcaId: row.teacher_wca_id,
    teacherName: row.teacher_name,
  };
}

function realActorWcaId(user: { wcaId: string; realWcaId?: string }): string | null {
  return normalizeWcaId(user.realWcaId ?? user.wcaId);
}

wcaTeacherRoutes.get('/wca/teachers', async (c) => {
  const ids = parseTeacherLookupIds(c.req.query('students'));
  const events = parseTeacherLookupEvents(c.req.query('events'));
  if (ids == null) return c.json({ error: 'invalid students' }, 400);
  if (events == null) return c.json({ error: 'invalid events' }, 400);
  if (ids.length === 0 || events.length === 0) return c.json({ teachers: [] });

  const studentPlaceholders = ids.map(() => '?').join(', ');
  const eventPlaceholders = events.map(() => '?').join(', ');
  const rows = await query<TeacherRow>(
    `SELECT student_wca_id, event_id, teacher_wca_id, teacher_name
       FROM wca_teachers
      WHERE student_wca_id IN (${studentPlaceholders})
        AND event_id IN (${eventPlaceholders})`,
    [...ids, ...events],
  );
  c.header('Cache-Control', 'public, max-age=60, s-maxage=300');
  return c.json({ teachers: rows.map(toJson) });
});

wcaTeacherRoutes.put('/wca/teachers/:studentId/:eventId', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const isAdmin = ADMIN_WCA_IDS.includes(user.wcaId);
  const actorWcaId = realActorWcaId(user);
  if (!actorWcaId) return c.json({ error: 'WCA account required' }, 403);

  const studentWcaId = normalizeWcaId(c.req.param('studentId'));
  if (!studentWcaId) return c.json({ error: 'invalid student WCA ID' }, 400);
  const eventId = normalizeWcaEventId(c.req.param('eventId'));
  if (!eventId) return c.json({ error: 'invalid event ID' }, 400);
  const body: { teacherWcaId?: unknown } = await c.req.json<{ teacherWcaId?: unknown }>().catch(() => ({}));
  const teacherWcaId = isAdmin
    ? normalizeWcaId(body.teacherWcaId)
    : actorWcaId;
  if (!teacherWcaId) return c.json({ error: 'invalid teacher WCA ID' }, 400);
  if (studentWcaId === teacherWcaId) return c.json({ error: 'a person cannot be their own teacher' }, 400);

  if (!isAdmin) {
    if (!(await hasActiveMembership(actorWcaId))) {
      return c.json({ error: 'active membership required' }, 403);
    }
  }

  const people = await query<{ wca_id: string; name: string }>(
    `SELECT wca_id, name FROM wca_persons WHERE wca_id IN (?, ?)`,
    [studentWcaId, teacherWcaId],
  );
  const personById = new Map(people.map((person) => [person.wca_id, person.name]));
  if (!personById.has(studentWcaId)) return c.json({ error: 'student not found' }, 404);
  const teacherName = personById.get(teacherWcaId);
  if (!teacherName) return c.json({ error: 'teacher not found' }, 404);

  const existing = await query<{ teacher_wca_id: string }>(
    'SELECT teacher_wca_id FROM wca_teachers WHERE student_wca_id = ? AND event_id = ?',
    [studentWcaId, eventId],
  );
  if (!mayReplaceTeacher(isAdmin, actorWcaId, existing[0]?.teacher_wca_id ?? null)) {
    return c.json({ error: 'teacher already set' }, 409);
  }

  // 普通会员的冲突更新只允许命中自己，避免两位老师并发看见空值后互相覆盖。
  const conflictGuard = isAdmin
    ? ''
    : 'WHERE wca_teachers.teacher_wca_id = EXCLUDED.teacher_wca_id';
  const rows = await query<TeacherRow>(
    `INSERT INTO wca_teachers
       (student_wca_id, event_id, teacher_wca_id, teacher_name, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (student_wca_id, event_id) DO UPDATE SET
       teacher_wca_id = EXCLUDED.teacher_wca_id,
       teacher_name = EXCLUDED.teacher_name,
       updated_by = EXCLUDED.updated_by
     ${conflictGuard}
     RETURNING student_wca_id, event_id, teacher_wca_id, teacher_name`,
    [studentWcaId, eventId, teacherWcaId, teacherName, actorWcaId, actorWcaId],
  );
  if (!rows.length) return c.json({ error: 'teacher already set' }, 409);
  return c.json({ teacher: toJson(rows[0]) });
});

wcaTeacherRoutes.delete('/wca/teachers/:studentId/:eventId', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const isAdmin = ADMIN_WCA_IDS.includes(user.wcaId);
  const actorWcaId = realActorWcaId(user);
  if (!actorWcaId) return c.json({ error: 'WCA account required' }, 403);

  const studentWcaId = normalizeWcaId(c.req.param('studentId'));
  if (!studentWcaId) return c.json({ error: 'invalid student WCA ID' }, 400);
  const eventId = normalizeWcaEventId(c.req.param('eventId'));
  if (!eventId) return c.json({ error: 'invalid event ID' }, 400);
  const rows = await query<{ teacher_wca_id: string }>(
    'SELECT teacher_wca_id FROM wca_teachers WHERE student_wca_id = ? AND event_id = ?',
    [studentWcaId, eventId],
  );
  if (!rows.length) return c.json({ error: 'teacher not found' }, 404);
  if (!isAdmin && rows[0].teacher_wca_id !== actorWcaId) {
    return c.json({ error: 'only the teacher can remove this relation' }, 403);
  }
  await query(
    'DELETE FROM wca_teachers WHERE student_wca_id = ? AND event_id = ?',
    [studentWcaId, eventId],
  );
  return c.json({ ok: true });
});
