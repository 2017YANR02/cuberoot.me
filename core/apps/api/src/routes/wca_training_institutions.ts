import { Hono } from 'hono';
import { query } from '../db/connection.js';
import { requireAdminOrApiKey } from '../utils/recon_helpers.js';
import { normalizeNamedStudentId, normalizeWcaId } from '../utils/wca_teachers.js';

export const wcaTrainingInstitutionRoutes = new Hono();
function studentKey(raw: string) {
  if (raw.startsWith('named:')) {
    const id = normalizeNamedStudentId(raw.slice(6));
    return id ? { key: `named:${id}`, column: 'named_student_id', table: 'wca_teacher_named_students', idColumn: 'id', id } : null;
  }
  const id = normalizeWcaId(raw);
  return id ? { key: id, column: 'student_wca_id', table: 'wca_persons', idColumn: 'wca_id', id } : null;
}
wcaTrainingInstitutionRoutes.get('/wca/training-institutions', async c => {
  c.header('Cache-Control', 'no-store');
  const raw = c.req.query('students') ?? '';
  const keys = raw ? [...new Set(raw.split(','))] : [];
  const parsed = keys.map(studentKey);
  if (keys.length > 100 || parsed.some(key => !key)) return c.json({ error: 'invalid students' }, 400);
  const institutions = await query<{ id: string; name: string }>(
    `SELECT org.id, org.name FROM wca_training_institutions public
     JOIN organizations org ON org.id = public.organization_id
     ORDER BY org.name, org.id`,
  );
  const assignments = parsed.length ? await query<{ studentKey: string; institutionId: string }>(
    `SELECT COALESCE(student_wca_id, 'named:' || named_student_id::text) AS "studentKey",
            organization_id AS "institutionId"
       FROM wca_student_institutions WHERE ` + parsed.map(key => `${key!.column} = ?`).join(' OR '),
    parsed.map(key => key!.id),
  ) : [];
  return c.json({ institutions, assignments });
});
wcaTrainingInstitutionRoutes.put('/wca/training-institutions/:studentKey', async c => {
  await requireAdminOrApiKey(c);
  c.header('Cache-Control', 'no-store');
  const student = studentKey(c.req.param('studentKey'));
  if (!student) return c.json({ error: 'invalid student' }, 400);
  const body = await c.req.json<{ institutionId?: unknown }>().catch(() => null);
  if (!body || (body.institutionId !== null && (typeof body.institutionId !== 'string' || !normalizeNamedStudentId(body.institutionId)))) {
    return c.json({ error: 'invalid institution' }, 400);
  }
  if (!(await query(`SELECT ${student.idColumn} FROM ${student.table} WHERE ${student.idColumn} = ?`, [student.id])).length) {
    return c.json({ error: 'student not found' }, 404);
  }
  if (body.institutionId === null) {
    await query(`DELETE FROM wca_student_institutions WHERE ${student.column} = ?`, [student.id]);
    return c.json({ ok: true });
  }
  // Only explicitly public organizations may be assigned, never arbitrary private tenants.
  const rows = await query(
    `INSERT INTO wca_student_institutions (${student.column}, organization_id)
     SELECT ?, organization_id FROM wca_training_institutions WHERE organization_id = ?
     ON CONFLICT (${student.column}) DO UPDATE SET organization_id = EXCLUDED.organization_id, updated_at = NOW()
     RETURNING id`, [student.id, body.institutionId],
  );
  return rows.length ? c.json({ ok: true }) : c.json({ error: 'institution not found' }, 404);
});
