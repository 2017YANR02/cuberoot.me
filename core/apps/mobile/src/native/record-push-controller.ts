import type { WebSession } from '@cuberoot/shared/auth/web-session';
import type { MobileSecureStorage } from './secure-storage';

export interface PushStatus { configured: boolean; enabled: boolean; clientId: string | null }
interface PushIdentity { installationId: string; secret: string; uid: number; revoke: boolean }
export interface RecordPushPort {
  storage: MobileSecureStorage;
  appId(): Promise<string>;
  identity(): { installationId: string; secret: string };
  request(method: 'GET' | 'PUT' | 'DELETE', path: string, body?: unknown, token?: string): Promise<{ enabled?: boolean }>;
  start(): Promise<PushStatus>;
  status(): Promise<PushStatus>;
  stop(): Promise<unknown>;
}

const KEY = 'record_push_device';

/** One serialized lifecycle per native installation; credentials never enter iframe messages. */
export class RecordPushController {
  private desired: WebSession | null = null;
  private queue: Promise<void> = Promise.resolve();
  private startedFor: number | null = null;
  private registered = '';
  private registeredAt = 0;
  private loggedOutToken: string | null = null;
  constructor(private readonly port: RecordPushPort) {}

  sync(session: WebSession | null): Promise<void> {
    if (session?.token === this.loggedOutToken) return this.queue.catch(() => undefined);
    this.desired = session;
    const run = this.queue.catch(() => undefined).then(() => this.reconcile());
    this.queue = run;
    return run;
  }

  async logout(): Promise<void> {
    this.loggedOutToken = this.desired?.token ?? null;
    this.desired = null;
    // Stop locally before waiting for pending network operations.
    try { await this.port.stop(); } finally { await this.sync(null); }
  }

  private async read(): Promise<PushIdentity | null> {
    const raw = await this.port.storage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PushIdentity;
    if (typeof value.installationId !== 'string' || typeof value.secret !== 'string' || !Number.isSafeInteger(value.uid)) {
      throw new Error('Invalid stored push identity');
    }
    return value;
  }

  private async revoke(device: PushIdentity): Promise<void> {
    this.startedFor = null;
    this.registered = '';
    await this.port.storage.setItem(KEY, JSON.stringify({ ...device, revoke: true }));
    await this.port.stop();
    await this.port.request('DELETE', '/notifications/push/device', { installationId: device.installationId, secret: device.secret });
    await this.port.storage.removeItem(KEY);
  }

  private async reconcile(): Promise<void> {
    let device = await this.read();
    const session = this.desired;
    if (device && (device.revoke || !session || device.uid !== session.user.uid)) {
      await this.revoke(device);
      device = null;
    }
    if (!session || this.desired !== session) {
      if (!session) { this.startedFor = null; await this.port.stop(); }
      return;
    }
    const appId = await this.port.appId();
    const initial = await this.port.status();
    if (!initial.configured) return;
    const config = await this.port.request('GET', `/notifications/push/config?appId=${encodeURIComponent(appId)}`, undefined, session.token);
    if (!config.enabled || this.desired !== session) {
      if (!config.enabled) { await this.port.stop(); this.startedFor = null; }
      return;
    }
    let status = initial;
    if (this.startedFor !== session.user.uid || (status.enabled && !status.clientId)) {
      status = await this.port.start();
      this.startedFor = session.user.uid;
    }
    if (this.desired !== session) { await this.port.stop(); return; }
    if (!status.enabled) {
      if (device) await this.revoke(device);
      return;
    }
    if (!status.clientId) return; // SDK registers asynchronously; next poll/resume reads the CID.
    if (!device) {
      device = { ...this.port.identity(), uid: session.user.uid, revoke: false };
      await this.port.storage.setItem(KEY, JSON.stringify(device));
    }
    const binding = `${session.user.uid}:${status.clientId}`;
    if (this.registered === binding && Date.now() - this.registeredAt < 3_600_000) return;
    if (this.desired !== session) return;
    await this.port.request('PUT', '/notifications/push/device', {
      installationId: device.installationId, secret: device.secret, appId, clientId: status.clientId,
    }, session.token);
    this.registered = binding;
    this.registeredAt = Date.now();
  }
}
