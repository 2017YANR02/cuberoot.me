import { App } from '@capacitor/app';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { parseNotificationOpen, parseNotificationOpenUrl, type NotificationOpen } from '@cuberoot/shared/notification-push';

const plugin = registerPlugin<{
  pendingNotification(): Promise<{ notification?: unknown }>;
  addListener(event: 'notificationOpened', listener: (value: unknown) => void): Promise<PluginListenerHandle>;
}>('RecordPush');

/** Native callbacks contain public destinations, never credentials or web tickets. */
export async function addNotificationOpenListener(listener: (value: NotificationOpen) => void): Promise<PluginListenerHandle> {
  const handles: PluginListenerHandle[] = [];
  try {
    const receive = (value: unknown) => { const opened = parseNotificationOpen(value); if (opened) listener(opened); };
    if (Capacitor.getPlatform() === 'ios') {
      handles.push(await plugin.addListener('notificationOpened', receive));
      receive((await plugin.pendingNotification()).notification);
    } else if (Capacitor.getPlatform() === 'android') {
      const receiveUrl = ({ url }: { url: string }) => { const opened = parseNotificationOpenUrl(url); if (opened) listener(opened); };
      handles.push(await App.addListener('appUrlOpen', receiveUrl));
      const launch = await App.getLaunchUrl();
      if (launch?.url) receiveUrl(launch);
    }
    return { remove: async () => { await Promise.all(handles.map(h => h.remove())); } };
  } catch (error) {
    await Promise.all(handles.map(h => h.remove()));
    throw error;
  }
}
