import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { mobileApiUrl } from '@cuberoot/app-ui';
import { nativeMobileSecureStorage } from './secure-storage';
import { RecordPushController, type PushStatus } from './record-push-controller';

const plugin = registerPlugin<{
  start(): Promise<PushStatus>; status(): Promise<PushStatus>; stop(): Promise<PushStatus>;
}>('RecordPush');

export const recordPush = Capacitor.getPlatform() === 'android' ? new RecordPushController({
  storage: nativeMobileSecureStorage,
  appId: async () => (await App.getInfo()).id,
  identity: () => ({ installationId: crypto.randomUUID(),
    secret: Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('') }),
  start: () => plugin.start(), status: () => plugin.status(), stop: () => plugin.stop(),
  async request(method, path, body, token) {
    const response = await fetch(mobileApiUrl(`/v1${path}`), {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Push registration ${response.status}`);
    return response.json();
  },
}) : null;
