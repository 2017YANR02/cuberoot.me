import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, `${new URL('.', import.meta.url).href}`), 'utf8');
}

function sourceSection(source: string, startNeedle: string, endNeedle: string): string {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  expect(start, `${startNeedle} missing`).toBeGreaterThan(-1);
  expect(end, `${endNeedle} missing after ${startNeedle}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('teaching learner portal schema and repository contract', () => {
  it('keeps migration 0156 represented in schema and developer ledgers', async () => {
    const [migration, schema, readme, devSchema, devApi] = await Promise.all([
      read('../migrations/0156_teaching_learner_portal.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
      readFile(workspaceFixturePath('@cuberoot/client', 'app/[lang]/dev/schema/page.tsx'), 'utf8'),
      readFile(workspaceFixturePath('@cuberoot/client', 'app/[lang]/dev/api/page.tsx'), 'utf8'),
    ]);
    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    expect(schema).toContain(
      migration.slice(migration.indexOf('CREATE TABLE guardian_account_binding_invites')).trim(),
    );
    expect(schema).toContain('account_linked_at  TIMESTAMPTZ');
    expect(schema).toContain('guardian_links_account_link_state');
    expect(readme).toContain('0156_teaching_learner_portal.sql');
    expect(devSchema).toContain("{ n: 156, slug: 'teaching_learner_portal'");
    for (const route of [
      '/v1/teaching/me/learning-contexts',
      '/v1/teaching/organizations/:orgSlug/me/students',
      '/v1/teaching/me/guardian-account-binding/preview',
      '/v1/teaching/me/guardian-account-binding/consume',
      '/v1/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invites',
      '/v1/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invite',
      '/v1/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invites/:inviteId/revoke',
      '/v1/teaching/organizations/:orgSlug/me/students/:studentId/weekly-reports',
      '/v1/teaching/organizations/:orgSlug/me/students/:studentId/weekly-reports/:reportId',
      '/v1/teaching/organizations/:orgSlug/me/students/:studentId/lesson-feedback',
    ]) {
      expect(devApi).toContain(route);
    }
  });

  it('stores only token hashes and freezes exactly one terminal state', async () => {
    const migration = await read('../migrations/0156_teaching_learner_portal.sql');
    expect(migration).toContain('token_hash CHAR(64) NOT NULL UNIQUE');
    expect(migration).not.toMatch(/\btoken\s+(?:TEXT|VARCHAR|CHAR)/i);
    expect(migration).toContain('num_nonnulls(expired_at, consumed_at, revoked_at) <= 1');
    expect(migration).toContain('consumed_by_user_id_snapshot BIGINT');
    expect(migration).toContain('CREATE UNIQUE INDEX uq_guardian_account_binding_invites_pending');
    expect(migration).toContain("RAISE EXCEPTION 'guardian account binding invite history is retained'");
    expect(migration).toContain("RAISE EXCEPTION 'terminal guardian account binding invite state is immutable'");
    expect(migration).toContain('guardian account binding invite consumption requires the active linked guardian');
  });

  it('discovers live self and guardian relationships without exposing account identifiers', async () => {
    const route = await read('../src/routes/teaching_saas.ts');
    const section = sourceSection(
      route,
      'async listLearningContexts(actor, slug, requestId)',
      'async listLearnerWeeklyReports(',
    );
    expect(section).toContain('student.account_user_id = ?');
    expect(section).toContain('guardian.guardian_user_id = ?');
    expect(section).toContain("student.status = 'active'");
    expect(section).toContain("guardian.status = 'active'");
    expect(section).toContain("organization.status = 'active'");
    expect(section).toContain('0 AS relationship_order');
    expect(section).toContain('1 AS relationship_order');
    expect(section).toContain('ORDER BY context.organization_slug');
    expect(section).not.toContain('accountUserId:');
    expect(section).not.toContain('guardianUserId:');
    expect(section).not.toContain('externalRef:');
  });

  it('returns only published identity-visible reports and the latest visible feedback revision', async () => {
    const route = await read('../src/routes/teaching_saas.ts');
    const reports = sourceSection(
      route,
      'async listLearnerWeeklyReports(',
      'async listSelfTrainingAssignments(',
    );
    expect(reports).toContain("report.status = 'published'");
    expect(reports).toContain("report.visibility IN ('student', 'student_and_guardians')");
    expect(reports).toContain("report.visibility = 'student_and_guardians'");
    expect(reports).toContain("feedback.visibility IN ('student', 'student_and_guardians')");
    expect(reports).toContain('PARTITION BY feedback.session_id, feedback.student_id');
    expect(reports).toContain('WHERE visible_revision_rank = 1');

    const reportMapper = sourceSection(
      route,
      'function learnerWeeklyReportToJson(',
      'function selfTrainingAssignmentToJson(',
    );
    expect(reportMapper).toContain("row.is_self === true && visibility === 'student'");
    expect(reportMapper).toContain('feedbackCount: visibleFeedback.length');
    expect(reportMapper).not.toContain('internalNotes');
    expect(reportMapper).not.toContain('externalRef');
    expect(reportMapper).not.toContain('actorUserId');
    expect(reportMapper).not.toContain('accountUserId');
  });

  it('clears paired account link state before deleting the account while retaining invite snapshots', async () => {
    const accountDelete = await read('../src/utils/account_delete.ts');
    const deleteUser = accountDelete.indexOf('DELETE FROM app_users');
    const unlinkStudent = accountDelete.indexOf('UPDATE student_profiles');
    const unlinkGuardian = accountDelete.indexOf('UPDATE guardian_links');
    expect(unlinkStudent).toBeGreaterThan(-1);
    expect(unlinkGuardian).toBeGreaterThan(unlinkStudent);
    expect(deleteUser).toBeGreaterThan(unlinkGuardian);
    expect(accountDelete.slice(unlinkStudent, unlinkGuardian)).toContain(
      'SET account_user_id = NULL, account_linked_at = NULL',
    );
    expect(accountDelete.slice(unlinkGuardian, deleteUser)).toContain(
      'SET guardian_user_id = NULL, account_linked_at = NULL',
    );
    expect(accountDelete).toContain('guardian_account_binding_invites');
  });
});
