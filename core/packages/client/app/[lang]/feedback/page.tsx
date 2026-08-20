'use client';

/**
 * /feedback — 公开反馈流。所有人可读,任意登录用户可发反馈 / 回复。
 * 管理员的诊断字段与审核操作仍只在 /feedback/admin 展示。
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseAsInteger, useQueryState } from 'nuqs';
import { ChevronDown, ChevronLeft, Lightbulb, Bug, MessageSquare, Plus } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import AppLink from '@/components/AppLink';
import FeedbackModal from '@/components/FeedbackModal';
import FeedbackConversation from '@/components/FeedbackConversation';
import Paginator from '@/components/wca-stats/Paginator';
import { useT } from '@/hooks/useT';
import { useAuthStore, isAdmin } from '@/lib/auth-store';
import { displayCuberName } from '@/lib/cuber-name-display';
import {
  feedbackMediaUrl,
  fetchPublicFeedback,
  type FeedbackKind,
  type PublicFeedbackPage,
} from '@/lib/feedback-api';
import './feedback.css';

const KIND_ICON: Record<FeedbackKind, typeof Bug> = { need: Lightbulb, bug: Bug, other: MessageSquare };
const PAGE_SIZES = [10, 20, 40];

export default function FeedbackPage() {
  const { i18n } = useTranslation();
  const t = useT();
  const isZh = i18n.language.startsWith('zh');
  const lang = (['en', 'zh'] as const)[Number(isZh)];
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useQueryState(
    'page', parseAsInteger.withDefault(1).withOptions({ history: 'push' }),
  );
  const [size, setSize] = useQueryState('size', parseAsInteger.withDefault(20));
  const safePage = Math.max(1, page);
  const safeSize = PAGE_SIZES.includes(size) ? size : 20;
  const [data, setData] = useState<PublicFeedbackPage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(() => {
    setErr(null);
    return fetchPublicFeedback(safePage, safeSize)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [safePage, safeSize]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setErr(null);
    fetchPublicFeedback(safePage, safeSize)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [safePage, safeSize]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / safeSize));
  useEffect(() => {
    if (data && data.total > 0 && safePage > totalPages) void setPage(totalPages);
  }, [data, safePage, setPage, totalPages]);

  function toggle(id: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startFeedback() {
    if (user) setComposeOpen(true);
    else login();
  }

  return (
    <div className="fbm-page">
      <header className="fbm-header">
        <HomeLink className="fbm-back"><ChevronLeft size={16} /><span>{t('首页', 'Home')}</span></HomeLink>
      </header>
      <div className="fbm-titlerow">
        <div>
          <h1 className="fbm-title">{t('反馈', 'Feedback')}</h1>
          <p className="fbm-subtitle">
            {t('所有反馈和回复均公开可见,登录后任何人都可以参与。',
              'All feedback and replies are public. Anyone can join after signing in.')}
          </p>
        </div>
        <button type="button" className="fbm-new" onClick={startFeedback}>
          <Plus size={15} /> {t('新反馈', 'New')}
        </button>
      </div>

      {err && <div className="fbm-error">{err}</div>}
      {!data && !err && <div className="fbm-empty">{t('加载中…', 'Loading…')}</div>}
      {data && data.items.length === 0 && (
        <div className="fbm-empty">
          <p>{t('还没有反馈。', 'No feedback yet.')}</p>
          <button type="button" className="fbm-new" onClick={startFeedback}>
            <Plus size={15} /> {t('提一条反馈', 'Send feedback')}
          </button>
        </div>
      )}

      <div className="fbm-list">
        {data?.items.map((it) => {
          const Icon = KIND_ICON[it.kind];
          const expanded = open.has(it.id);
          const author = displayCuberName(it.wcaName, isZh) || it.wcaId;
          return (
            <article key={it.id} className={`fbm-card fbm-status-${it.status}`}>
              <button type="button" className="fbm-card-head" onClick={() => toggle(it.id)} aria-expanded={expanded}>
                <span className="fbm-kind"><Icon size={14} /></span>
                <span className="fbm-author">{author}</span>
                <span className="fbm-when">{String(it.createdAt).slice(0, 10)}</span>
                <span className={`fbm-badge fbm-badge-${it.status}`}>
                  {it.status === 'new' ? t('新', 'New') : it.status === 'triaged' ? t('处理中', 'In progress') : t('已完成', 'Done')}
                </span>
                {it.replyCount > 0 && (
                  <span className="fbm-replies"><MessageSquare size={12} /> {it.replyCount}</span>
                )}
                <ChevronDown size={16} className={`fbm-chev${expanded ? ' is-open' : ''}`} />
              </button>

              <p className="fbm-body">{it.body}</p>

              {it.media.length > 0 && (
                <div className="fbm-media-row">
                  {it.media.map((m) => (
                    m.kind === 'video' ? (
                      <video key={m.id} className="fbm-media" src={feedbackMediaUrl(m.id)} controls playsInline preload="metadata" />
                    ) : (
                      <a key={m.id} className="fbm-media" href={feedbackMediaUrl(m.id)} target="_blank" rel="noreferrer">
                        <img src={feedbackMediaUrl(m.id)} alt="" loading="lazy" />
                      </a>
                    )
                  ))}
                </div>
              )}

              {expanded && <FeedbackConversation feedbackId={it.id} onActivity={load} />}
            </article>
          );
        })}
      </div>

      {data && data.total > 0 && (
        <Paginator
          page={Math.min(safePage, totalPages)}
          totalPages={totalPages}
          size={safeSize}
          pageSizeOptions={PAGE_SIZES}
          isZh={isZh}
          className="fbm-pagination"
          onPageChange={(next) => { void setPage(next); }}
          onSizeChange={(next) => { void setSize(next); void setPage(1); }}
        />
      )}

      {mounted && isAdmin() && (
        <AppLink href="/feedback/admin" className="fbm-admin-link">{t('反馈审核(管理员)', 'Review all (admin)')}</AppLink>
      )}

      {composeOpen && (
        <FeedbackModal lang={lang} onClose={() => { setComposeOpen(false); void load(); }} />
      )}
    </div>
  );
}
