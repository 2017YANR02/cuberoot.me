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
  const start = source.indexOf(`CREATE FUNCTION ${functionName}`);
  const end = source.indexOf('$$ LANGUAGE plpgsql;', start);
  expect(start, `${functionName} definition missing`).toBeGreaterThan(-1);
  expect(end, `${functionName} definition is incomplete`).toBeGreaterThan(start);
  return source.slice(start, end + '$$ LANGUAGE plpgsql;'.length);
}

describe('teaching Stage 1 CRM schema', () => {
  it('keeps the immutable upgrade and final-state snapshot aligned without replaying ALTERs', async () => {
    const [migration, schema, readme] = await Promise.all([
      read('../migrations/0149_teaching_campuses_groups_assignments.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
    ]);
    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    expect(migration).toContain('ALTER COLUMN teacher_display_name_snapshot TYPE VARCHAR(200)');
    expect(schema).not.toContain('ALTER TABLE session_teachers');
    expect(createTable(schema, 'session_teachers')).toContain('teacher_display_name_snapshot VARCHAR(200) NOT NULL');
    expect(createTable(schema, 'session_teachers')).toContain('CHAR_LENGTH(teacher_display_name_snapshot) BETWEEN 1 AND 200');

    for (const table of [
      'teaching_campuses',
      'teaching_groups',
      'student_group_memberships',
      'teacher_assignments',
    ]) {
      expect(createTable(schema, table)).toBe(createTable(migration, table));
    }
    expect(
      createTable(schema, 'teaching_relation_locks').replace(", 'training_evidence'", ''),
    ).toBe(createTable(migration, 'teaching_relation_locks'));
    expect(createTable(schema, 'teaching_relation_locks')).toContain("'training_evidence'");
    expect(readme).toContain('0149_teaching_campuses_groups_assignments.sql');
    expect(readme).toContain('0148_fix_teaching_owner_guard.sql');
  });

  it('uses composite tenant keys and a stable snapshotted assignment identity', async () => {
    const migration = await read('../migrations/0149_teaching_campuses_groups_assignments.sql');
    for (const table of [
      'teaching_campuses',
      'teaching_groups',
      'teaching_relation_locks',
      'student_group_memberships',
      'teacher_assignments',
    ]) {
      expect(createTable(migration, table)).toContain('UNIQUE (organization_id, id)');
    }
    for (const relation of [
      'teaching_groups_campus_fk',
      'student_group_memberships_group_fk',
      'student_group_memberships_student_fk',
      'teacher_assignments_member_fk',
      'teacher_assignments_group_fk',
      'teacher_assignments_student_fk',
    ]) {
      expect(migration).toContain(`CONSTRAINT ${relation}`);
    }
    const assignment = createTable(migration, 'teacher_assignments');
    expect(assignment).toContain('teacher_user_id BIGINT');
    expect(assignment).toContain('teacher_user_id_snapshot BIGINT NOT NULL');
    expect(assignment).toContain('teacher_display_name_snapshot VARCHAR(200) NOT NULL');
    expect(assignment).toContain("teacher_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant')");
    expect(assignment).toContain('teacher_assignments_target_xor');
    expect(migration).not.toContain('revoked_at');
  });

  it('serializes direct-SQL range writes and makes relation-lock identities permanent', async () => {
    const migration = await read('../migrations/0149_teaching_campuses_groups_assignments.sql');
    expect(migration).toContain('ON CONFLICT (organization_id, relation_kind, subject_key, target_key)');
    expect(migration).toContain('DO UPDATE SET revision = teaching_relation_locks.revision + 1');
    expect(migration).not.toContain('pg_advisory');
    expect(migration).not.toContain('btree_gist');
    expect(migration).toContain('student_group_memberships_validate');
    expect(migration).toContain('teacher_assignments_validate');
    expect(migration).toContain("tstzrange(existing.effective_from, existing.effective_to, '[)')");
    expect(migration).toContain("RAISE EXCEPTION 'teaching relation lock rows are permanent concurrency identities'");
    expect(migration).toContain('CREATE TRIGGER teaching_relation_locks_guard_update');
    for (const identity of [
      'NEW.id IS DISTINCT FROM OLD.id',
      'NEW.organization_id IS DISTINCT FROM OLD.organization_id',
      'NEW.relation_kind IS DISTINCT FROM OLD.relation_kind',
      'NEW.subject_key IS DISTINCT FROM OLD.subject_key',
      'NEW.target_key IS DISTINCT FROM OLD.target_key',
      'NEW.created_at IS DISTINCT FROM OLD.created_at',
    ]) {
      expect(migration).toContain(identity);
    }
    expect(migration).toContain("USING ERRCODE = '55000'");
  });

  it('locks current resource rows and permits only bounded endings or FK anonymization', async () => {
    const migration = await read('../migrations/0149_teaching_campuses_groups_assignments.sql');
    expect(migration).toContain('SELECT status, campus_id INTO locked_group_status, locked_group_campus_id');
    expect(migration).toContain('SELECT status INTO locked_student_status');
    expect(migration).toContain('INTO locked_member_status, locked_member_role, locked_member_display_name');
    expect(migration.match(/FOR UPDATE;/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(migration).toContain('effective_to IS NULL OR effective_to >= effective_from');
    expect(migration).toContain('new teaching relation effective_to must be after effective_from');
    expect(migration).toContain("NEW.effective_to = NEW.effective_from OR NEW.effective_to <= clock_timestamp()");
    expect(migration).toContain("to_jsonb(NEW) - 'created_by_user_id'");
    expect(migration).toContain("to_jsonb(NEW) - 'teacher_user_id' - 'effective_to' - 'created_by_user_id'");
    expect(migration).toContain('group has active memberships or teacher assignments');
  });

  it('blocks terminal group archival while current or future relations remain', async () => {
    const migration = await read('../migrations/0149_teaching_campuses_groups_assignments.sql');
    const archiveGuard = createFunction(migration, 'trg_guard_teaching_structure_archive()');
    expect(archiveGuard).toContain('FROM student_group_memberships membership');
    expect(archiveGuard).toContain('membership.effective_to IS DISTINCT FROM membership.effective_from');
    expect(archiveGuard).toContain('membership.effective_to IS NULL OR membership.effective_to > clock_timestamp()');
    expect(archiveGuard).toContain('FROM teacher_assignments assignment');
    expect(archiveGuard).toContain('assignment.effective_to IS DISTINCT FROM assignment.effective_from');
    expect(archiveGuard).toContain('assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp()');
    expect(archiveGuard).not.toContain('membership.effective_from <= clock_timestamp()');
    expect(archiveGuard).not.toContain('assignment.effective_from <= clock_timestamp()');
    expect(archiveGuard).toContain("RAISE EXCEPTION 'group has active memberships or teacher assignments'");
    expect(archiveGuard).toContain("USING ERRCODE = '23514'");
  });
});
