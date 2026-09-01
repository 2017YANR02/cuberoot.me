import {
  decodeMobileAuthCallback,
  decodeWebSession,
  decodeWebSessionTicketEnvelope,
  decodeWebSessionUserEnvelope,
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

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
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

  constructor(private readonly runtime: MobileAuthRuntime) {}

  private async saveSession(session: WebSession): Promise<void> {
    await this.runtime.storage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  private async clearSession(): Promise<void> {
    await this.runtime.storage.removeItem(SESSION_KEY);
  }

  private async readSession(): Promise<WebSession | null> {
    const raw = await this.runtime.storage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const session = decodeWebSession(JSON.parse(raw));
      if (session) return session;
    } catch {
      // Invalid secure-storage data is removed below.
    }
    await this.clearSession();
    return null;
  }

  private async refreshIfNeeded(session: WebSession): Promise<WebSession | null> {
    const expiresAt = jwtExpiresAt(session.token);
    if (expiresAt === null || expiresAt - this.runtime.now() > REFRESH_BEFORE_MS) return session;
    try {
      const response = await fetchWithTimeout(
        this.runtime.fetcher,
        `${API_ORIGIN}/v1/auth/refresh`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } },
      );
      if (response.status === 401) {
        await this.clearSession();
        return null;
      }
      if (!response.ok) return session;
      const refreshed = decodeWebSession(await response.json());
      if (!refreshed) return session;
      await this.saveSession(refreshed);
      return refreshed;
    } catch {
      return session;
    }
  }

  async restore(): Promise<WebSession | null> {
    const stored = await this.readSession();
    if (!stored) return null;
    const session = await this.refreshIfNeeded(stored);
    if (!session) return null;
    try {
      const response = await fetchWithTimeout(
        this.runtime.fetcher,
        `${API_ORIGIN}/v1/auth/me`,
        { headers: { Authorization: `Bearer ${session.token}` } },
      );
      if (response.status === 401) {
        await this.clearSession();
        return null;
      }
      if (!response.ok) return session;
      const envelope = decodeWebSessionUserEnvelope(await response.json());
      if (!envelope) return session;
      const validated = { ...session, user: envelope.user };
      await this.saveSession(validated);
      return validated;
    } catch {
      // Offline startup retains the last valid local session.
      return session;
    }
  }

  async start(
    language: SupportedLanguage,
    provider: MobileAuthProvider | null = null,
  ): Promise<void> {
    const appId = await this.runtime.getAppId();
    const callbackUrl = `${appId}://auth/callback`;
    if (!isMobileAuthCallbackUrl(callbackUrl)) throw new Error('unsupported app identity');

    const codeVerifier = base64Url(this.runtime.randomBytes(32));
    const state = base64Url(this.runtime.randomBytes(32));
    const codeChallenge = base64Url(await this.runtime.digestSha256(
      new TextEncoder().encode(codeVerifier),
    ));
    if (!isMobileAuthRandomValue(codeVerifier)
      || !isMobileAuthRandomValue(state)
      || !isMobileAuthRandomValue(codeChallenge)) {
      throw new Error('mobile auth randomness unavailable');
    }

    const pending: PendingMobileAuth = {
      codeVerifier,
      createdAt: this.runtime.now(),
      state,
    };
    await this.runtime.storage.setItem(PENDING_KEY, JSON.stringify(pending));

    const url = new URL('/auth/mobile', SITE_ORIGIN);
    url.searchParams.set('callback_url', callbackUrl);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('lang', language);
    url.searchParams.set('state', state);
    if (provider) url.searchParams.set('provider', provider);
    try {
      await this.runtime.openBrowser(url.toString());
    } catch (error) {
      await this.runtime.storage.removeItem(PENDING_KEY);
      throw error;
    }
  }

  async issueWebSessionTicket(): Promise<WebSessionTicketEnvelope> {
    const session = await this.readSession();
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
    if (response.status === 401) await this.clearSession();
    if (!response.ok) throw new Error('web session ticket request failed');
    const ticket = decodeWebSessionTicketEnvelope(await response.json());
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
    const callback = decodeMobileAuthCallback(callbackUrl);
    if (!callback) return null;
    const pending = decodePending(await this.runtime.storage.getItem(PENDING_KEY));
    if (!pending || callback.state !== pending.state) return null;
    if (this.runtime.now() - pending.createdAt > PENDING_TTL_MS) {
      await this.runtime.storage.removeItem(PENDING_KEY);
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
    if (!response.ok) {
      if (response.status === 401) await this.runtime.storage.removeItem(PENDING_KEY);
      throw new Error('mobile auth exchange failed');
    }
    const session = decodeWebSession(await response.json());
    if (!session) throw new Error('invalid mobile auth session');
    await this.saveSession(session);
    await this.runtime.storage.removeItem(PENDING_KEY);
    try {
      await this.runtime.closeBrowser();
    } catch {
      // Some Android browser implementations close themselves after the deep link.
    }
    return session;
  }

  async logout(): Promise<void> {
    await Promise.all([
      this.runtime.storage.removeItem(SESSION_KEY),
      this.runtime.storage.removeItem(PENDING_KEY),
    ]);
  }
}
