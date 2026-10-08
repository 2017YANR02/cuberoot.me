'use client';

import { decodeWebSession, type WebSessionUser } from '@cuberoot/shared/auth/web-session';
import { persistItem } from './safe-storage';

export const WEB_SESSION_MARKER_KEY = 'cuberoot_web_session_marker';
const PREFIX = 'web-session:';
const ENDPOINT = '/api/web-session';
let revision = 0;
let legacyRead = false;
let legacyToken: string | null = null;
let cached: { marker: string; token: string; expiresAt: number } | null = null;
let pending: { marker: string; promise: Promise<string> } | null = null;
let mutation: Promise<unknown> = Promise.resolve();
const listeners = new Set<(user: WebSessionUser | null) => void>();

export function subscribeWebSession(listener: (user: WebSessionUser | null) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function markerFromStorage(): string {
  try { return localStorage.getItem(WEB_SESSION_MARKER_KEY) ?? ''; } catch { return ''; }
}
function embeddedHeader(): Record<string, string> {
  return typeof window !== 'undefined' && window.parent !== window ? { 'X-Web-Session-Embedded': '1' } : {};
}
function notify(user: WebSessionUser | null): void { listeners.forEach(listener => listener(user)); }
function removeLegacy(): void {
  legacyToken = null;
  for (const key of ['cuberoot_jwt', 'wca_access_token']) {
    try { localStorage.removeItem(key); } catch { /* no new credentials are persisted */ }
  }
}
export function isWebSessionMarker(token: string): boolean { return token.startsWith(PREFIX); }

/** Synchronous identity marker for existing UI; it is never an API credential. */
export function getWebSessionMarker(): string {
  if (typeof window === 'undefined') return '';
  let marker = markerFromStorage();
  if (!legacyRead) {
    legacyRead = true;
    try { legacyToken = localStorage.getItem('cuberoot_jwt'); } catch { /* unavailable storage */ }
  }
  if (!marker && legacyToken) {
    marker = PREFIX + crypto.randomUUID();
    if (!persistItem(WEB_SESSION_MARKER_KEY, marker)) return '';
  }
  return marker;
}
function expiresAt(token: string): number {
  try {
    const exp = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp;
    if (typeof exp === 'number') return Math.min(exp * 1000, Date.now() + 15 * 60_000);
  } catch { /* response validation still requires a credential */ }
  return Date.now() + 14 * 60_000;
}
async function accept(response: Response, marker: string, expectedRevision: number, isCurrent: () => boolean = () => true): Promise<string> {
  if (!response.ok) throw new Error('Could not restore your session.');
  const body: unknown = await response.json();
  const session = decodeWebSession(body);
  if (!session || (body as { generation?: unknown }).generation !== marker.slice(PREFIX.length)) {
    throw new Error('Invalid web session response.');
  }
  if (!isCurrent()) throw new Error('Session request cancelled.');
  if (expectedRevision !== revision || markerFromStorage() !== marker) throw new Error('Session changed.');
  cached = { marker, token: session.token, expiresAt: expiresAt(session.token) };
  removeLegacy();
  notify(session.user);
  return session.token;
}
function enqueue<T>(action: () => Promise<T>): Promise<T> {
  const next = mutation.catch(() => undefined).then(action);
  mutation = next.catch(() => undefined);
  return next;
}

function isBrowserAccess(token: string): boolean {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).browserAccess === true; }
  catch { return false; }
}

/** Exchange a login credential for HttpOnly persistence and an in-memory access token. */
export async function establishWebSession(token: string, isCurrent: () => boolean = () => true): Promise<string> {
  const previousMarker = markerFromStorage();
  const rotate = isBrowserAccess(token);
  if (rotate && !previousMarker) throw new Error('No durable web session.');
  const marker = PREFIX + crypto.randomUUID();
  const expectedRevision = ++revision;
  cached = null;
  if (!persistItem(WEB_SESSION_MARKER_KEY, marker) || markerFromStorage() !== marker) {
    throw new Error('Could not save your session marker.');
  }
  const promise = enqueue(async () => {
    if (expectedRevision !== revision || markerFromStorage() !== marker) throw new Error('Session changed.');
    const response = await fetch(ENDPOINT, {
      method: rotate ? 'PATCH' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { ...embeddedHeader(), 'Content-Type': 'application/json', 'X-Web-Session': (rotate ? previousMarker : marker).slice(PREFIX.length) },
      body: JSON.stringify({ token, generation: marker.slice(PREFIX.length) }),
    });
    return accept(response, marker, expectedRevision, isCurrent);
  });
  pending = { marker, promise };
  try { await promise; return marker; }
  catch (error) {
    if (expectedRevision === revision && markerFromStorage() === marker) {
      // The response may already have set HttpOnly cookies before a caller unmounts.
      // Clear that exact generation as well as local state; never touch a newer login.
      await clearWebSession().catch(() => undefined);
    }
    throw error;
  } finally { if (pending?.promise === promise) pending = null; }
}

/** Resolve markers just before a request; temporary role-preview tokens pass through. */
export async function getWebAccessToken(token: string): Promise<string> {
  if (!isWebSessionMarker(token)) return token;
  if (markerFromStorage() !== token) throw new Error('Session changed.');
  if (cached?.marker === token && cached.expiresAt > Date.now() + 60_000) return cached.token;
  if (pending?.marker === token) return pending.promise;
  const expectedRevision = revision;
  const oldToken = legacyToken;
  const request = () => fetch(ENDPOINT, {
    method: oldToken ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: { ...embeddedHeader(), 'X-Web-Session': token.slice(PREFIX.length), ...(oldToken ? { 'Content-Type': 'application/json' } : {}) },
    ...(oldToken ? { body: JSON.stringify({ token: oldToken, generation: token.slice(PREFIX.length) }) } : {}),
  });
  const promise = (oldToken ? enqueue(request) : request()).then(response => accept(response, token, expectedRevision));
  pending = { marker: token, promise };
  try { return await promise; }
  finally { if (pending?.promise === promise) pending = null; }
}

/** Invalidate locally before the asynchronous cookie deletion can finish. */
export function clearWebSession(): Promise<void> {
  const marker = markerFromStorage();
  revision++;
  cached = null;
  pending = null;
  legacyRead = true;
  removeLegacy();
  try { localStorage.removeItem(WEB_SESSION_MARKER_KEY); } catch { /* unavailable storage */ }
  notify(null);
  return enqueue(async () => {
    const response = await fetch(ENDPOINT, {
      method: 'DELETE', credentials: 'same-origin', cache: 'no-store', keepalive: true,
      headers: { ...embeddedHeader(), 'X-Web-Session': marker.slice(PREFIX.length) },
    });
    if (!response.ok) throw new Error('Could not clear the session cookie.');
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== null && event.key !== WEB_SESSION_MARKER_KEY) return;
    revision++;
    cached = null;
    pending = null;
    legacyToken = null;
    legacyRead = true;
    if (!markerFromStorage()) notify(null);
  });
}
