import {
  type TeachingConversationActorSnapshot,
  TEACHING_CONVERSATION_ACTOR_ROLES,
  type TeachingConversationSummary,
  type TeachingConversationMessage,
  type ReplyTeachingConversationResponse,
  type TeachingConversationListResponse,
  type CreateTeachingConversationInput,
  type CreateTeachingConversationResponse,
  type TeachingConversationDetailResponse,
  type TeachingConversationMessagesResponse,
  type ReplyTeachingConversationInput,
  type MarkTeachingConversationReadInput,
  type MarkTeachingConversationReadResponse,
} from '@cuberoot/shared/teaching';
import {
  record,
  string,
  enumValue,
  nullableString,
  integer,
  boolean,
} from './validation';
import { TeachingApiError } from './errors';
import { request, post } from './transport';
import { conversationPath, pageQuery } from './pagination';

function conversationActor(value: unknown, label: string): TeachingConversationActorSnapshot {
  const item = record(value, label);
  return {
    displayName: string(item.displayName, `${label}.displayName`),
    role: enumValue(item.role, TEACHING_CONVERSATION_ACTOR_ROLES, `${label}.role`),
    relationship: nullableString(item.relationship, `${label}.relationship`),
  };
}

function conversationSummary(value: unknown): TeachingConversationSummary {
  const item = record(value, 'conversation');
  const organizationItem = record(item.organization, 'conversation.organization');
  const studentItem = record(item.student, 'conversation.student');
  return {
    id: string(item.id, 'conversation.id'),
    organization: {
      slug: string(organizationItem.slug, 'conversation.organization.slug'),
      name: string(organizationItem.name, 'conversation.organization.name'),
    },
    student: {
      id: string(studentItem.id, 'conversation.student.id'),
      displayName: string(studentItem.displayName, 'conversation.student.displayName'),
    },
    subject: string(item.subject, 'conversation.subject'),
    lastMessageSequence: integer(item.lastMessageSequence, 'conversation.lastMessageSequence', 1),
    lastMessageAt: string(item.lastMessageAt, 'conversation.lastMessageAt'),
    createdAt: string(item.createdAt, 'conversation.createdAt'),
    createdBy: conversationActor(item.createdBy, 'conversation.createdBy'),
    lastReadSequence: integer(item.lastReadSequence, 'conversation.lastReadSequence'),
    unreadCount: integer(item.unreadCount, 'conversation.unreadCount'),
  };
}

function conversationMessage(value: unknown): TeachingConversationMessage {
  const item = record(value, 'conversationMessage');
  return {
    id: string(item.id, 'conversationMessage.id'),
    conversationId: string(item.conversationId, 'conversationMessage.conversationId'),
    sequence: integer(item.sequence, 'conversationMessage.sequence', 1),
    body: string(item.body, 'conversationMessage.body'),
    author: conversationActor(item.author, 'conversationMessage.author'),
    createdAt: string(item.createdAt, 'conversationMessage.createdAt'),
  };
}

function conversationReplyState(
  value: unknown,
): ReplyTeachingConversationResponse['conversation'] {
  const item = record(value, 'conversation reply state');
  return {
    id: string(item.id, 'conversation reply state.id'),
    lastMessageSequence: integer(item.lastMessageSequence, 'conversation reply state.lastMessageSequence', 1),
    lastMessageAt: string(item.lastMessageAt, 'conversation reply state.lastMessageAt'),
    lastReadSequence: integer(item.lastReadSequence, 'conversation reply state.lastReadSequence'),
    unreadCount: integer(item.unreadCount, 'conversation reply state.unreadCount'),
  };
}

function assertConversationScope(
  item: TeachingConversationSummary,
  orgSlug: string,
  studentId: string,
): void {
  if (item.organization.slug !== orgSlug || item.student.id !== studentId) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation scope is invalid');
  }
  if (
    item.lastReadSequence > item.lastMessageSequence
    || item.unreadCount !== item.lastMessageSequence - item.lastReadSequence
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation read state is invalid');
  }
}

export async function listTeachingConversations(
  orgSlug: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingConversationListResponse> {
  const envelope = record(
    await request(conversationPath(orgSlug, studentId, pageQuery(pageNumber, pageSize))),
    'conversations',
  );
  if (!Array.isArray(envelope.conversations)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversations response is invalid');
  }
  const conversations = envelope.conversations.map(conversationSummary);
  conversations.forEach((item) => assertConversationScope(item, orgSlug, studentId));
  const total = integer(envelope.total, 'conversations.total');
  const page = integer(envelope.page, 'conversations.page', 1);
  const parsedPageSize = integer(envelope.pageSize, 'conversations.pageSize', 1);
  const safePage = Number.isSafeInteger(pageNumber) ? Math.max(1, pageNumber) : 1;
  const safePageSize = Number.isSafeInteger(pageSize) ? Math.min(100, Math.max(1, pageSize)) : 25;
  if (page !== safePage || parsedPageSize !== safePageSize || total < conversations.length) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation pagination is invalid');
  }
  return {
    conversations,
    total,
    page,
    pageSize: parsedPageSize,
  };
}

export async function createTeachingConversation(
  orgSlug: string,
  studentId: string,
  input: CreateTeachingConversationInput,
  idempotencyKey: string,
): Promise<CreateTeachingConversationResponse> {
  const envelope = record(await post(
    conversationPath(orgSlug, studentId),
    { subject: input.subject, body: input.body },
    idempotencyKey,
  ), 'conversation create');
  const conversation = conversationSummary(envelope.conversation);
  const message = conversationMessage(envelope.message);
  assertConversationScope(conversation, orgSlug, studentId);
  if (message.conversationId !== conversation.id || message.sequence !== conversation.lastMessageSequence) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation create state is invalid');
  }
  return { conversation, message };
}

export async function getTeachingConversation(
  orgSlug: string,
  studentId: string,
  conversationId: string,
): Promise<TeachingConversationDetailResponse> {
  const envelope = record(await request(conversationPath(
    orgSlug,
    studentId,
    `/${encodeURIComponent(conversationId)}`,
  )), 'conversation detail');
  const conversation = conversationSummary(envelope.conversation);
  assertConversationScope(conversation, orgSlug, studentId);
  if (conversation.id !== conversationId) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation identity is invalid');
  }
  return { conversation };
}

export async function listTeachingConversationMessages(
  orgSlug: string,
  studentId: string,
  conversationId: string,
  afterSequence = 0,
  limit = 50,
): Promise<TeachingConversationMessagesResponse> {
  const safeAfterSequence = Number.isSafeInteger(afterSequence)
    ? Math.min(2_147_483_647, Math.max(0, afterSequence))
    : 0;
  const safeLimit = Number.isSafeInteger(limit) ? Math.min(100, Math.max(1, limit)) : 50;
  const query = new URLSearchParams({
    afterSequence: String(safeAfterSequence),
    limit: String(safeLimit),
  });
  const envelope = record(await request(conversationPath(
    orgSlug,
    studentId,
    `/${encodeURIComponent(conversationId)}/messages?${query}`,
  )), 'conversation messages');
  if (!Array.isArray(envelope.messages)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation messages response is invalid');
  }
  const messages = envelope.messages.map(conversationMessage);
  const parsedAfterSequence = integer(envelope.afterSequence, 'conversation messages.afterSequence');
  const nextAfterSequence = integer(envelope.nextAfterSequence, 'conversation messages.nextAfterSequence');
  const hasMore = boolean(envelope.hasMore, 'conversation messages.hasMore');
  let previousSequence = parsedAfterSequence;
  for (const message of messages) {
    if (message.conversationId !== conversationId || message.sequence <= previousSequence) {
      throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation message order is invalid');
    }
    previousSequence = message.sequence;
  }
  if (
    parsedAfterSequence !== safeAfterSequence
    || nextAfterSequence !== previousSequence
    || (hasMore && messages.length === 0)
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation message cursor is invalid');
  }
  return { messages, afterSequence: parsedAfterSequence, nextAfterSequence, hasMore };
}

export async function replyTeachingConversation(
  orgSlug: string,
  studentId: string,
  conversationId: string,
  input: ReplyTeachingConversationInput,
  idempotencyKey: string,
): Promise<ReplyTeachingConversationResponse> {
  const envelope = record(await post(conversationPath(
    orgSlug,
    studentId,
    `/${encodeURIComponent(conversationId)}/messages`,
  ), { body: input.body }, idempotencyKey), 'conversation reply');
  const message = conversationMessage(envelope.message);
  const conversation = conversationReplyState(envelope.conversation);
  if (
    message.conversationId !== conversationId
    || conversation.id !== conversationId
    || message.sequence !== conversation.lastMessageSequence
    || conversation.lastReadSequence !== conversation.lastMessageSequence
    || conversation.unreadCount !== 0
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation reply state is invalid');
  }
  return { message, conversation };
}

export async function markTeachingConversationRead(
  orgSlug: string,
  studentId: string,
  conversationId: string,
  input: MarkTeachingConversationReadInput,
  idempotencyKey: string,
): Promise<MarkTeachingConversationReadResponse> {
  const envelope = record(await post(conversationPath(
    orgSlug,
    studentId,
    `/${encodeURIComponent(conversationId)}/read`,
  ), { lastReadSequence: input.lastReadSequence }, idempotencyKey), 'conversation read');
  const readItem = record(envelope.read, 'conversation read state');
  const read = {
    conversationId: string(readItem.conversationId, 'conversation read state.conversationId'),
    lastReadSequence: integer(readItem.lastReadSequence, 'conversation read state.lastReadSequence'),
  };
  if (read.conversationId !== conversationId || read.lastReadSequence < input.lastReadSequence) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation read state is invalid');
  }
  return { read };
}
