import { type TeachingConversationActorRole } from '@cuberoot/shared/teaching';
import { type TeachingActor } from '../../utils/teaching_platform_assertion.js';
import { sql } from '../../db/connection.js';
import { type Tx, type ConversationActorScope, type JsonObject } from '../types.js';
import { ConcealedTeachingPermissionDeniedException } from '../errors.js';
import { conversationDisplayName, conversationMessageRow } from '../serialization/conversations.js';
import { iso } from '../serialization/common.js';

export async function conversationRecipients(
  tx: Tx,
  scope: ConversationActorScope,
  excludedUserId: number,
): Promise<Array<Record<string, unknown>>> {
  const rows = await tx`
    WITH eligible AS (
      SELECT member.user_id, member.role::text AS role, NULL::text AS relationship,
             app.display_name, app.wca_id, 0 AS priority
      FROM organization_members member
      JOIN app_users app ON app.id = member.user_id
      WHERE member.organization_id = ${scope.organization.id}
        AND member.status = 'active'
        AND member.role IN ('owner', 'admin')
      UNION ALL
      SELECT member.user_id, member.role::text, NULL::text,
             app.display_name, app.wca_id, 1
      FROM organization_members member
      JOIN app_users app ON app.id = member.user_id
      WHERE member.organization_id = ${scope.organization.id}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
        AND (
          EXISTS (
            SELECT 1 FROM teacher_assignments assignment
            WHERE assignment.organization_id = member.organization_id
              AND assignment.teacher_user_id = member.user_id
              AND assignment.student_id = ${scope.student.id}
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
          ) OR EXISTS (
            SELECT 1
            FROM teacher_assignments assignment
            JOIN teaching_groups teaching_group
              ON teaching_group.organization_id = assignment.organization_id
             AND teaching_group.id = assignment.group_id
             AND teaching_group.status = 'active'
            LEFT JOIN teaching_campuses campus
              ON campus.organization_id = teaching_group.organization_id
             AND campus.id = teaching_group.campus_id
            JOIN student_group_memberships membership
              ON membership.organization_id = assignment.organization_id
             AND membership.group_id = assignment.group_id
             AND membership.student_id = ${scope.student.id}
             AND membership.effective_from <= clock_timestamp()
             AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
            WHERE assignment.organization_id = member.organization_id
              AND assignment.teacher_user_id = member.user_id
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
              AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
          )
        )
      UNION ALL
      SELECT student.account_user_id, 'student', NULL::text,
             app.display_name, app.wca_id, 2
      FROM student_profiles student
      JOIN app_users app ON app.id = student.account_user_id
      WHERE student.organization_id = ${scope.organization.id}
        AND student.id = ${scope.student.id}
        AND student.status = 'active'
      UNION ALL
      SELECT guardian.guardian_user_id, 'guardian', guardian.relationship,
             app.display_name, app.wca_id, 3
      FROM guardian_links guardian
      JOIN app_users app ON app.id = guardian.guardian_user_id
      WHERE guardian.organization_id = ${scope.organization.id}
        AND guardian.student_id = ${scope.student.id}
        AND guardian.status = 'active'
    )
    SELECT DISTINCT ON (user_id)
      user_id, role, relationship,
      COALESCE(NULLIF(btrim(display_name), ''),
        CASE WHEN role = 'student' THEN ${scope.student.displayName}
             WHEN role = 'guardian' THEN 'Guardian' ELSE 'Staff' END) AS display_name,
      COALESCE(NULLIF(wca_id, ''), 'u' || user_id::text) AS owner_key
    FROM eligible
    WHERE user_id <> ${excludedUserId}
    ORDER BY user_id, priority`;
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function lockConversationRecipientUsers(
  tx: Tx,
  recipients: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const live = new Set<number>();
  const userIds = [...new Set(recipients.map((recipient) => Number(recipient.user_id)))]
    .sort((left, right) => left - right);
  for (const userId of userIds) {
    const rows = await tx`SELECT id FROM app_users WHERE id = ${userId} FOR KEY SHARE`;
    if (rows.length) live.add(userId);
  }
  return recipients.filter((recipient) => live.has(Number(recipient.user_id)));
}

export async function upsertConversationParticipant(
  tx: Tx,
  scope: ConversationActorScope,
  conversationId: string,
  userId: number,
  displayName: string,
  role: TeachingConversationActorRole,
  relationship: string | null,
  lastReadSequence: number,
): Promise<number> {
  const rows = await tx`
    INSERT INTO teaching_conversation_participants (
      organization_id, conversation_id, student_id, participant_user_id,
      participant_display_name_snapshot, participant_role_snapshot,
      participant_relationship_snapshot, last_read_sequence
    ) VALUES (
      ${scope.organization.id}, ${conversationId}, ${scope.student.id}, ${userId},
      ${displayName}, ${role}, ${relationship}, ${lastReadSequence}
    )
    ON CONFLICT (organization_id, conversation_id, participant_user_id)
      WHERE participant_user_id IS NOT NULL
    DO UPDATE SET last_read_sequence = GREATEST(
      teaching_conversation_participants.last_read_sequence,
      EXCLUDED.last_read_sequence
    )
    RETURNING last_read_sequence`;
  return Number(rows[0].last_read_sequence);
}

export async function appendConversationMessage(
  tx: Tx,
  actor: TeachingActor,
  scope: ConversationActorScope,
  conversationId: string,
  subject: string,
  body: string,
  recipients: Array<Record<string, unknown>>,
): Promise<{ message: JsonObject; lastMessageSequence: number; lastMessageAt: string }> {
  const allocated = await tx`
    UPDATE teaching_conversations
    SET last_message_sequence = last_message_sequence + 1,
        last_message_at = clock_timestamp()
    WHERE organization_id = ${scope.organization.id}
      AND id = ${conversationId}
      AND student_id = ${scope.student.id}
    RETURNING last_message_sequence, last_message_at`;
  if (!allocated.length) {
    throw new ConcealedTeachingPermissionDeniedException('Conversation not found');
  }
  const sequence = Number(allocated[0].last_message_sequence);
  const displayName = conversationDisplayName(actor, scope);
  const messages = await tx`
    INSERT INTO teaching_conversation_messages (
      organization_id, conversation_id, student_id, sequence, body,
      author_user_id, author_display_name_snapshot, author_role_snapshot,
      author_relationship_snapshot
    ) VALUES (
      ${scope.organization.id}, ${conversationId}, ${scope.student.id}, ${sequence}, ${body},
      ${actor.userId}, ${displayName}, ${scope.role}, ${scope.relationship}
    )
    RETURNING *`;
  await upsertConversationParticipant(
    tx, scope, conversationId, actor.userId, displayName,
    scope.role, scope.relationship, sequence,
  );
  for (const recipient of recipients) {
    await upsertConversationParticipant(
      tx, scope, conversationId, Number(recipient.user_id), String(recipient.display_name),
      recipient.role as TeachingConversationActorRole,
      recipient.relationship == null ? null : String(recipient.relationship), 0,
    );
    const isLearner = recipient.role === 'student' || recipient.role === 'guardian';
    const link = isLearner
      ? `/learn/${encodeURIComponent(scope.organization.slug)}`
        + `/students/${encodeURIComponent(scope.student.id)}`
        + `/messages/${encodeURIComponent(conversationId)}`
      : `/org/${encodeURIComponent(scope.organization.slug)}`
        + `/students/${encodeURIComponent(scope.student.id)}`
        + `/messages/${encodeURIComponent(conversationId)}`;
    await tx`
      INSERT INTO notifications (
        user_key, kind, actor_key, actor_name, title, excerpt, link, dedupe_key
      ) VALUES (
        ${String(recipient.owner_key)}, 'teaching_message', ${scope.actorOwnerKey},
        ${displayName.slice(0, 100)}, ${subject}, ${body.slice(0, 500)}, ${link},
        ${`teaching-message:${conversationId}:${sequence}`}
      )
      ON CONFLICT (user_key, kind, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`;
  }
  return {
    message: conversationMessageRow(messages[0] as Record<string, unknown>),
    lastMessageSequence: sequence,
    lastMessageAt: iso(allocated[0].last_message_at),
  };
}

export async function insertConversationAudit(
  tx: Tx,
  actor: TeachingActor,
  scope: ConversationActorScope,
  action: string,
  entityType: string,
  entityId: string,
  requestId: string,
  metadata: JsonObject,
): Promise<void> {
  const staffRole = scope.staffAccess?.role ?? null;
  await tx`
    INSERT INTO teaching_audit_events (
      organization_id, actor_user_id, actor_role, actor_display_name,
      action, entity_type, entity_id, request_id, metadata
    ) VALUES (
      ${scope.organization.id}, ${actor.userId}, ${staffRole}, ${conversationDisplayName(actor, scope)},
      ${action}, ${entityType}, ${entityId}, ${requestId},
      ${sql.json({ ...metadata, actorKind: scope.role, actorRelationship: scope.relationship })}
    )`;
}
