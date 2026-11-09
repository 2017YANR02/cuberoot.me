import { describe, expect, it } from 'vitest';
import { notificationOpenUrl, parseNotificationOpenUrl } from '@cuberoot/shared/notification-push';
import { NotificationOpenQueue } from '../src/notification-navigation';

const tap = { kind: 'comp_announcement' as const, notificationId: '42', recipientUid: '7', link: '/wca/comp/Test2026?event=333' };
describe('notification navigation', () => {
  it('waits for restored auth and the current attempt, then opens only once', () => {
    const q = new NotificationOpenQueue();
    q.offer(tap);
    expect(q.take(undefined, false, false)).toBeNull();
    expect(q.take(7, true, true)).toBeNull();
    q.offer(tap); // native listener plus cold-start pending result
    expect(q.take(7, true, false)).toBe(tap.link);
    q.offer(tap); expect(q.take(7, true, false)).toBeNull();
  });
  it('drops notifications after logout/account switch and refuses arbitrary navigation', () => {
    const q = new NotificationOpenQueue();
    q.offer(tap); expect(q.take(8, true, false)).toBeNull();
    q.offer(tap); expect(q.take(7, true, false)).toBeNull();
    for (const link of ['https://evil.test', '//evil.test', '/account', '/wca/comp/../account', '/wca/comp/Test#x', '/wca/comp/Test?x=hello;end']) {
      q.offer({ ...tap, notificationId: '43', link }); expect(q.take(7, true, false)).toBeNull();
    }
    q.offer({ ...tap, notificationId: '44' }); expect(q.take(undefined, true, false)).toBeNull();
  });
  it('roundtrips release/debug intents while rejecting auth, duplicate keys and foreign schemes', () => {
    for (const appId of ['me.cuberoot.app', 'me.cuberoot.app.debug']) {
      const url = notificationOpenUrl(appId, tap);
      expect(parseNotificationOpenUrl(url)).toEqual(tap);
      expect(parseNotificationOpenUrl(url + '&recipientUid=8')).toBeNull();
      expect(parseNotificationOpenUrl(url.replace('notification/open', 'auth/callback'))).toBeNull();
      expect(parseNotificationOpenUrl(url.replace(appId, 'foreign'))).toBeNull();
    }
  });
});
