import { parseNotificationOpen, type NotificationOpen } from '@cuberoot/shared/notification-push';

/** Cold-start events wait for auth; foreground taps wait until an attempt finishes. */
export class NotificationOpenQueue {
  private pending: NotificationOpen | null = null;
  private seen = new Set<string>();
  offer(value: unknown): void {
    const opened = parseNotificationOpen(value);
    if (!opened || this.seen.has(opened.notificationId)) return;
    this.pending = opened;
  }
  take(uid: number | undefined, ready: boolean, blocked: boolean): string | null {
    if (!ready || !this.pending) return null;
    const opened = this.pending;
    if (!uid || (opened.recipientUid !== undefined && opened.recipientUid !== String(uid))) {
      this.pending = null;
      this.remember(opened.notificationId);
      return null;
    }
    if (blocked) return null;
    this.pending = null;
    this.remember(opened.notificationId);
    // The shared Tools surface adds the current app language exactly once.
    return opened.link.replace(/^\/zh\//, '/');
  }
  private remember(id: string) {
    this.seen.add(id);
    if (this.seen.size > 100) this.seen.delete(this.seen.values().next().value!);
  }
}
