import { Hono } from 'hono';
import { createHash, randomBytes } from 'node:crypto';

/**
 * /v1/wechat/jssdk-signature — 微信 JS-SDK `wx.config` 签名。
 *
 * 朋友圈 / 会话「自定义分享卡片」必须在微信内置浏览器里调 wx.config +
 * updateTimelineShareData / updateAppMessageShareData;wx.config 需要用公众号的
 * jsapi_ticket 对「当前页面 URL」做 SHA1 签名。本端点:
 *   换取 access_token → 换取 jsapi_ticket(均按 ~7200s 缓存,微信限频)→ 生成签名四元组。
 *
 *   GET /v1/wechat/jssdk-signature?url=<完整页面 URL,含 query,不含 #hash>
 *     → { appId, timestamp, nonceStr, signature }   已配置且成功
 *     → { disabled: true }                           未配公众号 env(前端静默 no-op)
 *
 * 上线前提(公众号后台,一次性):
 *   ① 服务号/订阅号 → 设置与开发 → 公众号设置 → 功能设置 →「JS 接口安全域名」加 cuberoot.me
 *      (需把校验文件 MP_verify_*.txt 放到站点根,可托管进 client/public/)。
 *   ② 基本配置 →「IP 白名单」加本服务器出口 IP,否则换 access_token 报 40164。
 * env:WECHAT_MP_APPID / WECHAT_MP_SECRET(可复用支付那个公众号的 appid;未设则本端点
 * 返回 { disabled:true },前端整条链路静默降级,不影响任何其它功能)。
 *
 * 注意:access_token / jsapi_ticket 是「公众号全局唯一 + 限频」资源。这里做进程内缓存;
 * 若日后多进程 / 多实例并发换取会互相顶掉,届时应挪到共享缓存(Redis / PG)集中签发。
 */
export const wechatJssdkRoutes = new Hono();

const APPID = process.env.WECHAT_MP_APPID || '';
const SECRET = process.env.WECHAT_MP_SECRET || '';

export function wechatJssdkConfigured(): boolean {
  return !!(APPID && SECRET);
}

interface Cached { value: string; exp: number }
let tokenCache: Cached | null = null;
let ticketCache: Cached | null = null;
const SKEW_MS = 5 * 60 * 1000; // 提前 5min 视为过期,避免边界踩空

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now()) return tokenCache.value;
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(APPID)}&secret=${encodeURIComponent(SECRET)}`,
  );
  const json = (await res.json()) as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
  if (!json.access_token) throw new Error(`wechat token: ${json.errcode ?? '?'} ${json.errmsg ?? ''}`);
  tokenCache = { value: json.access_token, exp: Date.now() + (json.expires_in ?? 7200) * 1000 - SKEW_MS };
  return json.access_token;
}

async function getJsapiTicket(): Promise<string> {
  if (ticketCache && ticketCache.exp > Date.now()) return ticketCache.value;
  const token = await getAccessToken();
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${encodeURIComponent(token)}&type=jsapi`,
  );
  const json = (await res.json()) as { ticket?: string; expires_in?: number; errcode?: number; errmsg?: string };
  if (!json.ticket) throw new Error(`wechat ticket: ${json.errcode ?? '?'} ${json.errmsg ?? ''}`);
  ticketCache = { value: json.ticket, exp: Date.now() + (json.expires_in ?? 7200) * 1000 - SKEW_MS };
  return json.ticket;
}

wechatJssdkRoutes.get('/wechat/jssdk-signature', async (c) => {
  if (!wechatJssdkConfigured()) return c.json({ disabled: true });
  const url = c.req.query('url') || '';
  if (!/^https?:\/\//.test(url)) return c.json({ error: 'url is required' }, 400);
  // 微信校验:签名用的 URL 必须与前端 location.href.split('#')[0] 逐字节一致(含 query),
  // 否则 wx.config 报 invalid signature。这里再兜一层去 hash。
  const signUrl = url.split('#')[0];
  try {
    const ticket = await getJsapiTicket();
    const nonceStr = randomBytes(12).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const raw = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${signUrl}`;
    const signature = createHash('sha1').update(raw).digest('hex');
    c.header('Cache-Control', 'no-store'); // 签名含 nonce/timestamp,不可被中间层缓存复用
    return c.json({ appId: APPID, timestamp, nonceStr, signature });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});
