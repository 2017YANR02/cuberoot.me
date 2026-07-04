'use client';

/**
 * /feedback — 「我的反馈」。登录用户查看自己提过的反馈线程,看管理员回复并继续对话
 * (GitHub issue 式)。新反馈仍走桌宠的反馈弹窗(这里也放一个入口)。
 * admin 的全量审核在 /feedback/admin。双主题走 globals token,文案走 useT()。
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Lightbulb, Bug, MessageSquare, LogIn, Plus, ChevronDown } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import AppLink from '@/components/AppLink';
import FeedbackModal from '@/components/FeedbackModal';
import FeedbackConversation from '@/components/FeedbackConversation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { useAuthStore, isAdmin } from '@/lib/auth-store';
import { feedbackMediaUrl, fetchMyFeedback, type MyFeedbackItem, type FeedbackKind } from '@/lib/feedback-api';
import './feedback.css';

const KIND_ICON: Record<FeedbackKind, typeof Bug> = { need: Lightbulb, bug: Bug, other: MessageSquare };

export default function MyFeedbackPage() {
  const { i18n } = useTranslation();
  const t = useT();
  const lang = (['en', 'zh'] as const)[Number(i18n.language.startsWith('zh'))];
  useDocumentTitle('我的反馈', 'My feedback');

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<MyFeedbackItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(() => {
    setErr(null);
    fetchMyFeedback()
      .then((list) => {
        setItems(list);
        // 默认展开有未读回复的线程
        setOpen((prev) => {
          const next = new Set(prev);
          for (const it of list) if (it.unread) next.add(it.id);
          return next;
        });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => { if (user && mounted) load(); }, [user, mounted, load]);

  function toggle(id: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // 展开即视作已读(后端在 thread fetch 时也会标),本地先清红点
    setItems((prev) => prev?.map((it) => (it.id === id ? { ...it, unread: false } : it)) ?? prev);
  }

  if (!mounted) return <div className="fbm-page" />;

  return (
    <div className="fbm-page">
      <header className="fbm-header">
        <HomeLink className="fbm-back"><ChevronLeft size={16} /><span>{t('首页', 'Home')}</span></HomeLink>
      </header>
      <div className="fbm-titlerow">
        <h1 className="fbm-title">{t('我的反馈', 'My feedback')}</h1>
        {user && (
          <button type="button" className="fbm-new" onClick={() => setComposeOpen(true)}>
            <Plus size={15} /> {t('新反馈', 'New')}
          </button>
        )}
      </div>

      {!user ? (
        <div className="fbm-login">
          <p className="fbm-login-hint">{t('登录后即可查看你的反馈和我的回复。',
            'Sign in to see your feedback and my replies.')}</p>
          <button type="button" className="fbm-login-btn" onClick={login}>
            <LogIn size={15} /> {t('登录', 'Sign in')}
          </button>
        </div>
      ) : (
        <>
          {err && <div className="fbm-error">{err}</div>}
          {!items && !err && <div className="fbm-empty">{t('加载中…', 'Loading…')}</div>}
          {items && items.length === 0 && (
            <div className="fbm-empty">
              <p>{t('你还没有提过反馈。', 'You haven’t sent any feedback yet.')}</p>
              <button type="button" className="fbm-new" onClick={() => setComposeOpen(true)}>
                <Plus size={15} /> {t('提一条反馈', 'Send feedback')}
              </button>
            </div>
          )}

          <div className="fbm-list">
            {items?.map((it) => {
              const Icon = KIND_ICON[it.kind];
              const expanded = open.has(it.id);
              return (
                <article key={it.id} className={`fbm-card fbm-status-${it.status}${it.unread ? ' is-unread' : ''}`}>
                  <button type="button" className="fbm-card-head" onClick={() => toggle(it.id)} aria-expanded={expanded}>
                    <span className="fbm-kind"><Icon size={14} /></span>
                    <span className="fbm-when">{String(it.createdAt).slice(0, 10)}</span>
                    <span className={`fbm-badge fbm-badge-${it.status}`}>
                      {it.status === 'new' ? t('新', 'New') : it.status === 'triaged' ? t('处理中', 'In progress') : t('已完成', 'Done')}
                    </span>
                    {it.replyCount > 0 && (
                      <span className="fbm-replies"><MessageSquare size={12} /> {it.replyCount}</span>
                    )}
                    {it.unread && <span className="fbm-dot" aria-label={t('有新回复', 'New reply')} />}
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

          {isAdmin() && (
            <AppLink href="/feedback/admin" className="fbm-admin-link">{t('反馈审核(管理员)', 'Review all (admin)')}</AppLink>
          )}
        </>
      )}

      {composeOpen && (
        <FeedbackModal lang={lang} onClose={() => { setComposeOpen(false); load(); }} />
      )}
    </div>
  );
}
