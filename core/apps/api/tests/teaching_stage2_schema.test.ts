import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, `${new URL('.', import.meta.url).href}`), 'utf8');
}

describe('teaching Stage 2 schema', () => {
  it('keeps the immutable Stage 2 migration represented by the evolved canonical schema', async () => {
    const migration = await read('../migrations/0147_teaching_packages_and_sessions.sql');
    const schema = await read('../src/db/schema.pg.sql');
    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    for (const table of [
      'lesson_package_products',
      'student_packages',
      'teaching_sessions',
      'session_teachers',
      'attendance_records',
      'lesson_credit_ledger',
      'session_events',
    ]) {
      expect(migration).toContain(`CREATE TABLE ${table}`);
      expect(schema).toContain(`CREATE TABLE ${table}`);
    }
    expect(schema).toContain('teacher_display_name_snapshot VARCHAR(200)');
    expect(schema).toContain('CHAR_LENGTH(teacher_display_name_snapshot) BETWEEN 1 AND 200');
    expect(schema).toContain('lesson_credit_ledger_entry_shape');
    expect(schema).not.toContain('CONSTRAINT lesson_credit_ledger_consume_shape');
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

  it('serializes every credit write and constrains refunds, reversals, and balances in 0164', async () => {
    const migration = await read('../migrations/0164_teaching_credit_adjustments.sql');
    const schema = await read('../src/db/schema.pg.sql');
    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    for (const contract of [
      'credit_ledger_revision BIGINT NOT NULL DEFAULT 0',
      'lesson_credit_ledger_entry_shape',
      'uq_lesson_credit_ledger_refund_source',
      'idx_lesson_credit_ledger_credit_adjustments',
      'trg_validate_lesson_credit_ledger_insert',
      'student package credit balance cannot be negative',
      'credit ledger reversal must exactly reverse one entry in the same package',
    ]) {
      expect(migration).toContain(contract);
      expect(schema).toContain(contract);
    }
    expect(migration).toContain('SET credit_ledger_revision = credit_ledger_revision + 1');
    expect(migration.indexOf('UPDATE student_packages')).toBeLessThan(
      migration.indexOf('SELECT COALESCE(SUM(delta), 0)'),
    );
    expect(migration).toContain("WHERE entry_type = 'refund'");
    expect(migration).toContain("WHERE entry_type IN ('adjustment', 'refund', 'reversal', 'expiration')");
  });

  it('publishes the bigint-safe shared ledger and adjustment feed contract', async () => {
    const shared = await readFile(workspaceFixturePath('@cuberoot/shared', 'src/teaching.ts'), 'utf8');
    expect(shared).toContain("export const TEACHING_CREDIT_LEDGER_ENTRY_TYPES = [");
    for (const type of ['purchase', 'grant', 'consume', 'refund', 'adjustment', 'expiration', 'reversal']) {
      expect(shared).toContain(`'${type}'`);
    }
    expect(shared).toMatch(/interface TeachingCreditLedgerEntry[\s\S]*?id: string;/);
    expect(shared).toMatch(/interface TeachingCreditLedgerEntry[\s\S]*?reversalOfLedgerId: string \| null;/);
    expect(shared).toMatch(/interface TeachingCreditLedgerEntry[\s\S]*?reversedByLedgerId: string \| null;/);
    expect(shared).toMatch(/interface TeachingCreditAdjustment[\s\S]*?ledgerEntry: TeachingCreditLedgerEntry;/);
  });
});
