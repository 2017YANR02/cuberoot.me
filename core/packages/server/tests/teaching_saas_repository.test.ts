import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTeachingPermission } from '@cuberoot/shared';

const db = vi.hoisted(() => {
  const query = vi.fn();
  const tx = vi.fn();
  const begin = vi.fn();
  const sql = Object.assign(vi.fn(), {
    begin,
    json: vi.fn((value: unknown) => value),
  });
  return { begin, query, sql, tx };
});

vi.mock('../src/db/connection.js', () => ({
  query: db.query,
  sql: db.sql,
}));

import {
  TeachingApiException,
  teachingSaasRepository,
} from '../src/routes/teaching_saas.js';
import type { TeachingActor } from '../src/utils/teaching_platform_assertion.js';

const ACTOR: TeachingActor = {
  userId: 42,
  displayName: 'Test Owner',
  source: 'platform',
  platformSubject: 'platform-user',
};

async function teachingRouteSource(): Promise<string> {
  return readFile(new URL('../src/routes/teaching_saas.ts', import.meta.url), 'utf8');
}

async function schemaSource(): Promise<string> {
  return readFile(new URL('../src/db/schema.pg.sql', import.meta.url), 'utf8');
}

function sourceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, `${startMarker} missing`).toBeGreaterThan(-1);
  expect(end, `${endMarker} missing after ${startMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('teaching SaaS repository tenant denial audit', () => {
  beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValue([]);
    db.tx.mockReset();
    db.begin.mockReset();
    db.sql.mockClear();
    db.sql.json.mockClear();
    db.begin.mockImplementation(async (operation) => operation(db.tx));
  });

  it('records a denied audit after a cross-organization read', async () => {
    db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(
      teachingSaasRepository.getOrganization(ACTOR, 'other-org', 'request-read'),
    ).rejects.toEqual(
      expect.objectContaining<TeachingApiException>({
        code: 'ORGANIZATION_NOT_FOUND',
        status: 404,
      }),
    );

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[1][0]).toContain('INSERT INTO teaching_audit_events');
    expect(db.query.mock.calls[1][0]).toContain("'denied'");
    expect(db.query.mock.calls[1][1]).toEqual([
      ACTOR.userId,
      ACTOR.displayName,
      'organization.read',
      'request-read',
      { reason: 'ORGANIZATION_NOT_FOUND' },
      ACTOR.userId,
      'other-org',
    ]);
    expect(db.query.mock.calls[1][1]).not.toContain(
      JSON.stringify({ reason: 'ORGANIZATION_NOT_FOUND' }),
    );
  });

  it('records a denied audit after a cross-organization write', async () => {
    db.tx.mockResolvedValueOnce([]);
    db.query.mockResolvedValueOnce([]);

    await expect(
      teachingSaasRepository.createStudent(
        ACTOR,
        'other-org',
        { displayName: 'Student', externalRef: null },
        'idempotency-key',
        'request-hash',
        'request-write',
      ),
    ).rejects.toEqual(
      expect.objectContaining<TeachingApiException>({
        code: 'ORGANIZATION_NOT_FOUND',
        status: 404,
      }),
    );

    expect(db.begin).toHaveBeenCalledTimes(1);
    expect(db.tx).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][0]).toContain('INSERT INTO teaching_mutation_rate_limits');
    expect(db.query.mock.calls[1][0]).toContain('INSERT INTO teaching_audit_events');
    expect(db.query.mock.calls[1][1]).toEqual([
      ACTOR.userId,
      ACTOR.displayName,
      'student.create',
      'request-write',
      { reason: 'ORGANIZATION_NOT_FOUND' },
      ACTOR.userId,
      'other-org',
    ]);
  });

  it('returns aggregate counts without loading full tenant rosters', async () => {
    db.query
      .mockResolvedValueOnce([{
        id: 'organization-id',
        slug: 'demo',
        name: 'Demo',
        timezone: 'Asia/Shanghai',
        status: 'active',
        version: 1,
        role: 'owner',
      }])
      .mockResolvedValueOnce([{ count: 9 }])
      .mockResolvedValueOnce([{ count: 42 }]);

    await expect(
      teachingSaasRepository.getOrganizationSummary(ACTOR, 'demo', 'request-summary'),
    ).resolves.toMatchObject({ memberCount: 9, studentCount: 42 });

    expect(db.query).toHaveBeenCalledTimes(3);
    expect(db.query.mock.calls[1][0]).toContain('COUNT(*)');
    expect(db.query.mock.calls[2][0]).toContain('COUNT(*)');
  });

  it('omits restricted aggregate counts for roles without student roster access', async () => {
    db.query
      .mockResolvedValueOnce([{
        id: 'organization-id',
        slug: 'demo',
        name: 'Demo',
        timezone: 'Asia/Shanghai',
        status: 'active',
        version: 1,
        role: 'viewer',
      }])
      .mockResolvedValueOnce([{ count: 9 }]);

    await expect(
      teachingSaasRepository.getOrganizationSummary(ACTOR, 'demo', 'request-summary'),
    ).resolves.toMatchObject({ memberCount: 9, studentCount: null });

    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it.each(['teacher', 'assistant'] as const)(
    'filters the student roster in SQL for an active scoped %s before pagination',
    async (role) => {
      db.query
        .mockResolvedValueOnce([{
          id: 'organization-id',
          slug: 'demo',
          name: 'Demo',
          timezone: 'Asia/Shanghai',
          status: 'active',
          version: 1,
          role,
        }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([]);

      await expect(
        teachingSaasRepository.listStudents(
          ACTOR,
          'demo',
          { page: 1, pageSize: 30, offset: 0 },
          'request-students',
        ),
      ).resolves.toMatchObject({ items: [], total: 0 });

      expect(db.query).toHaveBeenCalledTimes(3);
      for (const call of db.query.mock.calls.slice(1)) {
        const statement = String(call[0]);
        expect(statement).toContain('WITH active_scope_actor AS');
        expect(statement).toContain("member.status = 'active'");
        expect(statement).toContain("member.role IN ('teacher', 'assistant')");
        expect(statement).toContain('FROM teacher_assignments ta');
        expect(statement).toContain('JOIN student_group_memberships membership');
        expect(call[1]).toContain(ACTOR.userId);
      }
      const itemsSql = String(db.query.mock.calls[2][0]);
      expect(itemsSql.indexOf('JOIN scoped_student_ids scope')).toBeLessThan(itemsSql.indexOf('LIMIT ? OFFSET ?'));
    },
  );

  it.each(['finance', 'viewer'] as const)(
    'denies the organization-wide student roster to %s',
    async (role) => {
      db.query
        .mockResolvedValueOnce([{
          id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
          status: 'active', version: 1, role,
        }])
        .mockResolvedValueOnce([]);

      await expect(teachingSaasRepository.listStudents(
        ACTOR, 'demo', { page: 1, pageSize: 30, offset: 0 }, 'request-students',
      )).rejects.toEqual(expect.objectContaining<TeachingApiException>({
        code: 'PERMISSION_DENIED', status: 403,
      }));
      expect(db.query.mock.calls[1][0]).toContain('INSERT INTO teaching_audit_events');
      expect(db.query.mock.calls[1][1]).toContain('student.list');
    },
  );

  it('conceals and audits a same-organization student outside the teacher scope', async () => {
    db.query
      .mockResolvedValueOnce([{
        id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
        status: 'active', version: 1, role: 'teacher',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ exists: 1 }])
      .mockResolvedValueOnce([]);

    await expect(teachingSaasRepository.getStudent(
      ACTOR, 'demo', 'student-id', 'request-student-read',
    )).rejects.toEqual(expect.objectContaining<TeachingApiException>({
      code: 'RESOURCE_NOT_FOUND', status: 404,
    }));
    expect(db.query.mock.calls[1][0]).toContain('WITH active_scope_actor AS');
    expect(db.query.mock.calls[3][0]).toContain('INSERT INTO teaching_audit_events');
    expect(db.query.mock.calls[3][1]).toContain('student.read');
    expect(db.query.mock.calls[3][1]).toContainEqual({ reason: 'PERMISSION_DENIED' });
  });

  it('serializes idempotency and records the attempt outside the business transaction', async () => {
    db.tx
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 7 }])
      .mockResolvedValueOnce([{
        id: 'organization-id',
        slug: 'demo',
        name: 'Demo',
        timezone: 'Asia/Shanghai',
        status: 'active',
        version: 1,
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    db.query.mockResolvedValueOnce([{ attempts: 1 }]);

    await expect(teachingSaasRepository.createOrganization(
      ACTOR,
      { slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai' },
      'idempotency-key',
      'request-hash',
      'request-create',
    )).resolves.toMatchObject({ status: 201 });

    const statements = db.tx.mock.calls.map(([strings]) => Array.from(strings).join('?'));
    expect(statements[0]).toContain('pg_advisory_xact_lock');
    expect(statements[1]).toContain('DELETE FROM teaching_idempotency_requests');
    expect(statements[1]).toContain('idempotency_key =');
    expect(statements[1]).toContain('expires_at <= NOW()');
    expect(statements[2]).toContain('DELETE FROM teaching_idempotency_requests');
    expect(statements[2]).toContain('LIMIT 500');
    expect(statements[2]).toContain('FOR UPDATE SKIP LOCKED');
    expect(statements[3]).toContain('INSERT INTO teaching_idempotency_requests');
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain('INSERT INTO teaching_mutation_rate_limits');
    expect(db.query.mock.calls[0][1]).toEqual([ACTOR.userId, 'organization.create']);
  });

  it('rejects an over-limit attempt before the business row is written', async () => {
    db.query.mockResolvedValueOnce([{ attempts: 11 }]);

    await expect(teachingSaasRepository.createOrganization(
      ACTOR,
      { slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai' },
      'another-idempotency-key',
      'request-hash',
      'request-limited',
    )).rejects.toEqual(
      expect.objectContaining<TeachingApiException>({ code: 'RATE_LIMITED', status: 429 }),
    );

    expect(db.begin).not.toHaveBeenCalled();
    expect(db.tx).not.toHaveBeenCalled();
  });

  it('charges at least ten concurrent attempts before their transactions do any work', async () => {
    let releaseTransactions!: () => void;
    const gate = new Promise<void>((resolve) => { releaseTransactions = resolve; });
    db.query.mockResolvedValue([{ attempts: 1 }]);
    db.tx.mockImplementation(async (strings) => {
      const statement = String(strings[0]);
      if (statement.includes('INSERT INTO teaching_idempotency_requests')) return [{ id: 7 }];
      if (statement.includes('INSERT INTO organizations')) {
        return [{
          id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai', status: 'active', version: 1,
        }];
      }
      return [];
    });
    db.begin.mockImplementation(async (operation) => {
      await gate;
      return operation(db.tx);
    });

    const attempts = Array.from({ length: 10 }, (_, index) => teachingSaasRepository.createOrganization(
      ACTOR,
      { slug: `demo-${index}`, name: 'Demo', timezone: 'Asia/Shanghai' },
      `idempotency-${index}`,
      `request-hash-${index}`,
      `request-${index}`,
    ));
    await vi.waitFor(() => expect(db.begin).toHaveBeenCalledTimes(10));
    expect(db.query).toHaveBeenCalledTimes(10);
    expect(db.tx).not.toHaveBeenCalled();
    releaseTransactions();
    await expect(Promise.all(attempts)).resolves.toHaveLength(10);
    expect(db.query).toHaveBeenCalledTimes(10);
  });

  it.each(['teacher', 'assistant', 'viewer'] as const)(
    'denies package roster reads to %s while finance remains explicitly scoped',
    async (role) => {
      db.query
        .mockResolvedValueOnce([{
          id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
          status: 'active', version: 1, role,
        }])
        .mockResolvedValueOnce([]);
      await expect(teachingSaasRepository.listPackageProducts(
        ACTOR, 'demo', { page: 1, pageSize: 30, offset: 0 }, 'request-packages',
      )).rejects.toEqual(expect.objectContaining<TeachingApiException>({ code: 'PERMISSION_DENIED' }));
    },
  );

  it('keeps organization-wide privileges out of operational and viewer roles', () => {
    for (const role of ['owner', 'admin'] as const) {
      expect(hasTeachingPermission(role, 'session:create')).toBe(true);
      expect(hasTeachingPermission(role, 'session:manage')).toBe(true);
      expect(hasTeachingPermission(role, 'package:manage')).toBe(true);
    }
    for (const role of ['teacher', 'assistant'] as const) {
      expect(hasTeachingPermission(role, 'session:read')).toBe(true);
      expect(hasTeachingPermission(role, 'session:manage')).toBe(true);
      expect(hasTeachingPermission(role, 'session:create')).toBe(false);
      expect(hasTeachingPermission(role, 'student:read')).toBe(true);
      expect(hasTeachingPermission(role, 'campus:read')).toBe(true);
      expect(hasTeachingPermission(role, 'campus:manage')).toBe(false);
      expect(hasTeachingPermission(role, 'group:read')).toBe(true);
      expect(hasTeachingPermission(role, 'group:manage')).toBe(false);
      expect(hasTeachingPermission(role, 'assignment:manage')).toBe(false);
      expect(hasTeachingPermission(role, 'package:read')).toBe(false);
    }
    expect(hasTeachingPermission('finance', 'package:read')).toBe(true);
    expect(hasTeachingPermission('finance', 'package:manage')).toBe(true);
    expect(hasTeachingPermission('finance', 'session:read')).toBe(false);
    expect(hasTeachingPermission('finance', 'session:manage')).toBe(false);
    expect(hasTeachingPermission('viewer', 'member:read')).toBe(true);
    expect(hasTeachingPermission('viewer', 'finance:read')).toBe(false);
    expect(hasTeachingPermission('viewer', 'session:read')).toBe(false);
  });

  it.each(['teacher', 'assistant'] as const)(
    'lists only sessions assigned to %s',
    async (role) => {
      db.query
        .mockResolvedValueOnce([{
          id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
          status: 'active', version: 1, role,
        }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([]);
      await expect(teachingSaasRepository.listSessions(
        ACTOR, 'demo', { page: 1, pageSize: 30, offset: 0 }, 'request-sessions',
      )).resolves.toMatchObject({ items: [], total: 0 });

      for (const call of db.query.mock.calls.slice(1)) {
        expect(call[0]).toContain('FROM session_teachers assigned');
        expect(call[0]).toContain('assigned.organization_id = s.organization_id');
        expect(call[0]).toContain('assigned.session_id = s.id');
        expect(call[0]).toContain('assigned.teacher_user_id = ?');
        expect(call[1]).toContain(ACTOR.userId);
      }
    },
  );

  it.each(['finance', 'viewer'] as const)(
    'denies session roster access to %s and audits the refusal',
    async (role) => {
      db.query
        .mockResolvedValueOnce([{
          id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
          status: 'active', version: 1, role,
        }])
        .mockResolvedValueOnce([]);
      await expect(teachingSaasRepository.listSessions(
        ACTOR, 'demo', { page: 1, pageSize: 30, offset: 0 }, 'request-sessions',
      )).rejects.toEqual(expect.objectContaining<TeachingApiException>({
        code: 'PERMISSION_DENIED', status: 403,
      }));
      expect(db.query.mock.calls[1][0]).toContain('INSERT INTO teaching_audit_events');
      expect(db.query.mock.calls[1][1]).toContain('session.list');
    },
  );

  it('returns only attendance-linked student display fields for an assigned assistant', async () => {
    db.query
      .mockResolvedValueOnce([{
        id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
        status: 'active', version: 1, role: 'assistant',
      }])
      .mockResolvedValueOnce([{
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Assigned session',
        starts_at: '2026-08-18T01:00:00.000Z', ends_at: '2026-08-18T02:00:00.000Z',
        timezone: 'Asia/Shanghai', status: 'scheduled', version: 1,
        started_at: null, completed_at: null, cancelled_at: null, teachers: [],
        created_at: '2026-08-17T01:00:00.000Z', updated_at: '2026-08-17T01:00:00.000Z',
      }])
      .mockResolvedValueOnce([{
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        student_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', display_name: 'Student',
        student_package_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'expected', credit_cost: 1, notes: '', updated_at: '2026-08-17T01:00:00.000Z',
      }]);

    const session = await teachingSaasRepository.getSession(
      ACTOR, 'demo', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'request-assigned-session',
    );

    expect(db.query.mock.calls[1][0]).toContain('FROM session_teachers assigned');
    expect(db.query.mock.calls[1][1]).toContain(ACTOR.userId);
    expect(db.query.mock.calls[2][0]).toContain('JOIN student_profiles p');
    expect(db.query.mock.calls[2][0]).toContain('a.organization_id = ? AND a.session_id = ?');
    expect(session).toMatchObject({
      attendance: [{ displayName: 'Student', status: 'expected', creditCost: 1 }],
    });
    expect(session.attendance[0]).not.toHaveProperty('balance');
    expect(session.attendance[0]).not.toHaveProperty('priceAmountMinor');
  });

  it('returns and audits a concealed 404 for a same-organization unassigned session read', async () => {
    db.query
      .mockResolvedValueOnce([{
        id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
        status: 'active', version: 1, role: 'teacher',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([]);

    await expect(teachingSaasRepository.getSession(
      ACTOR, 'demo', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'request-session-read',
    )).rejects.toEqual(expect.objectContaining<TeachingApiException>({
      code: 'RESOURCE_NOT_FOUND', status: 404,
    }));

    expect(db.query.mock.calls[1][0]).toContain('FROM session_teachers assigned');
    expect(db.query.mock.calls[1][1]).toEqual([
      'organization-id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ACTOR.userId,
    ]);
    expect(db.query.mock.calls[2][0]).toBe(
      'SELECT 1 FROM teaching_sessions WHERE organization_id = ? AND id = ?',
    );
    expect(db.query.mock.calls[3][0]).toContain('INSERT INTO teaching_audit_events');
    expect(db.query.mock.calls[3][1]).toContain('session.read');
    expect(db.query.mock.calls[3][1]).toContainEqual({ reason: 'PERMISSION_DENIED' });
    expect(db.query.mock.calls.some(([statement]) => String(statement).includes('FROM attendance_records'))).toBe(false);
  });

  it('does not write a denial audit for a genuinely missing assigned-session read', async () => {
    db.query
      .mockResolvedValueOnce([{
        id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
        status: 'active', version: 1, role: 'assistant',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(teachingSaasRepository.getSession(
      ACTOR, 'demo', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'request-missing-session',
    )).rejects.toEqual(expect.objectContaining<TeachingApiException>({
      code: 'RESOURCE_NOT_FOUND', status: 404,
    }));
    expect(db.query).toHaveBeenCalledTimes(3);
    expect(db.query.mock.calls.some(([statement]) => String(statement).includes('teaching_audit_events'))).toBe(false);
  });

  it('audits a cross-organization session read without querying session rows', async () => {
    db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(teachingSaasRepository.getSession(
      ACTOR, 'outside', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'request-cross-session',
    )).rejects.toEqual(expect.objectContaining<TeachingApiException>({
      code: 'ORGANIZATION_NOT_FOUND', status: 404,
    }));

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[1][0]).toContain('INSERT INTO teaching_audit_events');
    expect(db.query.mock.calls[1][1]).toContain('session.read');
  });

  it('denies session creation to a teacher before any idempotency or business write', async () => {
    db.query.mockResolvedValueOnce([{ attempts: 1 }]).mockResolvedValueOnce([]);
    db.tx.mockResolvedValueOnce([{
      id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
      status: 'active', version: 1, role: 'teacher',
    }]);

    await expect(teachingSaasRepository.createSession(
      ACTOR,
      'demo',
      {
        title: 'Unauthorized', startsAt: '2026-08-18T01:00:00.000Z',
        endsAt: '2026-08-18T02:00:00.000Z', timezone: null,
        teacherUserIds: [ACTOR.userId], attendees: [],
      },
      'teacher-create',
      'request-hash',
      'request-teacher-create',
    )).rejects.toEqual(expect.objectContaining<TeachingApiException>({
      code: 'PERMISSION_DENIED', status: 403,
    }));

    expect(db.tx).toHaveBeenCalledTimes(1);
    expect(db.tx.mock.calls.some(([strings]) => Array.from(strings).join('?').includes('teaching_idempotency_requests'))).toBe(false);
    expect(db.query.mock.calls[1][0]).toContain('INSERT INTO teaching_audit_events');
  });

  it('conceals and audits an unassigned teacher attendance write before attendance changes', async () => {
    db.query.mockResolvedValueOnce([{ attempts: 1 }]).mockResolvedValueOnce([]);
    db.tx
      .mockResolvedValueOnce([{
        id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
        status: 'active', version: 1, role: 'teacher',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ '?column?': 1 }]);

    await expect(teachingSaasRepository.saveAttendanceBatch(
      ACTOR,
      'demo',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      { records: [{ attendanceId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', status: 'present' }] },
      'attendance-denied',
      'request-hash',
      'request-attendance-denied',
    )).rejects.toEqual(expect.objectContaining<TeachingApiException>({
      code: 'RESOURCE_NOT_FOUND', status: 404,
    }));

    const statements = db.tx.mock.calls.map(([strings]) => Array.from(strings).join('?'));
    expect(statements[1]).toContain('FROM session_teachers assigned');
    expect(statements[1]).toContain('assigned.teacher_user_id = ?');
    expect(db.tx.mock.calls[1].slice(1)).toContain(ACTOR.userId);
    expect(statements[2]).toContain('SELECT 1 FROM teaching_sessions');
    expect(statements.some((statement) => statement.includes('teaching_idempotency_requests'))).toBe(false);
    expect(statements.some((statement) => statement.includes('UPDATE attendance_records'))).toBe(false);
    expect(db.query.mock.calls[1][0]).toContain('INSERT INTO teaching_audit_events');
    expect(db.query.mock.calls[1][1]).toContainEqual({ reason: 'PERMISSION_DENIED' });
  });

  it('lets an assigned teacher lock packages, consume credits, and complete the session in order', async () => {
    db.query.mockResolvedValueOnce([{ attempts: 1 }]);
    db.tx
      .mockResolvedValueOnce([{
        id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
        status: 'active', version: 1, role: 'teacher',
      }])
      .mockResolvedValueOnce([{
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'scheduled',
        starts_at: '2026-08-18T01:00:00.000Z', completed_at: null,
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 9 }])
      .mockResolvedValueOnce([{
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        student_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        student_package_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'present', credit_cost: 1,
      }])
      .mockResolvedValueOnce([{
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', lifecycle_status: 'active',
        valid_from: '2026-01-01T00:00:00.000Z', valid_until: null,
      }])
      .mockResolvedValueOnce([{ balance: 10 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ completed_at: '2026-08-18T02:00:00.000Z' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(teachingSaasRepository.completeSession(
      ACTOR,
      'demo',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'complete-1',
      'request-hash',
      'request-complete',
    )).resolves.toMatchObject({
      body: { consumption: { attendanceCount: 1, totalCredits: 1 } },
    });

    const statements = db.tx.mock.calls.map(([strings]) => Array.from(strings).join('?'));
    expect(statements[1]).toContain('FROM session_teachers assigned');
    expect(statements[1]).toContain('assigned.teacher_user_id = ?');
    expect(db.tx.mock.calls[1].slice(1)).toContain(ACTOR.userId);
    const idempotencyInsert = statements.findIndex((statement) =>
      statement.includes('INSERT INTO teaching_idempotency_requests'));
    expect(idempotencyInsert).toBeGreaterThan(1);
    const packageLock = statements.findIndex((statement) =>
      statement.includes('FROM student_packages') && statement.includes('FOR UPDATE'));
    const ledgerInsert = statements.findIndex((statement) => statement.includes('INSERT INTO lesson_credit_ledger'));
    const completion = statements.findIndex((statement) => statement.includes('UPDATE teaching_sessions'));
    expect(packageLock).toBeGreaterThan(-1);
    expect(ledgerInsert).toBeGreaterThan(packageLock);
    expect(completion).toBeGreaterThan(ledgerInsert);
  });

  it('uses the database clock and keeps invite preview hash-only and read-only', async () => {
    const source = await teachingRouteSource();
    const serializer = sourceBetween(source, 'function bindingInviteToJson(', '\nfunction selfTrainingAssignmentToJson(');
    expect(serializer).toContain('row.database_now');
    expect(serializer).not.toContain('Date.now');

    const preview = sourceBetween(
      source,
      'async previewStudentAccountBindingInvite(',
      '\n  async consumeStudentAccountBindingInvite(',
    );
    expect(preview).toContain('input.tokenHash');
    expect(preview).toContain('clock_timestamp() AS database_now');
    expect(preview).toContain("'student-binding-preview'");
    expect(preview).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/);
    expect(preview).not.toContain('teaching_audit_events');
    expect(preview).not.toContain('Date.now');
  });

  it('checks staff scope before current-invite reads and locks resources before revoke idempotency', async () => {
    const source = await teachingRouteSource();
    const current = sourceBetween(
      source,
      'async getCurrentStudentAccountBindingInvite(',
      '\n  async revokeStudentAccountBindingInvite(',
    );
    expect(current.indexOf('accessForRead(')).toBeLessThan(current.indexOf("requirePermission(access, 'student:manage')"));
    expect(current.indexOf("requirePermission(access, 'student:manage')")).toBeLessThan(current.indexOf('FROM student_profiles'));
    expect(current).toContain('WITH database_clock AS MATERIALIZED');
    expect(current).toContain('invite.*, database_clock.database_now');
    expect(current).toContain('invite.expires_at > database_clock.database_now');

    const revoke = sourceBetween(
      source,
      'async revokeStudentAccountBindingInvite(',
      '\n  async previewStudentAccountBindingInvite(',
    );
    const permission = revoke.indexOf("requirePermission(initialAccess, 'student:manage')");
    const transaction = revoke.indexOf('return await sql.begin');
    const studentLock = revoke.indexOf('FROM student_profiles', transaction);
    const inviteLock = revoke.indexOf('FROM student_account_binding_invites invite', studentLock);
    const idempotency = revoke.indexOf('beginIdempotency(', inviteLock);
    const replay = revoke.indexOf("if ('replay' in idem) return idem.replay", idempotency);
    const terminalValidation = revoke.indexOf('existing.expired_at != null', replay);
    expect(permission).toBeGreaterThan(-1);
    expect(permission).toBeLessThan(transaction);
    expect(studentLock).toBeGreaterThan(transaction);
    expect(inviteLock).toBeGreaterThan(studentLock);
    expect(idempotency).toBeGreaterThan(inviteLock);
    expect(replay).toBeGreaterThan(idempotency);
    expect(terminalValidation).toBeGreaterThan(replay);
    expect(revoke).toContain('clock_timestamp() AS database_now');
    expect(revoke).toContain('expires_at > clock_timestamp()');
  });

  it('uses one database instant for consume and rolls back a boundary-expired link', async () => {
    const source = await teachingRouteSource();
    const consume = sourceBetween(
      source,
      'async consumeStudentAccountBindingInvite(',
      '\n  async listSelfTrainingAssignments(',
    );
    const instantQuery = consume.indexOf('WITH database_clock AS MATERIALIZED');
    const instantValue = consume.indexOf('const operationInstant = iso(invite.database_now)', instantQuery);
    const studentLink = consume.indexOf('SET account_user_id = ${actor.userId}, account_linked_at = ${operationInstant}', instantValue);
    const consumeUpdate = consume.indexOf('SET consumed_at = ${operationInstant}', studentLink);
    const expiryPredicate = consume.indexOf('AND expires_at > ${operationInstant}', consumeUpdate);
    const zeroRowFailure = consume.indexOf("throw new TeachingApiException(\n            'RESOURCE_NOT_FOUND'", expiryPredicate);
    expect(instantQuery).toBeGreaterThan(-1);
    expect(instantValue).toBeGreaterThan(instantQuery);
    expect(studentLink).toBeGreaterThan(instantValue);
    expect(consumeUpdate).toBeGreaterThan(studentLink);
    expect(expiryPredicate).toBeGreaterThan(consumeUpdate);
    expect(zeroRowFailure).toBeGreaterThan(expiryPredicate);
    expect(consume).toContain("if (code === '23514' || code === '55000')");
    expect(consume).toContain('SET expired_at = GREATEST(expires_at, ${operationInstant})');
    expect(consume).not.toContain('SET consumed_at = clock_timestamp()');
  });

  it('orders self evidence locks and permanently binds canonical payload hashes', async () => {
    const source = await teachingRouteSource();
    const selfStudent = sourceBetween(
      source,
      'async function boundSelfStudentForUpdate(',
      '\nconst ACTIVE_STUDENT_SCOPE_CTE',
    );
    expect(selfStudent.indexOf('FROM app_users')).toBeLessThan(selfStudent.indexOf('FROM organizations o'));
    expect(selfStudent).toContain('FOR KEY SHARE');
    expect(selfStudent).toContain('FOR UPDATE OF student');
    expect(selfStudent).toContain('clock_timestamp() AS database_now');

    const canonical = sourceBetween(
      source,
      'function canonicalTrainingEvidencePayload(',
      '\nasync function withRepeatableReadRetry',
    );
    expect(canonical).toContain('assignmentIds: input.assignmentIds ?? []');

    const evidence = sourceBetween(
      source,
      'async createSelfTrainingEvidence(',
      '\n  async saveAttendanceBatch(',
    );
    const student = evidence.indexOf('boundSelfStudentForUpdate(');
    const databaseClock = evidence.indexOf('new Date(student.databaseNow)', student);
    const naturalLock = evidence.indexOf('INSERT INTO teaching_relation_locks', databaseClock);
    const existing = evidence.indexOf('FROM training_evidence', naturalLock);
    const hashMismatch = evidence.indexOf('String(row.payload_sha256) !== payloadHash', existing);
    const replay = evidence.indexOf('replayed: true', hashMismatch);
    const targets = evidence.indexOf('FROM training_assignment_targets target', replay);
    const rawInsert = evidence.indexOf('INSERT INTO training_evidence (', targets);
    const linkInsert = evidence.indexOf('INSERT INTO training_evidence_assignments (', rawInsert);
    expect(student).toBeGreaterThan(-1);
    expect(databaseClock).toBeGreaterThan(student);
    expect(evidence).toContain('databaseNowMs + TRAINING_EVIDENCE_FUTURE_TOLERANCE_MS');
    expect(naturalLock).toBeGreaterThan(databaseClock);
    expect(existing).toBeGreaterThan(naturalLock);
    expect(hashMismatch).toBeGreaterThan(existing);
    expect(evidence.slice(hashMismatch, replay)).toContain("'CONFLICT'");
    expect(evidence.slice(hashMismatch, replay)).toContain('409');
    expect(replay).toBeGreaterThan(hashMismatch);
    expect(targets).toBeGreaterThan(replay);
    expect(rawInsert).toBeGreaterThan(targets);
    expect(linkInsert).toBeGreaterThan(rawInsert);
    expect(evidence.match(/INSERT INTO training_evidence \(/g)).toHaveLength(1);
    expect(evidence).toContain('for (const assignmentId of assignmentIds)');
    expect(evidence).toContain('replayed: false');
  });

  it('locks the exact current teacher scope path before validating training selectors', async () => {
    const source = await teachingRouteSource();
    const studentScope = sourceBetween(
      source,
      'async function lockAndCheckTeacherStudentScope(',
      '\nasync function trainingAssignmentEnvelope(',
    );
    expect(studentScope).toContain("member.status = 'active'");
    expect(studentScope).toContain("member.role IN ('teacher', 'assistant')");
    expect(studentScope).toContain("student.status = 'active'");
    expect(studentScope).toContain("teaching_group.status = 'active'");
    expect(studentScope).toContain("campus.status = 'active'");
    const candidate = studentScope.indexOf('const candidateRows = await tx');
    const teacherStudentLock = studentScope.indexOf("'teacher_student'", candidate);
    const teacherGroupLock = studentScope.indexOf("'teacher_group'", candidate);
    const membershipLock = studentScope.indexOf("'student_group'", teacherGroupLock);
    const exactDirectCheck = studentScope.indexOf('actorHasExactDirectStudentScope(', teacherStudentLock);
    const exactGroupCheck = studentScope.indexOf('actorHasExactGroupStudentScope(', membershipLock);
    expect(teacherStudentLock).toBeGreaterThan(candidate);
    expect(teacherGroupLock).toBeGreaterThan(candidate);
    expect(membershipLock).toBeGreaterThan(teacherGroupLock);
    expect(exactDirectCheck).toBeGreaterThan(teacherStudentLock);
    expect(exactGroupCheck).toBeGreaterThan(membershipLock);
    expect(studentScope).not.toContain('actorHasActiveStudentScope(');

    const validation = sourceBetween(
      source,
      'async function lockAndValidateTrainingSelectors(',
      '\nexport const teachingSaasRepository',
    );
    expect(validation).toContain('lockAndCheckTeacherGroupScope(tx, access, actor, groupId)');
    expect(validation).toContain('lockAndCheckTeacherStudentScope(tx, access, actor, studentId)');
    expect(validation).toContain('trainingSelectorMissing(');
  });

  it('materializes the exact active-student union before publishing an assignment', async () => {
    const source = await teachingRouteSource();
    const publish = sourceBetween(
      source,
      'async publishTrainingAssignment(',
      '\n  async closeTrainingAssignment(',
    );
    const assignmentLock = publish.indexOf('FOR UPDATE OF assignment');
    const scope = publish.indexOf("assertTrainingAssignmentScope(tx, access, actor, assignment, 'manage')");
    const idempotency = publish.indexOf('beginIdempotency(', scope);
    const databaseInstant = publish.indexOf('SELECT clock_timestamp() AS published_at', idempotency);
    const groupSetLock = publish.indexOf("'student_group', '*', groupId", databaseInstant);
    const groupRowLock = publish.indexOf('FOR UPDATE OF teaching_group', groupSetLock);
    const membershipRead = publish.indexOf('FROM student_group_memberships membership', groupRowLock);
    const activeStudentJoin = publish.indexOf("student.status = 'active'", membershipRead);
    const studentRowLock = publish.indexOf('FROM student_profiles', activeStudentJoin);
    const expandedDelete = publish.indexOf('DELETE FROM training_assignment_targets', studentRowLock);
    const expandedInsert = publish.indexOf('INSERT INTO training_assignment_targets (', expandedDelete);
    const publishTransition = publish.indexOf("SET status = 'published'", expandedInsert);
    expect(assignmentLock).toBeGreaterThan(-1);
    expect(scope).toBeGreaterThan(assignmentLock);
    expect(idempotency).toBeGreaterThan(scope);
    expect(databaseInstant).toBeGreaterThan(idempotency);
    expect(groupSetLock).toBeGreaterThan(databaseInstant);
    expect(groupRowLock).toBeGreaterThan(groupSetLock);
    expect(membershipRead).toBeGreaterThan(groupRowLock);
    expect(activeStudentJoin).toBeGreaterThan(membershipRead);
    expect(studentRowLock).toBeGreaterThan(activeStudentJoin);
    expect(expandedDelete).toBeGreaterThan(studentRowLock);
    expect(expandedInsert).toBeGreaterThan(expandedDelete);
    expect(publishTransition).toBeGreaterThan(expandedInsert);
    expect(publish).toContain('const directStudents = new Set(directStudentIds)');
    expect(publish).toContain('if (previous === undefined || groupId < previous)');
    expect(publish).toContain('if (directStudents.has(studentId)) continue');
    expect(publish).toContain('Published training assignments require at least one active student');
  });

  it('filters staff target pages by the canonical active scope before pagination', async () => {
    const source = await teachingRouteSource();
    const targets = sourceBetween(
      source,
      'async listTrainingAssignmentTargets(',
      '\n  async listTrainingTargetEvidence(',
    );
    expect(targets.match(/WITH active_scope_actor AS/g)).toHaveLength(2);
    expect(targets.match(/member\.status = 'active'/g)).toHaveLength(2);
    expect(targets.match(/teaching_group\.status = 'active'/g)).toHaveLength(2);
    expect(targets.match(/campus\.status = 'active'/g)).toHaveLength(2);
    expect(targets.match(/student\.status = 'active'/g)).toHaveLength(4);
    const staffItems = targets.lastIndexOf('WITH active_scope_actor AS');
    const scopedPredicate = targets.indexOf('target.student_id IN (SELECT id FROM scoped_student_ids)', staffItems);
    const pagination = targets.indexOf('LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}', staffItems);
    expect(scopedPredicate).toBeGreaterThan(staffItems);
    expect(pagination).toBeGreaterThan(scopedPredicate);
  });

  it('replays Stage 3C mutations before mutable input state and keeps reviews append-only', async () => {
    const source = await teachingRouteSource();
    const create = sourceBetween(
      source,
      'async createTrainingAssignment(',
      '\n  async reviseTrainingAssignment(',
    );
    expect(create.indexOf('beginIdempotency(')).toBeLessThan(
      create.indexOf('lockAndValidateTrainingSelectors('),
    );

    const revise = sourceBetween(
      source,
      'async reviseTrainingAssignment(',
      '\n  async publishTrainingAssignment(',
    );
    const existingScope = revise.indexOf("assertTrainingAssignmentScope(");
    const reviseIdempotency = revise.indexOf('beginIdempotency(', existingScope);
    const replacementValidation = revise.indexOf('lockAndValidateTrainingSelectors(', reviseIdempotency);
    expect(existingScope).toBeGreaterThan(-1);
    expect(reviseIdempotency).toBeGreaterThan(existingScope);
    expect(replacementValidation).toBeGreaterThan(reviseIdempotency);

    const review = sourceBetween(
      source,
      'async createTrainingTargetReview(',
      '\n  async saveAttendanceBatch(',
    );
    const operation = source.match(/const TRAINING_REVIEW_CREATE_OPERATION = '([^']+)'/);
    expect(operation?.[1]).toBe('training.review.create');
    expect(operation?.[1].length).toBeLessThanOrEqual(100);
    expect(review.match(/TRAINING_REVIEW_CREATE_OPERATION/g)).toHaveLength(2);
    expect(review).not.toContain('training.assignment.review.create:${assignmentId}:${studentId}');
    const targetLock = review.indexOf('FROM training_assignment_targets');
    const scopeLock = review.indexOf('lockAndCheckTeacherStudentScope(', targetLock);
    const reviewIdempotency = review.indexOf('beginIdempotency(', scopeLock);
    const replay = review.indexOf("if ('replay' in idem) return idem.replay", reviewIdempotency);
    const evidenceCheck = review.indexOf('evidence_count', replay);
    const revision = review.indexOf('latest_review_revision', evidenceCheck);
    const insert = review.indexOf('INSERT INTO training_submission_reviews', revision);
    expect(targetLock).toBeGreaterThan(-1);
    expect(scopeLock).toBeGreaterThan(targetLock);
    expect(reviewIdempotency).toBeGreaterThan(scopeLock);
    expect(replay).toBeGreaterThan(reviewIdempotency);
    expect(evidenceCheck).toBeGreaterThan(replay);
    expect(revision).toBeGreaterThan(evidenceCheck);
    expect(insert).toBeGreaterThan(revision);
    expect(review).not.toContain('feedback: input.feedback');
  });

  it('keeps the shared review operation within both persistence column limits', async () => {
    const [source, schema] = await Promise.all([teachingRouteSource(), schemaSource()]);
    const operation = source.match(/const TRAINING_REVIEW_CREATE_OPERATION = '([^']+)'/)?.[1];
    expect(operation).toBeDefined();
    expect(operation!.length).toBeLessThanOrEqual(100);
    expect(schema).toMatch(/CREATE TABLE teaching_idempotency_requests[\s\S]*?operation\s+VARCHAR\(100\) NOT NULL/);
    expect(schema).toMatch(/CREATE TABLE teaching_mutation_rate_limits[\s\S]*?operation\s+VARCHAR\(100\) NOT NULL/);
  });
});
