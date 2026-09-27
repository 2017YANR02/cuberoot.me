import type { FriendUser } from '../friends.js';

export const CHAT_BODY_LIMIT = 2_000;
export const CHAT_HTTP_BODY_LIMIT = 32 * 1024;
export const CHAT_PAGE_SIZE = 50;
export const CHAT_MESSAGE_LIMIT = 500;
export const CHAT_POLL_MS = 3_000;
export const CHAT_LIST_POLL_MS = 15_000;
export const CHAT_REQUEST_TIMEOUT_MS = 12_000;
export type ChatErrorCode = 'UNAUTHENTICATED' | 'CHAT_NOT_FOUND' | 'CHAT_UNAVAILABLE'
  | 'INVALID_INPUT' | 'IDEMPOTENCY_CONFLICT' | 'BODY_TOO_LARGE' | 'RATE_LIMITED'
  | 'INTERNAL_ERROR' | 'NETWORK_ERROR' | 'INVALID_RESPONSE';
export class ChatError extends Error {
  constructor(public readonly code: ChatErrorCode, public readonly retryAfterMs = 0) { super(code); }
}
export interface ChatMessage {
  conversationId: string;
  sequence: string;
  senderUserId: number;
  clientMessageId: string;
  body: string;
  createdAt: string;
}
export interface ChatConversation {
  id: string;
  peer: FriendUser;
  lastMessage: ChatMessage;
  lastSequence: string;
  myReadSequence: string;
  unreadCount: number;
  canSend: boolean;
}
export interface ChatConversationsPage { items: ChatConversation[]; nextCursor: string | null }
export interface ChatMessagesPage {
  conversationId: string | null;
  peer: FriendUser;
  items: ChatMessage[];
  canSend: boolean;
  myReadSequence: string;
  lastSequence: string;
  oldestSequence: string | null;
  nextAfterSequence: string;
  hasMore: boolean;
}
export interface ChatReadResult { myReadSequence: string; unreadCount: number }
export interface ChatSendInput { clientMessageId: string; body: string }
export interface ChatPageInput { before?: string; after?: string; limit?: number }
export interface ChatClient {
  conversations(cursor?: string, signal?: AbortSignal): Promise<ChatConversationsPage>;
  messages(peerId: number, page?: ChatPageInput, signal?: AbortSignal): Promise<ChatMessagesPage>;
  send(peerId: number, input: ChatSendInput, signal?: AbortSignal): Promise<ChatMessage>;
  read(peerId: number, sequence: string, signal?: AbortSignal): Promise<ChatReadResult>;
}
export function isChatSequence(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d{0,18})$/.test(value)
    && BigInt(value) <= 9223372036854775807n;
}
export function compareChatSequence(a: string, b: string): number {
  return a.length - b.length || a.localeCompare(b, 'en');
}
export function isChatUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function normalizeChatBody(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const body = value.replace(/\r\n?/g, '\n');
  const chars = Array.from(body);
  if (!body.trim() || chars.length > CHAT_BODY_LIMIT
    || chars.some((char) => char === '\0' || (char.length === 1 && /[\uD800-\uDFFF]/.test(char)))) return null;
  return body;
}
export function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const m = value as ChatMessage;
  return isChatUuid(m.conversationId) && isChatSequence(m.sequence) && m.sequence !== '0'
    && Number.isSafeInteger(m.senderUserId) && m.senderUserId > 0 && isChatUuid(m.clientMessageId)
    && normalizeChatBody(m.body) === m.body && typeof m.createdAt === 'string' && Number.isFinite(Date.parse(m.createdAt));
}
export function isChatPeer(value: unknown): value is FriendUser {
  if (!value || typeof value !== 'object') return false;
  const p = value as FriendUser;
  return Number.isSafeInteger(p.userId) && p.userId > 0 && typeof p.name === 'string'
    && (p.avatarUrl === null || typeof p.avatarUrl === 'string')
    && ['auto', 'clawd', 'upload'].includes(p.avatarSource)
    && (p.avatarPreset === null || typeof p.avatarPreset === 'string')
    && (p.wcaId === null || typeof p.wcaId === 'string');
}
