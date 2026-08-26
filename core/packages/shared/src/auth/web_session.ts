import {
  isAvatarSource,
  isClawdAvatarPreset,
  type AvatarSource,
  type ClawdAvatarPresetId,
} from '../account_avatar';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const WEB_SESSION_TICKET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

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
  'RATE_LIMITED',
  'ACCOUNT_BLOCKED',
  'WECHAT_UNAVAILABLE',
  'WECHAT_UNIONID_REQUIRED',
  'INVALID_WEB_SESSION_TICKET',
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
