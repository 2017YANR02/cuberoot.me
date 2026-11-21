import {
  createAuthCodeChallenge,
  decodeMobileAuthCallback,
  decodeWebSession,
  decodeWebSessionTicketEnvelope,
  decodeWebSessionUserEnvelope,
  encodeAuthRandomValue,
  isMobileAuthCallbackUrl,
  isMobileAuthRandomValue,
  type MobileAuthProvider,
  type WebSession,
  type WebSessionTicketEnvelope,
} from '@cuberoot/shared/auth/web-session';

import type { SupportedLanguage } from '../copy';

const API_ORIGIN = 'https://api.cuberoot.me';
const SITE_ORIGIN = 'https://cuberoot.me';
const SESSION_KEY = 'session';
const PENDING_KEY = 'pending_auth';
const PENDING_TTL_MS = 10 * 60 * 1000;
const REFRESH_BEFORE_MS = 30 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

interface PendingMobileAuth {
  codeVerifier: string;
  createdAt: number;
  state: string;
}

export interface MobileAuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface MobileAuthRuntime {
  closeBrowser(): Promise<void>;
  digestSha256(value: Uint8Array): Promise<Uint8Array>;
  fetcher: typeof fetch;
  getAppId(): Promise<string>;
  now(): number;
  openBrowser(url: string): Promise<void>;
  randomBytes(length: number): Uint8Array;
  storage: MobileAuthStorage;
}

function decodePending(value: string | null): PendingMobileAuth | null {
  if (!value) return null;
  try {
    const pending = JSON.parse(value) as Partial<PendingMobileAuth>;
    if (!isMobileAuthRandomValue(pending.codeVerifier)
      || !isMobileAuthRandomValue(pending.state)
      || typeof pending.createdAt !== 'number'
      || !Number.isSafeInteger(pending.createdAt)
      || pending.createdAt <= 0) {
      return null;
    }
    return {
      codeVerifier: pending.codeVerifier,
      createdAt: pending.createdAt,
      state: pending.state,
    };
  } catch {
    return null;
  }
}

export function jwtExpiresAt(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as {
      exp?: unknown;
    };
    return typeof decoded.exp === 'number' && Number.isFinite(decoded.exp)
      ? decoded.exp * 1000
      : null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  fetcher: typeof fetch,
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export class InstalledAuthClient {
  private finishing: Promise<WebSession | null> | null = null;
  private starting: Promise<void> | null = null;
  private sessionRevision = 0;
  private storageWrites: Promise<void> = Promise.resolve();
  // Android may deliver the same intent through appUrlOpen and getLaunchUrl.
  // Remember only a successfully consumed callback, never a session to replay.
  private completedCallback: string | null = null;

  constructor(private readonly runtime: MobileAuthRuntime) {}

  // Network and native-storage calls can finish after logout or a newer login.
  // Serialize writes so an already-running native write also precedes logout.
  private mutateStorage(revision: number, write: () => Promise<void>): Promise<boolean> {
    const operation = this.storageWrites.then(async () => {
      if (revision !== this.sessionRevision) return false;
      await write();
      return revision === this.sessionRevision;
    });
    this.storageWrites = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private saveSession(session: WebSession, revision: number): Promise<boolean> {
    return this.mutateStorage(revision, () => this.runtime.storage.setItem(SESSION_KEY, JSON.stringify(session)));
  }

  private clearSession(revision: number): Promise<boolean> {
    return this.mutateStorage(revision, () => this.runtime.storage.removeItem(SESSION_KEY));
  }

  private async readSession(revision: number): Promise<WebSession | null> {
    await this.storageWrites;
    const raw = await this.runtime.storage.getItem(SESSION_KEY);
    if (revision !== this.sessionRevision) return null;
    if (!raw) return null;
    try {
      const session = decodeWebSession(JSON.parse(raw));
      if (session) return session;
    } catch {
      // Invalid secure-storage data is removed below.
    }
    await this.clearSession(revision);
    return null;
  }

  private async refreshIfNeeded(session: WebSession, revision: number): Promise<WebSession | null> {
    const expiresAt = jwtExpiresAt(session.token);
    if (expiresAt === null || expiresAt - this.runtime.now() > REFRESH_BEFORE_MS) return session;
    try {
      const response = await fetchWithTimeout(
        this.runtime.fetcher,
        `${API_ORIGIN}/v1/auth/refresh`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } },
      );
      if (revision !== this.sessionRevision) return null;
      if (response.status === 401) {
        await this.clearSession(revision);
        return null;
      }
      if (!response.ok) return session;
      const refreshed = decodeWebSession(await response.json());
      if (revision !== this.sessionRevision) return null;
      if (!refreshed) return session;
      return await this.saveSession(refreshed, revision) ? refreshed : null;
    } catch {
      return revision === this.sessionRevision ? session : null;
    }
  }

  async restore(): Promise<WebSession | null> {
    const revision = this.sessionRevision;
    const stored = await this.readSession(revision);
    if (!stored) return null;
    const session = await this.refreshIfNeeded(stored, revision);
    if (!session || revision !== this.sessionRevision) return null;
    try {
      const response = await fetchWithTimeout(
        this.runtime.fetcher,
        `${API_ORIGIN}/v1/auth/me`,
        { headers: { Authorization: `Bearer ${session.token}` } },
      );
      if (revision !== this.sessionRevision) return null;
      if (response.status === 401) {
        await this.clearSession(revision);
        return null;
      }
      if (!response.ok) return session;
      const envelope = decodeWebSessionUserEnvelope(await response.json());
      if (revision !== this.sessionRevision) return null;
      // Both profiles have the canonical field order from decodeWebSessionUser.
      if (!envelope || JSON.stringify(envelope.user) === JSON.stringify(session.user)) return session;
      const validated = { ...session, user: envelope.user };
      return await this.saveSession(validated, revision) ? validated : null;
    } catch {
      // Offline startup retains the last valid local session.
      return revision === this.sessionRevision ? session : null;
    }
  }

  start(
    language: SupportedLanguage,
    provider: MobileAuthProvider | null = null,
  ): Promise<void> {
    if (this.starting) return this.starting;
    const operation = this.startOnce(language, provider).finally(() => {
      if (this.starting === operation) this.starting = null;
    });
    this.starting = operation;
    return operation;
  }

  private async startOnce(
    language: SupportedLanguage,
    provider: MobileAuthProvider | null,
  ): Promise<void> {
    const revision = this.sessionRevision;
    const appId = await this.runtime.getAppId();
    const callbackUrl = `${appId}://auth/callback`;
    if (!isMobileAuthCallbackUrl(callbackUrl)) throw new Error('unsupported app identity');

    await this.storageWrites;
    let pending = decodePending(await this.runtime.storage.getItem(PENDING_KEY));
    if (pending && this.runtime.now() - pending.createdAt > PENDING_TTL_MS) pending = null;
    const created = !pending;
    pending ??= {
      codeVerifier: encodeAuthRandomValue(this.runtime.randomBytes(32)),
      createdAt: this.runtime.now(),
      state: encodeAuthRandomValue(this.runtime.randomBytes(32)),
    };
    const codeChallenge = await createAuthCodeChallenge(
      pending.codeVerifier,
      (value) => this.runtime.digestSha256(value),
    );
    if (!isMobileAuthRandomValue(pending.codeVerifier)
      || !isMobileAuthRandomValue(pending.state)
      || !isMobileAuthRandomValue(codeChallenge)) {
      throw new Error('mobile auth randomness unavailable');
    }

    if (revision !== this.sessionRevision) return;
    if (created && !await this.mutateStorage(revision,
      () => this.runtime.storage.setItem(PENDING_KEY, JSON.stringify(pending)))) return;

    const url = new URL('/auth/mobile', SITE_ORIGIN);
    url.searchParams.set('callback_url', callbackUrl);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('lang', language);
    url.searchParams.set('state', pending.state);
    if (provider) url.searchParams.set('provider', provider);
    try {
      await this.runtime.openBrowser(url.toString());
    } catch (error) {
      if (created) await this.mutateStorage(revision, () => this.runtime.storage.removeItem(PENDING_KEY));
      throw error;
    }
  }

  async issueWebSessionTicket(): Promise<WebSessionTicketEnvelope> {
    const revision = this.sessionRevision;
    const session = await this.readSession(revision);
    if (!session) throw new Error('mobile auth session unavailable');
    const response = await fetchWithTimeout(
      this.runtime.fetcher,
      `${API_ORIGIN}/v1/auth/web-session/ticket`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        cache: 'no-store',
      },
    );
    if (revision !== this.sessionRevision) throw new Error('mobile auth session changed');
    if (response.status === 401) await this.clearSession(revision);
    if (!response.ok) throw new Error('web session ticket request failed');
    const ticket = decodeWebSessionTicketEnvelope(await response.json());
    if (revision !== this.sessionRevision) throw new Error('mobile auth session changed');
    if (!ticket) throw new Error('invalid web session ticket response');
    return ticket;
  }

  finish(callbackUrl: string): Promise<WebSession | null> {
    if (this.finishing) return this.finishing;
    const operation = this.finishOnce(callbackUrl).finally(() => {
      if (this.finishing === operation) this.finishing = null;
    });
    this.finishing = operation;
    return operation;
  }

  private async finishOnce(callbackUrl: string): Promise<WebSession | null> {
    const revision = this.sessionRevision;
    const callback = decodeMobileAuthCallback(callbackUrl);
    if (!callback || this.completedCallback === callbackUrl) return null;
    await this.storageWrites;
    const pending = decodePending(await this.runtime.storage.getItem(PENDING_KEY));
    if (revision !== this.sessionRevision) return null;
    if (!pending) throw new Error('mobile auth request unavailable');
    if (callback.state !== pending.state) throw new Error('mobile auth state mismatch');
    if (this.runtime.now() - pending.createdAt > PENDING_TTL_MS) {
      await this.mutateStorage(revision, () => this.runtime.storage.removeItem(PENDING_KEY));
      throw new Error('mobile auth request expired');
    }

    const response = await fetchWithTimeout(
      this.runtime.fetcher,
      `${API_ORIGIN}/v1/auth/mobile-session/exchange`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket: callback.ticket,
          codeVerifier: pending.codeVerifier,
        }),
      },
    );
    if (revision !== this.sessionRevision) return null;
    if (!response.ok) {
      if (response.status === 401) await this.mutateStorage(revision, () => this.runtime.storage.removeItem(PENDING_KEY));
      throw new Error('mobile auth exchange failed');
    }
    const session = decodeWebSession(await response.json());
    if (revision !== this.sessionRevision) return null;
    if (!session) throw new Error('invalid mobile auth session');
    const nextRevision = ++this.sessionRevision;
    if (!await this.saveSession(session, nextRevision)) return null;
    if (!await this.mutateStorage(nextRevision, () => this.runtime.storage.removeItem(PENDING_KEY))) return null;
    this.completedCallback = callbackUrl;
    try {
      await this.runtime.closeBrowser();
    } catch {
      // Some Android browser implementations close themselves after the deep link.
    }
    return nextRevision === this.sessionRevision ? session : null;
  }

  async logout(): Promise<void> {
    const revision = ++this.sessionRevision;
    await this.mutateStorage(revision, async () => {
      await Promise.all([
        this.runtime.storage.removeItem(SESSION_KEY),
        this.runtime.storage.removeItem(PENDING_KEY),
      ]);
    });
  }
}
