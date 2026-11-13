import { sql } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { lockConversationActorScope } from '../access/learner.js';
import { conversationRow, conversationDisplayName, conversationMessageRow } from '../serialization/conversations.js';
import { type PageResult, type MutationResult, type JsonObject } from '../types.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency } from '../transactions.js';
import { lockConversationRecipientUsers, conversationRecipients, appendConversationMessage, insertConversationAudit, upsertConversationParticipant } from '../conversations/messages.js';
import { ConcealedTeachingPermissionDeniedException, TeachingApiException } from '../errors.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const conversationsRepository: Pick<TeachingSaasRepository,
  'listConversations' | 'createConversation' | 'getConversation' | 'listConversationMessages' | 'replyConversation' | 'markConversationRead'> = {
  async listConversations(actor, slug, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'conversation.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        const totals = await tx`
          SELECT COUNT(*)::int AS total
          FROM teaching_conversations conversation
          WHERE conversation.organization_id = ${scope.organization.id}
            AND conversation.student_id = ${scope.student.id}`;
        const rows = await tx`
          SELECT conversation.*, organization.slug AS organization_slug,
                 organization.name AS organization_name,
                 COALESCE(participant.last_read_sequence, 0) AS last_read_sequence
          FROM teaching_conversations conversation
          JOIN organizations organization ON organization.id = conversation.organization_id
          LEFT JOIN teaching_conversation_participants participant
            ON participant.organization_id = conversation.organization_id
           AND participant.conversation_id = conversation.id
           AND participant.participant_user_id = ${actor.userId}
          WHERE conversation.organization_id = ${scope.organization.id}
            AND conversation.student_id = ${scope.student.id}
          ORDER BY conversation.last_message_at DESC, conversation.id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map((row) => conversationRow(row as Record<string, unknown>)),
          total: Number(totals[0]?.total ?? 0),
          page: pagination.page,
          pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async createConversation(
    actor, slug, studentId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, 'conversation.create', 60, '1 hour');
    return withDeniedAccessAudit(actor, slug, 'conversation.create', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'write');
        const recipients = await lockConversationRecipientUsers(
          tx,
          await conversationRecipients(tx, scope, actor.userId),
        );
        const idem = await beginIdempotency(
          tx, actor.userId, scope.organization.id,
          `conversation.create:${studentId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        const displayName = conversationDisplayName(actor, scope);
        const inserted = await tx`
          INSERT INTO teaching_conversations (
            organization_id, student_id, student_display_name_snapshot, subject,
            created_by_user_id, created_by_display_name_snapshot,
            created_by_role_snapshot, created_by_relationship_snapshot
          ) VALUES (
            ${scope.organization.id}, ${scope.student.id}, ${scope.student.displayName}, ${input.subject},
            ${actor.userId}, ${displayName}, ${scope.role}, ${scope.relationship}
          )
          RETURNING id`;
        const conversationId = String(inserted[0].id);
        const appended = await appendConversationMessage(
          tx, actor, scope, conversationId, input.subject, input.body, recipients,
        );
        const rows = await tx`
          SELECT conversation.*, ${scope.organization.slug}::text AS organization_slug,
                 ${scope.organization.name}::text AS organization_name,
                 participant.last_read_sequence
          FROM teaching_conversations conversation
          JOIN teaching_conversation_participants participant
            ON participant.organization_id = conversation.organization_id
           AND participant.conversation_id = conversation.id
           AND participant.participant_user_id = ${actor.userId}
          WHERE conversation.organization_id = ${scope.organization.id}
            AND conversation.id = ${conversationId}
            AND conversation.student_id = ${scope.student.id}`;
        const result: MutationResult = {
          status: 201,
          body: {
            conversation: conversationRow(rows[0] as Record<string, unknown>),
            message: appended.message,
          },
        };
        await insertConversationAudit(
          tx, actor, scope, 'conversation.create', 'teaching_conversation',
          conversationId, requestId, { studentId },
        );
        await completeIdempotency(tx, idem.id, result, 'teaching_conversation', conversationId);
        return result;
      }) as MutationResult;
    });
  },

  async getConversation(actor, slug, studentId, conversationId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'conversation.read', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        const rows = await tx`
          SELECT conversation.*, ${scope.organization.slug}::text AS organization_slug,
                 ${scope.organization.name}::text AS organization_name,
                 COALESCE(participant.last_read_sequence, 0) AS last_read_sequence
          FROM teaching_conversations conversation
          LEFT JOIN teaching_conversation_participants participant
            ON participant.organization_id = conversation.organization_id
           AND participant.conversation_id = conversation.id
           AND participant.participant_user_id = ${actor.userId}
          WHERE conversation.organization_id = ${scope.organization.id}
            AND conversation.id = ${conversationId}
            AND conversation.student_id = ${scope.student.id}
          FOR SHARE OF conversation`;
        if (!rows.length) {
          throw new ConcealedTeachingPermissionDeniedException('Conversation not found');
        }
        return conversationRow(rows[0] as Record<string, unknown>);
      }) as JsonObject;
    });
  },

  async listConversationMessages(
    actor, slug, studentId, conversationId, pagination, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'conversation.message.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        const conversations = await tx`
          SELECT id FROM teaching_conversations
          WHERE organization_id = ${scope.organization.id}
            AND id = ${conversationId} AND student_id = ${scope.student.id}
          FOR SHARE`;
        if (!conversations.length) {
          throw new ConcealedTeachingPermissionDeniedException('Conversation not found');
        }
        const rows = await tx`
          SELECT * FROM teaching_conversation_messages
          WHERE organization_id = ${scope.organization.id}
            AND conversation_id = ${conversationId}
            AND student_id = ${scope.student.id}
            AND sequence > ${pagination.afterSequence}
          ORDER BY sequence
          LIMIT ${pagination.limit + 1}`;
        const hasMore = rows.length > pagination.limit;
        const visible = hasMore ? rows.slice(0, pagination.limit) : rows;
        const nextAfterSequence = visible.length
          ? Number(visible[visible.length - 1].sequence)
          : pagination.afterSequence;
        return {
          items: visible.map((row) => conversationMessageRow(row as Record<string, unknown>)),
          afterSequence: pagination.afterSequence,
          nextAfterSequence,
          hasMore,
        };
      });
    });
  },

  async replyConversation(
    actor, slug, studentId, conversationId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `conversation.reply:${conversationId}`, 120, '1 hour');
    return withDeniedAccessAudit(actor, slug, 'conversation.message.send', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'write');
        const recipients = await lockConversationRecipientUsers(
          tx,
          await conversationRecipients(tx, scope, actor.userId),
        );
        const conversations = await tx`
          SELECT subject FROM teaching_conversations
          WHERE organization_id = ${scope.organization.id}
            AND id = ${conversationId} AND student_id = ${scope.student.id}
          FOR UPDATE`;
        if (!conversations.length) {
          throw new ConcealedTeachingPermissionDeniedException('Conversation not found');
        }
        const idem = await beginIdempotency(
          tx, actor.userId, scope.organization.id,
          `conversation.message.send:${conversationId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        const appended = await appendConversationMessage(
          tx, actor, scope, conversationId, String(conversations[0].subject), input.body, recipients,
        );
        const result: MutationResult = {
          status: 201,
          body: {
            message: appended.message,
            conversation: {
              id: conversationId,
              lastMessageSequence: appended.lastMessageSequence,
              lastMessageAt: appended.lastMessageAt,
              lastReadSequence: appended.lastMessageSequence,
              unreadCount: 0,
            },
          },
        };
        await insertConversationAudit(
          tx, actor, scope, 'conversation.message.send', 'teaching_conversation_message',
          String(appended.message.id), requestId, { conversationId, studentId },
        );
        await completeIdempotency(
          tx, idem.id, result, 'teaching_conversation_message', String(appended.message.id),
        );
        return result;
      }) as MutationResult;
    });
  },

  async markConversationRead(
    actor, slug, studentId, conversationId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `conversation.read:${conversationId}`, 240, '1 hour');
    return withDeniedAccessAudit(actor, slug, 'conversation.read.mark', requestId, async () => {
      return await sql.begin(async (tx) => {
        const scope = await lockConversationActorScope(tx, actor, slug, studentId, 'read');
        const conversations = await tx`
          SELECT last_message_sequence FROM teaching_conversations
          WHERE organization_id = ${scope.organization.id}
            AND id = ${conversationId} AND student_id = ${scope.student.id}
          FOR SHARE`;
        if (!conversations.length) {
          throw new ConcealedTeachingPermissionDeniedException('Conversation not found');
        }
        const lastMessageSequence = Number(conversations[0].last_message_sequence);
        if (input.lastReadSequence > lastMessageSequence) {
          throw new TeachingApiException(
            'INVALID_INPUT', 400, 'lastReadSequence cannot exceed the latest message sequence',
          );
        }
        const idem = await beginIdempotency(
          tx, actor.userId, scope.organization.id,
          `conversation.read.mark:${conversationId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        const lastReadSequence = await upsertConversationParticipant(
          tx, scope, conversationId, actor.userId, conversationDisplayName(actor, scope),
          scope.role, scope.relationship, input.lastReadSequence,
        );
        await tx`
          UPDATE notifications SET read_at = COALESCE(read_at, NOW())
          WHERE user_key = ${scope.actorOwnerKey}
            AND kind = 'teaching_message'
            AND dedupe_key LIKE ${`teaching-message:${conversationId}:%`}
            AND split_part(dedupe_key, ':', 3) ~ '^[0-9]+$'
            AND split_part(dedupe_key, ':', 3)::integer <= ${lastReadSequence}
            AND read_at IS NULL`;
        const result: MutationResult = {
          status: 200,
          body: { read: { conversationId, lastReadSequence } },
        };
        await completeIdempotency(tx, idem.id, result, 'teaching_conversation_read', conversationId);
        return result;
      }) as MutationResult;
    });
  },
};
