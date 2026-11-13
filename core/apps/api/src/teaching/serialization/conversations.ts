import { type TeachingActor } from '../../utils/teaching_platform_assertion.js';
import { type ConversationActorScope, type JsonObject } from '../types.js';
import { iso } from './common.js';

export function conversationDisplayName(actor: TeachingActor, scope: ConversationActorScope): string {
  const displayName = actor.displayName.trim();
  if (displayName) return displayName;
  if (scope.role === 'student') return scope.student.displayName;
  return scope.role === 'guardian' ? 'Guardian' : 'Staff';
}

export function conversationRow(row: Record<string, unknown>): JsonObject {
  const lastMessageSequence = Number(row.last_message_sequence);
  const lastReadSequence = Number(row.last_read_sequence ?? 0);
  return {
    id: String(row.id),
    organization: { slug: String(row.organization_slug), name: String(row.organization_name) },
    student: { id: String(row.student_id), displayName: String(row.student_display_name_snapshot) },
    subject: String(row.subject),
    lastMessageSequence,
    lastMessageAt: iso(row.last_message_at),
    createdAt: iso(row.created_at),
    createdBy: {
      displayName: String(row.created_by_display_name_snapshot),
      role: String(row.created_by_role_snapshot),
      relationship: row.created_by_relationship_snapshot == null
        ? null : String(row.created_by_relationship_snapshot),
    },
    lastReadSequence,
    unreadCount: Math.max(0, lastMessageSequence - lastReadSequence),
  };
}

export function conversationMessageRow(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    sequence: Number(row.sequence),
    body: String(row.body),
    author: {
      displayName: String(row.author_display_name_snapshot),
      role: String(row.author_role_snapshot),
      relationship: row.author_relationship_snapshot == null
        ? null : String(row.author_relationship_snapshot),
    },
    createdAt: iso(row.created_at),
  };
}
