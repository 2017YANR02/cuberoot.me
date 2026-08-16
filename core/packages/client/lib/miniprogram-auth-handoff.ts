'use client';

import { apiUrl } from './api-base';
import { safeNext } from './safe-next';

export const MINIPROGRAM_HANDOFF_FALLBACK = '/zh/timer';

const WEB_SESSION_TICKET_RE = /^[A-Za-z0-9_-]{43}$/;

export interface MiniProgramWebSession {
  token: string;
  user: {
    uid?: number;
    wcaId: string | null;
    name: string;
    avatar?: string;
  };
}

interface MiniProgramHandoff {
  ticket: string;
  next: string;
}

let exchangeCache: { ticket: string; promise: Promise<MiniProgramWebSession> } | null = null;

function isWebSession(value: unknown): value is MiniProgramWebSession {
  if (value === null || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  if (typeof session.token !== 'string' || session.token.length < 20) return false;
  if (session.user === null || typeof session.user !== 'object') return false;
  const user = session.user as Record<string, unknown>;
  return (user.uid === undefined || (typeof user.uid === 'number' && Number.isSafeInteger(user.uid) && user.uid > 0))
    && (user.wcaId === null || typeof user.wcaId === 'string')
    && typeof user.name === 'string'
    && (user.avatar === undefined || typeof user.avatar === 'string');
}

export function parseMiniProgramHandoff(hash: string): MiniProgramHandoff | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const ticket = params.get('ticket')?.trim() ?? '';
  if (!WEB_SESSION_TICKET_RE.test(ticket)) return null;
  return {
    ticket,
    next: safeNext(params.get('next')) ?? MINIPROGRAM_HANDOFF_FALLBACK,
  };
}

export function exchangeMiniProgramWebSession(ticket: string): Promise<MiniProgramWebSession> {
  if (!WEB_SESSION_TICKET_RE.test(ticket)) {
    return Promise.reject(new Error('invalid web session ticket'));
  }
  if (exchangeCache?.ticket === ticket) return exchangeCache.promise;

  const promise = fetch(apiUrl('/v1/auth/web-session/exchange'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket }),
    cache: 'no-store',
  }).then(async (response) => {
    if (!response.ok) throw new Error('web session exchange failed');
    const session: unknown = await response.json();
    if (!isWebSession(session)) throw new Error('invalid web session response');
    return session;
  });

  exchangeCache = { ticket, promise };
  const clearPendingExchange = () => {
    if (exchangeCache?.promise === promise) exchangeCache = null;
  };
  void promise.then(clearPendingExchange, clearPendingExchange);
  return promise;
}
