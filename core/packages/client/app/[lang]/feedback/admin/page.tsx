'use client';

/**
 * /feedback/admin — admin 审核反馈(需求 / Bug / 其他)。
 * 仅 admin 可见(isAdminWcaId 门控,登录态读自 auth-store);非 admin / 未登录早返。
 * 媒体(截图/短视频)经公开 GET /v1/feedback/media/:id 直接做 <img>/<video> 的 src
 * (immutable 长缓存)。双主题走 globals.css token。文案本地 t(简,en)。
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Trash2, Lightbulb, Bug, MessageSquare, ExternalLink, ChevronDown } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import FeedbackConversation from '@/components/FeedbackConversation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/lib/auth-store';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { displayCuberName } from '@/lib/cuber-name-display';
import {
  fetchFeedbackList, updateFeedbackStatus, deleteFeedback, feedbackMediaUrl,
  type AdminFeedbackItem, type FeedbackMedia, type FeedbackStatus, type FeedbackKind,
} from '@/lib/feedback-api';
import './feedback-admin.css';

const KIND_ICON: Record<FeedbackKind, typeof Bug> = { need: Lightbulb, bug: Bug, other: MessageSquare };
const STATUSES: FeedbackStatus[] = ['new', 'triaged', 'done'];

function MediaView({ m, t }: { m: FeedbackMedia; t: (zh: string, en: string) => string }) {
  const url = feedbackMediaUrl(m.id);
  if (m.kind === 'video') {
    return (
      <div className="fba-media">
        <video src={url} controls playsInline preload="metadata" />
        {m.durationMs != null && <span className="fba-media-dur">{(m.durationMs / 1000).toFixed(1)}s</span>}
      </div>
    );
  }
  return (
    <a className="fba-media" href={url} target="_blank" rel="noreferrer" title={t('原图', 'full size')}>
      <img src={url} alt="" loading="lazy" />
    </a>
  );
}

export default function FeedbackAdminPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('反馈审核', 'Feedback');

  const user = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(false);
  const admin = isAdminWcaId(user?.wcaId);

  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('all');
  const [items, setItems] = useState<AdminFeedbackItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(() => {
    setErr(null);
    fetchFeedbackList(filter === 'all' ? undefined : filter)
      .then((list) => {
        setItems(list);
        // 默认展开有用户新动作未读的线程
        setOpen((prev) => {
          const next = new Set(prev);
          for (const it of list) if (it.unread) next.add(it.id);
          return next;
        });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [filter]);

  function toggle(id: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setItems((prev) => prev?.map((it) => (it.id === id ? { ...it, unread: false } : it)) ?? prev);
  }

  useEffect(() => { if (admin && mounted) load(); }, [admin, mounted, load]);

  async function setStatus(id: number, status: FeedbackStatus) {
    setBusy(id);
    try { await updateFeedbackStatus(id, status); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  async function remove(id: number) {
    if (!window.confirm(t('删除这条反馈?', 'Delete this feedback?'))) return;
    setBusy(id);
    try { await deleteFeedback(id); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  if (!mounted) return <div className="fba-page" />;

  if (!admin) {
    return (
      <div className="fba-page fba-denied">
        <p>{t('需要管理员权限', 'Admin access required')}</p>
        <HomeLink className="fba-back"><ChevronLeft size={16} /><span>{t('首页', 'Home')}</span></HomeLink>
      </div>
    );
  }

  return (
    <div className="fba-page">
      <header className="fba-header">
        <HomeLink className="fba-back"><ChevronLeft size={16} /><span>{t('首页', 'Home')}</span></HomeLink>
      </header>
      <h1 className="fba-title">{t('反馈', 'Feedback')}</h1>

      <div className="fba-filters">
        {(['all', ...STATUSES] as const).map((s) => (
          <button key={s} type="button" className={`fba-filter${filter === s ? ' is-active' : ''}`}
            onClick={() => setFilter(s)}>
            {s === 'all' ? t('全部', 'All')
              : s === 'new' ? t('新', 'New')
              : s === 'triaged' ? t('处理中', 'Triaged')
              : t('已完成', 'Done')}
          </button>
        ))}
      </div>

      {err && <div className="fba-error">{err}</div>}
      {!items && !err && <div className="fba-empty">{t('加载中…', 'Loading…')}</div>}
      {items && items.length === 0 && <div className="fba-empty">{t('暂无反馈', 'No feedback yet')}</div>}

      <div className="fba-list">
        {items?.map((it) => {
          const Icon = KIND_ICON[it.kind];
          const expanded = open.has(it.id);
          return (
            <article key={it.id} className={`fba-card fba-status-${it.status}${it.unread ? ' is-unread' : ''}`}>
              <div className="fba-card-top">
                <span className={`fba-kind fba-kind-${it.kind}`}><Icon size={14} />
                  {it.kind === 'need' ? t('需求', 'Idea') : it.kind === 'bug' ? 'Bug' : t('其他', 'Other')}</span>
                <span className="fba-when">{String(it.createdAt).slice(0, 16).replace('T', ' ')}</span>
                {it.unread && <span className="fba-dot" aria-label={t('用户有新回复', 'New from user')} />}
                <span className={`fba-badge fba-badge-${it.status}`}>
                  {it.status === 'new' ? t('新', 'New') : it.status === 'triaged' ? t('处理中', 'Triaged') : t('已完成', 'Done')}</span>
              </div>

              <p className="fba-body">{it.body}</p>

              {it.media.length > 0 && (
                <div className="fba-media-row">
                  {it.media.map((m) => <MediaView key={m.id} m={m} t={t} />)}
                </div>
              )}

              <div className="fba-meta">
                <span className="fba-who">{displayCuberName(it.wcaName, isZh) || it.wcaId}</span>
                {it.contact && <span className="fba-contact">{it.contact}</span>}
                {it.pageUrl && (
                  <a className="fba-pageurl" href={it.pageUrl} target="_blank" rel="noreferrer">
                    {it.pageUrl.replace(/^https?:\/\/[^/]+/, '') || '/'} <ExternalLink size={11} />
                  </a>
                )}
                {it.viewport && <span className="fba-env">{it.viewport}</span>}
                {it.theme && <span className="fba-env">{it.theme}</span>}
                {it.lang && <span className="fba-env">{it.lang}</span>}
              </div>
              {it.userAgent && <p className="fba-ua" title={it.userAgent}>{it.userAgent}</p>}

              <div className="fba-actions">
                {STATUSES.map((s) => (
                  <button key={s} type="button" disabled={busy === it.id || it.status === s}
                    className={`fba-act${it.status === s ? ' is-cur' : ''}`} onClick={() => setStatus(it.id, s)}>
                    {s === 'new' ? t('新', 'New') : s === 'triaged' ? t('处理中', 'Triaged') : t('完成', 'Done')}
                  </button>
                ))}
                <button type="button" className={`fba-act fba-conv${expanded ? ' is-cur' : ''}`}
                  onClick={() => toggle(it.id)} aria-expanded={expanded}>
                  <MessageSquare size={13} />
                  {it.replyCount ? `${t('对话', 'Thread')} ${it.replyCount}` : t('回复', 'Reply')}
                  <ChevronDown size={13} className={`fba-conv-chev${expanded ? ' is-open' : ''}`} />
                </button>
                <button type="button" className="fba-del" disabled={busy === it.id} onClick={() => remove(it.id)}
                  title={t('删除', 'Delete')}><Trash2 size={14} /></button>
              </div>

              {expanded && <FeedbackConversation feedbackId={it.id} onActivity={load} />}
            </article>
          );
        })}
      </div>
    </div>
  );
}
