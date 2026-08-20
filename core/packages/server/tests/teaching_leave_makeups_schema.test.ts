import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, `${new URL('.', import.meta.url).href}`), 'utf8');
}

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const through = source.indexOf(end, from + start.length);
  expect(from, `${start} missing`).toBeGreaterThan(-1);
  expect(through, `${end} missing`).toBeGreaterThan(from);
  return source.slice(from, through);
}

describe('teaching leave and makeup contract', () => {
  it('keeps migration 0165 in the canonical schema and migration ledger', async () => {
    const [migration, schema, readme] = await Promise.all([
      read('../migrations/0165_teaching_leave_makeups.sql'),
      read('../src/db/schema.pg.sql'),
      read('../migrations/README.md'),
    ]);
    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT)\s*;/i);
    expect(schema).toContain(migration.trim());
    expect(readme).toContain('0165_teaching_leave_makeups.sql');
  });

  it('freezes one active leave and one live or fulfilled makeup without nested chains', async () => {
    const migration = await read('../migrations/0165_teaching_leave_makeups.sql');
    expect(migration).toContain("status IN ('pending', 'approved', 'rejected', 'cancelled')");
    expect(migration).toContain("WHERE status IN ('pending', 'approved')");
    expect(migration).toContain("status IN ('scheduled', 'fulfilled', 'failed', 'cancelled')");
    expect(migration).toContain("WHERE status IN ('scheduled', 'fulfilled')");
    expect(migration).toContain('UNIQUE (organization_id, target_attendance_id)');
    expect(migration).toContain('nested makeup chains are not allowed');
  });

  it('allows only account-deletion nulling after actor snapshots are established', async () => {
    const migration = await read('../migrations/0165_teaching_leave_makeups.sql');
    expect(migration).toContain(
      'OLD.requested_by_user_id IS NOT NULL AND NEW.requested_by_user_id IS NULL',
    );
    expect(migration).toContain(
      'OLD.created_by_user_id IS NOT NULL AND NEW.created_by_user_id IS NULL',
    );
    expect(migration).toContain(
      "OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected', 'cancelled')",
    );
    expect(migration).toContain(
      "OLD.status = 'scheduled' AND NEW.status IN ('fulfilled', 'failed', 'cancelled')",
    );
    expect(migration).toContain('leave request decider reference cannot be replaced');
    expect(migration).toContain('makeup attempt resolver reference cannot be replaced');
  });

  it('locks sessions, attendance, and package in one stable order and uses the database clock', async () => {
    const migration = await read('../migrations/0165_teaching_leave_makeups.sql');
    const leaveGuard = between(
      migration,
      'CREATE OR REPLACE FUNCTION trg_validate_leave_request_mutation()',
      'CREATE TRIGGER leave_requests_validate_mutation',
    );
    expect(leaveGuard.indexOf('FROM teaching_sessions')).toBeLessThan(
      leaveGuard.indexOf('FROM attendance_records'),
    );
    const insertGuard = between(
      migration,
      'CREATE OR REPLACE FUNCTION trg_validate_makeup_attempt_mutation()',
      'CREATE TRIGGER makeup_attempts_validate_mutation',
    );
    expect(insertGuard.indexOf('FROM teaching_sessions')).toBeLessThan(
      insertGuard.indexOf('FROM attendance_records'),
    );
    expect(insertGuard.indexOf('FROM attendance_records')).toBeLessThan(
      insertGuard.indexOf('FROM student_packages'),
    );
    expect(insertGuard).toContain('ORDER BY id\n  FOR UPDATE');
    expect(insertGuard).toContain('target_session.starts_at <= NOW()');
    expect(insertGuard).toContain("target_package.lifecycle_status <> 'active'");
    expect(insertGuard).toContain('target_package.valid_from > target_session.starts_at');
    expect(insertGuard).toContain('target_package.valid_until <= target_session.starts_at');
  });

  it('requires source and target session cancellation to resolve scheduled attempts atomically', async () => {
    const migration = await read('../migrations/0165_teaching_leave_makeups.sql');
    const terminalGuard = between(
      migration,
      'CREATE OR REPLACE FUNCTION trg_validate_makeup_terminal_state()',
      'CREATE CONSTRAINT TRIGGER makeup_attempts_terminal_state',
    );
    expect(terminalGuard).toContain('source_session_id = NEW.id OR target_session_id = NEW.id');
    expect(terminalGuard).toContain(
      "source_session_status IN ('scheduled', 'in_progress', 'completed')",
    );
    expect(terminalGuard).toContain("target_session_status IN ('scheduled', 'in_progress')");
    expect(terminalGuard).toContain(
      "target_attendance_status IN ('expected', 'present', 'late', 'absent', 'excused')",
    );
    expect(terminalGuard).toContain("target_session_status = 'completed'");
    expect(terminalGuard).toContain('consume_count = 1');
  });

  it('keeps leave decisions open-session only and billing on completed billable target attendance', async () => {
    const migration = await read('../migrations/0165_teaching_leave_makeups.sql');
    expect(migration).toContain("session_status NOT IN ('scheduled', 'in_progress')");
    expect(migration).toContain("NEW.status = 'approved' AND attendance_status <> 'excused'");
    expect(migration).toContain('approved leave and excused attendance must be committed together');
    expect(migration).toContain("session_status <> 'completed'");
    expect(migration).toContain("attendance_row.status NOT IN ('present', 'late')");
    expect(migration).toContain('credit consume requires matching completed billable attendance');
  });

  it('runs the PG13 upgrade, canonical parity, direct-SQL, and lock-order fixture', async () => {
    const fixture = await read('./fixtures/teaching_leave_makeups_pg.ts');
    const apply0147 = fixture.indexOf('await upgrade.unsafe(migration0147)');
    const seedLegacy = fixture.indexOf('await seedLegacy0147(upgrade)');
    const apply0164 = fixture.indexOf('await upgrade.unsafe(migration0164)');
    const apply0165 = fixture.indexOf('await upgrade.unsafe(migration0165)');

    expect(apply0147).toBeGreaterThan(-1);
    expect(seedLegacy).toBeGreaterThan(apply0147);
    expect(apply0164).toBeGreaterThan(seedLegacy);
    expect(apply0165).toBeGreaterThan(apply0164);
    expect(fixture).toContain("WHERE idempotency_key = 'legacy-purchase'");
    expect(fixture).toContain('await canonical.unsafe(schemaSnapshot)');
    expect(fixture).toContain('assert.deepEqual(canonicalCatalog, upgradeCatalog)');
    expect(fixture).toContain('assert.deepEqual(canonicalSemantics, upgradeSemantics)');

    expect(fixture).toContain("'read committed'");
    expect(fixture).toContain("'repeatable read'");
    expect(fixture).toContain("assert.notEqual(sqlState(result.reason), '40P01'");
    expect(fixture).toContain('readCommittedAscending');
    expect(fixture).toContain('repeatableReadDescending');
    expect(fixture).toContain('deadlocks: 0');

    for (const sqlState of ['23514', '23505', '55000']) {
      expect(fixture).toContain(`'${sqlState}'`);
    }
    for (const contract of [
      "lifecycle_status = 'frozen'",
      "valid_from = ${new Date",
      "valid_until = ${scenario.targetStartsAt}",
      "runAttendanceConsumption(db, 20, 'present')",
      "runAttendanceConsumption(db, 30, 'late')",
      "sourceExcusedConsume: '0'",
      "targetPresentConsume: '1'",
      "targetLateConsume: '1'",
      'runFailedAndNested(db)',
      'runCancelledReschedule(db)',
      'runLiveDuplicate(db)',
      'runSourceCancellation(db)',
      'runScheduledProgression(db)',
      "scheduledProgression: 'split-transactions-ok'",
      "completedWithoutResolution: '23514'",
      'runLifecycleConcurrencyMatrix(upgrade)',
      'scheduleThenComplete',
      'completeThenSchedule',
      'scheduleThenCancel',
      'cancelThenSchedule',
      'completeThenCancel',
      'cancelThenComplete',
      "return 'cancel-retry'",
    ]) {
      expect(fixture).toContain(contract);
    }
  });
});
