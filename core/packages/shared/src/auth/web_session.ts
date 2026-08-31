import {
  isAvatarSource,
  isClawdAvatarPreset,
  type AvatarSource,
  type ClawdAvatarPresetId,
} from '../account_avatar';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const WEB_SESSION_TICKET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MOBILE_AUTH_RANDOM_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const MOBILE_AUTH_CALLBACK_SCHEMES = [
  'me.cuberoot.app',
  'me.cuberoot.app.debug',
] as const;

const MAX_AVATAR_LENGTH = 2048;
const MAX_DISPLAY_NAME_LENGTH = 200;
const MAX_SESSION_TOKEN_LENGTH = 4096;
const MAX_WCA_ID_LENGTH = 20;
const MIN_SESSION_TOKEN_LENGTH = 20;

export const WEB_SESSION_ERROR_CODES = [
  'UNAUTHENTICATED',
  'INVALID_SESSION',
  'INVALID_REQUEST',
  'INVALID_WCA_TOKEN',
  'WCA_UNAVAILABLE',
  'WECHAT_NOT_CONFIGURED',
  'INVALID_WECHAT_CODE',
  'DOUYIN_NOT_CONFIGURED',
  'INVALID_DOUYIN_CODE',
  'RATE_LIMITED',
  'ACCOUNT_BLOCKED',
  'WECHAT_UNAVAILABLE',
  'DOUYIN_UNAVAILABLE',
  'WECHAT_UNIONID_REQUIRED',
  'INVALID_WEB_SESSION_TICKET',
  'INVALID_MOBILE_SESSION_TICKET',
] as const;

export type WebSessionErrorCode = typeof WEB_SESSION_ERROR_CODES[number];

/**
 * Auth error envelope during the compatibility expansion period.
 * `error` remains byte-for-byte equal to `message` for older consumers.
 */
export interface WebSessionErrorEnvelope {
  code: WebSessionErrorCode;
  message: string;
  error: string;
}

/** Canonical public account shape emitted by CubeRoot authentication routes. */
export interface WebSessionUser {
  uid: number;
  wcaId: string | null;
  /** A newly-created WeChat account has no profile name yet, so the empty string is valid. */
  name: string;
  avatar: string;
  avatarSource: AvatarSource;
  avatarPreset: ClawdAvatarPresetId | null;
}

export interface WebSession {
  token: string;
  user: WebSessionUser;
}

export interface WebSessionUserEnvelope {
  user: WebSessionUser;
}

export interface WebSessionTicketEnvelope {
  ticket: string;
  expiresIn: number;
}

export const MOBILE_AUTH_PROVIDERS = [
  'wca',
  'google',
  'wechat',
  'qq',
  'alipay',
] as const;

export type MobileAuthProvider = typeof MOBILE_AUTH_PROVIDERS[number];

export interface MobileAuthRequest {
  codeChallenge: string;
  state: string;
  callbackUrl: string;
  language: 'en' | 'zh';
  provider: MobileAuthProvider | null;
}

export interface MobileAuthCallback {
  ticket: string;
  state: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

const WEB_SESSION_ERROR_CODE_SET = new Set<string>(WEB_SESSION_ERROR_CODES);

export function webSessionError(
  code: WebSessionErrorCode,
  message: string,
): WebSessionErrorEnvelope {
  return { code, message, error: message };
}

export function decodeWebSessionError(value: unknown): WebSessionErrorEnvelope | null {
  const envelope = asRecord(value);
  if (!envelope
    || typeof envelope.code !== 'string'
    || !WEB_SESSION_ERROR_CODE_SET.has(envelope.code)
    || typeof envelope.message !== 'string'
    || typeof envelope.error !== 'string'
    || envelope.message.length === 0
    || envelope.message !== envelope.error
    || CONTROL_CHARACTER_PATTERN.test(envelope.message)) {
    return null;
  }
  return {
    code: envelope.code as WebSessionErrorCode,
    message: envelope.message,
    error: envelope.error,
  };
}

export function isWebSessionTicket(value: unknown): value is string {
  return typeof value === 'string' && WEB_SESSION_TICKET_PATTERN.test(value);
}

export function isMobileAuthRandomValue(value: unknown): value is string {
  return typeof value === 'string' && MOBILE_AUTH_RANDOM_PATTERN.test(value);
}

export const isMobileAuthCodeChallenge = isMobileAuthRandomValue;
export const isMobileAuthCodeVerifier = isMobileAuthRandomValue;
export const isMobileAuthState = isMobileAuthRandomValue;

export function isMobileAuthProvider(value: unknown): value is MobileAuthProvider {
  return typeof value === 'string'
    && MOBILE_AUTH_PROVIDERS.includes(value as MobileAuthProvider);
}

export function isMobileAuthCallbackUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const scheme = url.protocol.slice(0, -1);
    return MOBILE_AUTH_CALLBACK_SCHEMES.includes(
      scheme as typeof MOBILE_AUTH_CALLBACK_SCHEMES[number],
    )
      && url.hostname === 'auth'
      && url.pathname === '/callback'
      && url.username === ''
      && url.password === ''
      && url.search === ''
      && url.hash === '';
  } catch {
    return false;
  }
}

export function decodeMobileAuthRequest(search: string): MobileAuthRequest | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const codeChallenge = params.get('code_challenge')?.trim() ?? '';
  const state = params.get('state')?.trim() ?? '';
  const callbackUrl = params.get('callback_url')?.trim() ?? '';
  const language = params.get('lang') === 'zh' ? 'zh' : 'en';
  const rawProvider = params.get('provider');
  const provider = rawProvider === null ? null : rawProvider.trim();
  if (!isMobileAuthCodeChallenge(codeChallenge)
    || !isMobileAuthState(state)
    || !isMobileAuthCallbackUrl(callbackUrl)
    || (provider !== null && !isMobileAuthProvider(provider))) {
    return null;
  }
  return { codeChallenge, state, callbackUrl, language, provider };
}

export function decodeMobileAuthCallback(value: string): MobileAuthCallback | null {
  try {
    const url = new URL(value);
    const callbackBase = `${url.protocol}//${url.host}${url.pathname}`;
    const keys = Array.from(url.searchParams.keys());
    const ticket = url.searchParams.get('ticket')?.trim() ?? '';
    const state = url.searchParams.get('state')?.trim() ?? '';
    if (!isMobileAuthCallbackUrl(callbackBase)
      || !isWebSessionTicket(ticket)
      || !isMobileAuthState(state)
      || keys.length !== 2
      || keys.filter((key) => key === 'ticket').length !== 1
      || keys.filter((key) => key === 'state').length !== 1
      || url.hash !== '') {
      return null;
    }
    return { ticket, state };
  } catch {
    return null;
  }
}

export function decodeWebSessionUser(value: unknown): WebSessionUser | null {
  const user = asRecord(value);
  if (!user) return null;
  if (typeof user.uid !== 'number' || !Number.isSafeInteger(user.uid) || user.uid <= 0) return null;
  if (user.wcaId !== null && typeof user.wcaId !== 'string') return null;
  if (typeof user.name !== 'string' || user.name.length > MAX_DISPLAY_NAME_LENGTH) return null;
  if (typeof user.avatar !== 'string' || user.avatar.length > MAX_AVATAR_LENGTH) return null;
  const avatarSource = user.avatarSource === undefined ? 'auto' : user.avatarSource;
  const avatarPreset = user.avatarPreset === undefined ? null : user.avatarPreset;
  if (!isAvatarSource(avatarSource)) return null;
  if (avatarSource === 'clawd') {
    if (!isClawdAvatarPreset(avatarPreset)) return null;
  } else if (avatarPreset !== null) {
    return null;
  }
  if (CONTROL_CHARACTER_PATTERN.test(user.name)
    || CONTROL_CHARACTER_PATTERN.test(user.avatar)
    || (typeof user.wcaId === 'string'
      && (user.wcaId.length > MAX_WCA_ID_LENGTH || CONTROL_CHARACTER_PATTERN.test(user.wcaId)))) {
    return null;
  }

  const wcaId = user.wcaId?.trim() || null;

  return {
    uid: user.uid,
    wcaId,
    name: user.name.trim(),
    avatar: user.avatar,
    avatarSource,
    avatarPreset,
  };
}

export function decodeWebSession(value: unknown): WebSession | null {
  const session = asRecord(value);
  if (!session) return null;
  const rawToken = typeof session.token === 'string' ? session.token : '';
  const user = decodeWebSessionUser(session.user);
  if (rawToken.length < MIN_SESSION_TOKEN_LENGTH
    || rawToken.length > MAX_SESSION_TOKEN_LENGTH
    || rawToken !== rawToken.trim()
    || CONTROL_CHARACTER_PATTERN.test(rawToken)
    || !user) {
    return null;
  }
  return { token: rawToken, user };
}

export function decodeWebSessionUserEnvelope(value: unknown): WebSessionUserEnvelope | null {
  const envelope = asRecord(value);
  if (!envelope) return null;
  const user = decodeWebSessionUser(envelope.user);
  return user ? { user } : null;
}

export function decodeWebSessionTicketEnvelope(value: unknown): WebSessionTicketEnvelope | null {
  const envelope = asRecord(value);
  if (!envelope
    || !isWebSessionTicket(envelope.ticket)
    || typeof envelope.expiresIn !== 'number'
    || !Number.isSafeInteger(envelope.expiresIn)
    || envelope.expiresIn <= 0) {
    return null;
  }
  return { ticket: envelope.ticket, expiresIn: envelope.expiresIn };
}
