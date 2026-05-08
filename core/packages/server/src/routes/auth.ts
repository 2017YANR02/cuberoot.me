import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const WCA_CLIENT_ID = process.env.WCA_CLIENT_ID || '';
const WCA_CLIENT_SECRET = process.env.WCA_CLIENT_SECRET || '';
const WCA_REDIRECT_URI = process.env.WCA_REDIRECT_URI || 'http://localhost:5173/trainer/auth/callback';

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
    me: { id: number; wca_id: string; name: string; avatar: { url: string } };
  };

  const user = meData.me;
  const wcaId = user.wca_id;

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

  // 签发 JWT（有效期 7 天）
  const jwtToken = jwt.sign(
    { wcaId, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  // 重定向回前端，带上 JWT
  return c.redirect(
    `${WCA_REDIRECT_URI.replace('/auth/callback', '')}?token=${jwtToken}`,
  );
});

// 验证 JWT 获取用户信息
authRoutes.get('/auth/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as {
      wcaId: string;
      name: string;
    };
    return c.json({ user: payload });
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// WCA access_token → 自签 JWT（365 天有效期）
// NOTE: WCA Implicit Grant 的 token 2 小时过期，用此端点换取长效 JWT
authRoutes.post('/auth/exchange', async (c) => {
  const body = await c.req.json<{ accessToken?: string }>();
  const accessToken = body.accessToken;

  if (!accessToken) {
    return c.json({ error: 'accessToken is required' }, 400);
  }

  // 用 WCA access_token 验证用户身份
  try {
    const res = await fetch('https://www.worldcubeassociation.org/api/v0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return c.json({ error: 'Invalid or expired WCA token' }, 401);
    }

    const data = await res.json() as {
      me: { id: number; wca_id: string; name: string; avatar: { url: string } };
    };
    const user = data.me;
    if (!user?.wca_id) {
      return c.json({ error: 'Failed to get user info' }, 401);
    }

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

    // 签发 JWT（365 天有效期）
    const jwtToken = jwt.sign(
      { wcaId: user.wca_id, name: user.name },
      JWT_SECRET,
      { expiresIn: '365d' },
    );

    return c.json({ token: jwtToken });
  } catch {
    return c.json({ error: 'WCA API unavailable' }, 502);
  }
});
