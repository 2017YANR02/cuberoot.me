/** 同主体网站应用与小程序的共同用户标识；各应用必须用自己的凭据查询自己的 OpenID。 */
const credentials = {
  website: () => [process.env.DOUYIN_LOGIN_CLIENT_KEY, process.env.DOUYIN_LOGIN_CLIENT_SECRET],
  miniprogram: () => [process.env.DOUYIN_MINI_APP_ID, process.env.DOUYIN_MINI_APP_SECRET],
} as const;

const tokens = new Map<'website' | 'miniprogram', { value: string; expiresAt: number }>();

export async function getDouyinAlliedId(application: 'website' | 'miniprogram', openId: string): Promise<string | null> {
  const [clientKey, clientSecret] = credentials[application]();
  if (!clientKey || !clientSecret) return null;
  let token = tokens.get(application);
  if (!token || token.expiresAt <= Date.now()) {
    const response = await fetch('https://open.douyin.com/oauth/client_token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_key: clientKey, client_secret: clientSecret, grant_type: 'client_credential' }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`douyin client token HTTP ${response.status}`);
    const body = await response.json() as { data?: { access_token?: string; expires_in?: number; error_code?: number } };
    if (body.data?.error_code !== 0 || !body.data.access_token) {
      throw new Error(`douyin client token error ${body.data?.error_code ?? 'invalid-response'}`);
    }
    token = {
      value: body.data.access_token,
      expiresAt: Date.now() + Math.max(0, (body.data.expires_in ?? 0) - 300) * 1000,
    };
    tokens.set(application, token);
  }
  const path = application === 'website'
    ? '/api/douyin/v1/auth/get_related_id/'
    : '/api/apps/v1/auth/get_related_id/';
  const response = await fetch(`https://open.douyin.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'access-token': token.value },
    body: JSON.stringify({ open_id: openId }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`douyin allied id HTTP ${response.status}`);
  const body = await response.json() as { err_no?: number; data?: { allied_id?: string } };
  if (body.err_no !== 0) throw new Error(`douyin allied id error ${body.err_no ?? 'invalid-response'}`);
  const alliedId = body.data?.allied_id;
  if (typeof alliedId !== 'string' || !alliedId || alliedId.length > 310 || alliedId !== alliedId.trim() || /[\u0000-\u001F\u007F]/.test(alliedId)) {
    throw new Error('douyin allied id invalid response');
  }
  return `allied:${alliedId}`;
}
