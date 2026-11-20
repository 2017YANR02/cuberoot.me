import { HTTPException } from 'hono/http-exception';
import { wcaTeamFilterNames } from '@cuberoot/shared/wca-team-filters';
import { normalizeWcaId } from './wca_teachers.js';

/** Shared team predicate for WCA affiliations and members without a WCA ID. */
export function wcaTeamFilter(team: string, column: 'a.team_id' | 'rt.team_id') {
  const names = wcaTeamFilterNames(team);
  if (team && team !== 'none' && !names && !/^[1-9]\d{0,8}$/.test(team)) {
    throw new HTTPException(400, { message: 'Invalid team' });
  }
  if (!team) return { sql: '', params: [] };
  if (team === 'none') return { sql: ` AND ${column} IS NULL`, params: [] };
  if (names) return {
    sql: ` AND ${column} IN (SELECT id FROM wca_teams WHERE name IN (${names.map(() => '?').join(', ')}))`,
    params: [...names],
  };
  return { sql: ` AND ${column} = ?`, params: [Number(team)] };
}

export function wcaPersonTeamFilter(team: string, personColumn: 's.wca_id' | 't.wca_id' | 'pr.wca_id' | 'p.wca_id') {
  const filter = wcaTeamFilter(team, 'rt.team_id');
  if (!team) return filter;
  const membership = `SELECT 1 FROM wca_person_teams rt WHERE rt.wca_id = ${personColumn}`;
  if (team === 'none') return { sql: ` AND NOT EXISTS (${membership})`, params: [] };
  return { sql: ` AND EXISTS (${membership}${filter.sql})`, params: filter.params };
}

/** Apply current affiliations before counts and pagination, never to just one page. */
export function wcaRelationFilter(
  get: (key: string) => string | undefined,
  personColumn: 's.wca_id' | 't.wca_id' | 'pr.wca_id',
  events: readonly string[],
) {
  const team = get('team') ?? '';
  const teacher = get('teacherFilter') ?? '';
  const teamFilter = wcaPersonTeamFilter(team, personColumn);
  if (teacher && !['none', 'self'].includes(teacher) && !normalizeWcaId(teacher)) {
    throw new HTTPException(400, { message: 'Invalid teacherFilter' });
  }
  let sql = teamFilter.sql;
  const params: unknown[] = [...teamFilter.params];
  if (teacher) {
    const eventClause = events.length ? ` AND rf.event_id IN (${events.map(() => '?').join(',')})` : '';
    const teacherClause = teacher === 'none' ? '' : teacher === 'self' ? ' AND rf.teacher_wca_id IS NULL' : ' AND rf.teacher_wca_id = ?';
    sql += ` AND ${teacher === 'none' ? 'NOT ' : ''}EXISTS (SELECT 1 FROM wca_teachers rf WHERE rf.student_wca_id = ${personColumn}${eventClause}${teacherClause})`;
    params.push(...events);
    if (!['none', 'self'].includes(teacher)) params.push(normalizeWcaId(teacher));
  }
  return { sql, params, active: !!(team || teacher) };
}
