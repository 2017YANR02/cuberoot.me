'use client';

/**
 * /notifications — 站内消息。两个来源:recon(别人回复你的评论,或提了另解/评论 → 管理员收)
 * 和论坛(别人回复你的主题;新主题/举报 → 管理员收)。
 * 进页即把列出的未读标记已读(红点回落),但列表仍保留「新」高亮,免得用户还没看清就被清空。
 */
import { useEffect, useState } from 'react';
import {
  MessageSquare, Reply, GitBranch, LogIn, Check, MessagesSquare, Flag,
  Hourglass, CircleCheck, CircleX, Plane, BellRing, CalendarPlus, CalendarCheck,
  FilePenLine, UserPlus, UserCheck, Settings,
} from '@app-foundation/icons/lucide';
import PageBackLink from '@/components/PageBackLink';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { Tooltip } from '@/components/Tooltip';
import SettingsDialog from '@/components/SettingsDialog';
import { useT } from '@/hooks/useT';
import { useAuthStore } from '@/lib/auth-store';
import {
  fetchNotifications, markNotificationsRead, fetchEmailNotifyPref, setEmailNotifyPref,
  type SiteNotification, type NotificationKind,
} from '@/lib/notifications-api';
import { refreshNotificationsUnread } from '@/lib/notifications-unread';
import './notifications.css';
import RecordPreferences from './_RecordPreferences';
import CompetitionPreferences from './_CompetitionPreferences';
import { ContentSkeleton } from '@/components/ContentSkeleton';

const KIND_ICON: Record<NotificationKind, typeof MessageSquare> = {
  assistant_alert: BellRing,
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
  comp_announcement: Flag,
  comp_registration_open: CalendarPlus,
  comp_registration_close: CalendarCheck,
  wca_record: BellRing,
  membership_payment: BellRing,
  document_change: FilePenLine,
  cal_reminder: BellRing,
  cal_invite: CalendarPlus,
  cal_rsvp: CalendarCheck,
  teaching_message: MessagesSquare,
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  friend_message: MessagesSquare,
};

/** TIMESTAMPTZ → 本地 `yyyy-mm-dd hh:mm`。 */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function NotificationsPage() {
  const user = useAuthStore((s) => s.user);
  return <NotificationsContent key={user?.uid ?? user?.wcaId ?? 'guest'} />;
}

function NotificationsContent() {
  const t = useT();

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<SiteNotification[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [emailNotify, setEmailNotify] = useState<boolean | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const kindText = (k: NotificationKind): string => ({
    assistant_alert: t('AI 服务告警', 'AI service alert'),
    recon_alt: t('另解', 'Alternative'),
    recon_comment: t('评论', 'Comment'),
    recon_reply: t('回复', 'Reply'),
    forum_thread: t('新主题', 'New thread'),
    forum_reply: t('回复', 'Reply'),
    forum_report: t('举报', 'Report'),
    forum_review: t('待审核', 'Pending review'),
    forum_approved: t('审核通过', 'Approved'),
    forum_rejected: t('审核未通过', 'Declined'),
    comp_reg: t('比赛报名', 'Registration'),
    comp_announcement: t('比赛公示', 'Competition announced'),
    comp_registration_open: t('报名开放提醒', 'Registration opening'),
    comp_registration_close: t('报名截止提醒', 'Registration closing'),
    wca_record: t('纪录快讯', 'Record news'),
    membership_payment: t('会员收款成功', 'Membership payment received'),
    document_change: t('文件更新', 'File update'),
    cal_reminder: t('日程提醒', 'Event reminder'),
    cal_invite: t('日程邀请', 'Event invitation'),
    cal_rsvp: t('邀请回应', 'Invitation response'),
    teaching_message: t('教学消息', 'Teaching message'),
    friend_request: t('好友申请', 'Friend request'),
    friend_accepted: t('好友申请通过', 'Friend request accepted'),
    friend_message: t('私信', 'Message'),
  }[k]);

  useEffect(() => {
    if (!user || !mounted) return;
    let active = true;
    setErr(null);
    fetchNotifications(50)
      .then(async (list) => {
        if (!active) return;
        setItems(list);
        const unreadIds = list.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length) {
          await markNotificationsRead(unreadIds).catch(() => {});
          if (active) await refreshNotificationsUnread();
        }
      })
      .catch((e) => { if (active) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { active = false; };
  }, [user, mounted]);

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
      <header className="ntf-header page-back-heading">
        <PageBackLink className="ntf-back" />
        <h1 className="ntf-title">{t('消息', 'Notifications')}</h1>
        {user && <Tooltip content={t('消息设置', 'Notification settings')}>
          {(tip) => <button {...tip} type="button" className="ntf-settings-button"
            aria-label={t('消息设置', 'Notification settings')}
            aria-expanded={settingsOpen} aria-haspopup="dialog"
            onClick={() => setSettingsOpen(open => !open)}>
            <Settings size={19} aria-hidden="true" />
          </button>}
        </Tooltip>}
      </header>

      {!user ? (
        <div className="ntf-login">
          <p className="ntf-login-hint">
            {t('登录后即可看到好友申请、复盘互动和论坛回复。',
              'Sign in to see friend requests, reconstruction activity, and forum replies.')}
          </p>
          <button type="button" className="ntf-login-btn" onClick={login}>
            <LogIn size={15} /> {t('登录', 'Sign in')}
          </button>
        </div>
      ) : (
        <>
          {settingsOpen && <SettingsDialog label={t('消息设置', 'Notification settings')} onClose={() => setSettingsOpen(false)}>
          <h2 className="ntf-settings-title">{t('消息设置', 'Notification settings')}</h2>
          {emailNotify !== null && (
            <div className="ntf-prefs">
              <BoolToggle
                value={emailNotify}
                onChange={toggleEmail}
                label={t('新消息也发邮件给我', 'Also email me about new notifications')}
              />
            </div>
          )}

          <RecordPreferences key={user.uid ?? user.wcaId} />
          <CompetitionPreferences key={`competitions:${user.uid ?? user.wcaId}`} />
          </SettingsDialog>}
          {err && <div className="ntf-error">{err}</div>}
          {!items && !err && <ContentSkeleton variant="list" />}
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
                      <span className="ntf-action" data-kind={n.kind}>{kindText(n.kind)}</span>
                      {n.actorName && <strong className="ntf-actor">{n.actorName}</strong>}
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
