'use client';

import {
  decodeMobileAuthRequest,
  decodeWebSessionTicketEnvelope,
  type MobileAuthRequest,
  type WebSessionTicketEnvelope,
} from '@cuberoot/shared/auth/web-session';
import { apiUrl } from './api-base';

const MOBILE_TICKET_TIMEOUT_MS = 12_000;

export function mobileAuthRequestPath(request: MobileAuthRequest): string {
  const params = new URLSearchParams({
    callback_url: request.callbackUrl,
    code_challenge: request.codeChallenge,
    lang: request.language,
    state: request.state,
  });
  if (request.provider) params.set('provider', request.provider);
  return `/auth/mobile?${params.toString()}`;
}

export function mobileAuthAccountHref(request: MobileAuthRequest): string {
  const prefix = request.language === 'zh' ? '/zh' : '';
  const params = new URLSearchParams({
    auth: 'mobile',
    next: mobileAuthRequestPath(request),
  });
  if (request.provider) params.set('provider', request.provider);
  return `${prefix}/account?${params.toString()}`;
}

export function mobileAuthCallbackHref(
  request: MobileAuthRequest,
  ticket: string,
): string {
  const url = new URL(request.callbackUrl);
  url.searchParams.set('ticket', ticket);
  url.searchParams.set('state', request.state);
  return url.toString();
}

export async function issueMobileAuthTicket(
  request: MobileAuthRequest,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<WebSessionTicketEnvelope> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MOBILE_TICKET_TIMEOUT_MS);
  try {
    const response = await fetcher(apiUrl('/v1/auth/mobile-session/ticket'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ codeChallenge: request.codeChallenge }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('mobile auth ticket request failed');
    const ticket = decodeWebSessionTicketEnvelope(await response.json());
    if (!ticket) throw new Error('invalid mobile auth ticket response');
    return ticket;
  } finally {
    clearTimeout(timeout);
  }
}

export { decodeMobileAuthRequest };
