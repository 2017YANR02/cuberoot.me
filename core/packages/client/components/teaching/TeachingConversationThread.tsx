'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  TeachingConversationMessage,
  TeachingConversationSummary,
} from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { refreshNotificationsUnread } from '@/lib/notifications-unread';
import {
  getTeachingConversation,
  listTeachingConversationMessages,
  markTeachingConversationRead,
  replyTeachingConversation,
} from '@/lib/teaching-saas-api';
import {
  MutationMessage,
  teachingConversationActorLabel,
  teachingDateTime,
  teachingErrorMessage,
  useOperationKey,
} from './TeachingUi';

const MESSAGE_PAGE_SIZE = 100;

interface Props {
  orgSlug: string;
  studentId: string;
  conversationId: string;
  baseHref: string;
  canReply: boolean;
}

function mergeMessages(
  current: TeachingConversationMessage[],
  incoming: TeachingConversationMessage[],
): TeachingConversationMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
}

export default function TeachingConversationThread({
  orgSlug,
  studentId,
  conversationId,
  baseHref,
  canReply,
}: Props) {
  const t = useT();
  const { get: getReplyKey, reset: resetReplyKey } = useOperationKey();
  const { get: getReadKey, reset: resetReadKey } = useOperationKey();
  const readAttemptSequence = useRef(0);
  const latestReadSequence = useRef(0);
  const [conversation, setConversation] = useState<TeachingConversationSummary | null>(null);
  const [messages, setMessages] = useState<TeachingConversationMessage[]>([]);
  const [nextAfterSequence, setNextAfterSequence] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyError, setReplyError] = useState('');

  const markLoadedRead = useCallback(async (sequence: number) => {
    if (sequence <= 0 || sequence <= latestReadSequence.current) return;
    if (readAttemptSequence.current !== sequence) {
      resetReadKey();
      readAttemptSequence.current = sequence;
    }
    try {
      const response = await markTeachingConversationRead(
        orgSlug,
        studentId,
        conversationId,
        { lastReadSequence: sequence },
        getReadKey(),
      );
      latestReadSequence.current = Math.max(latestReadSequence.current, response.read.lastReadSequence);
      setConversation((current) => current ? {
        ...current,
        lastReadSequence: latestReadSequence.current,
        unreadCount: Math.max(0, current.lastMessageSequence - latestReadSequence.current),
      } : current);
      if (readAttemptSequence.current === sequence) {
        setReadError('');
        resetReadKey();
        readAttemptSequence.current = 0;
      }
      void refreshNotificationsUnread();
    } catch (reason) {
      if (readAttemptSequence.current === sequence) {
        setReadError(teachingErrorMessage(reason, t));
      }
    }
  }, [conversationId, getReadKey, orgSlug, resetReadKey, studentId, t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setConversation(null);
    setMessages([]);
    setNextAfterSequence(0);
    setHasMore(false);
    void Promise.all([
      getTeachingConversation(orgSlug, studentId, conversationId),
      listTeachingConversationMessages(orgSlug, studentId, conversationId, 0, MESSAGE_PAGE_SIZE),
    ]).then(([detail, messagePage]) => {
      if (cancelled) return;
      setConversation(detail.conversation);
      latestReadSequence.current = detail.conversation.lastReadSequence;
      setMessages(messagePage.messages);
      setNextAfterSequence(messagePage.nextAfterSequence);
      setHasMore(messagePage.hasMore);
      void markLoadedRead(messagePage.nextAfterSequence);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(teachingErrorMessage(reason, t));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [conversationId, markLoadedRead, orgSlug, studentId, t]);

  async function loadMore() {
    setLoadingMore(true);
    setError('');
    try {
      const response = await listTeachingConversationMessages(
        orgSlug,
        studentId,
        conversationId,
        nextAfterSequence,
        MESSAGE_PAGE_SIZE,
      );
      setMessages((current) => mergeMessages(current, response.messages));
      setNextAfterSequence(response.nextAfterSequence);
      setHasMore(response.hasMore);
      void markLoadedRead(response.nextAfterSequence);
    } catch (reason) {
      setError(teachingErrorMessage(reason, t));
    } finally {
      setLoadingMore(false);
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = replyBody.trim();
    if (!body) {
      setReplyError(t('请填写回复内容。', 'Enter a reply.'));
      return;
    }
    setReplying(true);
    setReplyMessage('');
    setReplyError('');
    try {
      const response = await replyTeachingConversation(
        orgSlug,
        studentId,
        conversationId,
        { body },
        getReplyKey(),
      );
      setMessages((current) => mergeMessages(current, [response.message]));
      setConversation((current) => current ? { ...current, ...response.conversation } : current);
      latestReadSequence.current = Math.max(latestReadSequence.current, response.conversation.lastReadSequence);
      setReplyBody('');
      resetReplyKey();
      setReplyMessage(t('回复已发送。', 'Reply sent.'));
    } catch (reason) {
      setReplyError(teachingErrorMessage(reason, t));
    } finally {
      setReplying(false);
    }
  }

  if (loading) return <p aria-busy="true">{t('正在加载消息…', 'Loading messages…')}</p>;
  if (error && !conversation) return <MutationMessage message={error} error />;
  if (!conversation) return null;

  return (
    <>
      <AppLink className="teaching-eyebrow" href={baseHref} prefetch={false}>
        {t('消息主题', 'Conversations')}
      </AppLink>
      <h2>{conversation.subject}</h2>
      <p className="teaching-help">
        {t('发起人：', 'Started by: ')}{teachingConversationActorLabel(conversation.createdBy, t)}
        {' / '}{teachingDateTime(conversation.createdAt)}
      </p>

      {error && <MutationMessage message={error} error />}
      {readError && (
        <div className="teaching-conversation-read-error">
          <MutationMessage message={readError} error />
          <button
            className="teaching-text-button"
            type="button"
            onClick={() => { void markLoadedRead(nextAfterSequence); }}
          >
            {t('重试更新已读状态', 'Retry read status')}
          </button>
        </div>
      )}

      <ol className="teaching-conversation-thread">
        {messages.map((message) => (
          <li className="teaching-conversation-entry" value={message.sequence} key={message.id}>
            <span className="teaching-conversation-sequence" aria-label={t(`第 ${message.sequence} 条`, `Message ${message.sequence}`)}>
              #{message.sequence}
            </span>
            <div className="teaching-conversation-author">
              <strong>{teachingConversationActorLabel(message.author, t)}</strong>
              <span>{teachingDateTime(message.createdAt)}</span>
            </div>
            <p className="teaching-conversation-body">{message.body}</p>
          </li>
        ))}
      </ol>
      {!messages.length && <p className="teaching-empty">{t('还没有消息。', 'No messages yet.')}</p>}
      {hasMore && (
        <button className="teaching-secondary-button" type="button" disabled={loadingMore} onClick={() => { void loadMore(); }}>
          {loadingMore ? t('正在加载…', 'Loading…') : t('加载后续消息', 'Load later messages')}
        </button>
      )}

      {canReply && (
        <section className="teaching-section">
          <h2>{t('回复', 'Reply')}</h2>
          <form
            className="teaching-form"
            onSubmit={submitReply}
            onChange={() => { resetReplyKey(); setReplyMessage(''); setReplyError(''); }}
          >
            <fieldset disabled={replying}>
              <label className="teaching-field-wide">
                {t('回复内容', 'Reply')}
                <textarea
                  className="teaching-form-control teaching-form-textarea teaching-conversation-compose"
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  maxLength={10_000}
                  required
                />
              </label>
              <div className="teaching-form-actions">
                <button className="teaching-form-button" type="submit">
                  {replying ? t('发送中…', 'Sending…') : t('发送回复', 'Send reply')}
                </button>
              </div>
            </fieldset>
            <MutationMessage message={replyError || replyMessage} error={!!replyError} />
          </form>
        </section>
      )}
    </>
  );
}
