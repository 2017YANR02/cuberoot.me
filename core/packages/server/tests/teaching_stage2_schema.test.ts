import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, `${new URL('.', import.meta.url).href}`), 'utf8');
}

describe('teaching Stage 2 schema', () => {
  it('keeps the immutable migration represented in the evolved canonical schema', async () => {
    const migration = await read('../migrations/0147_teaching_packages_and_sessions.sql');
    const schema = await read('../src/db/schema.pg.sql');
    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    const evolvedFinalState = migration
      .replace('teacher_display_name_snapshot VARCHAR(160)', 'teacher_display_name_snapshot VARCHAR(200)')
      .replace(
        'CHAR_LENGTH(teacher_display_name_snapshot) BETWEEN 1 AND 160',
        'CHAR_LENGTH(teacher_display_name_snapshot) BETWEEN 1 AND 200',
      );
    expect(schema).toContain(evolvedFinalState.trim());
  });

  it('uses composite tenant foreign keys for every cross-tenant business relation', async () => {
    const migration = await read('../migrations/0147_teaching_packages_and_sessions.sql');
    for (const relation of [
      'student_packages_student_fk',
      'student_packages_product_fk',
      'session_teachers_session_fk',
      'session_teachers_member_fk',
      'attendance_records_session_fk',
      'attendance_records_student_fk',
      'attendance_records_package_fk',
      'lesson_credit_ledger_package_fk',
      'lesson_credit_ledger_session_fk',
      'lesson_credit_ledger_attendance_fk',
      'lesson_credit_ledger_reversal_fk',
      'session_events_session_fk',
    ]) {
      expect(migration).toContain(`CONSTRAINT ${relation}`);
    }
    expect(migration).not.toMatch(/\b(?:orders|courses|memberships)\b/i);
  });

  it('makes credit and session histories append-only and attendance consumption permanent', async () => {
    const migration = await read('../migrations/0147_teaching_packages_and_sessions.sql');
    expect(migration).toContain('lesson_credit_ledger_append_only');
    expect(migration).toContain('session_events_append_only');
    expect(migration.match(/BEFORE UPDATE OR DELETE/g)).toHaveLength(2);
    expect(migration).toContain('uq_lesson_credit_ledger_attendance_consume');
    expect(migration).toContain("WHERE entry_type = 'consume'");
  });
});
