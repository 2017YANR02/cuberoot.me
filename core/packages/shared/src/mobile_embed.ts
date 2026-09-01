import {
  isMobileAuthProvider,
  isWebSessionTicket,
  type MobileAuthProvider,
} from './auth/web_session';

export const MOBILE_EMBED_FRAME_NAMES = {
  account: 'cuberoot-mobile-account',
  tools: 'cuberoot-mobile-tools',
} as const;

export type MobileEmbedSurface = keyof typeof MOBILE_EMBED_FRAME_NAMES;

export interface MobileEmbedInitMessage {
  surface: MobileEmbedSurface;
  type: 'cuberoot:mobile:init';
}

export interface MobileEmbedNavigationMessage {
  depth: number;
  href: string;
  surface: MobileEmbedSurface;
  type: 'cuberoot:mobile:navigation';
}

export interface MobileEmbedBackMessage {
  surface: MobileEmbedSurface;
  type: 'cuberoot:mobile:back';
}

export interface MobileEmbedAuthRequestMessage {
  provider: MobileAuthProvider | null;
  surface: 'account';
  type: 'cuberoot:mobile:auth-request';
}

export interface MobileEmbedAuthClearMessage {
  surface: 'account';
  type: 'cuberoot:mobile:auth-clear';
}

export interface MobileEmbedWebSessionMessage {
  requestId?: string;
  surface: 'account';
  ticket: string;
  type: 'cuberoot:mobile:web-session';
}

export interface MobileEmbedWebSessionResultMessage {
  ok: boolean;
  requestId?: string;
  surface: 'account';
  type: 'cuberoot:mobile:web-session-result';
}

export interface MobileEmbedExternalMessage {
  href: string;
  surface: MobileEmbedSurface;
  type: 'cuberoot:mobile:external';
}

export function mobileEmbedSurfaceFromFrameName(value: string): MobileEmbedSurface | null {
  if (value === MOBILE_EMBED_FRAME_NAMES.tools) return 'tools';
  if (value === MOBILE_EMBED_FRAME_NAMES.account) return 'account';
  return null;
}

export function mobileEmbedNavigationMessage(
  surface: MobileEmbedSurface,
  href: string,
  depth: number,
): MobileEmbedNavigationMessage {
  return {
    depth: Number.isSafeInteger(depth) && depth >= 0 ? depth : 0,
    href,
    surface,
    type: 'cuberoot:mobile:navigation',
  };
}

export function mobileEmbedBackMessage(surface: MobileEmbedSurface): MobileEmbedBackMessage {
  return { surface, type: 'cuberoot:mobile:back' };
}

export function mobileEmbedInitMessage(surface: MobileEmbedSurface): MobileEmbedInitMessage {
  return { surface, type: 'cuberoot:mobile:init' };
}

export function mobileEmbedAuthRequestMessage(
  provider: MobileAuthProvider | null = null,
): MobileEmbedAuthRequestMessage {
  return { provider, surface: 'account', type: 'cuberoot:mobile:auth-request' };
}

export function mobileEmbedAuthClearMessage(): MobileEmbedAuthClearMessage {
  return { surface: 'account', type: 'cuberoot:mobile:auth-clear' };
}

export function mobileEmbedWebSessionMessage(
  ticket: string,
  requestId: string,
): MobileEmbedWebSessionMessage {
  return requestId
    ? { requestId, surface: 'account', ticket, type: 'cuberoot:mobile:web-session' }
    : { surface: 'account', ticket, type: 'cuberoot:mobile:web-session' };
}

export function mobileEmbedWebSessionResultMessage(
  ok: boolean,
  requestId: string | undefined,
): MobileEmbedWebSessionResultMessage {
  return requestId
    ? { ok, requestId, surface: 'account', type: 'cuberoot:mobile:web-session-result' }
    : { ok, surface: 'account', type: 'cuberoot:mobile:web-session-result' };
}

export function mobileEmbedExternalMessage(
  surface: MobileEmbedSurface,
  href: string,
): MobileEmbedExternalMessage {
  return { href, surface, type: 'cuberoot:mobile:external' };
}

export function isMobileEmbedExternalHref(href: string): boolean {
  if (href.length > 2_048) return false;
  try {
    const protocol = new URL(href).protocol;
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}

export function decodeMobileEmbedNavigation(value: unknown): MobileEmbedNavigationMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedNavigationMessage>;
  if (candidate.type !== 'cuberoot:mobile:navigation'
    || (candidate.surface !== 'tools' && candidate.surface !== 'account')
    || typeof candidate.href !== 'string'
    || !Number.isSafeInteger(candidate.depth)
    || (candidate.depth ?? -1) < 0) {
    return null;
  }
  return candidate as MobileEmbedNavigationMessage;
}

export function decodeMobileEmbedBack(value: unknown): MobileEmbedBackMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedBackMessage>;
  if (candidate.type !== 'cuberoot:mobile:back'
    || (candidate.surface !== 'tools' && candidate.surface !== 'account')) {
    return null;
  }
  return candidate as MobileEmbedBackMessage;
}

export function decodeMobileEmbedInit(value: unknown): MobileEmbedInitMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedInitMessage>;
  if (candidate.type !== 'cuberoot:mobile:init'
    || (candidate.surface !== 'tools' && candidate.surface !== 'account')) {
    return null;
  }
  return candidate as MobileEmbedInitMessage;
}

export function decodeMobileEmbedAuthRequest(value: unknown): MobileEmbedAuthRequestMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedAuthRequestMessage>;
  if (candidate.type !== 'cuberoot:mobile:auth-request'
    || candidate.surface !== 'account'
    || (candidate.provider !== null && !isMobileAuthProvider(candidate.provider))) {
    return null;
  }
  return candidate as MobileEmbedAuthRequestMessage;
}

export function decodeMobileEmbedAuthClear(value: unknown): MobileEmbedAuthClearMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedAuthClearMessage>;
  if (candidate.type !== 'cuberoot:mobile:auth-clear' || candidate.surface !== 'account') {
    return null;
  }
  return candidate as MobileEmbedAuthClearMessage;
}

export function decodeMobileEmbedWebSession(value: unknown): MobileEmbedWebSessionMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedWebSessionMessage>;
  if (candidate.type !== 'cuberoot:mobile:web-session'
    || candidate.surface !== 'account'
    || (candidate.requestId !== undefined && !isMobileEmbedRequestId(candidate.requestId))
    || !isWebSessionTicket(candidate.ticket)) {
    return null;
  }
  return candidate as MobileEmbedWebSessionMessage;
}

export function decodeMobileEmbedWebSessionResult(
  value: unknown,
): MobileEmbedWebSessionResultMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedWebSessionResultMessage>;
  if (candidate.type !== 'cuberoot:mobile:web-session-result'
    || candidate.surface !== 'account'
    || (candidate.requestId !== undefined && !isMobileEmbedRequestId(candidate.requestId))
    || typeof candidate.ok !== 'boolean') {
    return null;
  }
  return candidate as MobileEmbedWebSessionResultMessage;
}

export function decodeMobileEmbedExternal(value: unknown): MobileEmbedExternalMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MobileEmbedExternalMessage>;
  if (candidate.type !== 'cuberoot:mobile:external'
    || (candidate.surface !== 'tools' && candidate.surface !== 'account')
    || typeof candidate.href !== 'string'
    || !isMobileEmbedExternalHref(candidate.href)) {
    return null;
  }
  return candidate as MobileEmbedExternalMessage;
}

function isMobileEmbedRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}
