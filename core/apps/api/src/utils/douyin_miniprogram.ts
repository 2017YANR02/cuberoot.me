const DOUYIN_MINI_APP_ID = process.env.DOUYIN_MINI_APP_ID?.trim() ?? '';
const DOUYIN_MINI_APP_SECRET = process.env.DOUYIN_MINI_APP_SECRET?.trim() ?? '';
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const MAX_PROVIDER_UID_LENGTH = 320;

export type DouyinMiniProgramErrorCode =
  | 'invalid-code'
  | 'invalid-response'
  | 'upstream-unavailable';

export class DouyinMiniProgramError extends Error {
  constructor(
    public readonly code: DouyinMiniProgramErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DouyinMiniProgramError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Keep only the stable account identifier. session_key and anonymous_openid stay private. */
export function parseDouyinMiniProgramSession(value: unknown): { openid: string } {
  if (!isRecord(value)) {
    throw new DouyinMiniProgramError('invalid-response', 'douyin returned a non-object response');
  }
  if (typeof value.err_no !== 'number') {
    throw new DouyinMiniProgramError('invalid-response', 'douyin response has no numeric err_no');
  }
  if (value.err_no !== 0) {
    throw new DouyinMiniProgramError(
      value.err_no === 40018 ? 'invalid-code' : 'upstream-unavailable',
      `douyin code2Session failed: ${value.err_no}`,
    );
  }
  const openid = isRecord(value.data) ? value.data.openid : null;
  if (typeof openid !== 'string'
    || !openid
    || openid !== openid.trim()
    || openid.length > MAX_PROVIDER_UID_LENGTH
    || CONTROL_CHARACTER_PATTERN.test(openid)) {
    throw new DouyinMiniProgramError('invalid-response', 'douyin response has invalid openid');
  }
  return { openid };
}

export function douyinMiniProgramConfigured(): boolean {
  return Boolean(DOUYIN_MINI_APP_ID && DOUYIN_MINI_APP_SECRET);
}

export async function exchangeDouyinMiniProgramCode(code: string): Promise<{ openid: string }> {
  let response: Response;
  try {
    response = await fetch('https://developer.toutiao.com/api/apps/v2/jscode2session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appid: DOUYIN_MINI_APP_ID,
        secret: DOUYIN_MINI_APP_SECRET,
        code,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw new DouyinMiniProgramError(
      'upstream-unavailable',
      error instanceof Error ? error.message : 'douyin request failed',
    );
  }
  if (!response.ok) {
    throw new DouyinMiniProgramError('upstream-unavailable', `douyin HTTP ${response.status}`);
  }
  try {
    return parseDouyinMiniProgramSession(await response.json());
  } catch (error) {
    if (error instanceof DouyinMiniProgramError) throw error;
    throw new DouyinMiniProgramError('invalid-response', 'douyin returned invalid JSON');
  }
}
