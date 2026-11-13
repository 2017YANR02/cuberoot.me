import { query, sql } from '../../db/connection.js';
import { hasTeachingPermission } from '@cuberoot/shared/teaching';
import { asAccess, accessForRead, hasOrganizationCrmScope, requirePermission, accessForWrite, requireWritable } from '../access/organization.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { ACTIVE_STUDENT_SCOPE_CTE, activeStudentScopeParams } from '../access/student.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency } from '../transactions.js';
import { type MutationResult } from '../types.js';
import { TeachingApiException, uniqueConflict, ConcealedTeachingPermissionDeniedException } from '../errors.js';
import { studentToJson } from '../serialization/organizations.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const organizationsRepository: Pick<TeachingSaasRepository,
  'listOrganizations' | 'getOrganization' | 'getOrganizationSummary' | 'createOrganization' | 'listMembers' | 'createMember' | 'listStudents' | 'getStudent' | 'createStudent'> = {
  async listOrganizations(actor) {
    const rows = await query<Record<string, unknown>>(
      `SELECT o.id, o.slug, o.name, o.timezone, o.status, o.version, m.role
       FROM organization_members m
       JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY o.name, o.slug`,
      [actor.userId],
    );
    return rows.map((row) => ({ ...asAccess(row) }));
  },

  async getOrganization(actor, slug, requestId) {
    return withDeniedAccessAudit(actor, slug, 'organization.read', requestId, async () => ({
      ...await accessForRead(actor.userId, slug),
    }));
  },

  async getOrganizationSummary(actor, slug, requestId) {
    return withDeniedAccessAudit(actor, slug, 'organization.summary', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const [memberRows, studentRows] = await Promise.all([
        hasTeachingPermission(access.role, 'member:read')
          ? query<Record<string, unknown>>(
              'SELECT COUNT(*)::int AS count FROM organization_members WHERE organization_id = ?',
              [access.id],
            )
          : Promise.resolve([]),
        hasTeachingPermission(access.role, 'student:read')
          ? hasOrganizationCrmScope(access.role)
            ? query<Record<string, unknown>>(
                'SELECT COUNT(*)::int AS count FROM student_profiles WHERE organization_id = ?',
                [access.id],
              )
            : query<Record<string, unknown>>(
                `${ACTIVE_STUDENT_SCOPE_CTE}
                 SELECT COUNT(*)::int AS count FROM scoped_student_ids`,
                activeStudentScopeParams(access, actor),
              )
          : Promise.resolve([]),
      ]);
      return {
        organization: { ...access },
        memberCount: hasTeachingPermission(access.role, 'member:read')
          ? Number(memberRows[0]?.count ?? 0)
          : null,
        studentCount: hasTeachingPermission(access.role, 'student:read')
          ? Number(studentRows[0]?.count ?? 0)
          : null,
      };
    });
  },

  async createOrganization(actor, input, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, 'organization.create', 10, '1 hour');
    try {
      return await sql.begin(async (tx) => {
        const idem = await beginIdempotency(tx, actor.userId, null, 'organization.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        const rows = await tx`
          INSERT INTO organizations (slug, name, timezone, created_by_user_id)
          VALUES (${input.slug}, ${input.name}, ${input.timezone}, ${actor.userId})
          RETURNING id, slug, name, timezone, status, version`;
        const org = rows[0] as Record<string, unknown>;
        const organizationId = String(org.id);
        await tx`
          INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
          VALUES (${organizationId}, ${actor.userId}, 'owner', 'active', NOW())`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${organizationId}, ${actor.userId}, 'owner', ${actor.displayName},
            'organization.create', 'organization', ${organizationId}, ${requestId}, ${sql.json({ slug: input.slug })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: {
            organization: {
              id: organizationId,
              slug: String(org.slug),
              name: String(org.name),
              timezone: String(org.timezone),
              status: String(org.status),
              version: Number(org.version),
              role: 'owner',
            },
          },
        };
        await completeIdempotency(tx, idem.id, result, 'organization', organizationId);
        return result;
      }) as MutationResult;
    } catch (error) {
      if (error instanceof TeachingApiException) throw error;
      return uniqueConflict(error, 'Organization slug already exists');
    }
  },

  async listMembers(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'member.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'member:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM organization_members WHERE organization_id = ?',
          [access.id],
        ),
        query<Record<string, unknown>>(
      `SELECT m.user_id, u.display_name, u.avatar_url, m.role, m.status, m.joined_at, m.created_at
       FROM organization_members m
       JOIN app_users u ON u.id = m.user_id
       WHERE m.organization_id = ?
       ORDER BY CASE m.role
         WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2
         WHEN 'assistant' THEN 3 WHEN 'finance' THEN 4 ELSE 5 END,
         u.display_name, m.user_id
       LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map((row) => ({
          userId: Number(row.user_id),
          displayName: String(row.display_name ?? ''),
          avatarUrl: row.avatar_url == null ? null : String(row.avatar_url),
          role: String(row.role),
          status: String(row.status),
          joinedAt: row.joined_at instanceof Date ? row.joined_at.toISOString() : String(row.joined_at),
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        })),
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async createMember(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'member.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'member.create', 60, '1 minute');
      try {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        requirePermission(access, 'member:manage');
        if (input.role === 'admin' && access.role !== 'owner') {
          throw new TeachingApiException('PERMISSION_DENIED', 403, 'Only an owner can grant the admin role');
        }
        const idem = await beginIdempotency(tx, actor.userId, access.id, 'member.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        const users = await tx`SELECT id, display_name FROM app_users WHERE id = ${input.userId}`;
        if (!users.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'User not found');
        await tx`
          INSERT INTO organization_members (
            organization_id, user_id, role, status, invited_by_user_id, joined_at
          ) VALUES (${access.id}, ${input.userId}, ${input.role}, 'active', ${actor.userId}, NOW())`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'member.create', 'organization_member', ${String(input.userId)}, ${requestId}, ${sql.json({ role: input.role })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: {
            member: {
              userId: input.userId,
              displayName: String(users[0].display_name ?? ''),
              role: input.role,
              status: 'active',
            },
          },
        };
        await completeIdempotency(tx, idem.id, result, 'organization_member', String(input.userId));
        return result;
      }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'User is already a member of this organization');
      }
    });
  },

  async listStudents(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'student:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const scopeParams = activeStudentScopeParams(access, actor);
      const [countRows, rows] = await Promise.all(organizationScope ? [
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM student_profiles WHERE organization_id = ?', [access.id],
        ),
        query<Record<string, unknown>>(
          `SELECT id, account_user_id, external_ref, display_name, status, created_at, updated_at
           FROM student_profiles
           WHERE organization_id = ?
           ORDER BY display_name, id
           LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ] : [
        query<Record<string, unknown>>(
          `${ACTIVE_STUDENT_SCOPE_CTE} SELECT COUNT(*)::int AS count FROM scoped_student_ids`, scopeParams,
        ),
        query<Record<string, unknown>>(
          `${ACTIVE_STUDENT_SCOPE_CTE}
           SELECT student.id, student.account_user_id, student.external_ref, student.display_name,
                  student.status, student.created_at, student.updated_at
           FROM student_profiles student
           JOIN scoped_student_ids scope ON scope.id = student.id
           ORDER BY student.display_name, student.id
           LIMIT ? OFFSET ?`,
          [...scopeParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(studentToJson),
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async getStudent(actor, slug, studentId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'student:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const rows = organizationScope
        ? await query<Record<string, unknown>>(
            `SELECT id, account_user_id, external_ref, display_name, status, created_at, updated_at
             FROM student_profiles WHERE organization_id = ? AND id = ?`,
            [access.id, studentId],
          )
        : await query<Record<string, unknown>>(
            `${ACTIVE_STUDENT_SCOPE_CTE}
             SELECT student.id, student.account_user_id, student.external_ref, student.display_name,
                    student.status, student.created_at, student.updated_at
             FROM student_profiles student
             JOIN scoped_student_ids scope ON scope.id = student.id
             WHERE student.id = ?`,
            [...activeStudentScopeParams(access, actor), studentId],
          );
      if (!rows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM student_profiles WHERE organization_id = ? AND id = ?', [access.id, studentId],
        );
        if (exists.length && !organizationScope) {
          throw new ConcealedTeachingPermissionDeniedException('Student not found');
        }
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
      }
      return studentToJson(rows[0]);
    });
  },

  async createStudent(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'student.create', 120, '1 minute');
      try {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        requirePermission(access, 'student:manage');
        const idem = await beginIdempotency(tx, actor.userId, access.id, 'student.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        const rows = await tx`
          INSERT INTO student_profiles (
            organization_id, external_ref, display_name, created_by_user_id
          ) VALUES (${access.id}, ${input.externalRef}, ${input.displayName}, ${actor.userId})
          RETURNING id, external_ref, display_name, status, created_at, updated_at`;
        const student = rows[0] as Record<string, unknown>;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'student.create', 'student', ${String(student.id)}, ${requestId}, ${sql.json({ externalRef: input.externalRef })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: {
            student: {
              id: String(student.id),
              accountUserId: null,
              externalRef: student.external_ref == null ? null : String(student.external_ref),
              displayName: String(student.display_name),
              status: String(student.status),
              createdAt: student.created_at instanceof Date ? student.created_at.toISOString() : String(student.created_at),
              updatedAt: student.updated_at instanceof Date ? student.updated_at.toISOString() : String(student.updated_at),
            },
          },
        };
        await completeIdempotency(tx, idem.id, result, 'student', String(student.id));
        return result;
      }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'Student external reference already exists in this organization');
      }
    });
  },
};
