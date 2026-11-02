import { HTTPException } from 'hono/http-exception';
import { normalizeWcaId } from './wca_teachers.js';

/** Shared team predicate for WCA affiliations and members without a WCA ID. */
export function wcaTeamFilter(team: string, column: 'a.team_id' | 'rt.team_id') {
  if (team && team !== 'none' && team !== 'moyu' && !/^[1-9]\d{0,8}$/.test(team)) {
    throw new HTTPException(400, { message: 'Invalid team' });
  }
  if (!team) return { sql: '', params: [] };
  if (team === 'none') return { sql: ` AND ${column} IS NULL`, params: [] };
  if (team === 'moyu') return {
    sql: ` AND ${column} IN (SELECT id FROM wca_teams WHERE name IN (?, ?, ?))`,
    params: ['魔域', '魔域战队', '魔域梦之队'],
  };
  return { sql: ` AND ${column} = ?`, params: [Number(team)] };
}

/** Apply current affiliations before counts and pagination, never to just one page. */
export function wcaRelationFilter(
  get: (key: string) => string | undefined,
  personColumn: 's.wca_id' | 't.wca_id' | 'pr.wca_id',
  events: readonly string[],
) {
  const team = get('team') ?? '';
  const teacher = get('teacherFilter') ?? '';
  const teamFilter = wcaTeamFilter(team, 'rt.team_id');
  if (teacher && !['none', 'self'].includes(teacher) && !normalizeWcaId(teacher)) {
    throw new HTTPException(400, { message: 'Invalid teacherFilter' });
  }
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (team) {
    if (team === 'none') clauses.push(`NOT EXISTS (SELECT 1 FROM wca_person_teams rt WHERE rt.wca_id = ${personColumn})`);
    else {
      clauses.push(`EXISTS (SELECT 1 FROM wca_person_teams rt WHERE rt.wca_id = ${personColumn}${teamFilter.sql})`);
      params.push(...teamFilter.params);
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
