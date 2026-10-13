/** Print read-only PostgreSQL fixtures for the actual daily-board query.
 * Run this file from any directory; pipe the output to psql -v ON_ERROR_STOP=1.
 * CTE fixtures shadow tables: no application data is read or written.
 */
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../src/routes/teaching_saas.ts', import.meta.url), 'utf8');
const start = source.indexOf('WITH eligible AS (', source.indexOf('async getTrainingDailyBoard'));
const end = source.indexOf('`;', start);
if (start < 0 || end < 0) throw new Error('Daily board query not found');
const query = source.slice(start, end);
const uuid = (n: number) => `'00000000-0000-4000-8000-${String(n).padStart(12, '0')}'::uuid`;
const org = uuid(1), assignment = uuid(2), group = uuid(3);
const students = [11, 12, 13, 14];
const targets = students.map(id => `(${org},${assignment},${uuid(id)},'student',${id === 13 ? uuid(4) : group},'Student ${id}')`).join(',');
const profiles = students.map(id => `(${org},${uuid(id)},'active')`).join(',');
const memberships = students.map(id => `(${org},${uuid(id)},${id === 13 ? uuid(4) : group},'2020-01-01'::timestamptz,${id === 14 ? "'2021-01-01'::timestamptz" : 'NULL::timestamptz'})`).join(',');
const evidence: { id: number; student: number; when: string; success: boolean }[] = [];
let next = 1;
for (const student of [11, 12]) {
  for (let i = 0; i < 5; i++) evidence.push({ id: next++, student, when: i === 0 ? '2026-10-11 16:00:00+00' : '2026-10-12 15:59:59+00', success: i < (student === 11 ? 4 : 3) });
}
evidence.push(
  { id: next++, student: 11, when: '2026-10-11 15:59:59+00', success: true },
  { id: next++, student: 12, when: '2026-10-12 16:00:00+00', success: true },
  { id: next++, student: 13, when: '2026-10-12 00:00:00+00', success: true },
);
const values = evidence.map(e => `(${org},${e.id},${uuid(e.student)},'${e.when}'::timestamptz,1000,${e.success},${e.success ? e.student === 12 ? 2000 : 1000 : 'NULL::integer'},'timer','{"event":"333"}'::jsonb)`).join(',');
const links = evidence.map(e => `(${org},${assignment},${e.id},${uuid(e.student)})`).join(',');
const fixture = `WITH
  training_assignment_targets(organization_id,assignment_id,student_id,target_kind,source_group_id,student_display_name_snapshot) AS (VALUES ${targets}),
  student_profiles(organization_id,id,status) AS (VALUES ${profiles}),
  student_group_memberships(organization_id,student_id,group_id,effective_from,effective_to) AS (VALUES ${memberships}),
  training_evidence(organization_id,id,student_id,occurred_at,duration_ms,success,result_ms,source,payload) AS (VALUES ${values}),
  training_evidence_assignments(organization_id,assignment_id,evidence_id,student_id) AS (VALUES ${links}),
  training_assignment_goal_metrics(organization_id,assignment_id,metric_key,target_value) AS (VALUES (${org},${assignment},'success_count',4)), `;

const cases = [
  { name: 'classmates_and_midnight_boundaries', learner: true, offset: 0, scope: null, event: null, size: 50, total: 2, complete: 1, count: 2 },
  { name: 'empty_page_keeps_totals', learner: true, offset: 50, scope: null, event: null, size: 50, total: 2, complete: 1, count: 0 },
  { name: 'teacher_scope_before_ranking', learner: false, offset: 0, scope: [12], event: null, size: 50, total: 1, complete: 0, count: 1 },
  { name: 'best_result_order', learner: true, offset: 0, scope: null, event: '333', size: 50, total: 2, complete: 1, count: 2 },
  { name: 'best_rank_before_pagination', learner: true, offset: 1, scope: null, event: '333', size: 1, total: 2, complete: 1, count: 1 },
];
console.log("BEGIN READ ONLY; SET LOCAL statement_timeout='5s';");
for (const test of cases) {
  const params: Record<string, string> = {
    organizationId: org, assignmentId: assignment, 'scopedIds === null': String(test.scope === null),
    'scopedIds ?? []': test.scope ? `ARRAY[${test.scope.map(uuid).join(',')}]` : 'ARRAY[]::uuid[]',
    '!learner': String(!test.learner), selfId: test.learner ? uuid(11) : 'NULL', groupId: test.learner ? group : 'NULL',
    date: "'2026-10-12'", timezone: "'Asia/Shanghai'", 'Number(assignment.expected_count)': '5',
    'pagination.pageSize': String(test.size), 'pagination.offset': String(test.offset), rankEvent: test.event ? `'${test.event}'` : 'NULL',
  };
  const sql = query.replace(/\$\{([^}]+)\}/g, (_, key) => {
    if (!(key in params)) throw new Error(`Uncovered query parameter: ${key}`);
    return params[key];
  }).replace(/^WITH /, fixture);
  const rank = test.event ? `CASE WHEN student_id = ${uuid(11)} THEN 1 ELSE 2 END` : '1';
  console.log(`SELECT '${test.name}' AS scenario, 1 / CASE WHEN MAX(total)=${test.total} AND MAX(completed_total)=${test.complete} AND COUNT(student_id)=${test.count} AND COALESCE(BOOL_AND(count=5 AND rank=${rank}) FILTER (WHERE student_id IS NOT NULL), true) THEN 1 ELSE 0 END AS passed FROM (${sql}) checked;`);
}
console.log('ROLLBACK;');
