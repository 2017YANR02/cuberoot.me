import {
  CHAT_LIST_POLL_MS, CHAT_MESSAGE_LIMIT, CHAT_POLL_MS, CHAT_STICKER_BODY, ChatError, compareChatSequence, normalizeChatBody, isChatUuid,
  type ChatClient, type ChatConversation, type ChatErrorCode, type ChatMessage, type ChatMessagesPage,
} from './contract';

export interface PendingChatMessage { clientMessageId: string; body: string; stickerId?: string; status: 'sending' | 'failed' }
export interface ChatSnapshot {
  peerId: number | null; page: ChatMessagesPage | null; messages: ChatMessage[]; pending: PendingChatMessage[];
  draft: string; loading: boolean; loadingOlder: boolean; hasOlder: boolean; hasNewerGap: boolean; error: ChatErrorCode | null;
  conversations: ChatConversation[]; nextCursor: string | null; listLoading: boolean; listError: ChatErrorCode | null;
}
export function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[], keepOlder = false): ChatMessage[] {
  const byId = new Map(current.map((m) => [`${m.conversationId}:${m.sequence}`, m]));
  for (const m of incoming) byId.set(`${m.conversationId}:${m.sequence}`, m);
  const result = [...byId.values()].sort((a, b) => compareChatSequence(a.sequence, b.sequence));
  return keepOlder ? result.slice(0, CHAT_MESSAGE_LIMIT) : result.slice(-CHAT_MESSAGE_LIMIT);
}
const maxSequence = (a: string, b: string) => compareChatSequence(a, b) >= 0 ? a : b;
const codeOf = (error: unknown): ChatErrorCode => error instanceof ChatError ? error.code : 'NETWORK_ERROR';
export interface ChatControllerOptions {
  client: ChatClient;
  userId: number;
  uuid(): string;
  onUnauthorized?(): void;
  onRead?(): void;
  schedule?(run: () => void, delay: number): unknown;
  cancel?(handle: unknown): void;
}
/** One account-scoped controller; hosts only supply transport and visibility. */
export function createChatController(options: ChatControllerOptions) {
  const schedule = options.schedule ?? ((run: () => void, delay: number) => setTimeout(run, delay));
  const cancel = options.cancel ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const listeners = new Set<() => void>();
  const drafts = new Map<number, string>();
  const outbox = new Map<number, PendingChatMessage[]>();
  let state: ChatSnapshot = { peerId: null, page: null, messages: [], pending: [], draft: '', loading: false,
    loadingOlder: false, hasOlder: false, hasNewerGap: false, error: null, conversations: [], nextCursor: null, listLoading: false, listError: null };
  let disposed = false;
  let active = false;
  let atBottom = false;
  let generation = 0;
  let cursor: string | null = null;
  let failures = 0;
  let listFailures = 0;
  let listExpanded = false;
  let messageTimer: unknown;
  let listTimer: unknown;
  let messageRequest: AbortController | null = null;
  let listRequest: AbortController | null = null;
  let readRequest: AbortController | null = null;
  const writes = new Set<AbortController>();
  const publish = (patch: Partial<ChatSnapshot>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  const current = (version: number, peer: number | null) => !disposed && generation === version && state.peerId === peer;
  function fail(error: unknown, list = false) {
    const code = codeOf(error);
    publish(code === 'UNAUTHENTICATED' ? { listError: code, error: code } : list ? { listError: code } : { error: code });
    if (code === 'UNAUTHENTICATED') { setActive(false); options.onUnauthorized?.(); }
  }
  const delayFor = (error: unknown, attempt: number, base: number) => Math.max(
    Math.min(base * 2 ** Math.min(attempt - 1, 4), 30_000), error instanceof ChatError ? error.retryAfterMs : 0);
  async function refreshList(more = false) {
    if (disposed || !active || listRequest || (more && !state.nextCursor)) return;
    const request = new AbortController(); listRequest = request;
    const selectedCursor = more ? state.nextCursor! : undefined;
    publish({ listLoading: true });
    let delay = CHAT_LIST_POLL_MS;
    try {
      const page = await options.client.conversations(selectedCursor, request.signal);
      if (disposed || request.signal.aborted) return;
      if (more) listExpanded = true;
      const items = more || listExpanded ? [...state.conversations, ...page.items] : page.items;
      const unique = [...new Map(items.map((item) => [item.id, item])).values()];
      unique.sort((a, b) => b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt) || b.id.localeCompare(a.id));
      publish({ conversations: unique, nextCursor: more || !listExpanded ? page.nextCursor : state.nextCursor, listError: null });
      listFailures = 0;
    } catch (error) {
      if (!disposed && !request.signal.aborted) { fail(error, true); delay = delayFor(error, ++listFailures, CHAT_LIST_POLL_MS); }
    } finally {
      if (listRequest === request) {
        listRequest = null; publish({ listLoading: false }); cancel(listTimer);
        if (active && !disposed) listTimer = schedule(() => void refreshList(), delay);
      }
    }
  }
  async function markRead() {
    const peer = state.peerId;
    const rendered = state.messages.at(-1)?.sequence;
    const through = cursor && rendered ? (compareChatSequence(cursor, rendered) <= 0 ? cursor : rendered) : null;
    if (!active || !atBottom || readRequest || !peer || !state.page?.conversationId || !through
      || compareChatSequence(through, state.page.myReadSequence) <= 0) return;
    const version = generation;
    const request = new AbortController(); readRequest = request;
    try {
      const result = await options.client.read(peer, through, request.signal);
      if (!current(version, peer) || request.signal.aborted || !state.page) return;
      publish({ page: { ...state.page, myReadSequence: maxSequence(result.myReadSequence, state.page.myReadSequence) },
        conversations: state.conversations.map((c) => c.peer.userId === peer
          ? { ...c, myReadSequence: result.myReadSequence, unreadCount: result.unreadCount } : c) });
      options.onRead?.();
    } catch (error) {
      if (current(version, peer) && !request.signal.aborted) fail(error);
    } finally { if (readRequest === request) readRequest = null; }
  }
  async function refreshMessages(older = false) {
    const peer = state.peerId;
    if (!active || disposed || !peer || messageRequest || (older && !state.hasOlder)) return;
    const version = generation;
    const request = new AbortController(); messageRequest = request;
    const initial = cursor === null;
    publish(older ? { loadingOlder: true } : { loading: initial });
    let delay = CHAT_POLL_MS;
    try {
      let more = false;
      do {
        const page = await options.client.messages(peer, older ? { before: state.messages[0]?.sequence }
          : cursor === null ? {} : { after: cursor }, request.signal);
        if (!current(version, peer) || request.signal.aborted) return;
        if (page.peer.userId !== peer) throw new ChatError('INVALID_RESPONSE');
        const previousCursor = cursor;
        if (!older) cursor = page.nextAfterSequence;
        const pending = state.pending.filter((p) => !page.items.some((m) => m.senderUserId === options.userId && m.clientMessageId === p.clientMessageId));
        outbox.set(peer, pending);
        const merged = mergeChatMessages(state.messages, page.items, older || !atBottom || state.hasNewerGap);
        const newestKnown = maxSequence(state.messages.at(-1)?.sequence ?? '0', page.items.at(-1)?.sequence ?? '0');
        const hasNewerGap = state.hasNewerGap || compareChatSequence(newestKnown, merged.at(-1)?.sequence ?? '0') > 0;
        publish({ page: { ...page, myReadSequence: maxSequence(page.myReadSequence, state.page?.myReadSequence ?? '0') },
          messages: merged, hasNewerGap, pending,
          hasOlder: older || initial ? page.hasMore : state.hasOlder || state.messages.length + page.items.length > CHAT_MESSAGE_LIMIT,
          error: null });
        more = !older && !initial && page.hasMore;
        if (more && cursor === previousCursor) throw new ChatError('INVALID_RESPONSE');
      } while (more && active);
      failures = 0;
      // The UI acknowledges visibility only after the new message DOM has rendered.
    } catch (error) {
      if (current(version, peer) && !request.signal.aborted) { fail(error); delay = delayFor(error, ++failures, CHAT_POLL_MS); }
    } finally {
      if (messageRequest === request) {
        messageRequest = null; publish({ loading: false, loadingOlder: false }); cancel(messageTimer);
        if (active && !disposed) messageTimer = schedule(() => void refreshMessages(), delay);
      }
    }
  }
  async function send(clientMessageId?: string, stickerId?: string) {
    const peer = state.peerId;
    if (!peer || !state.page?.canSend || disposed || state.listError === 'UNAUTHENTICATED') return;
    const old = clientMessageId ? state.pending.find((p) => p.clientMessageId === clientMessageId) : undefined;
    if (clientMessageId && (!old || old.status === 'sending')) return;
    if (stickerId !== undefined && !isChatUuid(stickerId)) { publish({ error: 'INVALID_INPUT' }); return; }
    const body = old?.body ?? (stickerId ? CHAT_STICKER_BODY : normalizeChatBody(state.draft));
    if (!body) { publish({ error: 'INVALID_INPUT' }); return; }
    const attachment = old?.stickerId ?? stickerId;
    const item: PendingChatMessage = { clientMessageId: old?.clientMessageId ?? options.uuid(), body,
      ...(attachment ? { stickerId: attachment } : {}), status: 'sending' };
    const pending = [...state.pending.filter((p) => p.clientMessageId !== item.clientMessageId), item];
    outbox.set(peer, pending);
    if (!old && !attachment) drafts.set(peer, '');
    publish({ pending, draft: old || attachment ? state.draft : '', error: null });
    const version = generation;
    const request = new AbortController(); writes.add(request);
    try {
      const message = await options.client.send(peer, item, request.signal);
      if (!current(version, peer) || request.signal.aborted) return;
      if (message.senderUserId !== options.userId) throw new ChatError('INVALID_RESPONSE');
      const rest = state.pending.filter((p) => p.clientMessageId !== item.clientMessageId);
      outbox.set(peer, rest);
      // A POST response must never advance the incremental receive cursor.
      const merged = mergeChatMessages(state.messages, [message], !atBottom || state.hasNewerGap);
      publish({ messages: merged, pending: rest,
        hasNewerGap: state.hasNewerGap || compareChatSequence(message.sequence, merged.at(-1)?.sequence ?? '0') > 0 });
      void refreshList(); void refreshMessages();
    } catch (error) {
      if (current(version, peer) && !request.signal.aborted) {
        const rest = state.pending.map((p) => p.clientMessageId === item.clientMessageId ? { ...p, status: 'failed' as const } : p);
        outbox.set(peer, rest); publish({ pending: rest }); fail(error);
      }
    } finally { writes.delete(request); }
  }
  function stopPeer() {
    cancel(messageTimer); messageRequest?.abort(); messageRequest = null;
    readRequest?.abort(); readRequest = null;
    for (const write of writes) write.abort(); writes.clear();
    if (state.peerId) outbox.set(state.peerId, state.pending.map((p) => ({ ...p, status: 'failed' })));
  }
  function selectPeer(peer: number | null) {
    if (disposed || peer === state.peerId) return;
    stopPeer(); generation++; cursor = null; failures = 0; atBottom = false;
    publish({ peerId: peer, page: null, messages: [], pending: peer ? outbox.get(peer) ?? [] : [],
      draft: peer ? drafts.get(peer) ?? '' : '', loading: !!peer && state.listError !== 'UNAUTHENTICATED', loadingOlder: false,
      hasOlder: false, hasNewerGap: false, error: state.listError === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : null });
    void refreshMessages();
  }
  function setActive(value: boolean) {
    if (disposed || active === value) return;
    active = value;
    if (active) { void refreshList(); void refreshMessages(); }
    else {
      cancel(messageTimer); cancel(listTimer);
      messageRequest?.abort(); messageRequest = null; listRequest?.abort(); listRequest = null;
      readRequest?.abort(); readRequest = null;
      publish({ loading: false, loadingOlder: false, listLoading: false });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    selectPeer, setActive, send,
    setDraft: (draft: string) => { if (state.peerId) drafts.set(state.peerId, draft); publish({ draft }); },
    acknowledgeVisible: (bottom: boolean) => { atBottom = bottom; if (bottom) void markRead(); },
    loadOlder: () => refreshMessages(true),
    loadMoreConversations: () => refreshList(true),
    refresh: () => { void refreshList(); void refreshMessages(); },
    latest: () => { stopPeer(); generation++; cursor = null; atBottom = true;
      publish({ messages: [], loading: true, hasNewerGap: false, pending: state.peerId ? outbox.get(state.peerId) ?? [] : [] }); void refreshMessages(); },
    dispose: () => { setActive(false); stopPeer(); disposed = true; generation++; drafts.clear(); outbox.clear(); listeners.clear(); },
  };
}
export type ChatController = ReturnType<typeof createChatController>;
