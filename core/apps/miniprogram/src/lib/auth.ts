import { API_ORIGIN } from './runtime-config';
import {
  decodeWebSessionError,
  decodeWebSession,
  decodeWebSessionTicketEnvelope,
  decodeWebSessionUserEnvelope,
  decodeIdentityChoicePending,
  isWebSessionTicket,
  type PendingIdentity,
  type WebSessionTicketEnvelope,
} from '@cuberoot/shared/auth/web-session';
import {
  clearRuntimeTimeout,
  scheduleRuntimeTimeout,
  type RuntimeTimer,
} from './runtime-timers';
import {
  MINI_PROGRAM_LOGIN_ENDPOINT,
  MINI_PROGRAM_PROVIDER_NAME,
  isDouyinMiniProgram,
  miniProgramApi,
} from './platform';
import { tr } from './i18n';

const SESSION_STORAGE_KEY = 'cuberoot:session';
const MAX_AVATAR_LENGTH = 2048;
const MAX_DISPLAY_NAME_LENGTH = 200;
const MAX_SESSION_TOKEN_LENGTH = 4096;
const MAX_WCA_ID_LENGTH = 20;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const REQUEST_TIMEOUT_MS = 12_000;
const WEB_SESSION_REQUEST_TIMEOUT_MS = 5_000;
const HARD_TIMEOUT_GRACE_MS = 1_000;
const MINI_PROGRAM_LOGIN_TIMEOUT_MS = 10_000;
const STORAGE_ERROR_STATUS = -1;

export interface SessionUser {
  uid?: number;
  wcaId: string | null;
  name: string;
  avatar?: string;
}

export interface SessionData {
  token: string;
  user: SessionUser;
}

export type StoredSessionSnapshot =
  | { status: 'available'; session: SessionData | null }
  | { status: 'unavailable'; session: null };

export interface LoginResult extends SessionData {
  isNew: boolean;
}

export type WebSessionTicket = WebSessionTicketEnvelope;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string | null = null,
    public readonly pending: PendingIdentity | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isSessionStorageError(error: unknown): boolean {
  return error instanceof ApiError && error.status === STORAGE_ERROR_STATUS;
}

/** Compatibility decoder for persisted sessions written before uid/avatar became wire-required. */
function decodeStoredSessionUser(value: unknown): SessionUser | null {
  if (value === null || typeof value !== 'object') return null;
  const user = value as Record<string, unknown>;
  if (user.uid !== undefined
    && (typeof user.uid !== 'number' || !Number.isSafeInteger(user.uid) || user.uid <= 0)) {
    return null;
  }
  if (user.wcaId !== null && typeof user.wcaId !== 'string') return null;
  if (typeof user.name !== 'string' || user.name.length > MAX_DISPLAY_NAME_LENGTH) return null;
  if (user.avatar !== undefined
    && (typeof user.avatar !== 'string' || user.avatar.length > MAX_AVATAR_LENGTH)) {
    return null;
  }

  const wcaId = user.wcaId?.trim() || null;
  const name = user.name.trim();
  if (CONTROL_CHARACTER_PATTERN.test(name)) return null;
  if (wcaId && (wcaId.length > MAX_WCA_ID_LENGTH || CONTROL_CHARACTER_PATTERN.test(wcaId))) {
    return null;
  }
  return {
    ...(user.uid === undefined ? {} : { uid: user.uid }),
    wcaId,
    name,
    ...(user.avatar === undefined ? {} : { avatar: user.avatar }),
  };
}

function decodeStoredSession(value: unknown): SessionData | null {
  if (value === null || typeof value !== 'object') return null;
  const session = value as Record<string, unknown>;
  const token = typeof session.token === 'string' ? session.token.trim() : '';
  const user = decodeStoredSessionUser(session.user);
  if (token.length < 20
    || token.length > MAX_SESSION_TOKEN_LENGTH
    || CONTROL_CHARACTER_PATTERN.test(token)
    || !user) {
    return null;
  }
  return {
    token,
    user,
  };
}

type StoredSessionRead =
  | { available: true; value: unknown }
  | { available: false };

function readStoredSessionValue(): StoredSessionRead {
  try {
    return {
      available: true,
      value: miniProgramApi().getStorageSync(SESSION_STORAGE_KEY) as unknown,
    };
  } catch {
    return { available: false };
  }
}

function removeStoredSessionValue(): boolean {
  try {
    miniProgramApi().removeStorageSync(SESSION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function writeStoredSessionValue(session: SessionData): boolean {
  try {
    miniProgramApi().setStorageSync(SESSION_STORAGE_KEY, session);
    return true;
  } catch {
    return false;
  }
}

export function requestJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: WechatMiniprogram.IAnyObject;
    timeoutMs?: number;
    token?: string;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    let requestTask: WechatMiniprogram.RequestTask | undefined;
    let settled = false;
    let hardTimeout: RuntimeTimer | null = null;
    const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    const header: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.token) header.Authorization = `Bearer ${options.token}`;
    if (options.idempotencyKey) header['Idempotency-Key'] = options.idempotencyKey;
    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearRuntimeTimeout(hardTimeout);
      action();
    };
    hardTimeout = scheduleRuntimeTimeout(() => {
      settle(() => {
        try {
          requestTask?.abort();
        } catch {
          // The request must still settle even if the platform cannot abort it.
        }
        reject(new ApiError(0, 'request timed out'));
      });
    }, timeoutMs + HARD_TIMEOUT_GRACE_MS);
    if (hardTimeout === null) {
      settle(() => reject(new ApiError(0, 'request timeout unavailable')));
      return;
    }
    if (settled) return;

    try {
      requestTask = miniProgramApi().request({
        url: `${API_ORIGIN}${path}`,
        method: options.method ?? 'GET',
        data: options.body,
        header,
        timeout: timeoutMs,
        success(response) {
          settle(() => {
            const body = response.data as Record<string, unknown> | undefined;
            if (response.statusCode >= 200 && response.statusCode < 300) {
              resolve(response.data as T);
              return;
            }
            const authError = decodeWebSessionError(body);
            const pending = response.statusCode === 409 ? decodeIdentityChoicePending(body) : null;
            if (body?.code === 'ACCOUNT_CHOICE_REQUIRED' && !pending) {
              reject(new ApiError(502, 'invalid identity choice response'));
              return;
            }
            const platformError = body?.error && typeof body.error === 'object'
              ? body.error as Record<string, unknown> : null;
            reject(new ApiError(
              response.statusCode,
              authError?.message
                ?? (typeof platformError?.message === 'string' ? platformError.message : undefined)
                ?? (typeof body?.error === 'string' ? body.error : `HTTP ${response.statusCode}`),
              pending ? 'ACCOUNT_CHOICE_REQUIRED' : authError?.code
                ?? (typeof platformError?.code === 'string' ? platformError.code : typeof body?.code === 'string' ? body.code : null),
              pending,
            ));
          });
        },
        fail(error) {
          settle(() => reject(new ApiError(0, error.errMsg || 'network error')));
        },
      });
    } catch (error) {
      settle(() => reject(new ApiError(
        0,
        error instanceof Error ? error.message : 'request failed',
      )));
    }
  });
}

export function miniProgramLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let hardTimeout: RuntimeTimer | null = null;
    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearRuntimeTimeout(hardTimeout);
      action();
    };
    hardTimeout = scheduleRuntimeTimeout(
      () => settle(() => reject(new ApiError(0, 'mini program login timed out'))),
      MINI_PROGRAM_LOGIN_TIMEOUT_MS + HARD_TIMEOUT_GRACE_MS,
    );
    if (hardTimeout === null) {
      settle(() => reject(new ApiError(0, 'mini program login timeout unavailable')));
      return;
    }
    if (settled) return;

    try {
      miniProgramApi().login({
        ...(isDouyinMiniProgram()
          ? { force: true }
          : { timeout: MINI_PROGRAM_LOGIN_TIMEOUT_MS }),
        success(result) {
          settle(() => {
            const code = result.code?.trim();
            if (code) resolve(code);
            else reject(new ApiError(0, 'mini program login returned no code'));
          });
        },
        fail(error) {
          settle(() => reject(new ApiError(0, error.errMsg || 'mini program login failed')));
        },
      });
    } catch (error) {
      settle(() => reject(new ApiError(
        0,
        error instanceof Error ? error.message : 'mini program login failed',
      )));
    }
  });
}

export function getStoredSession(): SessionData | null {
  return getStoredSessionSnapshot().session;
}

export function getStoredSessionSnapshot(): StoredSessionSnapshot {
  const stored = readStoredSessionValue();
  if (!stored.available) return { status: 'unavailable', session: null };
  const { value } = stored;
  if (value === '' || value === null || value === undefined) {
    return { status: 'available', session: null };
  }
  const session = decodeStoredSession(value);
  if (!session && !removeStoredSessionValue()) {
    return { status: 'unavailable', session: null };
  }
  return { status: 'available', session };
}

export function clearStoredSession(): boolean {
  return removeStoredSessionValue();
}

export async function loginWithMiniProgram(
  options: { createAccount?: boolean; phoneCode?: string; isCurrent?: () => boolean } = {},
): Promise<LoginResult> {
  if (options.phoneCode && isDouyinMiniProgram()) throw new ApiError(400, 'unsupported phone authorization');
  const code = await miniProgramLoginCode();
  if (options.isCurrent && !options.isCurrent()) throw new ApiError(0, 'account choice canceled');
  const response = await requestJson<unknown>(MINI_PROGRAM_LOGIN_ENDPOINT, {
    method: 'POST',
    body: { code, ...(options.createAccount ? { create: true } : {}), ...(options.phoneCode ? { phoneCode: options.phoneCode } : {}) },
  });
  return saveLoginResponse(response, options.isCurrent);
}

function saveLoginResponse(response: unknown, isCurrent: () => boolean = () => true, expectedUid?: number): LoginResult {
  const session = decodeWebSession(response);
  if (!session) {
    throw new ApiError(502, 'invalid session response');
  }
  if (expectedUid !== undefined && session.user.uid !== expectedUid) throw new ApiError(409, 'account changed', 'ACCOUNT_CHANGED');
  if (!isCurrent()) throw new ApiError(0, 'account choice canceled');
  if (!writeStoredSessionValue(session)) {
    throw new ApiError(STORAGE_ERROR_STATUS, 'session storage unavailable');
  }
  return {
    ...session,
    isNew: response !== null
      && typeof response === 'object'
      && (response as Record<string, unknown>).isNew === true,
  };
}

export interface IdentityLinkTarget { id: number; displayName: string }

export async function previewIdentityLinkCode(ticket: string, linkCode: string): Promise<IdentityLinkTarget> {
  const response = await requestJson<{ user?: IdentityLinkTarget }>('/auth/identity/link-code/preview', {
    method: 'POST', body: { ticket, linkCode },
  });
  const user = response?.user;
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0
    || typeof user.displayName !== 'string' || user.displayName.length > MAX_DISPLAY_NAME_LENGTH
    || CONTROL_CHARACTER_PATTERN.test(user.displayName)) throw new ApiError(502, 'invalid account response');
  return { id: user.id, displayName: user.displayName };
}

export async function completeMiniProgramIdentity(
  ticket: string,
  action: 'create' | 'link_with_code' | 'link_verified_phone',
  options: { linkCode?: string; expectedUid?: number; isCurrent: () => boolean },
): Promise<LoginResult> {
  const response = await requestJson<unknown>('/auth/identity/complete', {
    method: 'POST',
    body: { ticket, action, ...(action === 'link_with_code' ? { linkCode: options.linkCode } : {}), ...(action !== 'create' ? { expectedUid: options.expectedUid } : {}) },
  });
  return saveLoginResponse(response, options.isCurrent, action !== 'create' ? options.expectedUid : undefined);
}

export async function validateStoredSession(session: SessionData): Promise<SessionData> {
  const response = await requestJson<unknown>('/auth/me', { token: session.token });
  const envelope = decodeWebSessionUserEnvelope(response);
  if (!envelope) throw new ApiError(502, 'invalid user response');
  const { user } = envelope;
  if (session.user.uid !== undefined && session.user.uid !== user.uid) {
    throw new ApiError(401, 'session identity mismatch');
  }
  const next = { ...session, user: { ...session.user, ...user } };
  const stored = readStoredSessionValue();
  const current = stored.available ? decodeStoredSession(stored.value) : null;
  if (current?.token === session.token && !writeStoredSessionValue(next)) {
    throw new ApiError(STORAGE_ERROR_STATUS, 'session storage unavailable');
  }
  return next;
}

export async function createWebSessionTicket(session: SessionData): Promise<WebSessionTicket> {
  const response = await requestJson<unknown>('/auth/web-session/ticket', {
    method: 'POST',
    timeoutMs: WEB_SESSION_REQUEST_TIMEOUT_MS,
    token: session.token,
  });
  const ticket = decodeWebSessionTicketEnvelope(response);
  if (!ticket) {
    throw new ApiError(502, 'invalid web session ticket response');
  }
  return ticket;
}

export async function approveWechatBrowserLogin(
  session: SessionData,
  approval: string,
  approved: boolean,
): Promise<void> {
  if (isDouyinMiniProgram() || !isWebSessionTicket(approval)) {
    throw new ApiError(400, 'invalid browser login approval');
  }
  await requestJson('/auth/wechat/browser-session/approve', {
    method: 'POST',
    body: { approval, approved },
    token: session.token,
  });
}

export function loginErrorMessage(error: unknown): string {
  const providerName = tr({
    en: isDouyinMiniProgram() ? 'Douyin' : 'WeChat',
    zh: MINI_PROGRAM_PROVIDER_NAME,
  });
  const genericFailure = tr({ en: 'Sign-in failed. Try again later.', zh: '登录失败，请稍后重试' });
  if (!(error instanceof ApiError)) return genericFailure;
  if (error.status === STORAGE_ERROR_STATUS) {
    return tr({ en: 'Device storage is unavailable. Free up some space and try again.', zh: '设备存储不可用，请清理空间后重试' });
  }
  if (error.code === 'WECHAT_UNIONID_REQUIRED') {
    return tr({ en: 'UnionID is unavailable. Complete the Open Platform binding first.', zh: '暂未获得 UnionID，请先完成开放平台绑定' });
  }
  if (error.code === 'WECHAT_PHONE_REQUIRED') return tr({ en: 'Authorize your phone number to find your existing account, or use another sign-in method.', zh: '授权手机号以查找原账号，或使用其他登录方式。' });
  if (error.code === 'INVALID_WECHAT_PHONE_CODE') return tr({ en: 'Phone authorization expired. Authorize again.', zh: '手机号授权已失效，请重新授权。' });
  if (error.code === 'WECHAT_PHONE_UNAVAILABLE') return tr({ en: 'Phone authorization is unavailable. Try again later or use another sign-in method.', zh: '手机号授权暂不可用，请稍后重试或使用其他登录方式。' });
  if (error.code === 'WECHAT_PHONE_UNSUPPORTED') return tr({ en: 'Quick phone sign-in currently supports mainland China numbers. Use another sign-in method for your existing account.', zh: '手机号快捷登录目前支持中国大陆号码，请使用其他方式登录原账号。' });
  if (error.code === 'ACCOUNT_HAS_PHONE') return tr({ en: 'Your account already has another phone number. Use account settings to change it; this sign-in will not replace it.', zh: '原账号已绑定其他手机号，请在账号设置中换绑；本次登录不会覆盖它。' });
  if (error.code === 'WECHAT_ACCOUNT_LINK_REQUIRED') {
    return tr({
      en: 'Phone authorization is not available on this server yet. Sign in to your existing account to link WeChat, or try again later.',
      zh: '服务端暂未开放手机号授权。可先登录原账号绑定微信，或稍后重试。',
    });
  }
  if (error.code === 'ACCOUNT_CHOICE_REQUIRED') return tr({ en: 'Choose an existing account or create a new one.', zh: '请选择登录已有账号或创建新账号。' });
  if (error.code === 'INVALID_IDENTITY_LINK_CODE') return tr({ en: 'The account linking code is invalid or expired. Get a new code from your account settings.', zh: '账号绑定码无效或已过期，请在原账号设置中重新获取。' });
  if (error.code === 'INVALID_IDENTITY_TICKET') return tr({ en: 'This sign-in request expired. Start again.', zh: '本次登录已过期，请重新开始。' });
  if (error.code === 'ACCOUNT_CHANGED' || error.code === 'IDENTITY_CONFLICT') return tr({ en: 'The account or linked identity changed. Check your account and try again.', zh: '账号或绑定状态已改变，请先检查账号后重试。' });
  if (error.code === 'WECHAT_NOT_CONFIGURED' || error.code === 'DOUYIN_NOT_CONFIGURED') {
    return tr({ en: 'The Mini Program secret has not been configured on the server.', zh: '服务端还未配置小程序密钥' });
  }
  if (error.code === 'RATE_LIMITED') {
    return tr({ en: `${providerName} sign-in was attempted too frequently. Try again later.`, zh: `${providerName}登录操作过于频繁，请稍后再试` });
  }
  if (error.code === 'ACCOUNT_BLOCKED') {
    return tr({ en: `${providerName} cannot sign in to this account right now.`, zh: `${providerName}暂时无法为此账号完成登录` });
  }
  if (error.code === 'INVALID_WECHAT_CODE' || error.code === 'INVALID_DOUYIN_CODE') {
    return tr({ en: `${providerName} sign-in code has expired. Try again.`, zh: `${providerName}登录码已失效，请重试` });
  }
  if (error.code === 'DOUYIN_UNAVAILABLE') {
    return tr({ en: 'Douyin sign-in is temporarily unavailable. Try again later.', zh: '抖音登录服务暂时不可用，请稍后重试' });
  }
  if (error.status === 409) {
    return tr({ en: 'UnionID is unavailable. Complete the Open Platform binding first.', zh: '暂未获得 UnionID，请先完成开放平台绑定' });
  }
  if (error.status === 503) {
    return tr({ en: 'The Mini Program secret has not been configured on the server.', zh: '服务端还未配置小程序密钥' });
  }
  if (error.status === 429) {
    return tr({ en: `${providerName} sign-in was attempted too frequently. Try again later.`, zh: `${providerName}登录操作过于频繁，请稍后再试` });
  }
  if (error.status === 403) {
    return tr({ en: `${providerName} cannot sign in to this account right now.`, zh: `${providerName}暂时无法为此账号完成登录` });
  }
  if (error.status === 401) {
    return tr({ en: `${providerName} sign-in code has expired. Try again.`, zh: `${providerName}登录码已失效，请重试` });
  }
  if (error.status === 0 && error.message.includes('timed out')) {
    return tr({ en: 'The connection timed out. Try again.', zh: '网络连接超时，请重试' });
  }
  if (error.status === 0) {
    return tr({ en: 'Network connection failed. Check your connection.', zh: '网络连接失败，请检查网络' });
  }
  return genericFailure;
}
