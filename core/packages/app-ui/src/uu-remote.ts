/** UU's public URL protocol; native launching/storage remain in the host. */
export interface UURemoteRuntime {
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
  };
  /** Optional preflight. Android must use the launch result, not package visibility. */
  canOpen?(): Promise<boolean>;
  open(url: string): Promise<boolean>;
  appId(): Promise<string>;
  nonce(): string;
  now(): number;
}

type Pending = { kind: 'bind' | 'control'; nonce: string; expires: number };
type Saved = { device: string | null; pending: Pending | null };
export type UURemoteSnapshot = {
  ready: boolean;
  bound: boolean;
  busy: boolean;
  pending: 'bind' | 'control' | null;
  message: string;
  returned: number;
};
const KEY = 'uu_remote_v1';
const empty: Saved = { device: null, pending: null };
const MAX_WAIT = 30 * 60_000; // Leave time for UU's user-confirmed error dialogs.
const bindErrors = new Set(['no_device', 'user_cancel', 'timeout', 'not_logined', 'superseded', 'logout', 'internal_error']);
const controlErrors = new Set(['busy', 'device_offline', 'device_not_found', 'pip_unsupported', 'login_timeout', 'network_unavailable', 'not_allowed', 'connect_timeout', 'connect_failed', 'user_cancel', 'invalid_request', 'internal_error']);
const token = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 8192 && !/[\u0000-\u001f]/.test(value);

export class UURemoteClient {
  private saved: Saved = { ...empty };
  private state: UURemoteSnapshot = { ready: false, bound: false, busy: false, pending: null, message: '', returned: 0 };
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private initialized = false;
  constructor(private runtime: UURemoteRuntime) {}
  getSnapshot = (): UURemoteSnapshot => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(patch: Partial<UURemoteSnapshot> = {}) {
    this.state = { ...this.state, bound: Boolean(this.saved.device), pending: this.saved.pending?.kind ?? null, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private run(action: () => Promise<void>): Promise<void> {
    const result = this.queue.then(async () => {
      this.publish({ busy: true });
      try { await this.load(); await action(); }
      catch { this.publish({ message: 'failed' }); }
      finally { this.publish({ busy: false }); }
    });
    this.queue = result;
    return result;
  }
  private async load() {
    if (this.initialized) return;
    const raw = await this.runtime.storage.getItem(KEY);
    if (raw) {
      const data: Saved = JSON.parse(raw);
      if (!data || (data.device !== null && !token(data.device))) throw new Error('Invalid stored device');
      const p = data.pending;
      if (p && ((p.kind !== 'bind' && p.kind !== 'control') || !token(p.nonce) || !Number.isFinite(p.expires))) throw new Error('Invalid pending request');
      this.saved = { device: data.device, pending: p && p.expires > this.runtime.now() ? p : null };
    }
    this.initialized = true;
    this.publish({ ready: true });
  }
  private async save(next: Saved) {
    await this.runtime.storage.setItem(KEY, JSON.stringify(next));
    this.saved = next;
    this.publish();
  }
  initialize = () => this.run(async () => {});
  private async callback(kind: Pending['kind']) {
    const id = await this.runtime.appId();
    if (!/^[a-z][a-z0-9.+-]*$/.test(id)) throw new Error('Invalid app scheme');
    return new URL(`${id}://uu-remote/${kind}`);
  }
  start = (mode: 'bind' | 'fullscreen' | 'pip'): Promise<void> => this.run(async () => {
    if (this.saved.pending && this.saved.pending.expires > this.runtime.now()) return;
    if (this.runtime.canOpen && !(await this.runtime.canOpen())) { this.publish({ message: 'not_installed' }); return; }
    if (mode !== 'bind' && !this.saved.device) { this.publish({ message: 'no_binding' }); return; }
    const kind = mode === 'bind' ? 'bind' : 'control';
    const pending: Pending | null = mode === 'fullscreen' ? null : { kind, nonce: this.runtime.nonce(), expires: this.runtime.now() + MAX_WAIT };
    const url = new URL(`uuremote://external/device/${mode === 'bind' ? 'authorize' : 'control'}`);
    if (pending) {
      const callback = await this.callback(kind);
      if (kind === 'control') callback.searchParams.set('request', pending.nonce);
      url.searchParams.set('callback', callback.href);
      if (kind === 'bind') url.searchParams.set('nonce', pending.nonce);
    }
    if (mode !== 'bind') {
      url.searchParams.set('anonymous_device_id', this.saved.device!);
      url.searchParams.set('window_type', mode === 'pip' ? '1' : '0');
    }
    await this.save({ ...this.saved, pending });
    try {
      if (!(await this.runtime.open(url.href))) throw new Error('Launch failed');
      this.publish({ message: pending ? 'waiting' : 'opened' });
    } catch {
      await this.save({ ...this.saved, pending: null });
      this.publish({ message: 'open_failed' });
    }
  });
  cancel = () => this.run(async () => {
    await this.save({ ...this.saved, pending: null });
    this.publish({ message: 'cancelled' });
  });
  forget = () => this.run(async () => {
    await this.save({ ...empty });
    this.publish({ message: 'forgotten' });
  });
  handleUrl = (raw: string): Promise<void> => this.run(async () => {
    let url: URL;
    try { url = new URL(raw); } catch { return; }
    const pending = this.saved.pending;
    if (!pending) return;
    const expected = await this.callback(pending.kind);
    if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname || url.username || url.password || url.hash) return;
    // Never accept duplicate parameters or unsolicited/replayed callbacks.
    for (const key of new Set(url.searchParams.keys())) if (url.searchParams.getAll(key).length !== 1) return;
    const nonce = url.searchParams.get(pending.kind === 'bind' ? 'nonce' : 'request');
    if (nonce !== pending.nonce) return;
    if (pending.expires <= this.runtime.now()) {
      await this.save({ ...this.saved, pending: null });
      this.publish({ message: 'expired', returned: this.state.returned + 1 }); return;
    }
    let device = this.saved.device;
    let message: string;
    if (pending.kind === 'bind') {
      const id = url.searchParams.get('anonymous_device_id');
      const error = url.searchParams.get('error');
      if (token(id) && !url.searchParams.has('error')) { device = id; message = 'bound'; }
      else if (error && !url.searchParams.has('anonymous_device_id')) message = bindErrors.has(error) ? error : 'connect_failed';
      else return;
    } else {
      const status = url.searchParams.get('status');
      if (status === 'success' && !url.searchParams.has('reason')) message = 'connected';
      else if (status === 'failure') {
        const reason = url.searchParams.get('reason') ?? '';
        message = controlErrors.has(reason) ? reason : 'connect_failed';
        if (message === 'device_not_found') device = null;
      } else return;
    }
    await this.save({ device, pending: null });
    this.publish({ message, returned: this.state.returned + 1 });
  });
}
