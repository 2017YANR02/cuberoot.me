import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, `${new URL('.', import.meta.url).href}`), 'utf8');
}

function createTable(source: string, table: string): string {
  const start = source.indexOf(`CREATE TABLE ${table} (`);
  const end = source.indexOf('\n);', start);
  expect(start, `${table} definition missing`).toBeGreaterThan(-1);
  expect(end, `${table} definition is incomplete`).toBeGreaterThan(start);
  return source.slice(start, end + 3);
}

function createFunction(source: string, functionName: string): string {
  const marker = source.includes(`CREATE OR REPLACE FUNCTION ${functionName}`)
    ? `CREATE OR REPLACE FUNCTION ${functionName}`
    : `CREATE FUNCTION ${functionName}`;
  const start = source.indexOf(marker);
  const end = source.indexOf('$$ LANGUAGE plpgsql;', start);
  expect(start, `${functionName} definition missing`).toBeGreaterThan(-1);
  expect(end, `${functionName} definition is incomplete`).toBeGreaterThan(start);
  return source.slice(start, end + '$$ LANGUAGE plpgsql;'.length);
}

const TABLES = [
  'training_templates',
  'training_template_versions',
  'training_assignments',
  'training_assignment_targets',
  'training_assignment_goal_metrics',
  'training_evidence',
  'training_evidence_assignments',
  'training_submission_reviews',
  'daily_training_rollups',
  'student_account_binding_invites',
] as const;

describe('teaching Stage 3A foundation schema', () => {
  it('records immutable migration 0150 and every foundation table', async () => {
    const [migration, schema, readme, devSchema] = await Promise.all([
      read('../migrations/0150_teaching_training_foundation.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
      read('../../client/app/[lang]/dev/schema/page.tsx'),
    ]);
    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    expect(readme).toContain('0150_teaching_training_foundation.sql');
    expect(devSchema).toContain("{ n: 150, slug: 'teaching_training_foundation'");
    for (const table of TABLES) {
      expect(createTable(migration, table)).toContain('organization_id UUID NOT NULL');
      expect(createTable(schema, table)).toContain('organization_id UUID NOT NULL');
      expect(devSchema).toContain(`{ name: '${table}'`);
    }
    expect(schema).not.toContain('ALTER TABLE student_profiles\n  ADD COLUMN account_linked_at');
  });

  it('backfills legacy account links before enforcing unlinked-only transitions', async () => {
    const [migration, schema] = await Promise.all([
      read('../migrations/0150_teaching_training_foundation.sql'),
      read('../src/db/schema.pg.sql'),
    ]);
    expect(migration.indexOf('SET account_linked_at = LEAST(updated_at, clock_timestamp())'))
      .toBeLessThan(migration.indexOf('ADD CONSTRAINT student_profiles_account_link_state'));
    const guard = createFunction(migration, 'trg_guard_student_account_link()');
    expect(guard).toContain('IF NEW.account_user_id IS NULL THEN');
    expect(guard).toContain('NEW.account_linked_at := NULL');
    expect(guard).toContain('NEW.account_user_id IS DISTINCT FROM OLD.account_user_id');
    expect(guard).toContain('OLD.account_user_id IS NOT NULL AND NEW.account_user_id IS NOT NULL');
    expect(guard).toContain('a linked student account must be unlinked before a different account can be bound');
    expect(createTable(schema, 'student_profiles')).toContain(
      '(account_user_id IS NULL) = (account_linked_at IS NULL)',
    );
  });

  it('keeps binding tokens hashed, terminal, expirable, and linked to the consumed account', async () => {
    const migration = await read('../migrations/0150_teaching_training_foundation.sql');
    const invite = createTable(migration, 'student_account_binding_invites');
    const guard = createFunction(migration, 'trg_guard_student_account_binding_invite()');
    expect(invite).toContain('token_hash CHAR(64) NOT NULL UNIQUE');
    expect(invite).not.toMatch(/\btoken\s+(?:TEXT|VARCHAR)/i);
    expect(invite).toContain('num_nonnulls(expired_at, consumed_at, revoked_at) <= 1');
    expect(invite).toContain('consumed_at >= created_at AND consumed_at < expires_at');
    expect(invite).toContain('revoked_at >= created_at');
    expect(migration).toContain('WHERE expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL');
    expect(guard).toContain('NEW.expires_at > clock_timestamp()');
    expect(guard).toContain('linked_student_account_user_id IS DISTINCT FROM NEW.consumed_by_user_id');
    expect(guard).toContain('linked_student_account_linked_at > NEW.consumed_at');
    expect(guard).toContain('terminal student account binding invite state is immutable');
  });

  it('freezes published lifecycles and rejects direct aggregate or append-only history tampering', async () => {
    const migration = await read('../migrations/0150_teaching_training_foundation.sql');
    expect(createFunction(migration, 'trg_guard_training_template()')).toContain(
      'training template archive is terminal',
    );
    const assignmentGuard = createFunction(migration, 'trg_guard_training_assignment()');
    expect(assignmentGuard).toContain('training assignments are retained; close instead');
    expect(assignmentGuard).toContain('published training assignment schedule, content, and lifecycle are immutable');
    expect(assignmentGuard).toContain('closed training assignment is immutable');
    expect(assignmentGuard).toContain("NEW.created_at IS DISTINCT FROM OLD.created_at");
    expect(createFunction(migration, 'trg_guard_training_assignment_target()')).toContain(
      'aggregate_changed AND pg_trigger_depth() < 2',
    );
    for (const trigger of [
      'training_template_versions_append_only',
      'training_evidence_append_only',
      'training_evidence_assignments_append_only',
      'training_submission_reviews_guard',
    ]) {
      expect(migration).toContain(`CREATE TRIGGER ${trigger}`);
    }
  });

  it('serializes publish-time group expansion with the Stage 1 membership-set identity', async () => {
    const migration = await read('../migrations/0150_teaching_training_foundation.sql');
    const target = createTable(migration, 'training_assignment_targets');
    const membershipLock = createFunction(migration, 'trg_lock_student_group_membership_set()');
    const publishCheck = createFunction(migration, 'assert_training_assignment_has_targets(');
    expect(target).toContain('source_group_id UUID');
    expect(target).toContain('CONSTRAINT training_assignment_targets_source_group_fk');
    expect(target).toContain('FOREIGN KEY (organization_id, source_group_id)');
    expect(target).toContain("target_kind = 'group'\n      AND group_id IS NOT NULL\n      AND source_group_id IS NULL");
    expect(membershipLock).toContain("NEW.organization_id, 'student_group', '*', NEW.group_id::text");
    expect(migration).toContain('student_group_memberships_00_training_publish_lock');
    expect(publishCheck).toContain("target_organization_id, 'student_group', '*', locked_group_id::text");
    expect(publishCheck).toContain('DO UPDATE SET revision = teaching_relation_locks.revision + 1');
    expect(publishCheck).toContain('student_target.source_group_id IS NOT NULL');
    expect(publishCheck).toContain('group_target.group_id = student_target.source_group_id');
    expect(publishCheck).toContain('expanded training target source must be a selected group with an active publish-time membership');
    expect(publishCheck).toContain('WITH expected_students AS');
    expect(publishCheck).toContain('direct_target.source_group_id IS NULL');
    expect(publishCheck).toContain('FULL OUTER JOIN actual_students actual USING (student_id)');
    expect(publishCheck).toContain('published training student targets must exactly match direct targets and active group memberships');
    expect(migration).toContain('DEFERRABLE INITIALLY DEFERRED');
  });

  it('pins provenance, registry, identity, time, and normalized metric parity in the database', async () => {
    const migration = await read('../migrations/0150_teaching_training_foundation.sql');
    const evidence = createTable(migration, 'training_evidence');
    const prepare = createFunction(migration, 'trg_prepare_training_evidence()');
    expect(evidence).toContain("trust_level IN (\n      'self_reported',\n      'server_recomputed',\n      'server_challenge_recomputed',\n      'server_originated'");
    expect(evidence).not.toMatch(/\bverified\b/i);
    expect(evidence).toContain('UNIQUE (organization_id, student_id, source, source_event_id)');
    expect(prepare.indexOf('FROM app_users')).toBeLessThan(prepare.indexOf('FROM student_profiles'));
    expect(prepare).toContain('FOR KEY SHARE');
    expect(prepare).toContain('student_account_user_id IS DISTINCT FROM NEW.submitted_by_user_id');
    expect(prepare).toContain('NEW.occurred_at < student_account_linked_at');
    expect(prepare).toContain("clock_timestamp() + INTERVAL '5 minutes'");
    expect(prepare).toContain("jsonb_typeof(NEW.metrics -> 'success')");
    expect(prepare).toContain('NEW.success IS DISTINCT FROM metric_success');
    expect(prepare).toContain('NEW.result_ms IS DISTINCT FROM metric_result_ms');
    expect(prepare).toContain("ELSIF (NEW.metrics - 'success') <> '{}'::jsonb OR NEW.result_ms IS NOT NULL");
    expect(migration).toContain("candidate_source = 'timer' AND candidate_activity = 'solve'");
    expect(migration).toContain("('best_result_ms', 'lte')");
    expect(migration).not.toContain("candidate_source = 'predict' AND candidate_metric_key = 'best_result_ms'");
    expect(migration).not.toContain("candidate_source = 'alg-trainer' AND candidate_metric_key = 'best_result_ms'");
  });

  it('uses composite tenant FKs and row-dimension rollups that rebuild from evidence snapshots', async () => {
    const migration = await read('../migrations/0150_teaching_training_foundation.sql');
    for (const relation of [
      'training_template_versions_template_fk',
      'training_assignments_template_version_fk',
      'training_assignment_targets_assignment_fk',
      'training_assignment_targets_student_fk',
      'training_assignment_targets_group_fk',
      'training_assignment_targets_source_group_fk',
      'training_assignment_goal_metrics_assignment_fk',
      'training_evidence_student_fk',
      'training_evidence_assignments_evidence_fk',
      'training_evidence_assignments_target_fk',
      'training_submission_reviews_target_fk',
      'daily_training_rollups_student_fk',
      'student_account_binding_invites_student_fk',
    ]) {
      expect(migration).toContain(`CONSTRAINT ${relation}`);
    }
    expect(createTable(migration, 'daily_training_rollups')).toContain(
      'PRIMARY KEY (organization_id, student_id, local_date, source, activity, trust_level)',
    );
    const rebuild = createFunction(migration, 'rebuild_daily_training_rollups(');
    expect(rebuild).toContain('FROM training_evidence');
    expect(rebuild).toContain('GROUP BY organization_id, student_id, local_date, source, activity, trust_level');
  });
});
