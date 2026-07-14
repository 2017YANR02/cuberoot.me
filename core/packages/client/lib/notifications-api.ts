import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export type NotificationKind = 'recon_alt' | 'recon_comment' | 'recon_reply';

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

export async function fetchUnreadNotifications(): Promise<number> {
  const r = await fetch(apiUrl('/v1/notifications/unread'), {
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
