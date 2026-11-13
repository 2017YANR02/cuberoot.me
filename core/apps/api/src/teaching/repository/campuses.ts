import { query, sql } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requirePermission, hasOrganizationCrmScope, accessForWrite, requireWritable } from '../access/organization.js';
import { campusToJson } from '../serialization/organizations.js';
import { ConcealedTeachingPermissionDeniedException, TeachingApiException, crmConflict } from '../errors.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency } from '../transactions.js';
import { type MutationResult } from '../types.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const campusesRepository: Pick<TeachingSaasRepository,
  'listCampuses' | 'getCampus' | 'createCampus' | 'archiveCampus'> = {
  async listCampuses(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'campus:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const scopeSql = organizationScope ? '' : `
        AND campus.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM teacher_assignments assignment
          JOIN teaching_groups teaching_group
            ON teaching_group.organization_id = assignment.organization_id
           AND teaching_group.id = assignment.group_id
           WHERE assignment.organization_id = campus.organization_id
             AND assignment.teacher_user_id = ?
             AND EXISTS (
               SELECT 1 FROM organization_members scoped_member
               WHERE scoped_member.organization_id = assignment.organization_id
                 AND scoped_member.user_id = assignment.teacher_user_id
                 AND scoped_member.status = 'active'
                 AND scoped_member.role IN ('teacher', 'assistant')
             )
             AND assignment.effective_from <= NOW()
            AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
            AND teaching_group.status = 'active'
            AND teaching_group.campus_id = campus.id
        )`;
      const baseParams: unknown[] = organizationScope ? [access.id] : [access.id, actor.userId];
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count FROM teaching_campuses campus
           WHERE campus.organization_id = ? ${scopeSql}`,
          baseParams,
        ),
        query<Record<string, unknown>>(
          `SELECT campus.id, campus.code, campus.name, campus.timezone, campus.status,
                  campus.archived_at, campus.created_at, campus.updated_at
           FROM teaching_campuses campus
           WHERE campus.organization_id = ? ${scopeSql}
           ORDER BY CASE campus.status WHEN 'active' THEN 0 ELSE 1 END, campus.name, campus.id
           LIMIT ? OFFSET ?`,
          [...baseParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(campusToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getCampus(actor, slug, campusId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'campus:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const rows = await query<Record<string, unknown>>(
        `SELECT campus.id, campus.code, campus.name, campus.timezone, campus.status,
                campus.archived_at, campus.created_at, campus.updated_at
         FROM teaching_campuses campus
         WHERE campus.organization_id = ? AND campus.id = ?
           ${organizationScope ? '' : `AND campus.status = 'active' AND EXISTS (
             SELECT 1 FROM teacher_assignments assignment
             JOIN teaching_groups teaching_group
               ON teaching_group.organization_id = assignment.organization_id
              AND teaching_group.id = assignment.group_id
             WHERE assignment.organization_id = campus.organization_id
               AND assignment.teacher_user_id = ?
               AND EXISTS (
                 SELECT 1 FROM organization_members scoped_member
                 WHERE scoped_member.organization_id = assignment.organization_id
                   AND scoped_member.user_id = assignment.teacher_user_id
                   AND scoped_member.status = 'active'
                   AND scoped_member.role IN ('teacher', 'assistant')
               )
               AND assignment.effective_from <= NOW()
               AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
               AND teaching_group.status = 'active'
               AND teaching_group.campus_id = campus.id
           )`}`,
        organizationScope ? [access.id, campusId] : [access.id, campusId, actor.userId],
      );
      if (!rows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM teaching_campuses WHERE organization_id = ? AND id = ?', [access.id, campusId],
        );
        if (exists.length && !organizationScope) throw new ConcealedTeachingPermissionDeniedException('Campus not found');
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Campus not found');
      }
      return campusToJson(rows[0]);
    });
  },

  async createCampus(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'campus.create', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'campus:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'campus.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO teaching_campuses (organization_id, code, name, timezone, created_by_user_id)
            VALUES (${access.id}, ${input.code}, ${input.name}, ${input.timezone}, ${actor.userId})
            RETURNING id, code, name, timezone, status, archived_at, created_at, updated_at`;
          const campus = campusToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'campus.create', 'campus', ${String(rows[0].id)}, ${requestId}, ${sql.json({ code: input.code })}
            )`;
          const result: MutationResult = { status: 201, body: { campus } };
          await completeIdempotency(tx, idem.id, result, 'campus', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Campus code already exists or the campus is invalid');
      }
    });
  },

  async archiveCampus(actor, slug, campusId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.archive', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'campus.archive', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'campus:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'campus.archive', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, status FROM teaching_campuses
            WHERE organization_id = ${access.id} AND id = ${campusId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Campus not found');
          if (existing[0].status !== 'active') throw new TeachingApiException('CONFLICT', 409, 'Campus is already archived');
          const rows = await tx`
            UPDATE teaching_campuses SET status = 'archived', archived_at = NOW()
            WHERE organization_id = ${access.id} AND id = ${campusId}
            RETURNING id, code, name, timezone, status, archived_at, created_at, updated_at`;
          const campus = campusToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'campus.archive', 'campus', ${campusId}, ${requestId}, ${sql.json({ reason: 'manual_archive' })}
            )`;
          const result: MutationResult = { status: 200, body: { campus } };
          await completeIdempotency(tx, idem.id, result, 'campus', campusId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Campus cannot be archived while it has active groups');
      }
    });
  },
};
