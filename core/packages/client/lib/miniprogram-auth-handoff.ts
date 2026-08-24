'use client';

import { apiUrl } from './api-base';
import { safeNext } from './safe-next';
import {
  decodeWebSession,
  isWebSessionTicket,
  type WebSession,
} from '@cuberoot/shared/auth/web-session';

export const MINIPROGRAM_HANDOFF_FALLBACK = '/zh/timer';
export const MINIPROGRAM_LOGOUT_FALLBACK = '/zh/account';

const WEB_SESSION_EXCHANGE_TIMEOUT_MS = 12_000;

export type MiniProgramWebSession = WebSession;

interface MiniProgramHandoff {
  ticket: string;
  next: string;
}

interface MiniProgramLogout {
  next: string;
}

let exchangeCache: { ticket: string; promise: Promise<MiniProgramWebSession> } | null = null;

export function parseMiniProgramHandoff(hash: string): MiniProgramHandoff | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const ticket = params.get('ticket')?.trim() ?? '';
  if (!isWebSessionTicket(ticket)) return null;
  return {
    ticket,
    next: safeNext(params.get('next')) ?? MINIPROGRAM_HANDOFF_FALLBACK,
  };
}

export function parseMiniProgramLogout(hash: string): MiniProgramLogout | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  if (params.get('action') !== 'logout') return null;
  return {
    next: safeNext(params.get('next')) ?? MINIPROGRAM_LOGOUT_FALLBACK,
  };
}

export function exchangeMiniProgramWebSession(ticket: string): Promise<MiniProgramWebSession> {
  if (!isWebSessionTicket(ticket)) {
    return Promise.reject(new Error('invalid web session ticket'));
  }
  if (exchangeCache?.ticket === ticket) return exchangeCache.promise;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEB_SESSION_EXCHANGE_TIMEOUT_MS);
  const promise = fetch(apiUrl('/v1/auth/web-session/exchange'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket }),
    cache: 'no-store',
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('web session exchange failed');
      const session = decodeWebSession(await response.json());
      if (!session) throw new Error('invalid web session response');
      return session;
    })
    .finally(() => clearTimeout(timeout));

  exchangeCache = { ticket, promise };
  const clearPendingExchange = () => {
    if (exchangeCache?.promise === promise) exchangeCache = null;
  };
  void promise.then(clearPendingExchange, clearPendingExchange);
  return promise;
}
