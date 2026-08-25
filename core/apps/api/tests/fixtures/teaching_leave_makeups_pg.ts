import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const host = process.env.DB_HOST ?? '127.0.0.1';
const port = Number(process.env.DB_PORT ?? 5433);
const user = process.env.DB_USER ?? 'postgres';
const password = process.env.DB_PASS ?? 'dev';
const adminDatabase = process.env.DB_NAME ?? 'cuberoot_db';
const upgradeDatabase = `cuberoot_leave_makeup_upgrade_${process.pid}`;
const canonicalDatabase = `cuberoot_leave_makeup_canonical_${process.pid}`;

type Db = ReturnType<typeof postgres>;

interface Scenario {
  ordinal: number;
  sourceSessionId: string;
  sourceAttendanceId: string;
  targetSessionId: string;
  targetAttendanceId: string;
  targetStartsAt: string;
}

const organizationId = uuid(100);
const studentId = uuid(101);
const productId = uuid(102);
const studentPackageId = uuid(103);
const actorUserId = 101;

const admin = postgres({ host, port, user, password, database: adminDatabase, max: 1 });
let upgrade: Db | null = null;
let canonical: Db | null = null;
const extraClients: Db[] = [];

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
}

function instant(day: number, hour = 10): string {
  const value = new Date(Date.UTC(2099, 0, 1 + day, hour));
  return value.toISOString();
}

function sqlState(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

async function expectSqlState(
  operation: () => Promise<unknown>,
  expected: string | readonly string[],
): Promise<string> {
  const states = typeof expected === 'string' ? [expected] : expected;
  try {
    await operation();
  } catch (error) {
    const code = sqlState(error);
    assert.ok(code && states.includes(code), `expected SQLSTATE ${states.join('/')} but received ${code}`);
    return code;
  }
  assert.fail(`expected SQLSTATE ${states.join('/')}`);
}

const foundation = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE app_users (
  id BIGINT PRIMARY KEY,
  display_name VARCHAR(200) NOT NULL
);
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL,
  joined_at TIMESTAMPTZ,
  PRIMARY KEY (organization_id, user_id)
);
CREATE TABLE student_profiles (
  id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  display_name VARCHAR(160) NOT NULL,
  external_ref VARCHAR(100),
  status VARCHAR(16) NOT NULL,
  PRIMARY KEY (organization_id, id)
);
`;

async function seedLegacy0147(db: Db): Promise<void> {
  const legacyOrganizationId = uuid(10);
  const legacyStudentId = uuid(11);
  const legacyProductId = uuid(12);
  const legacyPackageId = uuid(13);
  await db.unsafe(`
    INSERT INTO app_users (id, display_name) VALUES (1, 'Legacy Owner');
    INSERT INTO organizations (id, slug, name, timezone, status)
    VALUES ('${legacyOrganizationId}', 'legacy', 'Legacy', 'UTC', 'active');
    INSERT INTO student_profiles (id, organization_id, display_name, external_ref, status)
    VALUES ('${legacyStudentId}', '${legacyOrganizationId}', 'Legacy Student', 'legacy-1', 'active');
    INSERT INTO lesson_package_products (
      id, organization_id, code, name, credit_unit, credit_type, total_credits,
      price_amount_minor, currency, created_by_user_id
    ) VALUES (
      '${legacyProductId}', '${legacyOrganizationId}', 'legacy', 'Legacy package',
      'lesson', 'standard', 2, 1000, 'USD', 1
    );
    INSERT INTO student_packages (
      id, organization_id, student_id, product_id, product_code_snapshot,
      product_name_snapshot, credit_unit, credit_type, entitled_credits,
      price_amount_minor, currency, acquisition_type, valid_from, valid_until,
      created_by_user_id
    ) VALUES (
      '${legacyPackageId}', '${legacyOrganizationId}', '${legacyStudentId}', '${legacyProductId}',
      'legacy', 'Legacy package', 'lesson', 'standard', 2, 1000, 'USD', 'purchase',
      '2020-01-01T00:00:00Z', '2100-01-01T00:00:00Z', 1
    );
    INSERT INTO lesson_credit_ledger (
      organization_id, student_package_id, student_id, entry_type, delta,
      idempotency_key, reason, actor_user_id, actor_role, actor_display_name
    ) VALUES (
      '${legacyOrganizationId}', '${legacyPackageId}', '${legacyStudentId}', 'purchase', 2,
      'legacy-purchase', 'Legacy entitlement', 1, 'owner', 'Legacy Owner'
    );
  `);
}

async function seedSemanticTenant(db: Db): Promise<void> {
  await db`
    INSERT INTO app_users (id, display_name)
    VALUES (${actorUserId}, 'Fixture Owner'), (102, 'Other Actor')`;
  await db.begin(async (tx) => {
    await tx`
      INSERT INTO organizations (id, slug, name, timezone, status)
      VALUES (${organizationId}, 'leave-fixture', 'Leave Fixture', 'UTC', 'active')`;
    await tx`
      INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
      VALUES (${organizationId}, ${actorUserId}, 'owner', 'active', NOW())`;
  });
  await db`
    INSERT INTO student_profiles (id, organization_id, display_name, external_ref, status)
    VALUES (${studentId}, ${organizationId}, 'Fixture Student', 'student-1', 'active')`;
  await db`
    INSERT INTO lesson_package_products (
      id, organization_id, code, name, credit_unit, credit_type, total_credits,
      price_amount_minor, currency, created_by_user_id
    ) VALUES (
      ${productId}, ${organizationId}, 'leave-fixture', 'Leave fixture package',
      'lesson', 'standard', 50, 5000, 'USD', ${actorUserId}
    )`;
  await db`
    INSERT INTO student_packages (
      id, organization_id, student_id, product_id, product_code_snapshot,
      product_name_snapshot, credit_unit, credit_type, entitled_credits,
      price_amount_minor, currency, acquisition_type, valid_from, valid_until,
      created_by_user_id
    ) VALUES (
      ${studentPackageId}, ${organizationId}, ${studentId}, ${productId},
      'leave-fixture', 'Leave fixture package', 'lesson', 'standard', 50,
      5000, 'USD', 'purchase', '2020-01-01T00:00:00Z', '2100-01-01T00:00:00Z',
      ${actorUserId}
    )`;
  await db`
    INSERT INTO lesson_credit_ledger (
      organization_id, student_package_id, student_id, entry_type, delta,
      idempotency_key, reason, actor_user_id, actor_role, actor_display_name
    ) VALUES (
      ${organizationId}, ${studentPackageId}, ${studentId}, 'purchase', 50,
      'fixture-purchase', 'Fixture entitlement', ${actorUserId}, 'owner', 'Fixture Owner'
    )`;
}

async function createScenario(db: Db, ordinal: number): Promise<Scenario> {
  const base = 100_000 + ordinal * 100;
  const sourceSessionId = uuid(base + 1);
  const sourceAttendanceId = uuid(base + 2);
  const targetSessionId = uuid(base + 3);
  const targetAttendanceId = uuid(base + 4);
  const sourceStartsAt = instant(ordinal * 3);
  const sourceEndsAt = instant(ordinal * 3, 11);
  const targetStartsAt = instant(ordinal * 3 + 1);
  const targetEndsAt = instant(ordinal * 3 + 1, 11);

  await db`
    INSERT INTO teaching_sessions (
      id, organization_id, title, starts_at, ends_at, timezone, status, created_by_user_id
    ) VALUES
      (${sourceSessionId}, ${organizationId}, ${`Source ${ordinal}`}, ${sourceStartsAt},
       ${sourceEndsAt}, 'UTC', 'scheduled', ${actorUserId}),
      (${targetSessionId}, ${organizationId}, ${`Target ${ordinal}`}, ${targetStartsAt},
       ${targetEndsAt}, 'UTC', 'scheduled', ${actorUserId})`;
  await db`
    INSERT INTO attendance_records (
      id, organization_id, session_id, student_id, student_package_id, status,
      credit_cost, notes, recorded_by_user_id
    ) VALUES
      (${sourceAttendanceId}, ${organizationId}, ${sourceSessionId}, ${studentId},
       ${studentPackageId}, 'expected', 1, '', ${actorUserId}),
      (${targetAttendanceId}, ${organizationId}, ${targetSessionId}, ${studentId},
       ${studentPackageId}, 'expected', 1, '', ${actorUserId})`;

  return {
    ordinal,
    sourceSessionId,
    sourceAttendanceId,
    targetSessionId,
    targetAttendanceId,
    targetStartsAt,
  };
}

async function addTarget(db: Db, scenario: Scenario, suffix: number): Promise<{
  sessionId: string;
  attendanceId: string;
}> {
  const base = 100_000 + scenario.ordinal * 100 + 20 + suffix * 2;
  const sessionId = uuid(base);
  const attendanceId = uuid(base + 1);
  const startsAt = instant(scenario.ordinal * 3 + 1 + suffix);
  const endsAt = instant(scenario.ordinal * 3 + 1 + suffix, 11);
  await db`
    INSERT INTO teaching_sessions (
      id, organization_id, title, starts_at, ends_at, timezone, status, created_by_user_id
    ) VALUES (
      ${sessionId}, ${organizationId}, ${`Target ${scenario.ordinal}.${suffix}`},
      ${startsAt}, ${endsAt}, 'UTC', 'scheduled', ${actorUserId}
    )`;
  await db`
    INSERT INTO attendance_records (
      id, organization_id, session_id, student_id, student_package_id, status,
      credit_cost, notes, recorded_by_user_id
    ) VALUES (
      ${attendanceId}, ${organizationId}, ${sessionId}, ${studentId}, ${studentPackageId},
      'expected', 1, '', ${actorUserId}
    )`;
  return { sessionId, attendanceId };
}

async function createPendingLeave(db: Db, scenario: Scenario): Promise<string> {
  const rows = await db`
    INSERT INTO leave_requests (
      organization_id, session_id, attendance_id, student_id, reason,
      requested_by_user_id, requested_by_user_id_snapshot,
      requested_by_display_name_snapshot, requested_by_role_snapshot
    ) VALUES (
      ${organizationId}, ${scenario.sourceSessionId}, ${scenario.sourceAttendanceId},
      ${studentId}, 'Needs leave', ${actorUserId}, ${actorUserId},
      'Fixture Owner', 'owner'
    ) RETURNING id::text`;
  return String(rows[0].id);
}

async function approveLeave(db: Db, scenario: Scenario): Promise<string> {
  const leaveId = await createPendingLeave(db, scenario);
  await db.begin(async (tx) => {
    await tx`
      UPDATE attendance_records SET status = 'excused'
      WHERE organization_id = ${organizationId} AND id = ${scenario.sourceAttendanceId}`;
    await tx`
      UPDATE leave_requests
      SET status = 'approved', decision_reason = 'Approved',
          decided_by_user_id = ${actorUserId}, decided_by_user_id_snapshot = ${actorUserId},
          decided_by_display_name_snapshot = 'Fixture Owner', decided_by_role_snapshot = 'owner',
          decided_at = NOW()
      WHERE organization_id = ${organizationId} AND id = ${leaveId}`;
  });
  return leaveId;
}

async function insertMakeup(
  db: Db,
  source: Pick<Scenario, 'sourceSessionId' | 'sourceAttendanceId'>,
  target: { sessionId: string; attendanceId: string } | Pick<Scenario, 'targetSessionId' | 'targetAttendanceId'>,
  reason: string,
): Promise<string> {
  const targetSessionId = 'sessionId' in target ? target.sessionId : target.targetSessionId;
  const targetAttendanceId = 'attendanceId' in target ? target.attendanceId : target.targetAttendanceId;
  const rows = await db`
    INSERT INTO makeup_attempts (
      organization_id, source_session_id, source_attendance_id,
      target_session_id, target_attendance_id, student_id, student_package_id,
      credit_cost, reason, created_by_user_id, created_by_user_id_snapshot,
      created_by_display_name_snapshot, created_by_role_snapshot
    ) VALUES (
      ${organizationId}, ${source.sourceSessionId}, ${source.sourceAttendanceId},
      ${targetSessionId}, ${targetAttendanceId}, ${studentId}, ${studentPackageId},
      1, ${reason}, ${actorUserId}, ${actorUserId}, 'Fixture Owner', 'owner'
    ) RETURNING id::text`;
  return String(rows[0].id);
}

async function resolveFulfilled(
  db: Db,
  scenario: Scenario,
  attemptId: string,
  attendanceStatus: 'present' | 'late',
): Promise<void> {
  await db.begin(async (tx) => {
    await tx`
      UPDATE attendance_records SET status = ${attendanceStatus}
      WHERE organization_id = ${organizationId} AND id = ${scenario.targetAttendanceId}`;
    await tx`
      UPDATE teaching_sessions
      SET status = 'completed', completed_at = NOW(), version = version + 1
      WHERE organization_id = ${organizationId} AND id = ${scenario.targetSessionId}`;
    await tx`
      INSERT INTO lesson_credit_ledger (
        organization_id, student_package_id, student_id, entry_type, delta,
        attendance_id, session_id, idempotency_key, reason,
        actor_user_id, actor_role, actor_display_name
      ) VALUES (
        ${organizationId}, ${studentPackageId}, ${studentId}, 'consume', -1,
        ${scenario.targetAttendanceId}, ${scenario.targetSessionId},
        ${`consume-${scenario.ordinal}`}, 'Makeup consumed',
        ${actorUserId}, 'owner', 'Fixture Owner'
      )`;
    await tx`
      UPDATE makeup_attempts
      SET status = 'fulfilled', resolved_by_user_id = ${actorUserId},
          resolved_by_user_id_snapshot = ${actorUserId},
          resolved_by_display_name_snapshot = 'Fixture Owner', resolved_by_role_snapshot = 'owner',
          resolution_reason = 'Attended', resolved_at = NOW()
      WHERE organization_id = ${organizationId} AND id = ${attemptId}`;
  });
}

async function runAttendanceConsumption(
  db: Db,
  ordinal: number,
  attendanceStatus: 'present' | 'late',
): Promise<void> {
  const scenario = await createScenario(db, ordinal);
  await approveLeave(db, scenario);
  const attemptId = await insertMakeup(db, scenario, scenario, `${attendanceStatus} attempt`);
  const sourceBefore = await db`
    SELECT COUNT(*)::int AS consumes FROM lesson_credit_ledger
    WHERE organization_id = ${organizationId}
      AND attendance_id = ${scenario.sourceAttendanceId} AND entry_type = 'consume'`;
  assert.equal(sourceBefore[0].consumes, 0);

  await resolveFulfilled(db, scenario, attemptId, attendanceStatus);
  const sourceAfter = await db`
    SELECT COUNT(*)::int AS consumes FROM lesson_credit_ledger
    WHERE organization_id = ${organizationId}
      AND attendance_id = ${scenario.sourceAttendanceId} AND entry_type = 'consume'`;
  assert.equal(sourceAfter[0].consumes, 0);
  const targetAfter = await db`
    SELECT COUNT(*)::int AS consumes, COALESCE(SUM(delta), 0)::int AS delta
    FROM lesson_credit_ledger
    WHERE organization_id = ${organizationId}
      AND attendance_id = ${scenario.targetAttendanceId} AND entry_type = 'consume'`;
  assert.deepEqual(targetAfter[0], { consumes: 1, delta: -1 });

  await expectSqlState(
    () => db`
      INSERT INTO lesson_credit_ledger (
        organization_id, student_package_id, student_id, entry_type, delta,
        attendance_id, session_id, idempotency_key, reason, actor_role, actor_display_name
      ) VALUES (
        ${organizationId}, ${studentPackageId}, ${studentId}, 'consume', -1,
        ${scenario.targetAttendanceId}, ${scenario.targetSessionId},
        ${`duplicate-consume-${ordinal}`}, 'Duplicate consume', 'owner', 'Fixture Owner'
      )`,
    '23505',
  );
  await expectSqlState(
    () => db`
      UPDATE makeup_attempts SET status = 'failed'
      WHERE organization_id = ${organizationId} AND id = ${attemptId}`,
    '55000',
  );
}

async function runPackageBounds(db: Db): Promise<void> {
  const scenario = await createScenario(db, 10);
  await expectSqlState(
    () => db`
      INSERT INTO leave_requests (
        organization_id, session_id, attendance_id, student_id, reason,
        requested_by_user_id, requested_by_user_id_snapshot,
        requested_by_display_name_snapshot, requested_by_role_snapshot
      ) VALUES (
        ${organizationId}, ${scenario.sourceSessionId}, ${scenario.sourceAttendanceId},
        ${studentId}, 'Actor mismatch', ${actorUserId}, 102, 'Fixture Owner', 'owner'
      )`,
    '23514',
  );
  const leaveId = await approveLeave(db, scenario);
  await expectSqlState(
    () => db`
      UPDATE leave_requests SET status = 'rejected'
      WHERE organization_id = ${organizationId} AND id = ${leaveId}`,
    '55000',
  );
  await expectSqlState(
    () => db`DELETE FROM leave_requests WHERE organization_id = ${organizationId} AND id = ${leaveId}`,
    '55000',
  );

  const invalidMakeup = () => db`
    INSERT INTO makeup_attempts (
      organization_id, source_session_id, source_attendance_id,
      target_session_id, target_attendance_id, student_id, student_package_id,
      credit_cost, reason, created_by_user_id, created_by_user_id_snapshot,
      created_by_display_name_snapshot, created_by_role_snapshot
    ) VALUES (
      ${organizationId}, ${scenario.sourceSessionId}, ${scenario.sourceAttendanceId},
      ${scenario.targetSessionId}, ${scenario.targetAttendanceId}, ${studentId}, ${studentPackageId},
      1, 'Bounds', ${actorUserId}, ${actorUserId}, 'Fixture Owner', 'owner'
    )`;

  await db`UPDATE student_packages SET lifecycle_status = 'frozen' WHERE id = ${studentPackageId}`;
  await expectSqlState(invalidMakeup, '23514');
  await db`
    UPDATE student_packages
    SET lifecycle_status = 'active', valid_from = ${new Date(new Date(scenario.targetStartsAt).getTime() + 3_600_000).toISOString()},
        valid_until = '2100-01-01T00:00:00Z'
    WHERE id = ${studentPackageId}`;
  await expectSqlState(invalidMakeup, '23514');
  await db`
    UPDATE student_packages
    SET valid_from = '2020-01-01T00:00:00Z', valid_until = ${scenario.targetStartsAt}
    WHERE id = ${studentPackageId}`;
  await expectSqlState(invalidMakeup, '23514');
  await db`
    UPDATE student_packages
    SET valid_from = '2020-01-01T00:00:00Z', valid_until = '2100-01-01T00:00:00Z'
    WHERE id = ${studentPackageId}`;

  await expectSqlState(
    () => db`
      INSERT INTO makeup_attempts (
        organization_id, source_session_id, source_attendance_id,
        target_session_id, target_attendance_id, student_id, student_package_id,
        credit_cost, reason, created_by_user_id, created_by_user_id_snapshot,
        created_by_display_name_snapshot, created_by_role_snapshot
      ) VALUES (
        ${organizationId}, ${scenario.sourceSessionId}, ${scenario.sourceAttendanceId},
        ${scenario.targetSessionId}, ${scenario.targetAttendanceId}, ${studentId}, ${studentPackageId},
        1, 'Actor mismatch', ${actorUserId}, 102, 'Fixture Owner', 'owner'
      )`,
    '23514',
  );
}

async function runLiveDuplicate(db: Db): Promise<void> {
  const scenario = await createScenario(db, 40);
  await approveLeave(db, scenario);
  const attemptId = await insertMakeup(db, scenario, scenario, 'Live attempt');
  const secondTarget = await addTarget(db, scenario, 2);
  await expectSqlState(
    () => insertMakeup(db, scenario, secondTarget, 'Duplicate live attempt'),
    '23505',
  );
  await expectSqlState(
    () => db`DELETE FROM makeup_attempts WHERE organization_id = ${organizationId} AND id = ${attemptId}`,
    '55000',
  );
}

async function runFailedAndNested(db: Db): Promise<void> {
  const scenario = await createScenario(db, 50);
  await approveLeave(db, scenario);
  const attemptId = await insertMakeup(db, scenario, scenario, 'Will fail');

  const targetLeaveRows = await db`
    INSERT INTO leave_requests (
      organization_id, session_id, attendance_id, student_id, reason,
      requested_by_user_id, requested_by_user_id_snapshot,
      requested_by_display_name_snapshot, requested_by_role_snapshot
    ) VALUES (
      ${organizationId}, ${scenario.targetSessionId}, ${scenario.targetAttendanceId},
      ${studentId}, 'Cannot attend makeup', ${actorUserId}, ${actorUserId},
      'Fixture Owner', 'owner'
    ) RETURNING id::text`;
  const targetLeaveId = String(targetLeaveRows[0].id);
  await db.begin(async (tx) => {
    await tx`
      UPDATE attendance_records SET status = 'excused'
      WHERE organization_id = ${organizationId} AND id = ${scenario.targetAttendanceId}`;
    await tx`
      UPDATE leave_requests
      SET status = 'approved', decision_reason = 'Approved',
          decided_by_user_id = ${actorUserId}, decided_by_user_id_snapshot = ${actorUserId},
          decided_by_display_name_snapshot = 'Fixture Owner', decided_by_role_snapshot = 'owner',
          decided_at = NOW()
      WHERE organization_id = ${organizationId} AND id = ${targetLeaveId}`;
    await tx`
      UPDATE teaching_sessions
      SET status = 'completed', completed_at = NOW(), version = version + 1
      WHERE organization_id = ${organizationId} AND id = ${scenario.targetSessionId}`;
    await tx`
      UPDATE makeup_attempts
      SET status = 'failed', resolved_by_user_id = ${actorUserId},
          resolved_by_user_id_snapshot = ${actorUserId},
          resolved_by_display_name_snapshot = 'Fixture Owner', resolved_by_role_snapshot = 'owner',
          resolution_reason = 'Excused', resolved_at = NOW()
      WHERE organization_id = ${organizationId} AND id = ${attemptId}`;
  });

  const nestedTarget = await addTarget(db, scenario, 3);
  await expectSqlState(
    () => insertMakeup(db, {
      sourceSessionId: scenario.targetSessionId,
      sourceAttendanceId: scenario.targetAttendanceId,
    }, nestedTarget, 'Nested attempt'),
    '23514',
  );

  const rescheduledTarget = await addTarget(db, scenario, 4);
  const rescheduledId = await insertMakeup(db, scenario, rescheduledTarget, 'Rescheduled after failure');
  const states = await db`
    SELECT status, COUNT(*)::int AS count FROM makeup_attempts
    WHERE organization_id = ${organizationId} AND source_attendance_id = ${scenario.sourceAttendanceId}
    GROUP BY status ORDER BY status`;
  assert.deepEqual(Array.from(states), [
    { status: 'failed', count: 1 },
    { status: 'scheduled', count: 1 },
  ]);
  assert.ok(rescheduledId.length > 0);
}

async function runCancelledReschedule(db: Db): Promise<void> {
  const scenario = await createScenario(db, 60);
  await approveLeave(db, scenario);
  const attemptId = await insertMakeup(db, scenario, scenario, 'Will cancel');
  await db.begin(async (tx) => {
    await tx`
      UPDATE teaching_sessions
      SET status = 'cancelled', cancelled_at = NOW(), version = version + 1
      WHERE organization_id = ${organizationId} AND id = ${scenario.targetSessionId}`;
    await tx`
      UPDATE makeup_attempts
      SET status = 'cancelled', resolved_by_user_id = ${actorUserId},
          resolved_by_user_id_snapshot = ${actorUserId},
          resolved_by_display_name_snapshot = 'Fixture Owner', resolved_by_role_snapshot = 'owner',
          resolution_reason = 'Target cancelled', resolved_at = NOW()
      WHERE organization_id = ${organizationId} AND id = ${attemptId}`;
  });
  const target = await addTarget(db, scenario, 2);
  const rescheduledId = await insertMakeup(db, scenario, target, 'Rescheduled after cancellation');
  assert.ok(rescheduledId.length > 0);
}

async function runSourceCancellation(db: Db): Promise<void> {
  const scenario = await createScenario(db, 70);
  await approveLeave(db, scenario);
  const attemptId = await insertMakeup(db, scenario, scenario, 'Source cancellation');
  await expectSqlState(
    () => db`
      UPDATE teaching_sessions SET status = 'cancelled', cancelled_at = NOW()
      WHERE organization_id = ${organizationId} AND id = ${scenario.sourceSessionId}`,
    '23514',
  );
  await db.begin(async (tx) => {
    await tx`
      UPDATE teaching_sessions
      SET status = 'cancelled', cancelled_at = NOW(), version = version + 1
      WHERE organization_id = ${organizationId} AND id = ${scenario.sourceSessionId}`;
    await tx`
      UPDATE makeup_attempts
      SET status = 'cancelled', resolved_by_user_id = ${actorUserId},
          resolved_by_user_id_snapshot = ${actorUserId},
          resolved_by_display_name_snapshot = 'Fixture Owner', resolved_by_role_snapshot = 'owner',
          resolution_reason = 'Source cancelled', resolved_at = NOW()
      WHERE organization_id = ${organizationId} AND id = ${attemptId}`;
  });
}

async function runScheduledProgression(db: Db): Promise<void> {
  const scenario = await createScenario(db, 80);
  await approveLeave(db, scenario);
  const attemptId = await insertMakeup(db, scenario, scenario, 'Scheduled progression');

  await db`
    UPDATE teaching_sessions
    SET status = 'in_progress', version = version + 1
    WHERE organization_id = ${organizationId} AND id = ${scenario.targetSessionId}`;
  await db`
    UPDATE attendance_records SET status = 'present'
    WHERE organization_id = ${organizationId} AND id = ${scenario.targetAttendanceId}`;

  const liveRows = await db`
    SELECT attempt.status, session.status AS session_status, attendance.status AS attendance_status,
           COUNT(ledger.id)::int AS consume_count
    FROM makeup_attempts attempt
    JOIN teaching_sessions session
      ON session.organization_id = attempt.organization_id
     AND session.id = attempt.target_session_id
    JOIN attendance_records attendance
      ON attendance.organization_id = attempt.organization_id
     AND attendance.id = attempt.target_attendance_id
    LEFT JOIN lesson_credit_ledger ledger
      ON ledger.organization_id = attempt.organization_id
     AND ledger.attendance_id = attempt.target_attendance_id
     AND ledger.entry_type = 'consume'
    WHERE attempt.organization_id = ${organizationId} AND attempt.id = ${attemptId}
    GROUP BY attempt.status, session.status, attendance.status`;
  assert.deepEqual(liveRows[0], {
    status: 'scheduled',
    session_status: 'in_progress',
    attendance_status: 'present',
    consume_count: 0,
  });

  await expectSqlState(
    () => db`
      UPDATE teaching_sessions
      SET status = 'completed', completed_at = NOW(), version = version + 1
      WHERE organization_id = ${organizationId} AND id = ${scenario.targetSessionId}`,
    '23514',
  );
}

async function runSemanticParity(db: Db): Promise<Record<string, string>> {
  await seedSemanticTenant(db);
  await runPackageBounds(db);
  await runAttendanceConsumption(db, 20, 'present');
  await runAttendanceConsumption(db, 30, 'late');
  await runLiveDuplicate(db);
  await runFailedAndNested(db);
  await runCancelledReschedule(db);
  await runSourceCancellation(db);
  await runScheduledProgression(db);
  return {
    actorAndTerminalGuards: 'ok',
    packageBounds: 'ok',
    sourceExcusedConsume: '0',
    targetPresentConsume: '1',
    targetLateConsume: '1',
    duplicateConsume: '23505',
    failedCancelledReschedule: 'ok',
    nestedAndLiveDuplicate: 'rejected',
    sourceCancellation: 'atomic',
    scheduledProgression: 'split-transactions-ok',
    completedWithoutResolution: '23514',
  };
}

async function catalogContract(db: Db): Promise<Record<string, unknown>> {
  const rows = await db.unsafe(`
    SELECT
      (SELECT ARRAY_AGG(column_name ORDER BY ordinal_position)
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'leave_requests') AS leave_columns,
      (SELECT ARRAY_AGG(column_name ORDER BY ordinal_position)
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'makeup_attempts') AS makeup_columns,
      (SELECT ARRAY_AGG(indexname ORDER BY indexname)
       FROM pg_indexes
       WHERE schemaname = 'public' AND tablename IN ('leave_requests', 'makeup_attempts')) AS indexes,
      (SELECT ARRAY_AGG(tgname ORDER BY tgname)
       FROM pg_trigger
       WHERE tgrelid IN ('leave_requests'::regclass, 'makeup_attempts'::regclass)
         AND NOT tgisinternal) AS triggers
  `);
  return rows[0] as Record<string, unknown>;
}

async function seedConcurrencyPair(
  db: Db,
  run: number,
  sourceSessionId: string,
  targetSessionId: string,
): Promise<Array<{
  studentId: string;
  packageId: string;
  sourceAttendanceId: string;
  targetAttendanceId: string;
}>> {
  const concurrencyOrganizationId = uuid(800 + run);
  const concurrencyProductId = uuid(810 + run);
  const sourceStartsAt = instant(230 + run * 3);
  const sourceEndsAt = instant(230 + run * 3, 11);
  const targetStartsAt = instant(231 + run * 3);
  const targetEndsAt = instant(231 + run * 3, 11);
  await db.begin(async (tx) => {
    await tx`
      INSERT INTO organizations (id, slug, name, timezone, status)
      VALUES (${concurrencyOrganizationId}, ${`concurrency-${run}`}, 'Concurrency', 'UTC', 'active')`;
    await tx`
      INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
      VALUES (${concurrencyOrganizationId}, ${actorUserId}, 'owner', 'active', NOW())`;
  });
  await db`
    INSERT INTO lesson_package_products (
      id, organization_id, code, name, credit_unit, credit_type, total_credits,
      price_amount_minor, currency, created_by_user_id
    ) VALUES (
      ${concurrencyProductId}, ${concurrencyOrganizationId}, 'concurrency', 'Concurrency package',
      'lesson', 'standard', 10, 1000, 'USD', ${actorUserId}
    )`;
  await db`
    INSERT INTO teaching_sessions (
      id, organization_id, title, starts_at, ends_at, timezone, status, created_by_user_id
    ) VALUES
      (${sourceSessionId}, ${concurrencyOrganizationId}, 'Concurrent source', ${sourceStartsAt},
       ${sourceEndsAt}, 'UTC', 'scheduled', ${actorUserId}),
      (${targetSessionId}, ${concurrencyOrganizationId}, 'Concurrent target', ${targetStartsAt},
       ${targetEndsAt}, 'UTC', 'scheduled', ${actorUserId})`;

  const actors = [];
  for (let index = 0; index < 2; index += 1) {
    const student = uuid(900_000 + run * 100 + index * 10 + 1);
    const packageId = uuid(900_000 + run * 100 + index * 10 + 2);
    const sourceAttendanceId = uuid(900_000 + run * 100 + index * 10 + 3);
    const targetAttendanceId = uuid(900_000 + run * 100 + index * 10 + 4);
    await db`
      INSERT INTO student_profiles (id, organization_id, display_name, external_ref, status)
      VALUES (${student}, ${concurrencyOrganizationId}, ${`Concurrent Student ${index}`},
              ${`concurrent-${run}-${index}`}, 'active')`;
    await db`
      INSERT INTO student_packages (
        id, organization_id, student_id, product_id, product_code_snapshot,
        product_name_snapshot, credit_unit, credit_type, entitled_credits,
        price_amount_minor, currency, acquisition_type, valid_from, valid_until,
        created_by_user_id
      ) VALUES (
        ${packageId}, ${concurrencyOrganizationId}, ${student}, ${concurrencyProductId},
        'concurrency', 'Concurrency package', 'lesson', 'standard', 10,
        1000, 'USD', 'purchase', '2020-01-01T00:00:00Z', '2100-01-01T00:00:00Z',
        ${actorUserId}
      )`;
    await db`
      INSERT INTO attendance_records (
        id, organization_id, session_id, student_id, student_package_id,
        status, credit_cost, notes, recorded_by_user_id
      ) VALUES
        (${sourceAttendanceId}, ${concurrencyOrganizationId}, ${sourceSessionId}, ${student},
         ${packageId}, 'expected', 1, '', ${actorUserId}),
        (${targetAttendanceId}, ${concurrencyOrganizationId}, ${targetSessionId}, ${student},
         ${packageId}, 'expected', 1, '', ${actorUserId})`;
    const leaveRows = await db`
      INSERT INTO leave_requests (
        organization_id, session_id, attendance_id, student_id, reason,
        requested_by_user_id, requested_by_user_id_snapshot,
        requested_by_display_name_snapshot, requested_by_role_snapshot
      ) VALUES (
        ${concurrencyOrganizationId}, ${sourceSessionId}, ${sourceAttendanceId}, ${student},
        'Concurrent leave', ${actorUserId}, ${actorUserId}, 'Fixture Owner', 'owner'
      ) RETURNING id::text`;
    await db.begin(async (tx) => {
      await tx`
        UPDATE attendance_records SET status = 'excused'
        WHERE organization_id = ${concurrencyOrganizationId} AND id = ${sourceAttendanceId}`;
      await tx`
        UPDATE leave_requests
        SET status = 'approved', decision_reason = 'Approved',
            decided_by_user_id = ${actorUserId}, decided_by_user_id_snapshot = ${actorUserId},
            decided_by_display_name_snapshot = 'Fixture Owner', decided_by_role_snapshot = 'owner',
            decided_at = NOW()
        WHERE organization_id = ${concurrencyOrganizationId} AND id = ${String(leaveRows[0].id)}`;
    });
    actors.push({ studentId: student, packageId, sourceAttendanceId, targetAttendanceId });
  }
  return actors;
}

async function runConcurrentOrder(
  db: Db,
  run: number,
  isolation: 'read committed' | 'repeatable read',
  sourceSessionId: string,
  targetSessionId: string,
  reverseLaunch: boolean,
): Promise<string[]> {
  const concurrencyOrganizationId = uuid(800 + run);
  const actors = await seedConcurrencyPair(db, run, sourceSessionId, targetSessionId);
  const clients = [
    postgres({ host, port, user, password, database: upgradeDatabase, max: 1 }),
    postgres({ host, port, user, password, database: upgradeDatabase, max: 1 }),
  ];
  extraClients.push(...clients);
  let arrived = 0;
  let release: (() => void) | undefined;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const operations = actors.map((entry, index) => clients[index].begin(
    `isolation level ${isolation}`,
    async (tx) => {
      await tx.unsafe("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '10s'");
      arrived += 1;
      if (arrived === actors.length) release?.();
      await barrier;
      await tx`
        INSERT INTO makeup_attempts (
          organization_id, source_session_id, source_attendance_id,
          target_session_id, target_attendance_id, student_id, student_package_id,
          credit_cost, reason, created_by_user_id, created_by_user_id_snapshot,
          created_by_display_name_snapshot, created_by_role_snapshot
        ) VALUES (
          ${concurrencyOrganizationId}, ${sourceSessionId}, ${entry.sourceAttendanceId},
          ${targetSessionId}, ${entry.targetAttendanceId}, ${entry.studentId}, ${entry.packageId},
          1, ${`Concurrent ${run}.${index}`}, ${actorUserId}, ${actorUserId},
          'Fixture Owner', 'owner'
        )`;
    },
  ));
  const launched = reverseLaunch ? [...operations].reverse() : operations;
  const settled = await Promise.allSettled(launched);
  for (const result of settled) {
    if (result.status === 'rejected') {
      assert.notEqual(sqlState(result.reason), '40P01', 'concurrent makeup scheduling deadlocked');
    }
  }
  assert.equal(settled.filter((result) => result.status === 'fulfilled').length, 2);
  const count = await db`
    SELECT COUNT(*)::int AS count FROM makeup_attempts
    WHERE organization_id = ${concurrencyOrganizationId} AND status = 'scheduled'`;
  assert.equal(count[0].count, 2);
  return settled.map((result) => result.status);
}

type ConcurrentTx = Parameters<Parameters<Db['begin']>[1]>[0];
type OrderedOperation = (
  tx: ConcurrentTx,
  afterInitialSessionLock: () => Promise<void>,
) => Promise<string>;

async function runOrderedOperations(
  first: OrderedOperation,
  second: OrderedOperation,
): Promise<[string, string]> {
  const clients = [
    postgres({ host, port, user, password, database: upgradeDatabase, max: 1 }),
    postgres({ host, port, user, password, database: upgradeDatabase, max: 1 }),
  ];
  extraClients.push(...clients);
  let firstLockedResolve: (() => void) | undefined;
  let secondStartedResolve: (() => void) | undefined;
  const firstLocked = new Promise<void>((resolve) => { firstLockedResolve = resolve; });
  const secondStarted = new Promise<void>((resolve) => { secondStartedResolve = resolve; });
  const firstResult = clients[0].begin('isolation level read committed', async (tx) => {
    await tx.unsafe("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '10s'");
    return await first(tx, async () => {
      firstLockedResolve?.();
      await secondStarted;
    });
  });
  await firstLocked;
  const secondResult = clients[1].begin('isolation level read committed', async (tx) => {
    await tx.unsafe("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '10s'");
    secondStartedResolve?.();
    return await second(tx, async () => undefined);
  });
  const settled = await Promise.allSettled([firstResult, secondResult]);
  for (const result of settled) {
    if (result.status === 'rejected') {
      assert.notEqual(sqlState(result.reason), '40P01', 'ordered lifecycle operations deadlocked');
      assert.equal(sqlState(result.reason), '23514', 'only the losing schedule may fail its DB invariant');
    }
  }
  return settled.map((result) => (
    result.status === 'fulfilled' ? result.value : `rejected:${sqlState(result.reason)}`
  )) as [string, string];
}

function scheduleOperation(scenario: Scenario): OrderedOperation {
  return async (tx, afterInitialSessionLock) => {
    const sessionIds = [scenario.sourceSessionId, scenario.targetSessionId].sort();
    await tx`
      SELECT id FROM teaching_sessions
      WHERE organization_id = ${organizationId} AND id IN ${tx(sessionIds)}
      ORDER BY id FOR UPDATE`;
    await afterInitialSessionLock();
    await tx`
      SELECT id FROM attendance_records
      WHERE organization_id = ${organizationId}
        AND id IN ${tx([scenario.sourceAttendanceId, scenario.targetAttendanceId].sort())}
      ORDER BY id FOR UPDATE`;
    await tx`
      INSERT INTO makeup_attempts (
        organization_id, source_session_id, source_attendance_id,
        target_session_id, target_attendance_id, student_id, student_package_id,
        credit_cost, reason, created_by_user_id, created_by_user_id_snapshot,
        created_by_display_name_snapshot, created_by_role_snapshot
      ) VALUES (
        ${organizationId}, ${scenario.sourceSessionId}, ${scenario.sourceAttendanceId},
        ${scenario.targetSessionId}, ${scenario.targetAttendanceId}, ${studentId}, ${studentPackageId},
        1, 'Ordered schedule', ${actorUserId}, ${actorUserId}, 'Fixture Owner', 'owner'
      )`;
    return 'scheduled';
  };
}

function completeTargetOperation(scenario: Scenario): OrderedOperation {
  return async (tx, afterInitialSessionLock) => {
    const sessions = await tx`
      SELECT status FROM teaching_sessions
      WHERE organization_id = ${organizationId} AND id = ${scenario.targetSessionId}
      FOR UPDATE`;
    await afterInitialSessionLock();
    if (sessions[0].status !== 'scheduled') return `complete-conflict:${String(sessions[0].status)}`;
    await tx`
      SELECT id FROM attendance_records
      WHERE organization_id = ${organizationId} AND session_id = ${scenario.targetSessionId}
      ORDER BY student_package_id NULLS LAST, id FOR UPDATE`;
    await tx`
      SELECT id FROM makeup_attempts
      WHERE organization_id = ${organizationId} AND target_session_id = ${scenario.targetSessionId}
        AND status = 'scheduled'
      ORDER BY id FOR UPDATE`;
    await tx`
      SELECT id FROM student_packages
      WHERE organization_id = ${organizationId} AND id = ${studentPackageId}
      ORDER BY id FOR UPDATE`;
    await tx`
      UPDATE attendance_records SET status = 'present'
      WHERE organization_id = ${organizationId} AND id = ${scenario.targetAttendanceId}`;
    await tx`
      UPDATE teaching_sessions SET status = 'completed', completed_at = NOW(), version = version + 1
      WHERE organization_id = ${organizationId} AND id = ${scenario.targetSessionId}`;
    await tx`
      INSERT INTO lesson_credit_ledger (
        organization_id, student_package_id, student_id, entry_type, delta,
        attendance_id, session_id, idempotency_key, reason,
        actor_user_id, actor_role, actor_display_name
      ) VALUES (
        ${organizationId}, ${studentPackageId}, ${studentId}, 'consume', -1,
        ${scenario.targetAttendanceId}, ${scenario.targetSessionId},
        ${`ordered-complete-${scenario.ordinal}`}, 'Ordered completion',
        ${actorUserId}, 'owner', 'Fixture Owner'
      )`;
    await tx`
      UPDATE makeup_attempts
      SET status = 'fulfilled', resolved_by_user_id = ${actorUserId},
          resolved_by_user_id_snapshot = ${actorUserId},
          resolved_by_display_name_snapshot = 'Fixture Owner', resolved_by_role_snapshot = 'owner',
          resolution_reason = 'Ordered completion', resolved_at = NOW()
      WHERE organization_id = ${organizationId} AND target_session_id = ${scenario.targetSessionId}
        AND status = 'scheduled'`;
    return 'completed';
  };
}

function cancelTargetOperation(scenario: Scenario): OrderedOperation {
  return async (tx, afterInitialSessionLock) => {
    const discovered = await tx`
      SELECT source_session_id, target_session_id FROM makeup_attempts
      WHERE organization_id = ${organizationId} AND status = 'scheduled'
        AND (source_session_id = ${scenario.targetSessionId} OR target_session_id = ${scenario.targetSessionId})
      ORDER BY source_session_id, target_session_id, id`;
    const sessionIds = [...new Set([
      scenario.targetSessionId,
      ...discovered.flatMap((row) => [String(row.source_session_id), String(row.target_session_id)]),
    ])].sort();
    const sessions = await tx`
      SELECT id, status FROM teaching_sessions
      WHERE organization_id = ${organizationId} AND id IN ${tx(sessionIds)}
      ORDER BY id FOR UPDATE`;
    await afterInitialSessionLock();
    const current = sessions.find((row) => String(row.id) === scenario.targetSessionId);
    if (current?.status !== 'scheduled') return `cancel-conflict:${String(current?.status)}`;
    const changed = await tx`
      SELECT source_session_id, target_session_id FROM makeup_attempts
      WHERE organization_id = ${organizationId} AND status = 'scheduled'
        AND (source_session_id = ${scenario.targetSessionId} OR target_session_id = ${scenario.targetSessionId})
      ORDER BY source_session_id, target_session_id, id`;
    const lockedIds = new Set(sessionIds);
    if (changed.some((row) => (
      !lockedIds.has(String(row.source_session_id)) || !lockedIds.has(String(row.target_session_id))
    ))) return 'cancel-retry';
    await tx`
      SELECT id FROM attendance_records
      WHERE organization_id = ${organizationId} AND session_id = ${scenario.targetSessionId}
      ORDER BY student_package_id NULLS LAST, id FOR UPDATE`;
    await tx`
      SELECT id FROM makeup_attempts
      WHERE organization_id = ${organizationId} AND status = 'scheduled'
        AND (source_session_id = ${scenario.targetSessionId} OR target_session_id = ${scenario.targetSessionId})
      ORDER BY id FOR UPDATE`;
    await tx`
      UPDATE makeup_attempts
      SET status = 'cancelled', resolved_by_user_id = ${actorUserId},
          resolved_by_user_id_snapshot = ${actorUserId},
          resolved_by_display_name_snapshot = 'Fixture Owner', resolved_by_role_snapshot = 'owner',
          resolution_reason = 'Ordered cancellation', resolved_at = NOW()
      WHERE organization_id = ${organizationId} AND status = 'scheduled'
        AND (source_session_id = ${scenario.targetSessionId} OR target_session_id = ${scenario.targetSessionId})`;
    await tx`
      UPDATE teaching_sessions SET status = 'cancelled', cancelled_at = NOW(), version = version + 1
      WHERE organization_id = ${organizationId} AND id = ${scenario.targetSessionId}`;
    return 'cancelled';
  };
}

async function runLifecycleConcurrencyMatrix(db: Db): Promise<Record<string, [string, string]>> {
  const scheduleThenComplete = await createScenario(db, 90);
  await approveLeave(db, scheduleThenComplete);
  const completeThenSchedule = await createScenario(db, 91);
  await approveLeave(db, completeThenSchedule);
  const scheduleThenCancel = await createScenario(db, 92);
  await approveLeave(db, scheduleThenCancel);
  const cancelThenSchedule = await createScenario(db, 93);
  await approveLeave(db, cancelThenSchedule);
  const completeThenCancel = await createScenario(db, 94);
  await approveLeave(db, completeThenCancel);
  await insertMakeup(db, completeThenCancel, completeThenCancel, 'Complete then cancel');
  const cancelThenComplete = await createScenario(db, 95);
  await approveLeave(db, cancelThenComplete);
  await insertMakeup(db, cancelThenComplete, cancelThenComplete, 'Cancel then complete');
  return {
    scheduleThenComplete: await runOrderedOperations(
      scheduleOperation(scheduleThenComplete), completeTargetOperation(scheduleThenComplete),
    ),
    completeThenSchedule: await runOrderedOperations(
      completeTargetOperation(completeThenSchedule), scheduleOperation(completeThenSchedule),
    ),
    scheduleThenCancel: await runOrderedOperations(
      scheduleOperation(scheduleThenCancel), cancelTargetOperation(scheduleThenCancel),
    ),
    cancelThenSchedule: await runOrderedOperations(
      cancelTargetOperation(cancelThenSchedule), scheduleOperation(cancelThenSchedule),
    ),
    completeThenCancel: await runOrderedOperations(
      completeTargetOperation(completeThenCancel), cancelTargetOperation(completeThenCancel),
    ),
    cancelThenComplete: await runOrderedOperations(
      cancelTargetOperation(cancelThenComplete), completeTargetOperation(cancelThenComplete),
    ),
  };
}

async function main(): Promise<void> {
  const [migration0147, migration0164, migration0165, schemaSnapshot] = await Promise.all([
    readFile(new URL('../../migrations/0147_teaching_packages_and_sessions.sql', import.meta.url), 'utf8'),
    readFile(new URL('../../migrations/0164_teaching_credit_adjustments.sql', import.meta.url), 'utf8'),
    readFile(new URL('../../migrations/0165_teaching_leave_makeups.sql', import.meta.url), 'utf8'),
    readFile(new URL('../../src/db/schema.pg.sql', import.meta.url), 'utf8'),
  ]);

  await admin.unsafe(`CREATE DATABASE "${upgradeDatabase}"`);
  await admin.unsafe(`CREATE DATABASE "${canonicalDatabase}"`);
  upgrade = postgres({ host, port, user, password, database: upgradeDatabase, max: 12 });
  canonical = postgres({ host, port, user, password, database: canonicalDatabase, max: 12 });

  await upgrade.unsafe(foundation);
  await upgrade.unsafe(migration0147);
  await seedLegacy0147(upgrade);
  await upgrade.unsafe(migration0164);
  await upgrade.unsafe(migration0165);
  const legacyRows = await upgrade`
    SELECT COUNT(*)::int AS count FROM lesson_credit_ledger WHERE idempotency_key = 'legacy-purchase'`;
  assert.equal(legacyRows[0].count, 1);

  await canonical.unsafe(schemaSnapshot);
  const upgradeCatalog = await catalogContract(upgrade);
  const canonicalCatalog = await catalogContract(canonical);
  assert.deepEqual(canonicalCatalog, upgradeCatalog);
  assert.ok((upgradeCatalog.indexes as string[]).includes('uq_makeup_attempts_live_source'));
  assert.ok((upgradeCatalog.triggers as string[]).includes('makeup_attempts_terminal_state'));

  const upgradeSemantics = await runSemanticParity(upgrade);
  const canonicalSemantics = await runSemanticParity(canonical);
  assert.deepEqual(canonicalSemantics, upgradeSemantics);

  const readCommittedAscending = await runConcurrentOrder(
    upgrade,
    1,
    'read committed',
    uuid(910_001),
    uuid(910_002),
    false,
  );
  const repeatableReadDescending = await runConcurrentOrder(
    upgrade,
    2,
    'repeatable read',
    uuid(920_002),
    uuid(920_001),
    true,
  );
  const lifecycleConcurrency = await runLifecycleConcurrencyMatrix(upgrade);

  console.log(JSON.stringify({
    upgrade: '0147-to-0164-to-0165-ok',
    canonicalSemanticParity: 'ok',
    ...upgradeSemantics,
    readCommittedAscending,
    repeatableReadDescending,
    lifecycleConcurrency,
    deadlocks: 0,
  }));
}

try {
  await main();
} finally {
  await Promise.all(extraClients.map((client) => client.end().catch(() => undefined)));
  if (upgrade) await upgrade.end().catch(() => undefined);
  if (canonical) await canonical.end().catch(() => undefined);
  for (const database of [upgradeDatabase, canonicalDatabase]) {
    await admin.unsafe(`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = '${database}' AND pid <> pg_backend_pid();
    `).catch(() => undefined);
    await admin.unsafe(`DROP DATABASE IF EXISTS "${database}"`).catch(() => undefined);
  }
  await admin.end();
}
