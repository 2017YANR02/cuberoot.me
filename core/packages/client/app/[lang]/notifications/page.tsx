'use client';

/**
 * /notifications — 站内消息。两个来源:recon(别人回复你的评论,或提了另解/评论 → 管理员收)
 * 和论坛(别人回复你的主题;新主题/举报 → 管理员收)。
 * 进页即把列出的未读标记已读(红点回落),但列表仍保留「新」高亮,免得用户还没看清就被清空。
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft, MessageSquare, Reply, GitBranch, LogIn, Check, MessagesSquare, Flag,
  Hourglass, CircleCheck, CircleX, Plane,
} from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { useAuthStore } from '@/lib/auth-store';
import {
  fetchNotifications, markNotificationsRead, fetchEmailNotifyPref, setEmailNotifyPref,
  type SiteNotification, type NotificationKind,
} from '@/lib/notifications-api';
import { refreshNotificationsUnread } from '@/lib/notifications-unread';
import './notifications.css';

const KIND_ICON: Record<NotificationKind, typeof MessageSquare> = {
  recon_alt: GitBranch,
  recon_comment: MessageSquare,
  recon_reply: Reply,
  forum_thread: MessagesSquare,
  forum_reply: Reply,
  forum_report: Flag,
  forum_review: Hourglass,
  forum_approved: CircleCheck,
  forum_rejected: CircleX,
  comp_reg: Plane,
};

/** TIMESTAMPTZ → 本地 `yyyy-mm-dd hh:mm`。 */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function NotificationsPage() {
  const t = useT();
  useDocumentTitle('消息', 'Notifications');

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<SiteNotification[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [emailNotify, setEmailNotify] = useState<boolean | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const kindText = (k: NotificationKind): string => ({
    recon_alt: t('提交了新另解', 'submitted an alternative'),
    recon_comment: t('发表了新评论', 'left a new comment'),
    recon_reply: t('回复了你的评论', 'replied to your comment'),
    forum_thread: t('发布了新主题', 'started a new thread'),
    forum_reply: t('回复了你的主题', 'replied to your thread'),
    forum_report: t('举报了一个帖子', 'reported a post'),
    forum_review: t('发布了待审核内容', 'posted content awaiting review'),
    forum_approved: t('通过了你的帖子', 'approved your post'),
    forum_rejected: t('驳回了你的帖子', 'declined your post'),
    comp_reg: t('报名了国外比赛', 'registered for an overseas competition'),
  }[k]);

  const load = useCallback(() => {
    setErr(null);
    fetchNotifications(50)
      .then(async (list) => {
        setItems(list);
        if (list.some((n) => !n.read)) {
          await markNotificationsRead().catch(() => {});
          await refreshNotificationsUnread();
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => { if (user && mounted) load(); }, [user, mounted, load]);

  useEffect(() => {
    if (!user || !mounted) return;
    fetchEmailNotifyPref().then(setEmailNotify).catch(() => {});
  }, [user, mounted]);

  // 乐观切换:失败回滚,免开关卡在错的位置。
  async function toggleEmail(next: boolean) {
    const prev = emailNotify;
    setEmailNotify(next);
    try {
      await setEmailNotifyPref(next);
    } catch (e) {
      setEmailNotify(prev);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (!mounted) return <div className="ntf-page" />;

  return (
    <div className="ntf-page">
      <header className="ntf-header">
        <HomeLink className="ntf-back"><ChevronLeft size={16} /><span>{t('首页', 'Home')}</span></HomeLink>
      </header>
      <h1 className="ntf-title">{t('消息', 'Notifications')}</h1>

      {!user ? (
        <div className="ntf-login">
          <p className="ntf-login-hint">
            {t('登录后即可看到别人对你的复盘评论、另解,以及论坛主题的回复。',
              'Sign in to see comments, alternative solutions and forum replies addressed to you.')}
          </p>
          <button type="button" className="ntf-login-btn" onClick={login}>
            <LogIn size={15} /> {t('登录', 'Sign in')}
          </button>
        </div>
      ) : (
        <>
          {emailNotify !== null && (
            <div className="ntf-prefs">
              <BoolToggle
                value={emailNotify}
                onChange={toggleEmail}
                label={t('新消息也发邮件给我', 'Also email me about new notifications')}
              />
              {!emailNotify && (
                <p className="ntf-prefs-hint">
                  {t('已关闭邮件,这里的红点和列表照常。', 'Email is off. The badge and this list still work.')}
                </p>
              )}
            </div>
          )}

          {err && <div className="ntf-error">{err}</div>}
          {!items && !err && <div className="ntf-empty">{t('加载中…', 'Loading…')}</div>}
          {items && items.length === 0 && (
            <div className="ntf-empty">
              <Check size={16} />
              <span>{t('还没有新消息。', 'Nothing new yet.')}</span>
            </div>
          )}

          <div className="ntf-list">
            {items?.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? MessageSquare;
              return (
                <AppLink
                  key={n.id}
                  href={n.link}
                  className={`ntf-item${n.read ? '' : ' is-new'}`}
                  prefetch={false}
                >
                  <span className="ntf-icon"><Icon size={15} /></span>
                  <span className="ntf-main">
                    <span className="ntf-line">
                      <strong className="ntf-actor">{n.actorName}</strong>
                      <span className="ntf-action">{kindText(n.kind)}</span>
                    </span>
                    <span className="ntf-target">{n.title}</span>
                    {n.excerpt && <span className="ntf-excerpt">{n.excerpt}</span>}
                  </span>
                  <span className="ntf-when">{formatWhen(n.createdAt)}</span>
                </AppLink>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
