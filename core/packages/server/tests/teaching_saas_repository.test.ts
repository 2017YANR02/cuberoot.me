import { beforeEach, describe, expect, it, vi } from 'vitest';

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
      JSON.stringify({ reason: 'ORGANIZATION_NOT_FOUND' }),
      ACTOR.userId,
      'other-org',
    ]);
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
      JSON.stringify({ reason: 'ORGANIZATION_NOT_FOUND' }),
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

  it.each(['teacher', 'assistant', 'finance', 'viewer'] as const)(
    'denies the organization-wide student roster to %s before assignments exist',
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
        .mockResolvedValueOnce([]);

      await expect(
        teachingSaasRepository.listStudents(
          ACTOR,
          'demo',
          { page: 1, pageSize: 30, offset: 0 },
          'request-students',
        ),
      ).rejects.toEqual(
        expect.objectContaining<TeachingApiException>({
          code: 'PERMISSION_DENIED',
          status: 403,
        }),
      );

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query.mock.calls[1][0]).toContain('INSERT INTO teaching_audit_events');
      expect(db.query.mock.calls[1][1]).toContain('student.list');
    },
  );

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

  it.each(['teacher', 'assistant', 'finance', 'viewer'] as const)(
    'denies the organization-wide session roster to %s before assignments exist',
    async (role) => {
      db.query
        .mockResolvedValueOnce([{
          id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
          status: 'active', version: 1, role,
        }])
        .mockResolvedValueOnce([]);
      await expect(teachingSaasRepository.listSessions(
        ACTOR, 'demo', { page: 1, pageSize: 30, offset: 0 }, 'request-sessions',
      )).rejects.toEqual(expect.objectContaining<TeachingApiException>({ code: 'PERMISSION_DENIED' }));
    },
  );

  it('locks the student package before writing a consume ledger row and completes afterward', async () => {
    db.query.mockResolvedValueOnce([{ attempts: 1 }]);
    db.tx
      .mockResolvedValueOnce([{
        id: 'organization-id', slug: 'demo', name: 'Demo', timezone: 'Asia/Shanghai',
        status: 'active', version: 1, role: 'owner',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 9 }])
      .mockResolvedValueOnce([{
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'scheduled',
        starts_at: '2026-08-18T01:00:00.000Z', completed_at: null,
      }])
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
    const packageLock = statements.findIndex((statement) =>
      statement.includes('FROM student_packages') && statement.includes('FOR UPDATE'));
    const ledgerInsert = statements.findIndex((statement) => statement.includes('INSERT INTO lesson_credit_ledger'));
    const completion = statements.findIndex((statement) => statement.includes('UPDATE teaching_sessions'));
    expect(packageLock).toBeGreaterThan(-1);
    expect(ledgerInsert).toBeGreaterThan(packageLock);
    expect(completion).toBeGreaterThan(ledgerInsert);
  });
});
