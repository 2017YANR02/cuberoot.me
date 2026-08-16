import { API_ORIGIN } from './runtime-config';

const SESSION_STORAGE_KEY = 'cuberoot:session';
const MAX_AVATAR_LENGTH = 2048;
const MAX_DISPLAY_NAME_LENGTH = 200;
const MAX_SESSION_TOKEN_LENGTH = 4096;
const MAX_WCA_ID_LENGTH = 20;

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
  if (wcaId && wcaId.length > MAX_WCA_ID_LENGTH) return null;
  return {
    ...(user.uid === undefined ? {} : { uid: user.uid }),
    wcaId,
    name: user.name.trim(),
    ...(user.avatar === undefined ? {} : { avatar: user.avatar }),
  };
}

function decodeSession(value: unknown): SessionData | null {
  if (value === null || typeof value !== 'object') return null;
  const session = value as Record<string, unknown>;
  const token = typeof session.token === 'string' ? session.token.trim() : '';
  const user = decodeSessionUser(session.user);
  if (token.length < 20 || token.length > MAX_SESSION_TOKEN_LENGTH || !user) {
    return null;
  }
  return {
    token,
    user,
  };
}

function requestJson<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: WechatMiniprogram.IAnyObject; token?: string } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const header: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.token) header.Authorization = `Bearer ${options.token}`;
    wx.request({
      url: `${API_ORIGIN}${path}`,
      method: options.method ?? 'GET',
      data: options.body,
      header,
      timeout: 12_000,
      success(response) {
        const body = response.data as Record<string, unknown> | undefined;
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T);
          return;
        }
        reject(new ApiError(
          response.statusCode,
          typeof body?.error === 'string' ? body.error : `HTTP ${response.statusCode}`,
        ));
      },
      fail(error) {
        reject(new ApiError(0, error.errMsg || 'network error'));
      },
    });
  });
}

function wechatLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      timeout: 10_000,
      success(result) {
        const code = result.code?.trim();
        if (code) resolve(code);
        else reject(new ApiError(0, 'wx.login returned no code'));
      },
      fail(error) {
        reject(new ApiError(0, error.errMsg || 'wx.login failed'));
      },
    });
  });
}

export function getStoredSession(): SessionData | null {
  const session = decodeSession(wx.getStorageSync(SESSION_STORAGE_KEY) as unknown);
  if (!session) wx.removeStorageSync(SESSION_STORAGE_KEY);
  return session;
}

export function clearStoredSession(): void {
  wx.removeStorageSync(SESSION_STORAGE_KEY);
}

export async function loginWithWechat(): Promise<LoginResult> {
  const code = await wechatLoginCode();
  const response = await requestJson<unknown>('/auth/wechat/miniprogram', {
    method: 'POST',
    body: { code },
  });
  const session = decodeSession(response);
  if (!session) throw new ApiError(502, 'invalid session response');
  wx.setStorageSync(SESSION_STORAGE_KEY, session);
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
  if (!user) throw new ApiError(502, 'invalid user response');
  const next = { ...session, user: { ...session.user, ...user } };
  const current = decodeSession(wx.getStorageSync(SESSION_STORAGE_KEY) as unknown);
  if (current?.token === session.token) {
    wx.setStorageSync(SESSION_STORAGE_KEY, next);
  }
  return next;
}

export async function createWebSessionTicket(session: SessionData): Promise<WebSessionTicket> {
  const response = await requestJson<unknown>('/auth/web-session/ticket', {
    method: 'POST',
    token: session.token,
  });
  if (response === null || typeof response !== 'object') {
    throw new ApiError(502, 'invalid web session ticket response');
  }
  const ticket = response as Record<string, unknown>;
  if (typeof ticket.ticket !== 'string'
    || !/^[A-Za-z0-9_-]{43}$/.test(ticket.ticket)
    || typeof ticket.expiresIn !== 'number'
    || !Number.isSafeInteger(ticket.expiresIn)
    || ticket.expiresIn <= 0) {
    throw new ApiError(502, 'invalid web session ticket response');
  }
  return { ticket: ticket.ticket, expiresIn: ticket.expiresIn };
}

export function loginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '登录失败，请稍后重试';
  if (error.status === 409) return '暂未获得 UnionID，请先完成开放平台绑定';
  if (error.status === 503) return '服务端还未配置小程序密钥';
  if (error.status === 401) return '微信登录码已失效，请重试';
  if (error.status === 0) return '网络连接失败，请检查网络';
  return '登录失败，请稍后重试';
}
