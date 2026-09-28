import {
  ChatError, CHAT_REQUEST_TIMEOUT_MS, isChatMessage, isChatPeer, isChatSequence, isChatUuid,
  type ChatClient, type ChatErrorCode, type ChatConversation, type ChatConversationsPage,
  type ChatMessagesPage, type ChatReadResult, type ChatSticker,
} from './contract';

export interface ChatTransport {
  fetch: typeof fetch;
  url(path: string): string;
  headers(): Record<string, string>;
}
function readResult(value: unknown): value is ChatReadResult {
  const v = value as ChatReadResult | null;
  return !!v && isChatSequence(v.myReadSequence) && Number.isSafeInteger(v.unreadCount) && v.unreadCount >= 0;
}
function conversation(value: unknown): value is ChatConversation {
  const v = value as ChatConversation | null;
  return !!v && isChatUuid(v.id) && isChatPeer(v.peer) && isChatMessage(v.lastMessage)
    && v.lastMessage.conversationId === v.id && readResult(v) && isChatSequence(v.lastSequence) && typeof v.canSend === 'boolean';
}
function messages(value: unknown): value is ChatMessagesPage {
  const v = value as ChatMessagesPage | null;
  return !!v && (v.conversationId === null || isChatUuid(v.conversationId)) && isChatPeer(v.peer)
    && Array.isArray(v.items) && v.items.every(isChatMessage)
    && v.items.every((m) => m.conversationId === v.conversationId)
    && isChatSequence(v.myReadSequence) && isChatSequence(v.lastSequence)
    && (v.oldestSequence === null || isChatSequence(v.oldestSequence))
    && isChatSequence(v.nextAfterSequence) && typeof v.canSend === 'boolean' && typeof v.hasMore === 'boolean';
}
const codes: ChatErrorCode[] = ['UNAUTHENTICATED', 'CHAT_NOT_FOUND', 'CHAT_UNAVAILABLE', 'INVALID_INPUT',
  'IDEMPOTENCY_CONFLICT', 'BODY_TOO_LARGE', 'RATE_LIMITED', 'INTERNAL_ERROR', 'STICKER_LIMIT'];
const sticker = (v: unknown): v is ChatSticker => !!v && typeof v === 'object' && isChatUuid((v as ChatSticker).id);
const stickers = (v: unknown): v is ChatSticker[] => Array.isArray(v) && v.every(sticker);
export function createChatClient(transport: ChatTransport): ChatClient {
  async function request<T>(path: string, validate: (value: unknown) => value is T, signal?: AbortSignal, method = 'GET', body?: unknown, binary = false): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, CHAT_REQUEST_TIMEOUT_MS);
    try {
      const raw = typeof Blob !== 'undefined' && body instanceof Blob;
      const response = await transport.fetch(transport.url(`/v1/chat${path}${path.includes('?') ? '&' : '?'}v=2`), {
        method, headers: { ...transport.headers(), ...(body === undefined ? {} : { 'Content-Type': raw ? body.type : 'application/json' }) },
        cache: 'no-store', signal: controller.signal, body: raw ? body : body === undefined ? undefined : JSON.stringify(body),
      });
      const value = binary && response.ok ? await response.blob() : await response.json().catch(() => null);
      if (!response.ok) {
        const raw = value?.error?.code;
        const code = codes.includes(raw) ? raw : response.status === 401 ? 'UNAUTHENTICATED'
          : response.status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR';
        const retry = Number(response.headers.get('Retry-After'));
        throw new ChatError(code, Number.isFinite(retry) && retry > 0 ? retry * 1000 : 0);
      }
      if (!validate(value)) throw new ChatError('INVALID_RESPONSE');
      return value;
    } catch (error) {
      if (error instanceof ChatError) throw error;
      throw new ChatError('NETWORK_ERROR');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
  return {
    stickers: {
      list: (signal) => request('/stickers', stickers, signal),
      upload: (file, signal) => request('/stickers', sticker, signal, 'POST', file),
      image: (id, signal) => request(`/stickers/${encodeURIComponent(id)}/image`, (v): v is Blob => v instanceof Blob, signal, 'GET', undefined, true),
      save: (id, saved, signal) => request(`/stickers/${encodeURIComponent(id)}`, stickers, signal, 'PUT', { saved }),
    },
    conversations: (cursor, signal) => request(`/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      (v): v is ChatConversationsPage => !!v && typeof v === 'object'
        && Array.isArray((v as ChatConversationsPage).items) && (v as ChatConversationsPage).items.every(conversation)
        && ((v as ChatConversationsPage).nextCursor === null || typeof (v as ChatConversationsPage).nextCursor === 'string'), signal),
    messages: (peer, page = {}, signal) => {
      const query = Object.entries(page).map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&');
      return request(`/peers/${peer}/messages${query ? `?${query}` : ''}`, messages, signal);
    },
    send: async (peer, input, signal) => {
      const result = await request(`/peers/${peer}/messages`,
        (v): v is { message: import('./contract').ChatMessage } => !!v && typeof v === 'object' && isChatMessage((v as { message: unknown }).message),
        signal, 'POST', input);
      if (result.message.clientMessageId !== input.clientMessageId || result.message.body !== input.body
        || result.message.stickerId !== input.stickerId) throw new ChatError('INVALID_RESPONSE');
      return result.message;
    },
    read: (peer, sequence, signal) => request(`/peers/${peer}/read`, readResult, signal, 'PUT', { throughSequence: sequence }),
  };
}
