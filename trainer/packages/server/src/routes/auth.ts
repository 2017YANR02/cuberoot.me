import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const WCA_CLIENT_ID = process.env.WCA_CLIENT_ID || '';
const WCA_CLIENT_SECRET = process.env.WCA_CLIENT_SECRET || '';
const WCA_REDIRECT_URI = process.env.WCA_REDIRECT_URI || 'http://localhost:5173/trainer/auth/callback';

/**
 * WCA OAuth + JWT 认证路由
 *
 * GET  /api/auth/login    — 重定向到 WCA OAuth 授权页
 * GET  /api/auth/callback — WCA 回调，换取 token，签发 JWT
 * GET  /api/auth/me       — 验证 JWT，返回用户信息
 */
export async function authRoutes(server: FastifyInstance) {

  // 跳转到 WCA OAuth
  server.get('/api/auth/login', async (_req, reply) => {
    const url = `https://www.worldcubeassociation.org/oauth/authorize?`
      + `client_id=${WCA_CLIENT_ID}`
      + `&redirect_uri=${encodeURIComponent(WCA_REDIRECT_URI)}`
      + `&response_type=code`
      + `&scope=public`;
    return reply.redirect(url);
  });

  // WCA 回调
  server.get<{
    Querystring: { code: string };
  }>('/api/auth/callback', async (req, reply) => {
    const { code } = req.query;

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
      return reply.code(401).send({ error: 'Failed to exchange code for token' });
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
      return reply.code(401).send({ error: 'Failed to fetch user info' });
    }

    const meData = await meRes.json() as {
      me: { id: number; wca_id: string; name: string; avatar: { url: string } };
    };

    const user = meData.me;
    const wcaId = user.wca_id;

    // 缓存到数据库
    await query(
      `INSERT INTO wca_users (wca_id, name, avatar_url, access_token, refresh_token, token_expires_at)
       VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         avatar_url = VALUES(avatar_url),
         access_token = VALUES(access_token),
         refresh_token = VALUES(refresh_token),
         token_expires_at = VALUES(token_expires_at),
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
    return reply.redirect(
      `${WCA_REDIRECT_URI.replace('/auth/callback', '')}?token=${jwtToken}`,
    );
  });

  // 验证 JWT 获取用户信息
  server.get('/api/auth/me', async (req, reply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'No token provided' });
    }

    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as {
        wcaId: string;
        name: string;
      };
      return { user: payload };
    } catch {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  });
}
