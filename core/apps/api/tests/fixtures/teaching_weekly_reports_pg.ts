import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const host = process.env.DB_HOST ?? '127.0.0.1';
const port = Number(process.env.DB_PORT ?? 5433);
const user = process.env.DB_USER ?? 'postgres';
const password = process.env.DB_PASS ?? 'dev';
const adminDatabase = process.env.DB_NAME ?? 'cuberoot_db';
const fixtureDatabase = `cuberoot_weekly_reports_fixture_${process.pid}`;

const admin = postgres({ host, port, user, password, database: adminDatabase, max: 1 });
let fixture: ReturnType<typeof postgres> | null = null;

const foundation = `
CREATE TABLE app_users (id BIGINT PRIMARY KEY, display_name VARCHAR(200) NOT NULL);
CREATE TABLE organizations (
  id UUID PRIMARY KEY, slug VARCHAR(120) NOT NULL UNIQUE, name VARCHAR(200) NOT NULL,
  timezone VARCHAR(64) NOT NULL, status VARCHAR(16) NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE student_profiles (
  id UUID NOT NULL, organization_id UUID NOT NULL REFERENCES organizations(id),
  display_name VARCHAR(200) NOT NULL, external_ref VARCHAR(160), status VARCHAR(16) NOT NULL,
  PRIMARY KEY (organization_id, id)
);
CREATE TABLE organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL, role VARCHAR(16) NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);
CREATE TABLE teaching_mutation_rate_limits (
  actor_user_id BIGINT NOT NULL, operation VARCHAR(120) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (actor_user_id, operation)
);
CREATE TABLE teaching_idempotency_requests (
  id BIGSERIAL PRIMARY KEY, organization_id UUID, actor_user_id BIGINT NOT NULL,
  scope_key VARCHAR(200) NOT NULL, operation VARCHAR(120) NOT NULL,
  idempotency_key VARCHAR(200) NOT NULL, request_hash CHAR(64) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'in_progress', response_status INTEGER, response_body JSONB,
  resource_type VARCHAR(100), resource_id VARCHAR(200), completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (actor_user_id, scope_key, operation, idempotency_key)
);
CREATE TABLE teaching_audit_events (
  id BIGSERIAL PRIMARY KEY, organization_id UUID NOT NULL, actor_user_id BIGINT,
  actor_role VARCHAR(16), actor_display_name VARCHAR(200) NOT NULL,
  action VARCHAR(120) NOT NULL, entity_type VARCHAR(120) NOT NULL, entity_id VARCHAR(200),
  outcome VARCHAR(16) NOT NULL DEFAULT 'succeeded', request_id VARCHAR(100) NOT NULL, metadata JSONB NOT NULL
);
CREATE TABLE teaching_sessions (
  id UUID NOT NULL, organization_id UUID NOT NULL, status VARCHAR(16) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (organization_id, id)
);
CREATE TABLE attendance_records (
  organization_id UUID NOT NULL, session_id UUID NOT NULL, student_id UUID NOT NULL,
  status VARCHAR(16) NOT NULL
);
CREATE TABLE lesson_credit_ledger (
  organization_id UUID NOT NULL, student_id UUID NOT NULL, entry_type VARCHAR(16) NOT NULL,
  delta BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE daily_training_rollups (
  organization_id UUID NOT NULL, student_id UUID NOT NULL, local_date DATE NOT NULL,
  source VARCHAR(32) NOT NULL, activity VARCHAR(64) NOT NULL, trust_level VARCHAR(32) NOT NULL,
  evidence_count BIGINT NOT NULL, duration_ms BIGINT NOT NULL, success_count BIGINT NOT NULL
);
CREATE TABLE training_assignments (
  id UUID NOT NULL, organization_id UUID NOT NULL, title VARCHAR(200) NOT NULL,
  status VARCHAR(16) NOT NULL, schedule_kind VARCHAR(16) NOT NULL, expected_count INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ, PRIMARY KEY (organization_id, id)
);
CREATE TABLE training_assignment_targets (
  organization_id UUID NOT NULL, assignment_id UUID NOT NULL, student_id UUID,
  target_kind VARCHAR(16) NOT NULL, evidence_count BIGINT NOT NULL DEFAULT 0,
  latest_review_revision INTEGER NOT NULL DEFAULT 0, latest_review_status VARCHAR(24)
);
CREATE TABLE lesson_feedback (
  id UUID NOT NULL, organization_id UUID NOT NULL, student_id UUID NOT NULL, session_id UUID NOT NULL,
  revision INTEGER NOT NULL, visibility VARCHAR(24) NOT NULL, summary TEXT NOT NULL,
  strengths TEXT, challenges TEXT, next_goals TEXT, published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL
);
`;

async function main(): Promise<void> {
  await admin.unsafe(`CREATE DATABASE "${fixtureDatabase}"`);
  fixture = postgres({ host, port, user, password, database: fixtureDatabase, max: 5 });
  const migration = await readFile(
    new URL('../../migrations/0155_teaching_weekly_reports.sql', import.meta.url),
    'utf8',
  );
  await fixture.unsafe(foundation);
  await fixture.unsafe(migration);
  await fixture.unsafe(`
    INSERT INTO app_users (id, display_name) VALUES (101, 'Generator A'), (202, 'Publisher B');
    INSERT INTO organizations (id, slug, name, timezone, status)
    VALUES ('11111111-1111-4111-8111-111111111111', 'fixture', 'Fixture', 'America/Los_Angeles', 'active');
    INSERT INTO student_profiles (id, organization_id, display_name, external_ref, status)
    VALUES (
      '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
      'Student', 'S-1', 'active'
    );
    INSERT INTO organization_members (organization_id, user_id, status, role) VALUES
      ('11111111-1111-4111-8111-111111111111', 101, 'active', 'owner'),
      ('11111111-1111-4111-8111-111111111111', 202, 'active', 'admin');
  `);

  process.env.DB_HOST = host;
  process.env.DB_PORT = String(port);
  process.env.DB_USER = user;
  process.env.DB_PASS = password;
  process.env.DB_NAME = fixtureDatabase;
  const [{ teachingSaasRepository }, { sql }] = await Promise.all([
    import('../../src/routes/teaching_saas.js'),
    import('../../src/db/connection.js'),
  ]);
  const actor = { userId: 101, displayName: 'Generator A', source: 'session' as const };
  const input = {
    studentId: '22222222-2222-4222-8222-222222222222',
    weekStart: '2026-08-17',
  };
  const results = await Promise.all([
    teachingSaasRepository.generateWeeklyReport(actor, 'fixture', input, 'key-a', 'a'.repeat(64), 'request-a'),
    teachingSaasRepository.generateWeeklyReport(actor, 'fixture', input, 'key-b', 'b'.repeat(64), 'request-b'),
  ]);
  const rows = await sql`
    SELECT revision, status, COUNT(*)::int AS report_count
    FROM teaching_weekly_reports
    GROUP BY revision, status`;
  const statuses = results.map((result) => result.status).sort();
  if (JSON.stringify(statuses) !== JSON.stringify([200, 201])) {
    throw new Error(`concurrent generate statuses were ${JSON.stringify(statuses)}`);
  }
  if (rows.length !== 1 || Number(rows[0].revision) !== 1
      || rows[0].status !== 'draft' || Number(rows[0].report_count) !== 1) {
    throw new Error(`concurrent generate produced unexpected reports: ${JSON.stringify(rows)}`);
  }

  await sql`
    UPDATE teaching_weekly_reports
    SET status = 'published', visibility = 'student', teacher_summary = 'summary',
        next_week_plan = 'plan', published_by_user_id = 202`;
  await sql`DELETE FROM app_users WHERE id = 101`;
  const afterGeneratorDelete = await sql`SELECT * FROM teaching_weekly_reports`;
  if (afterGeneratorDelete[0].generated_by_user_id !== null
      || Number(afterGeneratorDelete[0].generated_by_user_id_snapshot) !== 101
      || Number(afterGeneratorDelete[0].published_by_user_id) !== 202) {
    throw new Error('generator deletion changed the publisher or frozen snapshots');
  }
  await sql`DELETE FROM app_users WHERE id = 202`;
  const afterPublisherDelete = await sql`SELECT * FROM teaching_weekly_reports`;
  if (afterPublisherDelete[0].published_by_user_id !== null
      || Number(afterPublisherDelete[0].published_by_user_id_snapshot) !== 202) {
    throw new Error('publisher deletion failed after generator deletion');
  }
  console.log(JSON.stringify({ concurrentStatuses: statuses, reports: rows, accountDelete: 'ok' }));
  await sql.end();
}

try {
  await main();
} finally {
  if (fixture) await fixture.end().catch(() => undefined);
  await admin.unsafe(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = '${fixtureDatabase}' AND pid <> pg_backend_pid();
  `).catch(() => undefined);
  await admin.unsafe(`DROP DATABASE IF EXISTS "${fixtureDatabase}"`).catch(() => undefined);
  await admin.end();
}
