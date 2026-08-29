/**
 * WCA 选手按项目登记老师关系。
 *
 *   GET    /v1/wca/teachers?students=...&events=... — 按学生与项目公开批量读取
 *   GET    /v1/wca/teachers?teachers=...             — 按老师公开反查学生
 *   GET    /v1/wca/teachers/:teacherId/named-students — 公开读取尚无 WCA ID 的学生
 *   POST   /v1/wca/teachers/:teacherId/named-students — 老师本人或管理员添加
 *   PUT    /v1/wca/teachers/:teacherId/named-students/:id — 老师本人或管理员编辑
 *   DELETE /v1/wca/teachers/:teacherId/named-students/:id — 老师本人或管理员移除
 *   PUT    /v1/wca/teachers/:studentId/:eventId    — 有效会员老师登记自己，或有效会员学生填写本人老师；管理员可指定任意老师
 *   DELETE /v1/wca/teachers/:studentId/:eventId    — 老师本人、有效会员学生本人或管理员撤销
 */
import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { ADMIN_WCA_IDS, requireAuth } from '../utils/recon_helpers.js';
import { hasActiveMembership } from '../utils/membership.js';
import {
  mayReplaceTeacher,
  normalizeNamedStudentId,
  normalizeNamedStudentName,
  normalizeWcaEventId,
  normalizeWcaId,
  parseTeacherEventIds,
  parseTeacherLookupEvents,
  parseTeacherLookupIds,
} from '../utils/wca_teachers.js';

export const wcaTeacherRoutes = new Hono();

interface TeacherRow {
  student_wca_id: string;
  student_name: string;
  event_id: string;
  teacher_wca_id: string;
  teacher_name: string;
  teacher_country_iso2: string;
}

interface TeacherWriteRow {
  student_wca_id: string;
  event_id: string;
  teacher_wca_id: string;
  teacher_name: string;
}

interface NamedStudentRow {
  id: string;
  teacher_wca_id: string;
  student_name: string;
  country_iso2: string;
  event_ids: string[];
}

function toJson(row: TeacherRow) {
  return {
    studentWcaId: row.student_wca_id,
    studentName: row.student_name,
    eventId: row.event_id,
    teacherWcaId: row.teacher_wca_id,
    teacherName: row.teacher_name,
    teacherCountryIso2: row.teacher_country_iso2,
  };
}

function realActorWcaId(user: { wcaId: string; realWcaId?: string }): string | null {
  return normalizeWcaId(user.realWcaId ?? user.wcaId);
}

function namedStudentToJson(row: NamedStudentRow) {
  return {
    id: row.id,
    teacherWcaId: row.teacher_wca_id,
    studentName: row.student_name,
    countryIso2: row.country_iso2,
    eventIds: row.event_ids,
  };
}

function normalizeCountryIso2(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const countryIso2 = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(countryIso2) ? countryIso2 : null;
}

async function checkRosterWritePermission(
  isAdmin: boolean,
  actorWcaId: string,
  teacherWcaId: string,
): Promise<'forbidden' | 'membership' | null> {
  if (isAdmin) return null;
  if (actorWcaId !== teacherWcaId) return 'forbidden';
  return (await hasActiveMembership(actorWcaId)) ? null : 'membership';
}

wcaTeacherRoutes.get('/wca/teachers', async (c) => {
  const studentIds = parseTeacherLookupIds(c.req.query('students'));
  const teacherIds = parseTeacherLookupIds(c.req.query('teachers'));
  const events = parseTeacherLookupEvents(c.req.query('events'));
  if (studentIds == null) return c.json({ error: 'invalid students' }, 400);
  if (teacherIds == null) return c.json({ error: 'invalid teachers' }, 400);
  if (events == null) return c.json({ error: 'invalid events' }, 400);
  if (studentIds.length > 0 && teacherIds.length > 0) {
    return c.json({ error: 'use either students or teachers' }, 400);
  }
  if (studentIds.length === 0 && teacherIds.length === 0) return c.json({ teachers: [] });
  if (studentIds.length > 0 && events.length === 0) return c.json({ teachers: [] });

  const ids = studentIds.length > 0 ? studentIds : teacherIds;
  const idColumn = studentIds.length > 0 ? 'wt.student_wca_id' : 'wt.teacher_wca_id';
  const idPlaceholders = ids.map(() => '?').join(', ');
  const eventFilter = events.length > 0
    ? ` AND wt.event_id IN (${events.map(() => '?').join(', ')})`
    : '';
  const rows = await query<TeacherRow>(
    `SELECT wt.student_wca_id, student.name AS student_name,
            wt.event_id, wt.teacher_wca_id, wt.teacher_name,
            teacher.country_iso2 AS teacher_country_iso2
       FROM wca_teachers wt
       JOIN wca_persons student ON student.wca_id = wt.student_wca_id
       JOIN wca_persons teacher ON teacher.wca_id = wt.teacher_wca_id
      WHERE ${idColumn} IN (${idPlaceholders})${eventFilter}
      ORDER BY wt.student_wca_id, wt.event_id`,
    [...ids, ...events],
  );
  c.header('Cache-Control', 'public, max-age=60, s-maxage=300');
  return c.json({ teachers: rows.map(toJson) });
});

wcaTeacherRoutes.get('/wca/teachers/:teacherId/named-students', async (c) => {
  const teacherWcaId = normalizeWcaId(c.req.param('teacherId'));
  if (!teacherWcaId) return c.json({ error: 'invalid teacher WCA ID' }, 400);
  const rows = await query<NamedStudentRow>(
    `SELECT student.id, student.teacher_wca_id, student.student_name, student.country_iso2,
            array_agg(event.event_id ORDER BY event.event_id) AS event_ids
       FROM wca_teacher_named_students student
       JOIN wca_teacher_named_student_events event ON event.student_id = student.id
      WHERE student.teacher_wca_id = ?
      GROUP BY student.id, student.teacher_wca_id, student.student_name, student.country_iso2
      ORDER BY student.student_name, student.id`,
    [teacherWcaId],
  );
  c.header('Cache-Control', 'public, max-age=60, s-maxage=300');
  return c.json({ students: rows.map(namedStudentToJson) });
});

wcaTeacherRoutes.post('/wca/teachers/:teacherId/named-students', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const isAdmin = ADMIN_WCA_IDS.includes(user.wcaId);
  const actorWcaId = realActorWcaId(user);
  if (!actorWcaId) return c.json({ error: 'WCA account required' }, 403);
  const teacherWcaId = normalizeWcaId(c.req.param('teacherId'));
  if (!teacherWcaId) return c.json({ error: 'invalid teacher WCA ID' }, 400);
  const permission = await checkRosterWritePermission(isAdmin, actorWcaId, teacherWcaId);
  if (permission === 'forbidden') return c.json({ error: 'only the teacher can manage this roster' }, 403);
  if (permission === 'membership') return c.json({ error: 'active membership required' }, 403);

  const body: { studentName?: unknown; countryIso2?: unknown; eventIds?: unknown } = await c.req.json().catch(() => ({}));
  const studentName = normalizeNamedStudentName(body.studentName);
  if (!studentName) return c.json({ error: 'invalid student name' }, 400);
  const countryIso2 = normalizeCountryIso2(body.countryIso2);
  if (!countryIso2) return c.json({ error: 'invalid country' }, 400);
  const eventIds = parseTeacherEventIds(body.eventIds);
  if (!eventIds) return c.json({ error: 'invalid event IDs' }, 400);

  const teacher = await query<{ wca_id: string; country_exists: boolean }>(
    `SELECT teacher.wca_id,
            EXISTS (SELECT 1 FROM wca_countries country WHERE country.iso2 = ?) AS country_exists
       FROM wca_persons teacher
      WHERE teacher.wca_id = ?`,
    [countryIso2, teacherWcaId],
  );
  if (!teacher.length) return c.json({ error: 'teacher not found' }, 404);
  if (!teacher[0].country_exists) return c.json({ error: 'invalid country' }, 400);
  const eventValues = eventIds.map(() => '(?)').join(', ');
  const rows = await query<Omit<NamedStudentRow, 'event_ids'>>(
    `WITH inserted_student AS (
       INSERT INTO wca_teacher_named_students
         (teacher_wca_id, student_name, country_iso2, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING
       RETURNING id, teacher_wca_id, student_name, country_iso2
     ), inserted_events AS (
       INSERT INTO wca_teacher_named_student_events
         (student_id, event_id, created_by, updated_by)
       SELECT inserted_student.id, selected.event_id, ?, ?
         FROM inserted_student
         CROSS JOIN (VALUES ${eventValues}) AS selected(event_id)
     )
     SELECT id, teacher_wca_id, student_name, country_iso2 FROM inserted_student`,
    [teacherWcaId, studentName, countryIso2, actorWcaId, actorWcaId, actorWcaId, actorWcaId, ...eventIds],
  );
  if (!rows.length) return c.json({ error: 'student already exists' }, 409);
  return c.json({ student: namedStudentToJson({ ...rows[0], event_ids: eventIds }) }, 201);
});

wcaTeacherRoutes.put('/wca/teachers/:teacherId/named-students/:namedStudentId', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const isAdmin = ADMIN_WCA_IDS.includes(user.wcaId);
  const actorWcaId = realActorWcaId(user);
  if (!actorWcaId) return c.json({ error: 'WCA account required' }, 403);
  const teacherWcaId = normalizeWcaId(c.req.param('teacherId'));
  if (!teacherWcaId) return c.json({ error: 'invalid teacher WCA ID' }, 400);
  const namedStudentId = normalizeNamedStudentId(c.req.param('namedStudentId'));
  if (!namedStudentId) return c.json({ error: 'invalid student ID' }, 400);
  const permission = await checkRosterWritePermission(isAdmin, actorWcaId, teacherWcaId);
  if (permission === 'forbidden') return c.json({ error: 'only the teacher can manage this roster' }, 403);
  if (permission === 'membership') return c.json({ error: 'active membership required' }, 403);

  const body: { studentName?: unknown; countryIso2?: unknown; eventIds?: unknown } = await c.req.json().catch(() => ({}));
  const studentName = normalizeNamedStudentName(body.studentName);
  if (!studentName) return c.json({ error: 'invalid student name' }, 400);
  const countryIso2 = normalizeCountryIso2(body.countryIso2);
  if (!countryIso2) return c.json({ error: 'invalid country' }, 400);
  const eventIds = parseTeacherEventIds(body.eventIds);
  if (!eventIds) return c.json({ error: 'invalid event IDs' }, 400);
  const existing = await query<{ id: string; country_exists: boolean }>(
    `SELECT student.id,
            EXISTS (SELECT 1 FROM wca_countries country WHERE country.iso2 = ?) AS country_exists
       FROM wca_teacher_named_students student
      WHERE student.id = ? AND student.teacher_wca_id = ?`,
    [countryIso2, namedStudentId, teacherWcaId],
  );
  if (!existing.length) return c.json({ error: 'student not found' }, 404);
  if (!existing[0].country_exists) return c.json({ error: 'invalid country' }, 400);

  const eventValues = eventIds.map(() => '(?)').join(', ');
  const selectedPlaceholders = eventIds.map(() => '?').join(', ');
  await query(
    `WITH updated_student AS (
       UPDATE wca_teacher_named_students
          SET student_name = ?, country_iso2 = ?, updated_by = ?
        WHERE id = ? AND teacher_wca_id = ?
       RETURNING id
     ), deleted_events AS (
       DELETE FROM wca_teacher_named_student_events
        WHERE student_id IN (SELECT id FROM updated_student)
          AND event_id NOT IN (${selectedPlaceholders})
     )
     INSERT INTO wca_teacher_named_student_events
       (student_id, event_id, created_by, updated_by)
     SELECT updated_student.id, selected.event_id, ?, ?
       FROM updated_student
       CROSS JOIN (VALUES ${eventValues}) AS selected(event_id)
     ON CONFLICT (student_id, event_id) DO UPDATE SET updated_by = EXCLUDED.updated_by`,
    [studentName, countryIso2, actorWcaId, namedStudentId, teacherWcaId, ...eventIds, actorWcaId, actorWcaId, ...eventIds],
  );
  return c.json({ student: namedStudentToJson({
    id: namedStudentId,
    teacher_wca_id: teacherWcaId,
    student_name: studentName,
    country_iso2: countryIso2,
    event_ids: eventIds,
  }) });
});

wcaTeacherRoutes.delete('/wca/teachers/:teacherId/named-students/:namedStudentId', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const isAdmin = ADMIN_WCA_IDS.includes(user.wcaId);
  const actorWcaId = realActorWcaId(user);
  if (!actorWcaId) return c.json({ error: 'WCA account required' }, 403);
  const teacherWcaId = normalizeWcaId(c.req.param('teacherId'));
  if (!teacherWcaId) return c.json({ error: 'invalid teacher WCA ID' }, 400);
  const namedStudentId = normalizeNamedStudentId(c.req.param('namedStudentId'));
  if (!namedStudentId) return c.json({ error: 'invalid student ID' }, 400);
  if (!isAdmin && actorWcaId !== teacherWcaId) {
    return c.json({ error: 'only the teacher can manage this roster' }, 403);
  }
  const rows = await query<{ id: string }>(
    'DELETE FROM wca_teacher_named_students WHERE id = ? AND teacher_wca_id = ? RETURNING id',
    [namedStudentId, teacherWcaId],
  );
  if (!rows.length) return c.json({ error: 'student not found' }, 404);
  return c.json({ ok: true });
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
  const studentManagesOwnTeacher = actorWcaId === studentWcaId;
  const teacherWcaId = isAdmin || studentManagesOwnTeacher
    ? normalizeWcaId(body.teacherWcaId)
    : actorWcaId;
  if (!teacherWcaId) return c.json({ error: 'invalid teacher WCA ID' }, 400);
  if (studentWcaId === teacherWcaId) return c.json({ error: 'a person cannot be their own teacher' }, 400);

  if (!isAdmin) {
    if (!(await hasActiveMembership(actorWcaId))) {
      return c.json({ error: 'active membership required' }, 403);
    }
  }

  const people = await query<{ wca_id: string; name: string; country_iso2: string }>(
    `SELECT wca_id, name, country_iso2 FROM wca_persons WHERE wca_id IN (?, ?)`,
    [studentWcaId, teacherWcaId],
  );
  const personById = new Map(people.map((person) => [person.wca_id, person]));
  const student = personById.get(studentWcaId);
  if (!student) return c.json({ error: 'student not found' }, 404);
  const teacher = personById.get(teacherWcaId);
  if (!teacher) return c.json({ error: 'teacher not found' }, 404);

  const existing = await query<{ teacher_wca_id: string }>(
    'SELECT teacher_wca_id FROM wca_teachers WHERE student_wca_id = ? AND event_id = ?',
    [studentWcaId, eventId],
  );
  if (!mayReplaceTeacher(isAdmin || studentManagesOwnTeacher, actorWcaId, existing[0]?.teacher_wca_id ?? null)) {
    return c.json({ error: 'teacher already set' }, 409);
  }

  // 老师登记自己的冲突更新只允许命中自己，避免两位老师并发看见空值后互相覆盖。
  // 学生管理本人老师时允许明确更换老师。
  const conflictGuard = isAdmin || studentManagesOwnTeacher
    ? ''
    : 'WHERE wca_teachers.teacher_wca_id = EXCLUDED.teacher_wca_id';
  const rows = await query<TeacherWriteRow>(
    `INSERT INTO wca_teachers
       (student_wca_id, event_id, teacher_wca_id, teacher_name, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (student_wca_id, event_id) DO UPDATE SET
       teacher_wca_id = EXCLUDED.teacher_wca_id,
       teacher_name = EXCLUDED.teacher_name,
       updated_by = EXCLUDED.updated_by
     ${conflictGuard}
     RETURNING student_wca_id, event_id, teacher_wca_id, teacher_name`,
    [studentWcaId, eventId, teacherWcaId, teacher.name, actorWcaId, actorWcaId],
  );
  if (!rows.length) return c.json({ error: 'teacher already set' }, 409);
  return c.json({ teacher: toJson({
    ...rows[0],
    student_name: student.name,
    teacher_country_iso2: teacher.country_iso2,
  }) });
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
  const studentRemovesOwnTeacher = actorWcaId === studentWcaId;
  if (studentRemovesOwnTeacher && !isAdmin && !(await hasActiveMembership(actorWcaId))) {
    return c.json({ error: 'active membership required' }, 403);
  }
  if (!isAdmin && !studentRemovesOwnTeacher && rows[0].teacher_wca_id !== actorWcaId) {
    return c.json({ error: 'only the teacher can remove this relation' }, 403);
  }
  await query(
    'DELETE FROM wca_teachers WHERE student_wca_id = ? AND event_id = ?',
    [studentWcaId, eventId],
  );
  return c.json({ ok: true });
});
