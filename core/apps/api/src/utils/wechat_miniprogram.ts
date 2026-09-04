const WECHAT_MINI_APP_ID = process.env.WECHAT_MINI_APP_ID?.trim() ?? '';
const WECHAT_MINI_APP_SECRET = process.env.WECHAT_MINI_APP_SECRET?.trim() ?? '';
let accessToken = '';
let accessTokenExpiresAt = 0;
let accessTokenRequest: Promise<string> | null = null;

export type WechatMiniProgramErrorCode =
  | 'invalid-code'
  | 'rate-limited'
  | 'blocked-user'
  | 'invalid-response'
  | 'upstream-unavailable';

export class WechatMiniProgramError extends Error {
  constructor(
    public readonly code: WechatMiniProgramErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WechatMiniProgramError';
  }
}

export interface WechatMiniProgramSession {
  openid: string;
  unionid: string | null;
}

interface WechatAccessTokenResponse {
  access_token?: unknown;
  errcode?: unknown;
  expires_in?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Parse only identifiers needed by the account layer. session_key must never leave this module. */
export function parseWechatMiniProgramSession(value: unknown): WechatMiniProgramSession {
  if (!isRecord(value)) {
    throw new WechatMiniProgramError('invalid-response', 'wechat returned a non-object response');
  }
  if (typeof value.errcode === 'number' && value.errcode !== 0) {
    const code: WechatMiniProgramErrorCode = value.errcode === 40029
      ? 'invalid-code'
      : value.errcode === 45011
        ? 'rate-limited'
        : value.errcode === 40226
          ? 'blocked-user'
          : 'upstream-unavailable';
    throw new WechatMiniProgramError(code, `wechat code2Session failed: ${value.errcode}`);
  }
  if (typeof value.openid !== 'string' || !value.openid.trim()) {
    throw new WechatMiniProgramError('invalid-response', 'wechat response has no openid');
  }
  return {
    openid: value.openid,
    unionid: typeof value.unionid === 'string' && value.unionid.trim()
      ? value.unionid
      : null,
  };
}

export function wechatMiniProgramConfigured(): boolean {
  return Boolean(WECHAT_MINI_APP_ID && WECHAT_MINI_APP_SECRET);
}

export async function exchangeWechatMiniProgramCode(code: string): Promise<WechatMiniProgramSession> {
  const params = new URLSearchParams({
    appid: WECHAT_MINI_APP_ID,
    secret: WECHAT_MINI_APP_SECRET,
    js_code: code,
    grant_type: 'authorization_code',
  });
  let response: Response;
  try {
    response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params}`, {
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw new WechatMiniProgramError(
      'upstream-unavailable',
      error instanceof Error ? error.message : 'wechat request failed',
    );
  }
  if (!response.ok) {
    throw new WechatMiniProgramError('upstream-unavailable', `wechat HTTP ${response.status}`);
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new WechatMiniProgramError('invalid-response', 'wechat returned invalid JSON');
  }
  return parseWechatMiniProgramSession(value);
}

async function fetchWechatMiniProgramAccessToken(): Promise<string> {
  if (accessToken && Date.now() < accessTokenExpiresAt) return accessToken;
  if (accessTokenRequest) return accessTokenRequest;

  accessTokenRequest = (async () => {
    const params = new URLSearchParams({
      appid: WECHAT_MINI_APP_ID,
      secret: WECHAT_MINI_APP_SECRET,
      grant_type: 'client_credential',
    });
    const response = await fetch(`https://api.weixin.qq.com/cgi-bin/token?${params}`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`wechat access token HTTP ${response.status}`);
    const value = await response.json() as WechatAccessTokenResponse;
    if (typeof value.access_token !== 'string' || !value.access_token
      || typeof value.expires_in !== 'number' || value.expires_in <= 60) {
      throw new Error(`wechat access token failed: ${String(value.errcode ?? 'invalid response')}`);
    }
    accessToken = value.access_token;
    accessTokenExpiresAt = Date.now() + (value.expires_in - 60) * 1000;
    return accessToken;
  })().finally(() => { accessTokenRequest = null; });
  return accessTokenRequest;
}

/** Generate an HTTPS URL Link that opens the released Mini Program account page. */
export async function generateWechatMiniProgramUrlLink(
  query: string,
  expireTime: number,
): Promise<string> {
  try {
    const token = await fetchWechatMiniProgramAccessToken();
    const response = await fetch(
      `https://api.weixin.qq.com/wxa/generate_urllink?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'pages/account/index',
          query,
          env_version: 'release',
          expire_type: 0,
          expire_time: expireTime,
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) throw new Error(`wechat URL Link HTTP ${response.status}`);
    const value = await response.json() as Record<string, unknown>;
    if (typeof value.url_link !== 'string' || !value.url_link.startsWith('https://')) {
      throw new Error(`wechat URL Link failed: ${String(value.errcode ?? 'invalid response')}`);
    }
    return value.url_link;
  } catch (error) {
    throw new WechatMiniProgramError(
      'upstream-unavailable',
      error instanceof Error ? error.message : 'wechat URL Link request failed',
    );
  }
}
