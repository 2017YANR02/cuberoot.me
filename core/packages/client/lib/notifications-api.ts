import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import i18n, { normalizeAppLang } from '@/i18n/i18n-client';

export type NotificationKind =
  | 'recon_alt' | 'recon_comment' | 'recon_reply'
  | 'forum_thread' | 'forum_reply' | 'forum_report'
  | 'forum_review' | 'forum_approved' | 'forum_rejected';

export interface SiteNotification {
  id: number;
  kind: NotificationKind;
  actorKey: string;
  actorName: string;
  /** 通知抬头,如 recon 的「选手 项目 比赛」。 */
  title: string;
  excerpt: string;
  /** 站内相对路径,如 /recon/2489。 */
  link: string;
  createdAt: string;
  read: boolean;
}

export async function fetchNotifications(limit = 30): Promise<SiteNotification[]> {
  const r = await fetch(apiUrl(`/v1/notifications?limit=${limit}`), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  return handleApi<SiteNotification[]>(r);
}

/**
 * 未读数(红点角标)。顺带把当前站点语言报给服务端 —— 通知邮件按收件人语言发,而收件人的
 * 语言只有他自己在站上时才知道。这是每个登录用户都会周期性打的请求,搭车即可,不新增请求。
 */
export async function fetchUnreadNotifications(): Promise<number> {
  const lang = normalizeAppLang(i18n.language);
  const r = await fetch(apiUrl(`/v1/notifications/unread?lang=${lang}`), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  const data = await handleApi<{ count?: number }>(r);
  return data.count ?? 0;
}

/** 标记已读。不传 ids = 全部已读。 */
export async function markNotificationsRead(ids?: number[]): Promise<void> {
  const r = await fetch(apiUrl('/v1/notifications/read'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(ids?.length ? { ids } : {}),
  });
  await handleApi<{ ok: boolean }>(r);
}

/** 邮件通知开关(关掉 = 退订;站内红点不受影响)。 */
export async function fetchEmailNotifyPref(): Promise<boolean> {
  const r = await fetch(apiUrl('/v1/notifications/prefs'), {
    headers: authHeaders(false),
    cache: 'no-store',
  });
  const data = await handleApi<{ emailNotify?: boolean }>(r);
  return data.emailNotify ?? true;
}

export async function setEmailNotifyPref(emailNotify: boolean): Promise<void> {
  const r = await fetch(apiUrl('/v1/notifications/prefs'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ emailNotify }),
  });
  await handleApi<{ ok: boolean }>(r);
}
