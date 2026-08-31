'use client';

import {
  decodeWebSession,
  isWebSessionTicket,
  type WebSession,
} from '@cuberoot/shared/auth/web-session';

import { apiUrl } from './api-base';

const WEB_SESSION_EXCHANGE_TIMEOUT_MS = 12_000;

let exchangeCache: { ticket: string; promise: Promise<WebSession> } | null = null;

/**
 * Exchange the canonical short-lived web-session ticket. Native Mobile and the
 * Mini Program share this helper so neither shell creates a second account flow.
 */
export function exchangeWebSessionTicket(ticket: string): Promise<WebSession> {
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
