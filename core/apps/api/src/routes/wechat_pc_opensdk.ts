import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { checkRateLimit } from '../utils/recon_helpers.js';

/**
 * 微信网站应用 PC OpenSDK 的单次 ticket。
 *
 * 与公众号 JS-SDK (`wechat_jssdk.ts`) 是两套独立能力:这里复用已审核网站应用的
 * WECHAT_LOGIN_APP_ID / WECHAT_LOGIN_APP_SECRET。access_token 可缓存,pcopensdk
 * ticket 仅 5 分钟有效且只能使用一次,因此绝不缓存或预取。
 */
export const wechatPcOpenSdkRoutes = new Hono();

interface CachedToken {
  appId: string;
  value: string;
  expiresAt: number;
}

interface WeChatTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface WeChatTicketResponse {
  ticket?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

const TOKEN_SKEW_MS = 5 * 60 * 1000;
const INVALID_TOKEN_CODES = new Set([40001, 40014, 42001]);
let tokenCache: CachedToken | null = null;
let tokenRequest: Promise<string> | null = null;

function config(): { appId: string; secret: string } {
  return {
    appId: process.env.WECHAT_LOGIN_APP_ID || '',
    secret: process.env.WECHAT_LOGIN_APP_SECRET || '',
  };
}

async function requestAccessToken(appId: string, secret: string): Promise<string> {
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}`,
  );
  const payload = await response.json() as WeChatTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(`access_token ${payload.errcode ?? response.status}: ${payload.errmsg ?? 'request failed'}`);
  }
  tokenCache = {
    appId,
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(0, (payload.expires_in ?? 7200) * 1000 - TOKEN_SKEW_MS),
  };
  return payload.access_token;
}

async function getAccessToken(appId: string, secret: string, forceRefresh = false): Promise<string> {
  if (forceRefresh) tokenCache = null;
  if (!forceRefresh && tokenCache?.appId === appId && tokenCache.expiresAt > Date.now()) {
    return tokenCache.value;
  }
  if (!tokenRequest) {
    tokenRequest = requestAccessToken(appId, secret).finally(() => {
      tokenRequest = null;
    });
  }
  return tokenRequest;
}

async function requestOneTimeTicket(accessToken: string): Promise<WeChatTicketResponse> {
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/pcopensdk/ticket?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_type: 'pcopensdk' }),
    },
  );
  const payload = await response.json() as WeChatTicketResponse;
  if (!response.ok && payload.errcode === undefined) payload.errcode = response.status;
  return payload;
}

async function getOneTimeTicket(appId: string, secret: string): Promise<string> {
  let accessToken = await getAccessToken(appId, secret);
  let payload = await requestOneTimeTicket(accessToken);

  // 微信可能提前作废全局 access_token。仅针对明确的 token 错误强制刷新并重试一次。
  if (payload.errcode !== undefined && INVALID_TOKEN_CODES.has(payload.errcode)) {
    accessToken = await getAccessToken(appId, secret, true);
    payload = await requestOneTimeTicket(accessToken);
  }
  if (!payload.ticket || (payload.errcode !== undefined && payload.errcode !== 0)) {
    throw new Error(`pcopensdk ticket ${payload.errcode ?? '?'}: ${payload.errmsg ?? 'request failed'}`);
  }
  return payload.ticket;
}

wechatPcOpenSdkRoutes.post('/wechat/pc-opensdk-ticket', async (c) => {
  c.header('Cache-Control', 'no-store');
  const { appId, secret } = config();
  if (!appId || !secret) return c.json({ disabled: true });

  checkRateLimit(getIp(c), { bucket: 'wechat-pc-opensdk-ticket', max: 12 });
  try {
    const ticket = await getOneTimeTicket(appId, secret);
    return c.json({ appId, ticket, expiresIn: 300 });
  } catch (error) {
    // 上游详情仅写服务端日志;响应不得泄露 access_token、AppSecret 或微信原始错误细节。
    console.error('[wechat-pc-opensdk] ticket request failed:', error);
    return c.json({ error: 'WeChat sharing is temporarily unavailable' }, 502);
  }
});

/** 仅供单元测试隔离进程内 token 状态。 */
export function resetWeChatPcOpenSdkCacheForTest(): void {
  tokenCache = null;
  tokenRequest = null;
}
