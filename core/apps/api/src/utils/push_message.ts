import { parseNotificationOpen, type NotificationPushKind } from '@cuberoot/shared/notification-push';

export interface NotificationPushInput {
  clientId: string; notificationId: number; title: string; excerpt: string; link: string;
  kind?: NotificationPushKind; recipientUid?: string; pushVersion?: number; expiresAt?: number;
}
export function pushOpen(input: NotificationPushInput) {
  const value = parseNotificationOpen({ kind: input.kind ?? 'wca_record', notificationId: String(input.notificationId),
    link: input.link, ...(input.recipientUid ? { recipientUid: input.recipientUid } : {}) });
  if (!value || (value.kind !== 'wca_record' && input.pushVersion !== 2)) throw new Error('Unsupported push message');
  return value;
}
export function pushExpiry(input: NotificationPushInput, now = Date.now()): number {
  const expiry = input.expiresAt ?? now + 3_600_000;
  if (!Number.isFinite(expiry) || expiry <= now) throw new Error('Expired push message');
  return Math.min(expiry, now + 3_600_000);
}
