import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { PushStatus } from './record-push-controller';

export const recordPushPlugin = registerPlugin<{
  start(): Promise<PushStatus>; status(): Promise<PushStatus>; stop(): Promise<PushStatus>;
  pendingNotification(): Promise<{ notification?: unknown }>;
  addListener(event: 'notificationOpened', listener: (value: unknown) => void): Promise<PluginListenerHandle>;
}>('RecordPush');
