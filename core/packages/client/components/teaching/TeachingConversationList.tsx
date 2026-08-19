'use client';

import { useCallback, useState, type FormEvent } from 'react';
import type { TeachingConversationSummary } from '@cuberoot/shared/teaching';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  createTeachingConversation,
  listTeachingConversations,
} from '@/lib/teaching-saas-api';
import {
  MutationMessage,
  TeachingPagination,
  teachingConversationActorLabel,
  teachingDateTime,
  teachingErrorMessage,
  useOperationKey,
  useTeachingPage,
} from './TeachingUi';

const PAGE_SIZE = 25;

interface Props {
  orgSlug: string;
  studentId: string;
  baseHref: string;
  page: number;
  audience: 'learner' | 'staff';
  canManage: boolean;
}

export default function TeachingConversationList({
  orgSlug,
  studentId,
  baseHref,
  page,
  audience,
  canManage,
}: Props) {
  const t = useT();
  const operationKey = useOperationKey();
  const loader = useCallback(async () => {
    const response = await listTeachingConversations(orgSlug, studentId, page, PAGE_SIZE);
    return {
      items: response.conversations,
      total: response.total,
      page: response.page,
      pageSize: response.pageSize,
    };
  }, [orgSlug, page, studentId]);
  const conversations = useTeachingPage(loader);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<TeachingConversationSummary | null>(null);
  const [message, setMessage] = useState('');
  const [mutationError, setMutationError] = useState('');

  function resetMutationState() {
    operationKey.reset();
    setCreated(null);
    setMessage('');
    setMutationError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject) {
      setMutationError(t('请填写主题。', 'Enter a subject.'));
      return;
    }
    if (!trimmedBody) {
      setMutationError(t('请填写消息内容。', 'Enter a message.'));
      return;
    }
    setSubmitting(true);
    setCreated(null);
    setMessage('');
    setMutationError('');
    try {
      const response = await createTeachingConversation(
        orgSlug,
        studentId,
        { subject: trimmedSubject, body: trimmedBody },
        operationKey.get(),
      );
      setCreated(response.conversation);
      setSubject('');
      setBody('');
      operationKey.reset();
      conversations.reload();
      setMessage(t('消息主题已创建。', 'Conversation created.'));
    } catch (reason) {
      setMutationError(teachingErrorMessage(reason, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h2>{audience === 'staff' ? t('家校沟通', 'Family communication') : t('消息', 'Messages')}</h2>
      <p className="teaching-lead">
        {audience === 'staff'
          ? t('围绕这名学员保留连续、可追溯的沟通记录。', 'Keep a continuous, traceable communication record for this learner.')
          : t('在这里与老师查看并继续教学沟通。', 'Review and continue teaching conversations with staff here.')}
      </p>

      {conversations.loading ? <p aria-busy="true">{t('正在加载消息…', 'Loading messages…')}</p> : conversations.error ? (
        <MutationMessage message={conversations.error} error />
      ) : !conversations.result?.items.length ? (
        <p className="teaching-empty">{t('还没有消息主题。', 'No conversations yet.')}</p>
      ) : (
        <div className="teaching-list">
          {conversations.result.items.map((conversation) => (
            <AppLink
              className="teaching-row teaching-row-link"
              href={`${baseHref}/${conversation.id}`}
              prefetch={false}
              key={conversation.id}
            >
              <div className="teaching-row-main">
                <div className="teaching-row-title">{conversation.subject}</div>
                <div className="teaching-row-meta">
                  {t('发起人：', 'Started by: ')}{teachingConversationActorLabel(conversation.createdBy, t)}
                  {' / '}{teachingDateTime(conversation.lastMessageAt)}
                </div>
              </div>
              {conversation.unreadCount > 0 && (
                <span className="teaching-status">
                  {t(`${conversation.unreadCount} 条未读`, `${conversation.unreadCount} unread`)}
                </span>
              )}
            </AppLink>
          ))}
        </div>
      )}
      {conversations.result && (
        <TeachingPagination
          page={conversations.result.page}
          pageSize={conversations.result.pageSize}
          total={conversations.result.total}
          baseHref={baseHref}
        />
      )}

      {canManage && (
        <section className="teaching-section">
          <h2>{t('发起新主题', 'Start a conversation')}</h2>
          <form className="teaching-form" onSubmit={submit} onChange={resetMutationState}>
            <fieldset disabled={submitting}>
              <label className="teaching-field-wide">
                {t('主题', 'Subject')}
                <input
                  className="teaching-form-control"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={200}
                  required
                />
              </label>
              <label className="teaching-field-wide">
                {t('消息内容', 'Message')}
                <textarea
                  className="teaching-form-control teaching-form-textarea teaching-conversation-compose"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={10_000}
                  required
                />
              </label>
              <div className="teaching-form-actions">
                <button className="teaching-form-button" type="submit">
                  {submitting ? t('发送中…', 'Sending…') : t('发起主题', 'Start conversation')}
                </button>
              </div>
            </fieldset>
            <MutationMessage message={mutationError || message} error={!!mutationError} />
            {created && (
              <AppLink href={`${baseHref}/${created.id}`} prefetch={false}>
                {t('打开刚创建的主题', 'Open the new conversation')}
              </AppLink>
            )}
          </form>
        </section>
      )}
    </>
  );
}
