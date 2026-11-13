import { randomBytes } from 'node:crypto';
import { sql, query } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requireWritable, requirePermission, accessForWrite } from '../access/organization.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency, withRepeatableReadRetry } from '../transactions.js';
import { sha256 } from '../encoding.js';
import { TeachingApiException, uniqueConflict, crmConflict } from '../errors.js';
import { guardianBindingInviteToJson } from '../serialization/bindings.js';
import { type MutationResult } from '../types.js';
import { iso } from '../serialization/common.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const guardianBindingsRepository: Pick<TeachingSaasRepository,
  'createGuardianAccountBindingInvite' | 'getCurrentGuardianAccountBindingInvite' | 'revokeGuardianAccountBindingInvite' | 'previewGuardianAccountBindingInvite' | 'consumeGuardianAccountBindingInvite'> = {
  async createGuardianAccountBindingInvite(
    actor, slug, studentId, guardianLinkId, input, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'guardian.account-binding.invite.create', requestId, async () => {
      const initialAccess = await accessForRead(actor.userId, slug);
      requireWritable(initialAccess);
      requirePermission(initialAccess, 'student:manage');
      await consumeMutationAttempt(
        actor.userId,
        `guardian-binding-invite:${initialAccess.id}`,
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
          const guardians = await tx`
            SELECT guardian.id, guardian.status, guardian.guardian_user_id,
                   student.status AS student_status
            FROM guardian_links guardian
            JOIN student_profiles student
              ON student.organization_id = guardian.organization_id
             AND student.id = guardian.student_id
            WHERE guardian.organization_id = ${access.id}
              AND guardian.student_id = ${studentId}
              AND guardian.id = ${guardianLinkId}
            FOR UPDATE OF guardian`;
          if (!guardians.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian link not found');
          }
          const guardian = guardians[0] as Record<string, unknown>;
          if (guardian.status !== 'active' || guardian.student_status !== 'active') {
            throw new TeachingApiException('CONFLICT', 409, 'Only an active guardian link can be linked');
          }
          if (guardian.guardian_user_id != null) {
            throw new TeachingApiException('CONFLICT', 409, 'Guardian link already has a linked account');
          }
          await tx`
            UPDATE guardian_account_binding_invites
            SET expired_at = GREATEST(expires_at, clock_timestamp())
            WHERE organization_id = ${access.id}
              AND guardian_link_id = ${guardianLinkId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
              AND expires_at <= clock_timestamp()`;
          await tx`
            UPDATE guardian_account_binding_invites
            SET revoked_at = GREATEST(created_at, clock_timestamp()),
                revoked_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id}
              AND guardian_link_id = ${guardianLinkId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL`;
          const rows = await tx`
            INSERT INTO guardian_account_binding_invites (
              organization_id, guardian_link_id, token_hash, expires_at, created_by_user_id
            ) VALUES (
              ${access.id}, ${guardianLinkId}, ${tokenHash},
              clock_timestamp() + make_interval(mins => ${input.expiresInMinutes}),
              ${actor.userId}
            )
            RETURNING *, clock_timestamp() AS database_now`;
          const invite = guardianBindingInviteToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'guardian.account-binding.invite.create', 'guardian_account_binding_invite',
              ${String(rows[0].id)}, ${requestId},
              ${sql.json({ studentId, guardianLinkId, expiresAt: invite.expiresAt })}
            )`;
          return { status: 201, body: { invite, token } } satisfies MutationResult;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        uniqueConflict(error, 'A guardian account binding invite could not be issued concurrently');
      }
    });
  },

  async getCurrentGuardianAccountBindingInvite(
    actor, slug, studentId, guardianLinkId, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'guardian.account-binding.invite.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'student:manage');
      const guardians = await query<Record<string, unknown>>(
        `SELECT id FROM guardian_links
         WHERE organization_id = ? AND student_id = ? AND id = ?`,
        [access.id, studentId, guardianLinkId],
      );
      if (!guardians.length) {
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian link not found');
      }
      const rows = await query<Record<string, unknown>>(
        `WITH database_clock AS MATERIALIZED (
           SELECT clock_timestamp() AS database_now
         )
         SELECT invite.*, database_clock.database_now
         FROM guardian_account_binding_invites invite
         CROSS JOIN database_clock
         WHERE invite.organization_id = ? AND invite.guardian_link_id = ?
           AND invite.expired_at IS NULL
           AND invite.consumed_at IS NULL
           AND invite.revoked_at IS NULL
           AND invite.expires_at > database_clock.database_now
         ORDER BY invite.created_at DESC, invite.id DESC
         LIMIT 1`,
        [access.id, guardianLinkId],
      );
      return { invite: rows.length ? guardianBindingInviteToJson(rows[0]) : null };
    });
  },

  async revokeGuardianAccountBindingInvite(
    actor, slug, studentId, guardianLinkId, inviteId,
    idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'guardian.account-binding.invite.revoke', requestId, async () => {
      const initialAccess = await accessForRead(actor.userId, slug);
      requireWritable(initialAccess);
      requirePermission(initialAccess, 'student:manage');
      await consumeMutationAttempt(
        actor.userId,
        `guardian-binding-invite-revoke:${initialAccess.id}`,
        60,
        '1 minute',
      );
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'student:manage');
          const guardians = await tx`
            SELECT id FROM guardian_links
            WHERE organization_id = ${access.id}
              AND student_id = ${studentId} AND id = ${guardianLinkId}
            FOR UPDATE`;
          if (!guardians.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian link not found');
          }
          const rows = await tx`
            SELECT invite.*, clock_timestamp() AS database_now
            FROM guardian_account_binding_invites invite
            WHERE invite.organization_id = ${access.id}
              AND invite.guardian_link_id = ${guardianLinkId}
              AND invite.id = ${inviteId}
            FOR UPDATE`;
          if (!rows.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian account binding invite not found');
          }
          const idem = await beginIdempotency(
            tx,
            actor.userId,
            access.id,
            `guardian.account-binding.invite.revoke:${inviteId}`,
            idempotencyKey,
            requestHash,
          );
          if ('replay' in idem) return idem.replay;
          const existing = rows[0] as Record<string, unknown>;
          if (
            existing.expired_at != null || existing.consumed_at != null || existing.revoked_at != null
            || new Date(String(existing.expires_at)).getTime()
              <= new Date(String(existing.database_now)).getTime()
          ) {
            throw new TeachingApiException('CONFLICT', 409, 'Only a current pending invite can be revoked');
          }
          const revoked = await tx`
            UPDATE guardian_account_binding_invites
            SET revoked_at = GREATEST(created_at, clock_timestamp()),
                revoked_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id}
              AND guardian_link_id = ${guardianLinkId}
              AND id = ${inviteId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
              AND expires_at > clock_timestamp()
            RETURNING *, clock_timestamp() AS database_now`;
          if (!revoked.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Guardian account binding invite changed concurrently');
          }
          const invite = guardianBindingInviteToJson(revoked[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'guardian.account-binding.invite.revoke', 'guardian_account_binding_invite',
              ${inviteId}, ${requestId},
              ${sql.json({ studentId, guardianLinkId, reason: 'manual_revoke' })}
            )`;
          const result: MutationResult = { status: 200, body: { invite } };
          await completeIdempotency(tx, idem.id, result, 'guardian_account_binding_invite', inviteId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Guardian account binding invite could not be revoked');
      }
    });
  },

  async previewGuardianAccountBindingInvite(actor, input, requestId) {
    await consumeMutationAttempt(actor.userId, 'guardian-binding-preview', 120, '1 hour');
    const rows = await query<Record<string, unknown>>(
      `SELECT invite.id, invite.organization_id, invite.guardian_link_id,
              invite.expires_at, invite.expired_at, invite.consumed_at, invite.revoked_at,
              organization.name AS organization_name, organization.status AS organization_status,
              student.display_name AS student_display_name, student.status AS student_status,
              guardian.relationship, guardian.status AS guardian_status,
              guardian.guardian_user_id, clock_timestamp() AS database_now
       FROM guardian_account_binding_invites invite
       JOIN organizations organization ON organization.id = invite.organization_id
       JOIN guardian_links guardian
         ON guardian.organization_id = invite.organization_id AND guardian.id = invite.guardian_link_id
       JOIN student_profiles student
         ON student.organization_id = guardian.organization_id AND student.id = guardian.student_id
       WHERE invite.token_hash = ?`,
      [input.tokenHash],
    );
    if (rows.length) {
      const row = rows[0];
      await consumeMutationAttempt(
        actor.userId,
        `guardian-binding-preview:${String(row.organization_id)}`,
        30,
        '1 hour',
      );
      const available = row.expired_at == null
        && row.consumed_at == null
        && row.revoked_at == null
        && new Date(String(row.expires_at)).getTime() > new Date(String(row.database_now)).getTime()
        && row.organization_status === 'active'
        && row.student_status === 'active'
        && row.guardian_status === 'active'
        && row.guardian_user_id == null;
      if (available) {
        return {
          organizationName: String(row.organization_name),
          studentDisplayName: String(row.student_display_name),
          relationship: String(row.relationship),
          expiresAt: iso(row.expires_at),
        };
      }
    }
    throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian account binding invite not found');
  },

  async consumeGuardianAccountBindingInvite(actor, input, requestId) {
    await consumeMutationAttempt(actor.userId, 'guardian-binding-consume', 60, '1 hour');
    const rateScopes = await query<Record<string, unknown>>(
      `SELECT organization_id FROM guardian_account_binding_invites WHERE token_hash = ?`,
      [input.tokenHash],
    );
    if (rateScopes.length) {
      await consumeMutationAttempt(
        actor.userId,
        `guardian-binding-consume:${String(rateScopes[0].organization_id)}`,
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
          SELECT organization_id, guardian_link_id
          FROM guardian_account_binding_invites
          WHERE token_hash = ${input.tokenHash}`;
        if (!inviteIdentity.length) return { unavailable: true };
        const organizationId = String(inviteIdentity[0].organization_id);
        const guardianLinkId = String(inviteIdentity[0].guardian_link_id);
        const guardians = await tx`
          SELECT guardian.id, guardian.student_id, guardian.relationship,
                 guardian.status, guardian.guardian_user_id, guardian.account_linked_at,
                 student.display_name AS student_display_name, student.status AS student_status,
                 organization.name AS organization_name, organization.status AS organization_status
          FROM guardian_links guardian
          JOIN organizations organization ON organization.id = guardian.organization_id
          JOIN student_profiles student
            ON student.organization_id = guardian.organization_id AND student.id = guardian.student_id
          WHERE guardian.organization_id = ${organizationId} AND guardian.id = ${guardianLinkId}
          FOR UPDATE OF guardian`;
        if (!guardians.length) return { unavailable: true };
        const guardian = guardians[0] as Record<string, unknown>;
        const invites = await tx`
          WITH database_clock AS MATERIALIZED (
            SELECT clock_timestamp() AS database_now
          )
          SELECT invite.*, database_clock.database_now
          FROM guardian_account_binding_invites invite
          CROSS JOIN database_clock
          WHERE invite.token_hash = ${input.tokenHash}
            AND invite.organization_id = ${organizationId}
            AND invite.guardian_link_id = ${guardianLinkId}
          FOR UPDATE OF invite`;
        if (!invites.length) return { unavailable: true };
        let invite = invites[0] as Record<string, unknown>;
        const studentId = String(guardian.student_id);
        const consumedBySameActor = invite.consumed_at != null
          && Number(invite.consumed_by_user_id_snapshot) === actor.userId
          && Number(guardian.guardian_user_id) === actor.userId;
        if (consumedBySameActor) {
          return {
            status: 200,
            body: {
              invite: {
                id: String(invite.id), status: 'consumed', expiresAt: iso(invite.expires_at),
                consumedAt: iso(invite.consumed_at), createdAt: iso(invite.created_at),
              },
              guardian: {
                guardianLinkId, studentId,
                organizationName: String(guardian.organization_name),
                studentDisplayName: String(guardian.student_display_name),
                relationship: String(guardian.relationship),
                accountLinkedAt: iso(guardian.account_linked_at),
              },
            },
          };
        }
        const operationInstant = iso(invite.database_now);
        const databaseNow = new Date(operationInstant).getTime();
        const linkedToAnotherAccount = guardian.guardian_user_id != null
          && Number(guardian.guardian_user_id) !== actor.userId;
        if (
          invite.expired_at != null || invite.revoked_at != null || invite.consumed_at != null
          || new Date(String(invite.expires_at)).getTime() <= databaseNow
          || linkedToAnotherAccount
          || guardian.organization_status !== 'active'
          || guardian.student_status !== 'active'
          || guardian.status !== 'active'
        ) {
          if (
            invite.expired_at == null && invite.revoked_at == null && invite.consumed_at == null
            && new Date(String(invite.expires_at)).getTime() <= databaseNow
          ) {
            const expired = await tx`
              UPDATE guardian_account_binding_invites
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
              ${actor.displayName}, 'guardian.account-binding.consume',
              'guardian_account_binding_invite', ${String(invite.id)}, 'denied', ${requestId},
              ${sql.json({ reason: linkedToAnotherAccount ? 'GUARDIAN_ALREADY_LINKED' : 'INVITE_UNAVAILABLE' })}
            )`;
          return { unavailable: true };
        }
        const linked = await tx`
          UPDATE guardian_links
          SET guardian_user_id = ${actor.userId}, account_linked_at = ${operationInstant}
          WHERE organization_id = ${organizationId} AND id = ${guardianLinkId}
            AND guardian_user_id IS NULL AND status = 'active'
          RETURNING account_linked_at`;
        if (!linked.length) {
          throw new TeachingApiException('CONFLICT', 409, 'Guardian account binding changed concurrently');
        }
        guardian.account_linked_at = linked[0].account_linked_at;
        const consumed = await tx`
          UPDATE guardian_account_binding_invites
          SET consumed_at = ${operationInstant},
              consumed_by_user_id = ${actor.userId},
              consumed_by_user_id_snapshot = ${actor.userId}
          WHERE id = ${String(invite.id)}
            AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
            AND expires_at > ${operationInstant}
          RETURNING *`;
        if (!consumed.length) {
          throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian account binding invite not found');
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
            ${actor.displayName}, 'guardian.account-binding.consume',
            'guardian_account_binding_invite', ${String(invite.id)}, ${requestId},
            ${sql.json({ studentId, guardianLinkId })}
          )`;
        return {
          status: 200,
          body: {
            invite: {
              id: String(invite.id), status: 'consumed', expiresAt: iso(invite.expires_at),
              consumedAt: iso(invite.consumed_at), createdAt: iso(invite.created_at),
            },
            guardian: {
              guardianLinkId, studentId,
              organizationName: String(guardian.organization_name),
              studentDisplayName: String(guardian.student_display_name),
              relationship: String(guardian.relationship),
              accountLinkedAt: iso(guardian.account_linked_at),
            },
          },
        };
      });
    } catch (error) {
      if (error instanceof TeachingApiException) throw error;
      const code = (error as { code?: string }).code;
      if (code === '23514' || code === '55000') {
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian account binding invite not found');
      }
      uniqueConflict(error, 'This account is already linked to this student as a guardian');
    }
    if ('unavailable' in outcome) {
      throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Guardian account binding invite not found');
    }
    return outcome;
  },
};
