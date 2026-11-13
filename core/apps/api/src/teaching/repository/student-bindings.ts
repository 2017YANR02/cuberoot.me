import { randomBytes } from 'node:crypto';
import { sql, query } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requireWritable, requirePermission, accessForWrite } from '../access/organization.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency, withRepeatableReadRetry } from '../transactions.js';
import { sha256 } from '../encoding.js';
import { TeachingApiException, uniqueConflict, crmConflict } from '../errors.js';
import { bindingInviteToJson } from '../serialization/bindings.js';
import { type MutationResult } from '../types.js';
import { iso } from '../serialization/common.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const studentBindingsRepository: Pick<TeachingSaasRepository,
  'createStudentAccountBindingInvite' | 'getCurrentStudentAccountBindingInvite' | 'revokeStudentAccountBindingInvite' | 'previewStudentAccountBindingInvite' | 'consumeStudentAccountBindingInvite'> = {
  async createStudentAccountBindingInvite(actor, slug, studentId, input, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.account-binding.invite.create', requestId, async () => {
      const initialAccess = await accessForRead(actor.userId, slug);
      requireWritable(initialAccess);
      requirePermission(initialAccess, 'student:manage');
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-invite:${initialAccess.id}`,
        30,
        '1 hour',
      );
      const token = randomBytes(32).toString('base64url');
      const tokenHash = sha256(token);
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'student:manage');
          const students = await tx`
            SELECT id, status, account_user_id
            FROM student_profiles
            WHERE organization_id = ${access.id} AND id = ${studentId}
            FOR UPDATE`;
          if (!students.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
          }
          const student = students[0] as Record<string, unknown>;
          if (student.status !== 'active') {
            throw new TeachingApiException('CONFLICT', 409, 'Only an active student can be linked');
          }
          if (student.account_user_id != null) {
            throw new TeachingApiException('CONFLICT', 409, 'Student already has a linked account');
          }
          await tx`
            UPDATE student_account_binding_invites
            SET expired_at = GREATEST(expires_at, clock_timestamp())
            WHERE organization_id = ${access.id}
              AND student_id = ${studentId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
              AND expires_at <= clock_timestamp()`;
          await tx`
            UPDATE student_account_binding_invites
            SET revoked_at = GREATEST(created_at, clock_timestamp()),
                revoked_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id}
              AND student_id = ${studentId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL`;
          const rows = await tx`
            INSERT INTO student_account_binding_invites (
              organization_id, student_id, token_hash, expires_at, created_by_user_id
            ) VALUES (
              ${access.id}, ${studentId}, ${tokenHash},
              clock_timestamp() + make_interval(mins => ${input.expiresInMinutes}),
              ${actor.userId}
            )
            RETURNING *, clock_timestamp() AS database_now`;
          const invite = bindingInviteToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student.account-binding.invite.create', 'student_account_binding_invite',
              ${String(rows[0].id)}, ${requestId},
              ${sql.json({ studentId, expiresAt: invite.expiresAt })}
            )`;
          return { status: 201, body: { invite, token } } satisfies MutationResult;
        }) as MutationResult;
      } catch (error) {
        uniqueConflict(error, 'A student account binding invite could not be issued concurrently');
      }
    });
  },

  async getCurrentStudentAccountBindingInvite(actor, slug, studentId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.account-binding.invite.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'student:manage');
      const students = await query<Record<string, unknown>>(
        `SELECT id FROM student_profiles WHERE organization_id = ? AND id = ?`,
        [access.id, studentId],
      );
      if (!students.length) {
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
      }
      const rows = await query<Record<string, unknown>>(
        `WITH database_clock AS MATERIALIZED (
           SELECT clock_timestamp() AS database_now
         )
         SELECT invite.*, database_clock.database_now
         FROM student_account_binding_invites invite
         CROSS JOIN database_clock
         WHERE invite.organization_id = ? AND invite.student_id = ?
           AND invite.expired_at IS NULL
           AND invite.consumed_at IS NULL
           AND invite.revoked_at IS NULL
           AND invite.expires_at > database_clock.database_now
         ORDER BY invite.created_at DESC, invite.id DESC
         LIMIT 1`,
        [access.id, studentId],
      );
      return { invite: rows.length ? bindingInviteToJson(rows[0]) : null };
    });
  },

  async revokeStudentAccountBindingInvite(
    actor,
    slug,
    studentId,
    inviteId,
    idempotencyKey,
    requestHash,
    requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'student.account-binding.invite.revoke', requestId, async () => {
      const initialAccess = await accessForRead(actor.userId, slug);
      requireWritable(initialAccess);
      requirePermission(initialAccess, 'student:manage');
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-invite-revoke:${initialAccess.id}`,
        60,
        '1 minute',
      );
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'student:manage');
          const students = await tx`
            SELECT id FROM student_profiles
            WHERE organization_id = ${access.id} AND id = ${studentId}
            FOR UPDATE`;
          if (!students.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
          }
          const rows = await tx`
            SELECT invite.*, clock_timestamp() AS database_now
            FROM student_account_binding_invites invite
            WHERE invite.organization_id = ${access.id}
              AND invite.student_id = ${studentId}
              AND invite.id = ${inviteId}
            FOR UPDATE`;
          if (!rows.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student account binding invite not found');
          }
          const idem = await beginIdempotency(
            tx,
            actor.userId,
            access.id,
            `student.account-binding.invite.revoke:${inviteId}`,
            idempotencyKey,
            requestHash,
          );
          if ('replay' in idem) return idem.replay;
          const existing = rows[0] as Record<string, unknown>;
          if (
            existing.expired_at != null
            || existing.consumed_at != null
            || existing.revoked_at != null
            || new Date(String(existing.expires_at)).getTime()
              <= new Date(String(existing.database_now)).getTime()
          ) {
            throw new TeachingApiException('CONFLICT', 409, 'Only a current pending invite can be revoked');
          }
          const revoked = await tx`
            UPDATE student_account_binding_invites
            SET revoked_at = GREATEST(created_at, clock_timestamp()),
                revoked_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id}
              AND student_id = ${studentId}
              AND id = ${inviteId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
              AND expires_at > clock_timestamp()
            RETURNING *, clock_timestamp() AS database_now`;
          if (!revoked.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Student account binding invite changed concurrently');
          }
          const invite = bindingInviteToJson(revoked[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student.account-binding.invite.revoke', 'student_account_binding_invite',
              ${inviteId}, ${requestId}, ${sql.json({ studentId, reason: 'manual_revoke' })}
            )`;
          const result: MutationResult = { status: 200, body: { invite } };
          await completeIdempotency(
            tx,
            idem.id,
            result,
            'student_account_binding_invite',
            inviteId,
          );
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Student account binding invite could not be revoked');
      }
    });
  },

  async previewStudentAccountBindingInvite(actor, input, requestId) {
    await consumeMutationAttempt(actor.userId, 'student-binding-preview', 120, '1 hour');
    const rows = await query<Record<string, unknown>>(
      `SELECT invite.id, invite.organization_id, invite.student_id,
              invite.expires_at, invite.expired_at, invite.consumed_at, invite.revoked_at,
              organization.name AS organization_name, organization.status AS organization_status,
              student.display_name AS student_display_name, student.status AS student_status,
              student.account_user_id, clock_timestamp() AS database_now
       FROM student_account_binding_invites invite
       JOIN organizations organization ON organization.id = invite.organization_id
       JOIN student_profiles student
         ON student.organization_id = invite.organization_id AND student.id = invite.student_id
       WHERE invite.token_hash = ?`,
      [input.tokenHash],
    );
    if (rows.length) {
      const row = rows[0];
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-preview:${String(row.organization_id)}`,
        30,
        '1 hour',
      );
      const available = row.expired_at == null
        && row.consumed_at == null
        && row.revoked_at == null
        && new Date(String(row.expires_at)).getTime() > new Date(String(row.database_now)).getTime()
        && row.organization_status === 'active'
        && row.student_status === 'active'
        && row.account_user_id == null;
      if (available) {
        return {
          organizationName: String(row.organization_name),
          studentDisplayName: String(row.student_display_name),
          expiresAt: iso(row.expires_at),
        };
      }
    }
    throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student account binding invite not found');
  },

  async consumeStudentAccountBindingInvite(actor, input, requestId) {
    await consumeMutationAttempt(actor.userId, 'student-binding-consume', 60, '1 hour');
    const rateScopes = await query<Record<string, unknown>>(
      `SELECT organization_id FROM student_account_binding_invites WHERE token_hash = ?`,
      [input.tokenHash],
    );
    if (rateScopes.length) {
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-consume:${String(rateScopes[0].organization_id)}`,
        20,
        '1 hour',
      );
    }
    type ConsumeOutcome = MutationResult | { unavailable: true };
    let outcome: ConsumeOutcome;
    try {
      outcome = await withRepeatableReadRetry<ConsumeOutcome>(async (tx) => {
        const actors = await tx`
          SELECT id FROM app_users WHERE id = ${actor.userId} FOR KEY SHARE`;
        if (!actors.length) {
          throw new TeachingApiException('UNAUTHENTICATED', 401, 'Authentication required');
        }
        const inviteIdentity = await tx`
          SELECT organization_id, student_id
          FROM student_account_binding_invites
          WHERE token_hash = ${input.tokenHash}`;
        if (!inviteIdentity.length) return { unavailable: true };
        const organizationId = String(inviteIdentity[0].organization_id);
        const studentId = String(inviteIdentity[0].student_id);
        const students = await tx`
          SELECT student.id, student.display_name, student.status,
                 student.account_user_id, student.account_linked_at,
                 organization.name AS organization_name, organization.status AS organization_status
          FROM student_profiles student
          JOIN organizations organization ON organization.id = student.organization_id
          WHERE student.organization_id = ${organizationId} AND student.id = ${studentId}
          FOR UPDATE OF student`;
        if (!students.length) return { unavailable: true };
        const student = students[0] as Record<string, unknown>;
        const invites = await tx`
          WITH database_clock AS MATERIALIZED (
            SELECT clock_timestamp() AS database_now
          )
          SELECT invite.*, database_clock.database_now
          FROM student_account_binding_invites invite
          CROSS JOIN database_clock
          WHERE invite.token_hash = ${input.tokenHash}
            AND invite.organization_id = ${organizationId}
            AND invite.student_id = ${studentId}
          FOR UPDATE OF invite`;
        if (!invites.length) return { unavailable: true };
        let invite = invites[0] as Record<string, unknown>;

        const consumedBySameActor = invite.consumed_at != null
          && Number(invite.consumed_by_user_id_snapshot) === actor.userId
          && Number(student.account_user_id) === actor.userId;
        if (consumedBySameActor) {
          return {
            status: 200,
            body: {
              invite: {
                id: String(invite.id), status: 'consumed', expiresAt: iso(invite.expires_at),
                consumedAt: iso(invite.consumed_at), createdAt: iso(invite.created_at),
              },
              student: {
                id: studentId, organizationName: String(student.organization_name),
                displayName: String(student.display_name), accountLinkedAt: iso(student.account_linked_at),
              },
            },
          };
        }

        const operationInstant = iso(invite.database_now);
        const databaseNow = new Date(operationInstant).getTime();
        const linkedToAnotherAccount = student.account_user_id != null
          && Number(student.account_user_id) !== actor.userId;
        if (
          invite.expired_at != null || invite.revoked_at != null || invite.consumed_at != null
          || new Date(String(invite.expires_at)).getTime() <= databaseNow
          || linkedToAnotherAccount
          || student.organization_status !== 'active' || student.status !== 'active'
        ) {
          if (
            invite.expired_at == null && invite.revoked_at == null && invite.consumed_at == null
            && new Date(String(invite.expires_at)).getTime() <= databaseNow
          ) {
            const expired = await tx`
              UPDATE student_account_binding_invites
              SET expired_at = GREATEST(expires_at, ${operationInstant})
              WHERE id = ${String(invite.id)}
              RETURNING *`;
            invite = expired[0] as Record<string, unknown>;
          }
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, outcome, request_id, metadata
            ) VALUES (
              ${organizationId}, ${actor.userId},
              (SELECT role FROM organization_members
               WHERE organization_id = ${organizationId} AND user_id = ${actor.userId}),
              ${actor.displayName}, 'student.account-binding.consume',
              'student_account_binding_invite', ${String(invite.id)}, 'denied', ${requestId},
              ${sql.json({ reason: linkedToAnotherAccount ? 'STUDENT_ALREADY_LINKED' : 'INVITE_UNAVAILABLE' })}
            )`;
          return { unavailable: true };
        }
        if (student.account_user_id == null) {
          const linked = await tx`
            UPDATE student_profiles
            SET account_user_id = ${actor.userId}, account_linked_at = ${operationInstant}
            WHERE organization_id = ${organizationId} AND id = ${studentId}
              AND account_user_id IS NULL
            RETURNING account_linked_at`;
          if (!linked.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Student account binding changed concurrently');
          }
          student.account_linked_at = linked[0].account_linked_at;
        }
        const consumed = await tx`
          UPDATE student_account_binding_invites
          SET consumed_at = ${operationInstant},
              consumed_by_user_id = ${actor.userId},
              consumed_by_user_id_snapshot = ${actor.userId}
          WHERE id = ${String(invite.id)}
            AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
            AND expires_at > ${operationInstant}
          RETURNING *`;
        if (!consumed.length) {
          throw new TeachingApiException(
            'RESOURCE_NOT_FOUND',
            404,
            'Student account binding invite not found',
          );
        }
        invite = consumed[0] as Record<string, unknown>;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${organizationId}, ${actor.userId},
            (SELECT role FROM organization_members
             WHERE organization_id = ${organizationId} AND user_id = ${actor.userId}),
            ${actor.displayName}, 'student.account-binding.consume',
            'student_account_binding_invite', ${String(invite.id)}, ${requestId},
            ${sql.json({ studentId })}
          )`;
        return {
          status: 200,
          body: {
            invite: {
              id: String(invite.id), status: 'consumed', expiresAt: iso(invite.expires_at),
              consumedAt: iso(invite.consumed_at), createdAt: iso(invite.created_at),
            },
            student: {
              id: studentId, organizationName: String(student.organization_name),
              displayName: String(student.display_name), accountLinkedAt: iso(student.account_linked_at),
            },
          },
        };
      });
    } catch (error) {
      if (error instanceof TeachingApiException) throw error;
      const code = (error as { code?: string }).code;
      if (code === '23514' || code === '55000') {
        throw new TeachingApiException(
          'RESOURCE_NOT_FOUND',
          404,
          'Student account binding invite not found',
        );
      }
      uniqueConflict(error, 'This account is already linked to another student in the organization');
    }
    if ('unavailable' in outcome) {
      throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student account binding invite not found');
    }
    return outcome;
  },
};
