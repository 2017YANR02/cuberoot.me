'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Loader2, MessageSquare, Send, RotateCcw } from 'lucide-react';
import { CHAT_BODY_LIMIT, compareChatSequence, normalizeChatBody, type ChatClient, type ChatErrorCode } from '@cuberoot/shared/chat';
import type { FriendUser } from '@cuberoot/shared/friends';
import { useChat } from './use-chat';

export interface ChatPanelProps {
  client: ChatClient;
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
export function ChatPanel({ client, userId, peerId, onSelectPeer, renderIdentity, t, locale, onRead, onUnauthorized, onSignIn }: ChatPanelProps) {
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
  const [hasNew, setHasNew] = useState(false);
  const lastRendered = useRef<string | undefined>(undefined);
  const missingTail = !!state?.hasNewerGap || (!!state?.page && compareChatSequence(state.page.lastSequence, state.messages.at(-1)?.sequence ?? '0') > 0);
  const canSend = !!state?.page?.canSend && state.listError !== 'UNAUTHENTICATED';

  useEffect(() => { controller?.selectPeer(peerId); bottom.current = true; lastRendered.current = undefined; setHasNew(false); }, [controller, peerId]);
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
        <p className="friend-chat-preview">{Array.from(c.lastMessage.body).slice(0, 60).join('')}</p>
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
            <p>{m.body}</p><time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
          </div>)}
          <div ref={tail} className="friend-chat-tail" aria-hidden="true" />
          {state?.pending.map((m) => <div key={m.clientMessageId} className="friend-chat-message is-mine is-pending">
            <p>{m.body}</p><span role="status">{m.status === 'sending' ? t('发送中', 'Sending') : t('未确认发送', 'Delivery unconfirmed')}</span>
            {m.status === 'failed' && <button type="button" className="friend-chat-action" onClick={() => void controller?.send(m.clientMessageId)}><RotateCcw size={13} />{t('重试', 'Retry')}</button>}
          </div>)}
        </div>
        {hasNew && <button type="button" className="friend-chat-action friend-chat-new" onClick={() => { bottom.current = true; controller?.latest(); setHasNew(false); }}>{t('查看新消息', 'Show new messages')}</button>}
        {state?.page && !state.page.canSend ? <p className="friend-chat-muted friend-chat-readonly">{t('好友关系已解除或聊天不可用，仍可查看已有记录。', 'You can still read this history, but cannot send messages while the friendship is inactive.')}</p>
          : <form className="friend-chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <label className="friend-chat-input-label" htmlFor="friend-chat-message">{t('消息', 'Message')}</label>
            <textarea id="friend-chat-message" value={state?.draft ?? ''} rows={3} disabled={!canSend}
              placeholder={t('写一条消息…', 'Write a message…')} onChange={(event) => controller?.setDraft(event.target.value)}
              onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !composing.current
                  && event.keyCode !== 229 && window.matchMedia('(hover: hover) and (pointer: fine)').matches) { event.preventDefault(); send(); }
              }} />
            <div className="friend-chat-compose-actions"><span className="friend-chat-muted">{Array.from(state?.draft ?? '').length}/{CHAT_BODY_LIMIT}</span>
              <button type="submit" className="friend-chat-action is-primary" disabled={!canSend || !normalizeChatBody(state?.draft)}><Send size={15} />{t('发送', 'Send')}</button>
            </div>
          </form>}
      </>}
    </div>
  </section>;
}
