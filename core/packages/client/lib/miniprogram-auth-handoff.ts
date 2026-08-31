'use client';

import { safeNext } from './safe-next';
import {
  isWebSessionTicket,
  type WebSession,
} from '@cuberoot/shared/auth/web-session';
import { exchangeWebSessionTicket } from './web-session-handoff';

export const MINIPROGRAM_HANDOFF_FALLBACK = '/zh/timer';
export const MINIPROGRAM_LOGOUT_FALLBACK = '/zh/account';

export type MiniProgramWebSession = WebSession;

interface MiniProgramHandoff {
  ticket: string;
  next: string;
}

interface MiniProgramLogout {
  next: string;
}

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
  return exchangeWebSessionTicket(ticket);
}
