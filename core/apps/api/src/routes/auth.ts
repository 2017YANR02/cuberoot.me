import { Hono } from 'hono';
import type {
  WebSession,
  WebSessionUserEnvelope,
} from '@cuberoot/shared/auth/web-session';
import { webSessionError } from '@cuberoot/shared/auth/web-session';
import { query } from '../db/connection.js';
import { signSession, verifySession } from '../utils/session.js';
import {
  loginWithIdentity,
  findUserByWcaId,
  getUserById,
  publicUser,
  isValidCountryIso2,
  normalizeCountryIso2,
} from '../utils/account.js';

const WCA_CLIENT_ID = process.env.WCA_CLIENT_ID || '';
const WCA_CLIENT_SECRET = process.env.WCA_CLIENT_SECRET || '';
const WCA_REDIRECT_URI = process.env.WCA_REDIRECT_URI || 'http://localhost:3000/auth/callback';

/**
 * WCA OAuth + JWT 认证路由
 *
 * GET  /v1/auth/login    — 重定向到 WCA OAuth 授权页
 * GET  /v1/auth/callback — WCA 回调，换取 token，签发 JWT
 * GET  /v1/auth/me       — 验证 JWT，返回用户信息
 */
export const authRoutes = new Hono();

// 跳转到 WCA OAuth
authRoutes.get('/auth/login', (c) => {
  const url = `https://www.worldcubeassociation.org/oauth/authorize?`
    + `client_id=${WCA_CLIENT_ID}`
    + `&redirect_uri=${encodeURIComponent(WCA_REDIRECT_URI)}`
    + `&response_type=code`
    + `&scope=public`;
  return c.redirect(url);
});

// WCA 回调
authRoutes.get('/auth/callback', async (c) => {
  const code = c.req.query('code');

  // 用 code 换取 access_token
  const tokenRes = await fetch('https://www.worldcubeassociation.org/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: WCA_CLIENT_ID,
      client_secret: WCA_CLIENT_SECRET,
      redirect_uri: WCA_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    return c.json({ error: 'Failed to exchange code for token' }, 401);
  }

  const tokenData = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // 用 access_token 获取用户信息
  const meRes = await fetch('https://www.worldcubeassociation.org/api/v0/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!meRes.ok) {
    return c.json({ error: 'Failed to fetch user info' }, 401);
  }

  const meData = await meRes.json() as {
    me: { id: number; wca_id: string; name: string; country_iso2?: string; avatar: { url: string } };
  };

  const user = meData.me;
  const wcaId = user.wca_id;
  const countryIso2 = typeof user.country_iso2 === 'string'
    ? normalizeCountryIso2(user.country_iso2)
    : null;
  const verifiedCountryIso2 = countryIso2 && isValidCountryIso2(countryIso2) ? countryIso2 : null;

  // 缓存到数据库
  await query(
    `INSERT INTO wca_users (wca_id, name, avatar_url, access_token, refresh_token, token_expires_at)
     VALUES (?, ?, ?, ?, ?, NOW() + make_interval(secs => ?))
     ON CONFLICT (wca_id) DO UPDATE SET
       name = EXCLUDED.name,
       avatar_url = EXCLUDED.avatar_url,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       token_expires_at = EXCLUDED.token_expires_at,
       updated_at = NOW()`,
    [wcaId, user.name, user.avatar?.url, tokenData.access_token, tokenData.refresh_token, tokenData.expires_in],
  );

  // 建/取内部账号 + wca 身份,签发会话 JWT（365 天）
  const { user: account } = await loginWithIdentity('wca', wcaId, {
    name: user.name,
    avatar: user.avatar?.url ?? null,
    wcaId,
    countryIso2: verifiedCountryIso2,
  });
  const jwtToken = signSession({ uid: account.id, wcaId: account.wca_id, name: account.display_name });

  // 重定向回前端，带上 JWT
  return c.redirect(
    `${WCA_REDIRECT_URI.replace('/auth/callback', '')}?token=${jwtToken}`,
  );
});

// 验证 JWT 获取用户信息
authRoutes.get('/auth/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(webSessionError('UNAUTHENTICATED', 'No token provided'), 401);
  }

  try {
    const payload = verifySession(authHeader.slice(7));
    const account = payload.uid != null
      ? await getUserById(payload.uid)
      : payload.wcaId
        ? await findUserByWcaId(payload.wcaId)
        : null;
    if (!account) return c.json(webSessionError('INVALID_SESSION', 'Invalid token'), 401);
    const response: WebSessionUserEnvelope = { user: publicUser(account) };
    return c.json(response);
  } catch {
    return c.json(webSessionError('INVALID_SESSION', 'Invalid token'), 401);
  }
});

// WCA access_token → 自签 JWT（365 天有效期）
// NOTE: WCA Implicit Grant 的 token 2 小时过期，用此端点换取长效 JWT
authRoutes.post('/auth/exchange', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(webSessionError('INVALID_REQUEST', 'accessToken is required'), 400);
  }
  const accessToken = typeof body === 'object'
    && body !== null
    && 'accessToken' in body
    && typeof body.accessToken === 'string'
    ? body.accessToken
    : '';

  if (!accessToken) {
    return c.json(webSessionError('INVALID_REQUEST', 'accessToken is required'), 400);
  }

  // 用 WCA access_token 验证用户身份
  try {
    const res = await fetch('https://www.worldcubeassociation.org/api/v0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return c.json(webSessionError('INVALID_WCA_TOKEN', 'Invalid or expired WCA token'), 401);
    }

    const data = await res.json() as {
      me: { id: number; wca_id: string; name: string; country_iso2?: string; avatar: { url: string } };
    };
    const user = data.me;
    if (!user?.wca_id) {
      return c.json(webSessionError('INVALID_WCA_TOKEN', 'Failed to get user info'), 401);
    }
    const countryIso2 = typeof user.country_iso2 === 'string'
      ? normalizeCountryIso2(user.country_iso2)
      : null;
    const verifiedCountryIso2 = countryIso2 && isValidCountryIso2(countryIso2) ? countryIso2 : null;

    // 缓存用户信息到数据库
    await query(
      `INSERT INTO wca_users (wca_id, name, avatar_url, access_token, token_expires_at)
       VALUES (?, ?, ?, ?, NOW() + INTERVAL '7200 seconds')
       ON CONFLICT (wca_id) DO UPDATE SET
         name = EXCLUDED.name,
         avatar_url = EXCLUDED.avatar_url,
         access_token = EXCLUDED.access_token,
         token_expires_at = EXCLUDED.token_expires_at,
         updated_at = NOW()`,
      [user.wca_id, user.name, user.avatar?.url, accessToken],
    );

    // 建/取内部账号 + wca 身份,签发会话 JWT（365 天）
    const { user: account } = await loginWithIdentity('wca', user.wca_id, {
      name: user.name,
      avatar: user.avatar?.url ?? null,
      wcaId: user.wca_id,
      countryIso2: verifiedCountryIso2,
    });
    const jwtToken = signSession({ uid: account.id, wcaId: account.wca_id, name: account.display_name });

    const session: WebSession = { token: jwtToken, user: publicUser(account) };
    return c.json(session);
  } catch {
    return c.json(webSessionError('WCA_UNAVAILABLE', 'WCA API unavailable'), 502);
  }
});

// 用未过期的 cuberoot_jwt 续签一张新的 365 天 JWT(滑动过期)。
// 前端在 token 临近过期时静默调用 → 只要一年内活跃过就不掉线;整年不活跃才需重新 WCA 登录。
// 只接受自签 JWT(WCA access_token 验签会失败 → 401,走 /auth/exchange)。
authRoutes.post('/auth/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(webSessionError('UNAUTHENTICATED', 'unauthorized'), 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifySession(token);
    // uid token 直接续;老 wca-only token 借机升级(按真实 wcaId 查库补 uid)。
    let uid = payload.uid ?? null;
    if (uid == null && payload.wcaId) {
      const u = await findUserByWcaId(payload.wcaId);
      if (u) uid = u.id;
    }
    if (uid == null) return c.json(webSessionError('UNAUTHENTICATED', 'unauthorized'), 401);
    // 按账号最新态续签(可能刚绑了新的 wca / 改了名)。查不到账号 → 强制重登。
    const u = await getUserById(uid);
    if (!u) return c.json(webSessionError('UNAUTHENTICATED', 'unauthorized'), 401);
    const fresh = signSession({ uid: u.id, wcaId: u.wca_id, name: u.display_name || (payload.name ?? '') });
    const session: WebSession = { token: fresh, user: publicUser(u) };
    return c.json(session);
  } catch {
    // 过期或非法 JWT — 不续签,前端回退到重新登录。
    return c.json(webSessionError('UNAUTHENTICATED', 'unauthorized'), 401);
  }
});
