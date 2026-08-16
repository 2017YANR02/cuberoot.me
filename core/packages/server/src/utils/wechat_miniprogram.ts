const WECHAT_MINI_APP_ID = process.env.WECHAT_MINI_APP_ID?.trim() ?? '';
const WECHAT_MINI_APP_SECRET = process.env.WECHAT_MINI_APP_SECRET?.trim() ?? '';

export type WechatMiniProgramErrorCode =
  | 'invalid-code'
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Parse only identifiers needed by the account layer. session_key must never leave this module. */
export function parseWechatMiniProgramSession(value: unknown): WechatMiniProgramSession {
  if (!isRecord(value)) {
    throw new WechatMiniProgramError('invalid-response', 'wechat returned a non-object response');
  }
  if (typeof value.errcode === 'number' && value.errcode !== 0) {
    const code = value.errcode === -1 ? 'upstream-unavailable' : 'invalid-code';
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
