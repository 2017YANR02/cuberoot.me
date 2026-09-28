'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Loader2, MessageSquare, RotateCcw, Star, CheckCheck, Circle } from 'lucide-react';
import { CHAT_BODY_LIMIT, compareChatSequence, normalizeChatBody, type ChatClient, type ChatErrorCode, type ChatSticker } from '@cuberoot/shared/chat';
import type { FriendUser } from '@cuberoot/shared/friends';
import { useChat } from './use-chat';
import { ChatExpressions, stickerError } from './ChatExpressions';
import { ChatMessageText, type ChatExpressionPack } from './ChatMessageText';
import { ChatStickerImage } from './ChatStickerImage';

export interface ChatPanelProps {
  client: ChatClient;
  expressionPacks?: ChatExpressionPack[];
  onReloadExpressions?(): void;
  renderMore?(insert: (value: string) => void, close: () => void): ReactNode;
  renderVoice?(insert: (value: string) => void, disabled: boolean): ReactNode;
  renderMessage?(body: string, renderText: (text: string) => ReactNode): ReactNode | undefined;
  userId: number;
  peerId: number | null;
  onSelectPeer(peer: number | null): void;
  renderIdentity(user: FriendUser): ReactNode;
  t(zh: string, en: string): string;
  locale: string;
  onRead?(): void;
  onUnauthorized?(): void;
  onSignIn?(): void;
}
function errorText(code: ChatErrorCode, t: ChatPanelProps['t']) {
  if (code === 'UNAUTHENTICATED') return t('登录已过期，请重新登录。', 'Your session expired. Sign in again.');
  if (code === 'CHAT_UNAVAILABLE') return t('目前无法向这位用户发送消息。', 'You cannot send messages to this user right now.');
  if (code === 'CHAT_NOT_FOUND') return t('无法打开这段聊天。', 'This conversation is unavailable.');
  if (code === 'INVALID_INPUT' || code === 'BODY_TOO_LARGE') return t('请输入 1–2,000 字的消息。', 'Enter a message of 1–2,000 characters.');
  if (code === 'RATE_LIMITED') return t('发送或刷新过于频繁，请稍后重试。', 'Too many requests. Wait a moment and try again.');
  if (code === 'IDEMPOTENCY_CONFLICT') return t('这条消息的发送标识已被使用，请重新输入消息。', 'This message identifier was already used. Compose a new message.');
  return t('暂时无法连接。未确认发送的消息可以重试。', 'Could not connect. You can retry messages whose delivery is unconfirmed.');
}
export function ChatPanel({ expressionPacks = [], onReloadExpressions, renderMore, renderVoice, renderMessage, client, userId, peerId, onSelectPeer, renderIdentity, t, locale, onRead, onUnauthorized, onSignIn }: ChatPanelProps) {
  const options = useMemo(() => ({ client, userId, uuid: () => crypto.randomUUID(), onRead, onUnauthorized }), [client, userId, onRead, onUnauthorized]);
  const { controller, state } = useChat(options);
  const host = useRef<HTMLElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const tail = useRef<HTMLDivElement>(null);
  const tailVisible = useRef(false);
  const visible = useRef(false);
  const bottom = useRef(true);
  const oldScroll = useRef<{ height: number; top: number } | null>(null);
  const composing = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [favorites, setFavorites] = useState<{ client: ChatClient; items: ChatSticker[] } | null>(null);
  const [stickerFailure, setStickerFailure] = useState<string | null>(null);
  const [stickerLoading, setStickerLoading] = useState(false);
  const stickerRequest = useRef<AbortController | null>(null);
  const favoriteWrites = useRef(new Map<string, AbortController>());
  const [savingFavorites, setSavingFavorites] = useState<string[]>([]);
  const [hasNew, setHasNew] = useState(false);
  const lastRendered = useRef<string | undefined>(undefined);
  const missingTail = !!state?.hasNewerGap || (!!state?.page && compareChatSequence(state.page.lastSequence, state.messages.at(-1)?.sequence ?? '0') > 0);
  const canSend = !!state?.page?.canSend && state.listError !== 'UNAUTHENTICATED';
  const stickerItems = favorites?.client === client ? favorites.items : [];
  const loadStickers = () => {
    if (!client.stickers) return;
    stickerRequest.current?.abort();
    const request = new AbortController(); stickerRequest.current = request;
    setStickerLoading(true); setStickerFailure(null);
    void client.stickers.list(request.signal).then((items) => {
      if (!request.signal.aborted) setFavorites({ client, items });
    }).catch((error) => { if (!request.signal.aborted) setStickerFailure(stickerError(error, t)); })
      .finally(() => { if (!request.signal.aborted) setStickerLoading(false); });
  };
  useEffect(() => {
    setFavorites(null); setStickerFailure(null); setSavingFavorites([]); setStickerLoading(false);
    return () => { stickerRequest.current?.abort(); for (const request of favoriteWrites.current.values()) request.abort(); favoriteWrites.current.clear(); };
  }, [client, userId]);
  async function saveSticker(id: string) {
    if (!client.stickers || favoriteWrites.current.has(id)) return;
    const request = new AbortController(); favoriteWrites.current.set(id, request);
    setSavingFavorites((ids) => [...ids, id]); setStickerFailure(null);
    try {
      const items = await client.stickers.save(id, true, request.signal);
      if (!request.signal.aborted) { stickerRequest.current?.abort(); setStickerLoading(false); setFavorites({ client, items }); }
    } catch (error) { if (!request.signal.aborted) setStickerFailure(stickerError(error, t)); }
    finally { if (!request.signal.aborted) { favoriteWrites.current.delete(id); setSavingFavorites((ids) => ids.filter((value) => value !== id)); } }
  }
  const insertEmoji = (value: string) => {
    const input = textarea.current;
    if (!input || !controller) return;
    const draft = state?.draft ?? '';
    const start = input.selectionStart;
    const next = draft.slice(0, start) + value + draft.slice(input.selectionEnd);
    if (Array.from(next).length > CHAT_BODY_LIMIT) return;
    controller.setDraft(next);
    requestAnimationFrame(() => { input.setSelectionRange(start + value.length, start + value.length); });
  };

  const backspace = () => {
    const input = textarea.current;
    if (!input || !controller) return;
    const draft = state?.draft ?? '';
    let start = input.selectionStart;
    const end = input.selectionEnd;
    if (start === end) {
      const before = draft.slice(0, start);
      const token = expressionPacks.flatMap(pack => pack.items).find(item => before.endsWith(item.token));
      const last = Array.from(new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(before)).at(-1);
      start = token ? start - token.token.length : last?.index ?? start;
    }
    controller.setDraft(draft.slice(0, start) + draft.slice(end));
    requestAnimationFrame(() => input.setSelectionRange(start, start));
  };
  const renderText = (body: string) => <ChatMessageText body={body} packs={expressionPacks} />;
  const messageBody = (body: string) => renderMessage?.(body, renderText) ?? renderText(body);

  useEffect(() => { controller?.selectPeer(peerId); bottom.current = true; lastRendered.current = undefined; setHasNew(false); }, [controller, peerId]);
  useEffect(() => {
    const element = scroll.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => { if (bottom.current) element.scrollTop = element.scrollHeight; });
    observer.observe(element);
    return () => observer.disconnect();
  }, [peerId]);
  useEffect(() => {
    if (!controller || !host.current) return;
    let intersecting = false;
    const update = () => {
      visible.current = intersecting && document.visibilityState === 'visible' && navigator.onLine;
      controller.setActive(visible.current);
      controller.acknowledgeVisible(visible.current && tailVisible.current && bottom.current);
    };
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    observer.observe(host.current);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => {
      visible.current = false; controller.setActive(false); observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('online', update); window.removeEventListener('offline', update);
    };
  }, [controller]);
  useEffect(() => {
    tailVisible.current = false;
    if (!controller || !tail.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      tailVisible.current = entry.isIntersecting;
      controller.acknowledgeVisible(visible.current && tailVisible.current && bottom.current);
    });
    observer.observe(tail.current);
    return () => { tailVisible.current = false; observer.disconnect(); };
  }, [controller, peerId]);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element || !state || !controller) return;
    const latest = state.messages.at(-1)?.sequence;
    if (oldScroll.current && !state.loadingOlder) {
      element.scrollTop = oldScroll.current.top + element.scrollHeight - oldScroll.current.height;
      oldScroll.current = null;
    } else if (bottom.current) {
      element.scrollTop = element.scrollHeight;
      setHasNew(missingTail);
    } else if (missingTail || (latest && latest !== lastRendered.current)) setHasNew(true);
    lastRendered.current = latest;
    controller.acknowledgeVisible(visible.current && tailVisible.current && bottom.current);
  }, [state?.messages, state?.pending, state?.loadingOlder, missingTail, controller]);

  const onScroll = () => {
    const element = scroll.current;
    if (!element) return;
    bottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
    if (bottom.current) setHasNew(missingTail);
    controller?.acknowledgeVisible(visible.current && tailVisible.current && bottom.current);
  };
  const send = () => { if (!composing.current) void controller?.send(); };
  const formatTime = (value: string) => new Date(value).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return <section ref={host} className={`friend-chat${peerId ? ' has-peer' : ''}`} aria-label={t('好友聊天', 'Friend chat')}>
    <aside className="friend-chat-sidebar" aria-label={t('会话', 'Conversations')}>
      <h2>{t('聊天', 'Chats')}</h2>
      {state?.listError && <p className="friend-chat-error" role="alert">{errorText(state.listError, t)}{state.listError === 'UNAUTHENTICATED' && onSignIn && <button type="button" className="friend-chat-action" onClick={onSignIn}>{t('登录', 'Sign in')}</button>}</p>}
      {!state?.conversations.length && !state?.listLoading && <p className="friend-chat-muted">{t('从好友列表选择一位好友开始聊天。', 'Choose a friend from your friends list to start a conversation.')}</p>}
      {state?.conversations.map((c) => <div key={c.id} className={`friend-chat-conversation${peerId === c.peer.userId ? ' is-selected' : ''}`}>
        <div className="friend-chat-peer">{renderIdentity(c.peer)}</div>
        <button type="button" className="friend-chat-action" onClick={() => onSelectPeer(c.peer.userId)} aria-current={peerId === c.peer.userId ? 'true' : undefined}
          aria-label={`${t('打开聊天', 'Open conversation')}: ${c.peer.name}`}><MessageSquare size={16} />{c.unreadCount > 0 && <span>{c.unreadCount}</span>}</button>
        <p className="friend-chat-preview">{c.lastMessage.stickerId ? t('[表情包]', '[Sticker]') : <ChatMessageText body={Array.from(c.lastMessage.body).slice(0, 60).join('')} packs={expressionPacks} />}</p>
      </div>)}
      {state?.nextCursor && <button type="button" className="friend-chat-action" disabled={state.listLoading} onClick={() => void controller?.loadMoreConversations()}>{t('更多会话', 'More conversations')}</button>}
      {state?.listLoading && <Loader2 className="friend-chat-spin" size={16} aria-label={t('加载中', 'Loading')} />}
    </aside>
    <div className="friend-chat-thread" data-site-surface="panel">
      {!peerId ? <p className="friend-chat-empty">{t('选择一段聊天。', 'Select a conversation.')}</p> : <>
        <header className="friend-chat-header" data-site-surface="heading">
          {state?.page ? renderIdentity(state.page.peer) : <span>{t('聊天', 'Chat')}</span>}
          <button type="button" className="friend-chat-action friend-chat-show-list" onClick={() => onSelectPeer(null)}>{t('会话列表', 'Conversations')}</button>
        </header>
        {state?.error && <p className="friend-chat-error" role="alert">{errorText(state.error, t)} {state.error === 'UNAUTHENTICATED'
          ? onSignIn && <button type="button" className="friend-chat-action" onClick={onSignIn}>{t('登录', 'Sign in')}</button>
          : <button type="button" className="friend-chat-action" onClick={() => controller?.refresh()}>{t('重试', 'Retry')}</button>}</p>}
        <div ref={scroll} className="friend-chat-messages" onScroll={onScroll} aria-label={t('聊天记录', 'Message history')}>
          {state?.hasOlder && <button type="button" className="friend-chat-action friend-chat-older" disabled={state.loadingOlder} onClick={() => {
            const el = scroll.current;
            if (el) oldScroll.current = { height: el.scrollHeight, top: el.scrollTop };
            bottom.current = false; void controller?.loadOlder();
          }}>{t('更早的消息', 'Earlier messages')}</button>}
          {state?.loading && <p className="friend-chat-muted" role="status">{t('加载中…', 'Loading…')}</p>}
          {state?.page && !state.messages.length && <p className="friend-chat-muted">{t('还没有消息。', 'No messages yet.')}</p>}
          {state?.messages.map((m) => <div key={`${m.conversationId}:${m.sequence}`} className={`friend-chat-message${m.senderUserId === userId ? ' is-mine' : ''}`}>
            {m.stickerId && client.stickers ? <>
              <ChatStickerImage client={client.stickers} id={m.stickerId} label={t('表情包', 'Sticker')} retryLabel={t('重试', 'Retry')} />
              <button type="button" className="friend-chat-action friend-chat-save-sticker" disabled={savingFavorites.includes(m.stickerId) || stickerItems.some((item) => item.id === m.stickerId)} onClick={() => void saveSticker(m.stickerId!)}><Star size={13} />{stickerItems.some((item) => item.id === m.stickerId) ? t('已收藏', 'Saved') : t('收藏', 'Save sticker')}</button>
            </> : <div className="friend-chat-message-body">{messageBody(m.body)}</div>}<div className="friend-chat-message-meta"><time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
              {m.senderUserId === userId && <span className="friend-chat-receipt" aria-label={state?.page?.peerReadSequence === undefined ? t('已发送', 'Sent') : compareChatSequence(m.sequence, state.page.peerReadSequence) <= 0 ? t('对方已读', 'Read by recipient') : t('对方未读', 'Not yet read by recipient')}>
                {state?.page?.peerReadSequence === undefined ? t('已发送', 'Sent') : compareChatSequence(m.sequence, state.page.peerReadSequence) <= 0 ? <><CheckCheck size={12} />{t('已读', 'Read')}</> : <><Circle size={11} />{t('未读', 'Unread')}</>}
              </span>}
            </div>
          </div>)}
          <div ref={tail} className="friend-chat-tail" aria-hidden="true" />
          {state?.pending.map((m) => <div key={m.clientMessageId} className="friend-chat-message is-mine is-pending">
            {m.stickerId && client.stickers ? <ChatStickerImage client={client.stickers} id={m.stickerId} label={t('表情包', 'Sticker')} retryLabel={t('重试', 'Retry')} /> : <div className="friend-chat-message-body">{messageBody(m.body)}</div>}<span role="status">{m.status === 'sending' ? t('发送中', 'Sending') : t('未确认发送', 'Delivery unconfirmed')}</span>
            {m.status === 'failed' && <button type="button" className="friend-chat-action" onClick={() => void controller?.send(m.clientMessageId)}><RotateCcw size={13} />{t('重试', 'Retry')}</button>}
          </div>)}
        </div>
        {hasNew && <button type="button" className="friend-chat-action friend-chat-new" onClick={() => { bottom.current = true; controller?.latest(); setHasNew(false); }}>{t('查看新消息', 'Show new messages')}</button>}
        {state?.page && !state.page.canSend ? <p className="friend-chat-muted friend-chat-readonly">{t('好友关系已解除或聊天不可用，仍可查看已有记录。', 'You can still read this history, but cannot send messages while the friendship is inactive.')}</p>
          : <form className="friend-chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
            {stickerFailure && <p className="friend-chat-error" role="alert">{stickerFailure}</p>}
            <ChatExpressions key={userId + ':' + peerId} client={client.stickers} packs={expressionPacks} onReloadExpressions={onReloadExpressions} disabled={!canSend} items={stickerItems}
              recentKey={'cuberoot.chat.recent-expressions.' + userId} onKeyboard={() => textarea.current?.focus()} onOpenPanel={() => textarea.current?.blur()} onBackspace={backspace}
              renderMore={renderMore} voiceControl={renderVoice?.(insertEmoji, !canSend)}
              loading={stickerLoading} error={stickerFailure} onReload={loadStickers} onChange={(items) => { stickerRequest.current?.abort(); setStickerLoading(false); setFavorites({ client, items }); }}
              onEmoji={insertEmoji} onSend={(id) => void controller?.send(undefined, id)} t={t}
              input={<textarea ref={textarea} id="friend-chat-message" value={state?.draft ?? ''} rows={1} disabled={!canSend}
                aria-label={t('消息', 'Message')} onChange={(event) => { controller?.setDraft(event.target.value); event.target.style.height = 'auto'; event.target.style.height = Math.min(event.target.scrollHeight, 112) + 'px'; }}
                onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !composing.current
                    && event.keyCode !== 229 && window.matchMedia('(hover: hover) and (pointer: fine)').matches) { event.preventDefault(); send(); }
                }} />}
              sendButton={normalizeChatBody(state?.draft) && <button type="submit" className="friend-chat-action is-primary friend-chat-send" disabled={!canSend}>{t('发送', 'Send')}</button>} />
            {state?.draft.includes('[') && <div className="friend-chat-draft-preview" aria-label={t('消息预览', 'Message preview')}><ChatMessageText body={state.draft} packs={expressionPacks} /></div>}
            {Array.from(state?.draft ?? '').length > CHAT_BODY_LIMIT - 200 && <span className="friend-chat-muted">{Array.from(state?.draft ?? '').length}/{CHAT_BODY_LIMIT}</span>}
          </form>}
      </>}
    </div>
  </section>;
}
