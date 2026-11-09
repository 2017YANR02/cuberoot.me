/** Public competition destinations shared by the API and installed clients. */
export const NOTIFICATION_PUSH_VERSION = 2;
export const NOTIFICATION_PUSH_KINDS = ['wca_record', 'comp_announcement', 'comp_registration_open', 'comp_registration_close'] as const;
export type NotificationPushKind = typeof NOTIFICATION_PUSH_KINDS[number];
export interface NotificationOpen {
  kind: NotificationPushKind;
  notificationId: string;
  link: string;
  recipientUid?: string;
}
export function competitionPushLink(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 512
    && /^\/(?:zh\/)?wca\/comp\/[A-Za-z0-9_-]{1,64}(?:\?[A-Za-z0-9_=&%.~-]*)?$/.test(value);
}
export function parseNotificationOpen(value: unknown): NotificationOpen | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!(NOTIFICATION_PUSH_KINDS as readonly unknown[]).includes(v.kind) || !competitionPushLink(v.link)
    || typeof v.notificationId !== 'string' || !/^[1-9]\d{0,18}$/.test(v.notificationId)
    || (v.recipientUid !== undefined && (typeof v.recipientUid !== 'string' || !/^[1-9]\d{0,18}$/.test(v.recipientUid)))
    || (v.kind !== 'wca_record' && v.recipientUid === undefined)) return null;
  return { kind: v.kind as NotificationPushKind, notificationId: v.notificationId, link: v.link,
    ...(v.recipientUid === undefined ? {} : { recipientUid: v.recipientUid as string }) };
}
export function notificationOpenUrl(appId: string, value: NotificationOpen): string {
  if (!['me.cuberoot.app', 'me.cuberoot.app.debug'].includes(appId) || !parseNotificationOpen(value)) throw new Error('Invalid notification destination');
  return `${appId}://notification/open?${new URLSearchParams({ ...value })}`;
}
export function parseNotificationOpenUrl(raw: string): NotificationOpen | null {
  try {
    const url = new URL(raw);
    if (!['me.cuberoot.app:', 'me.cuberoot.app.debug:'].includes(url.protocol) || url.hostname !== 'notification'
      || url.pathname !== '/open' || url.username || url.password || url.port || url.hash
      || [...url.searchParams.keys()].some((k, i, keys) => keys.indexOf(k) !== i || !['kind', 'notificationId', 'link', 'recipientUid'].includes(k))) return null;
    return parseNotificationOpen(Object.fromEntries(url.searchParams));
  } catch { return null; }
}
