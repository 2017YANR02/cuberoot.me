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
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain('INSERT INTO teaching_audit_events');
    expect(db.query.mock.calls[0][1]).toEqual([
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

    const statements = db.tx.mock.calls.map(([strings]) => String(strings[0]));
    expect(statements[0]).toContain('pg_advisory_xact_lock');
    expect(statements[1]).toContain('DELETE FROM teaching_idempotency_requests');
    expect(statements[1]).toContain('WHERE expires_at <= NOW()');
    expect(statements[1]).toContain('LIMIT 500');
    expect(statements[1]).toContain('FOR UPDATE SKIP LOCKED');
    expect(statements[2]).toContain('INSERT INTO teaching_idempotency_requests');
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain('INSERT INTO teaching_mutation_rate_limits');
    expect(db.query.mock.calls[0][1]).toEqual([ACTOR.userId, 'organization.create']);
  });

  it('rejects an over-limit attempt before the business row is written', async () => {
    db.tx
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 8 }]);
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

    const statements = db.tx.mock.calls.map(([strings]) => String(strings[0]));
    expect(statements.some((statement) => statement.includes('INSERT INTO organizations'))).toBe(false);
  });
});
