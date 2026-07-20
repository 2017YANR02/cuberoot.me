'use client';

/**
 * 反馈对话面板(GitHub issue 式来回)。发帖人在 /feedback、admin 在 /feedback/admin 共用。
 * 挂载即拉 GET /feedback/:id/thread(后端据请求方角色标记已读)→ 渲染往来气泡 + 回复框。
 * 开帖正文由父卡片渲染,这里只渲染后续 messages。双主题走 globals token。
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CornerDownRight, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import { displayCuberName } from '@/lib/cuber-name-display';
import { getOwnerKey, isAdmin } from '@/lib/auth-store';
import { fetchFeedbackThread, replyToFeedback, deleteFeedbackMessage, type FeedbackMessage } from '@/lib/feedback-api';
import { refreshFeedbackUnread } from '@/lib/feedback-unread';
import './feedback-conversation.css';

const REPLY_MAX = 8000;

function when(v: string): string {
  return String(v).slice(0, 16).replace('T', ' ');
}

export default function FeedbackConversation({ feedbackId, onActivity }: {
  feedbackId: number;
  onActivity?: () => void;
}) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [messages, setMessages] = useState<FeedbackMessage[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const myId = getOwnerKey();
  const admin = isAdmin();
  const canDelete = (m: FeedbackMessage) => admin || m.wcaId === myId;

  const load = useCallback(() => {
    setErr(null);
    fetchFeedbackThread(feedbackId)
      .then((d) => { setMessages(d.messages); refreshFeedbackUnread(); }) // 取阅已标记已读 → 同步桌宠角标
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [feedbackId]);

  useEffect(() => { load(); }, [load]);

  async function send() {
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    setErr(null);
    try {
      await replyToFeedback(feedbackId, text.slice(0, REPLY_MAX));
      setReply('');
      load();
      onActivity?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function del(messageId: number) {
    setDeleting(messageId);
    setErr(null);
    try {
      await deleteFeedbackMessage(feedbackId, messageId);
      setConfirmId(null);
      load();
      onActivity?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="fbc">
      {messages && messages.length > 0 && (
        <div className="fbc-thread">
          {messages.map((m) => (
            <div key={m.id} className={`fbc-msg fbc-msg-${m.role}`}>
              <div className="fbc-msg-head">
                <span className="fbc-msg-who">
                  {m.role === 'admin' ? t('管理员', 'Admin') : (displayCuberName(m.wcaName, isZh) || m.wcaId)}
                </span>
                <span className="fbc-msg-when">{when(m.createdAt)}</span>
                {canDelete(m) && (
                  confirmId === m.id ? (
                    <span className="fbc-msg-confirm">
                      <button type="button" className="fbc-msg-del-yes" disabled={deleting === m.id}
                        onClick={() => void del(m.id)}>
                        {deleting === m.id ? <Spinner size={12} label={t('删除中…', 'Deleting…')} /> : t('删除', 'Delete')}
                      </button>
                      <button type="button" className="fbc-msg-del-no" onClick={() => setConfirmId(null)}>
                        {t('取消', 'Cancel')}
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="fbc-msg-del" title={t('删除', 'Delete')}
                      onClick={() => setConfirmId(m.id)}>
                      <Trash2 size={13} />
                    </button>
                  )
                )}
              </div>
              <p className="fbc-msg-body">{m.body}</p>
            </div>
          ))}
        </div>
      )}

      {err && <p className="fbc-err">{err}</p>}

      <div className="fbc-reply">
        <textarea
          className="fbc-input"
          value={reply}
          maxLength={REPLY_MAX}
          rows={2}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
          placeholder={t('写一条回复…(Ctrl+Enter 发送)', 'Write a reply… (Ctrl+Enter to send)')}
        />
        <button type="button" className="fbc-send" onClick={() => void send()} disabled={!reply.trim() || sending}>
          {sending ? <Spinner size={14} /> : <CornerDownRight size={14} />}
          {t('回复', 'Reply')}
        </button>
      </div>
    </div>
  );
}
