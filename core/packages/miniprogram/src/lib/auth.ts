import { API_ORIGIN } from './runtime-config';
import {
  clearRuntimeTimeout,
  scheduleRuntimeTimeout,
  type RuntimeTimer,
} from './runtime-timers';
import { isWebSessionTicket } from './web-session-contract';

const SESSION_STORAGE_KEY = 'cuberoot:session';
const MAX_AVATAR_LENGTH = 2048;
const MAX_DISPLAY_NAME_LENGTH = 200;
const MAX_SESSION_TOKEN_LENGTH = 4096;
const MAX_WCA_ID_LENGTH = 20;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const REQUEST_TIMEOUT_MS = 12_000;
const WEB_SESSION_REQUEST_TIMEOUT_MS = 5_000;
const HARD_TIMEOUT_GRACE_MS = 1_000;
const WECHAT_LOGIN_TIMEOUT_MS = 10_000;
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

export interface WebSessionTicket {
  ticket: string;
  expiresIn: number;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function decodeSessionUser(value: unknown): SessionUser | null {
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
  if (!name) return null;
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

function decodeSession(value: unknown): SessionData | null {
  if (value === null || typeof value !== 'object') return null;
  const session = value as Record<string, unknown>;
  const token = typeof session.token === 'string' ? session.token.trim() : '';
  const user = decodeSessionUser(session.user);
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
      value: wx.getStorageSync(SESSION_STORAGE_KEY) as unknown,
    };
  } catch {
    return { available: false };
  }
}

function removeStoredSessionValue(): boolean {
  try {
    wx.removeStorageSync(SESSION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function writeStoredSessionValue(session: SessionData): boolean {
  try {
    wx.setStorageSync(SESSION_STORAGE_KEY, session);
    return true;
  } catch {
    return false;
  }
}

function requestJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: WechatMiniprogram.IAnyObject;
    timeoutMs?: number;
    token?: string;
  } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    let requestTask: WechatMiniprogram.RequestTask | undefined;
    let settled = false;
    let hardTimeout: RuntimeTimer | null = null;
    const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    const header: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.token) header.Authorization = `Bearer ${options.token}`;
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
      requestTask = wx.request({
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
            reject(new ApiError(
              response.statusCode,
              typeof body?.error === 'string' ? body.error : `HTTP ${response.statusCode}`,
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

function wechatLoginCode(): Promise<string> {
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
      () => settle(() => reject(new ApiError(0, 'wx.login timed out'))),
      WECHAT_LOGIN_TIMEOUT_MS + HARD_TIMEOUT_GRACE_MS,
    );
    if (hardTimeout === null) {
      settle(() => reject(new ApiError(0, 'wx.login timeout unavailable')));
      return;
    }
    if (settled) return;

    try {
      wx.login({
        timeout: WECHAT_LOGIN_TIMEOUT_MS,
        success(result) {
          settle(() => {
            const code = result.code?.trim();
            if (code) resolve(code);
            else reject(new ApiError(0, 'wx.login returned no code'));
          });
        },
        fail(error) {
          settle(() => reject(new ApiError(0, error.errMsg || 'wx.login failed')));
        },
      });
    } catch (error) {
      settle(() => reject(new ApiError(
        0,
        error instanceof Error ? error.message : 'wx.login failed',
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
  const session = decodeSession(value);
  if (!session && !removeStoredSessionValue()) {
    return { status: 'unavailable', session: null };
  }
  return { status: 'available', session };
}

export function clearStoredSession(): boolean {
  return removeStoredSessionValue();
}

export async function loginWithWechat(): Promise<LoginResult> {
  const code = await wechatLoginCode();
  const response = await requestJson<unknown>('/auth/wechat/miniprogram', {
    method: 'POST',
    body: { code },
  });
  const session = decodeSession(response);
  if (!session || session.user.uid === undefined) {
    throw new ApiError(502, 'invalid session response');
  }
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

export async function validateStoredSession(session: SessionData): Promise<SessionData> {
  const response = await requestJson<unknown>('/auth/me', { token: session.token });
  if (response === null || typeof response !== 'object') {
    throw new ApiError(502, 'invalid user response');
  }
  const user = decodeSessionUser((response as Record<string, unknown>).user);
  if (!user || user.uid === undefined) throw new ApiError(502, 'invalid user response');
  if (session.user.uid !== undefined && session.user.uid !== user.uid) {
    throw new ApiError(401, 'session identity mismatch');
  }
  const next = { ...session, user: { ...session.user, ...user } };
  const stored = readStoredSessionValue();
  const current = stored.available ? decodeSession(stored.value) : null;
  if (current?.token === session.token) {
    writeStoredSessionValue(next);
  }
  return next;
}

export async function createWebSessionTicket(session: SessionData): Promise<WebSessionTicket> {
  const response = await requestJson<unknown>('/auth/web-session/ticket', {
    method: 'POST',
    timeoutMs: WEB_SESSION_REQUEST_TIMEOUT_MS,
    token: session.token,
  });
  if (response === null || typeof response !== 'object') {
    throw new ApiError(502, 'invalid web session ticket response');
  }
  const ticket = response as Record<string, unknown>;
  if (!isWebSessionTicket(ticket.ticket)
    || typeof ticket.expiresIn !== 'number'
    || !Number.isSafeInteger(ticket.expiresIn)
    || ticket.expiresIn <= 0) {
    throw new ApiError(502, 'invalid web session ticket response');
  }
  return { ticket: ticket.ticket, expiresIn: ticket.expiresIn };
}

export function loginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '登录失败，请稍后重试';
  if (error.status === STORAGE_ERROR_STATUS) return '设备存储不可用，请清理空间后重试';
  if (error.status === 409) return '暂未获得 UnionID，请先完成开放平台绑定';
  if (error.status === 503) return '服务端还未配置小程序密钥';
  if (error.status === 401) return '微信登录码已失效，请重试';
  if (error.status === 0 && error.message.includes('timed out')) return '网络连接超时，请重试';
  if (error.status === 0) return '网络连接失败，请检查网络';
  return '登录失败，请稍后重试';
}
