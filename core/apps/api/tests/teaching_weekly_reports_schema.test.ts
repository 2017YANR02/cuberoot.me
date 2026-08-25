import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';
import {
  hasTeachingPermission,
  TEACHING_WEEKLY_REPORT_VISIBILITIES,
  type TeachingPermission,
} from '@cuberoot/shared/teaching';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, `${new URL('.', import.meta.url).href}`), 'utf8');
}

function functionBody(source: string, functionName: string): string {
  const start = source.indexOf(`async function ${functionName}`);
  const end = source.indexOf('\n}\n', start);
  expect(start, `${functionName} missing`).toBeGreaterThan(-1);
  expect(end, `${functionName} incomplete`).toBeGreaterThan(start);
  return source.slice(start, end + 3);
}

describe('teaching weekly reports schema and repository contract', () => {
  it('keeps migration 0155 represented exactly in the schema and ledgers', async () => {
    const [migration, schema, readme, devSchema, devApi] = await Promise.all([
      read('../migrations/0155_teaching_weekly_reports.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
      readFile(workspaceFixturePath('@cuberoot/client', 'app/[lang]/dev/schema/page.tsx'), 'utf8'),
      readFile(workspaceFixturePath('@cuberoot/client', 'app/[lang]/dev/api/page.tsx'), 'utf8'),
    ]);
    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    expect(schema).toContain(migration.slice(migration.indexOf('CREATE TABLE teaching_weekly_reports')).trim());
    expect(readme).toContain('0155_teaching_weekly_reports.sql');
    expect(devSchema).toContain("{ n: 155, slug: 'teaching_weekly_reports'");
    for (const route of [
      '/v1/teaching/organizations/:orgSlug/weekly-reports',
      '/v1/teaching/organizations/:orgSlug/weekly-reports/generate',
      '/v1/teaching/organizations/:orgSlug/weekly-reports/:reportId',
      '/v1/teaching/organizations/:orgSlug/weekly-reports/:reportId/publish',
    ]) {
      expect(devApi).toContain(route);
    }
  });

  it('freezes published revisions and independently permits account-reference removal', async () => {
    const migration = await read('../migrations/0155_teaching_weekly_reports.sql');
    expect(migration).toContain("OLD.generated_by_user_id IS NOT NULL AND NEW.generated_by_user_id IS NULL");
    expect(migration).toContain("OLD.published_by_user_id IS NOT NULL AND NEW.published_by_user_id IS NULL");
    expect(migration).toContain("ARRAY['generated_by_user_id', 'published_by_user_id']");
    expect(migration).toContain("RAISE EXCEPTION 'published teaching weekly reports are immutable'");
    expect(migration).toContain("NOT jsonb_path_exists(aggregate, '$.**.internalNotes')");
  });

  it('serializes revision allocation before MAX and permits only one draft', async () => {
    const migration = await read('../migrations/0155_teaching_weekly_reports.sql');
    const lock = migration.indexOf("PERFORM pg_advisory_xact_lock(hashtextextended(");
    const revision = migration.indexOf('SELECT COALESCE(MAX(report.revision), 0) + 1');
    expect(lock).toBeGreaterThan(-1);
    expect(revision).toBeGreaterThan(lock);
    expect(migration).toContain('CREATE UNIQUE INDEX uq_teaching_weekly_reports_one_draft');
    expect(migration).toContain("WHERE status = 'draft'");
  });

  it('retries only the two proven generate races with a fresh whole transaction', async () => {
    const route = await read('../src/routes/teaching_saas.ts');
    const retry = functionBody(route, 'withWeeklyReportGenerateRetry');
    const generate = functionBody(route, 'buildWeeklyReportAggregate');
    expect(retry).toContain("'teaching_weekly_reports_revision_unique'");
    expect(retry).toContain("'uq_teaching_weekly_reports_one_draft'");
    expect(retry).toMatch(/const generateRace = code === '23505'\s*&&/);
    expect(retry).toContain('databaseError.constraint ?? databaseError.constraint_name');
    expect(retry).toContain('retryableUniqueConstraints.has(constraint)');
    expect(retry).toContain("sql.begin('isolation level repeatable read', operation)");
    expect(generate).not.toContain('23505');
  });

  it('uses half-open assignment overlap and includes only outward lesson feedback', async () => {
    const route = await read('../src/routes/teaching_saas.ts');
    const aggregate = functionBody(route, 'buildWeeklyReportAggregate');
    expect(aggregate).toContain('assignment.ends_at > (${weekStart}::date::timestamp AT TIME ZONE ${access.timezone})');
    expect(aggregate).not.toContain('assignment.ends_at >= (${weekStart}::date::timestamp AT TIME ZONE ${access.timezone})');
    expect(aggregate).toContain("feedback.visibility IN ('student', 'student_and_guardians')");
    expect(aggregate).not.toMatch(/SELECT[\s\S]*feedback\.internal_notes/);
  });

  it('keeps report permissions to teaching roles and the frozen visibility enum', () => {
    const permissions: TeachingPermission[] = ['report:read', 'report:manage'];
    for (const permission of permissions) {
      expect(hasTeachingPermission('owner', permission)).toBe(true);
      expect(hasTeachingPermission('admin', permission)).toBe(true);
      expect(hasTeachingPermission('teacher', permission)).toBe(true);
      expect(hasTeachingPermission('assistant', permission)).toBe(true);
      expect(hasTeachingPermission('finance', permission)).toBe(false);
      expect(hasTeachingPermission('viewer', permission)).toBe(false);
    }
    expect(TEACHING_WEEKLY_REPORT_VISIBILITIES).toEqual([
      'staff_only', 'student', 'student_and_guardians',
    ]);
  });
});
