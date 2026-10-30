import { HTTPException } from 'hono/http-exception';
import { normalizeWcaId } from './wca_teachers.js';

/** Apply current affiliations before counts and pagination, never to just one page. */
export function wcaRelationFilter(
  get: (key: string) => string | undefined,
  personColumn: 's.wca_id' | 't.wca_id' | 'pr.wca_id',
  events: readonly string[],
) {
  const team = get('team') ?? '';
  const teacher = get('teacherFilter') ?? '';
  if (team && team !== 'none' && team !== 'moyu' && !/^[1-9]\d{0,8}$/.test(team)) {
    throw new HTTPException(400, { message: 'Invalid team' });
  }
  if (teacher && !['none', 'self'].includes(teacher) && !normalizeWcaId(teacher)) {
    throw new HTTPException(400, { message: 'Invalid teacherFilter' });
  }
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (team) {
    if (team === 'none') clauses.push(`NOT EXISTS (SELECT 1 FROM wca_person_teams rt WHERE rt.wca_id = ${personColumn})`);
    else {
      const condition = team === 'moyu' ? 'rt.team_id IN (SELECT id FROM wca_teams WHERE name IN (?, ?, ?))' : 'rt.team_id = ?';
      clauses.push(`EXISTS (SELECT 1 FROM wca_person_teams rt WHERE rt.wca_id = ${personColumn} AND ${condition})`);
      params.push(...(team === 'moyu' ? ['魔域', '魔域战队', '魔域梦之队'] : [Number(team)]));
    }
  }
  if (teacher) {
    const eventClause = events.length ? ` AND rf.event_id IN (${events.map(() => '?').join(',')})` : '';
    const teacherClause = teacher === 'none' ? '' : teacher === 'self' ? ' AND rf.teacher_wca_id IS NULL' : ' AND rf.teacher_wca_id = ?';
    clauses.push(`${teacher === 'none' ? 'NOT ' : ''}EXISTS (SELECT 1 FROM wca_teachers rf WHERE rf.student_wca_id = ${personColumn}${eventClause}${teacherClause})`);
    params.push(...events);
    if (!['none', 'self'].includes(teacher)) params.push(normalizeWcaId(teacher));
  }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', params, active: !!(team || teacher) };
}
