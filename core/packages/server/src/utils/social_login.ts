/**
 * 国内三方登录(微信 / QQ / 支付宝)—— 标准 OAuth2「授权码」重定向流,服务端换 code。
 *
 * 与 Google 不同:本服务器出网到微信/QQ/支付宝 API 全部畅通(均为国内域),故**无需墙外中继**,
 * 直接服务端 code→access_token→userinfo。浏览器只负责跳授权页 + 把回调 code 送回来。
 *
 * 授权回调统一落到前端页 `${SITE_ORIGIN}/auth/social/callback`(需在各平台后台登记为回调域/地址),
 * 该页读出 code 后 POST 给后端 /v1/auth/social/:provider(登录)或 /v1/auth/link/social/:provider(绑定)。
 * 授权页 URL 也由服务端下发(GET /v1/auth/social/authorize),保证 redirect_uri 与换 code 时逐字一致。
 *
 * 每个 provider 的凭据齐全才算「已配置」(xxxLoginConfigured),否则前端隐藏入口、后端返 503,
 * 与 email/sms/google 同款降级。凭据来源见文件尾「环境变量」。
 */
import { createSign, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { buildAlipaySignContent, type SignParams } from '@cuberoot/shared/payment';
import { JWT_SECRET } from './session.js';

export type SocialProvider = 'wechat' | 'qq' | 'alipay';
export type SocialIntent = 'login' | 'link';
export const SOCIAL_PROVIDERS: readonly SocialProvider[] = ['wechat', 'qq', 'alipay'];
export function isSocialProvider(x: string): x is SocialProvider {
  return (SOCIAL_PROVIDERS as readonly string[]).includes(x);
}

export interface SocialUser {
  sub: string;              // 稳定唯一标识(unionid / openid / alipay user_id)→ 存 auth_identities.provider_uid
  name?: string;
  avatar?: string;
}

// 授权回调统一落到这个前端页(各平台后台需把它的域名/地址登记为回调域)。
// 用 PUBLIC_SITE_ORIGIN(支付已在用)保证与前端跳转时的 origin 一致,免 www/apex 漂移。
const SITE_ORIGIN = (process.env.PUBLIC_SITE_ORIGIN || 'https://cuberoot.me').replace(/\/+$/, '');
const SOCIAL_REDIRECT = `${SITE_ORIGIN}/auth/social/callback`;

// ── 微信开放平台「网站应用」扫码登录(需企业主体 + ¥300/年认证)──
const WECHAT_APP_ID = process.env.WECHAT_LOGIN_APP_ID || '';
const WECHAT_APP_SECRET = process.env.WECHAT_LOGIN_APP_SECRET || '';
export function wechatLoginConfigured(): boolean { return Boolean(WECHAT_APP_ID && WECHAT_APP_SECRET); }

// ── QQ 互联「网站应用」(个人开发者即可,需 ICP 备案域名)──
const QQ_APP_ID = process.env.QQ_APP_ID || '';
const QQ_APP_KEY = process.env.QQ_APP_KEY || '';
export function qqLoginConfigured(): boolean { return Boolean(QQ_APP_ID && QQ_APP_KEY); }

// ── 支付宝「用户信息授权」(复用支付那套应用 APPID + 应用私钥,公钥模式 RSA2)──
// 应用需在开放平台加签「获取会员信息 alipay.user.info.share」能力后才可用;为免能力未就绪就
// 亮出会报错的入口,单设 ALIPAY_LOGIN_ENABLED 显式开关(默认关),与支付的 env 解耦。
const ALIPAY_GATEWAY = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
const ALIPAY_APP_ID = process.env.ALIPAY_APP_ID || '';
const ALIPAY_PRIVATE_KEY = normalizePem(process.env.ALIPAY_PRIVATE_KEY || '', 'PRIVATE KEY');
const ALIPAY_LOGIN_ON = process.env.ALIPAY_LOGIN_ENABLED === '1' || process.env.ALIPAY_LOGIN_ENABLED === 'true';
export function alipayLoginConfigured(): boolean { return Boolean(ALIPAY_LOGIN_ON && ALIPAY_APP_ID && ALIPAY_PRIVATE_KEY); }

/** 某 provider 的公开 appId(供前端展示/兜底;未配返 null)。 */
export function socialAppId(provider: SocialProvider): string | null {
  if (provider === 'wechat') return wechatLoginConfigured() ? WECHAT_APP_ID : null;
  if (provider === 'qq') return qqLoginConfigured() ? QQ_APP_ID : null;
  return alipayLoginConfigured() ? ALIPAY_APP_ID : null;
}

export function socialLoginConfigured(provider: SocialProvider): boolean {
  if (provider === 'wechat') return wechatLoginConfigured();
  if (provider === 'qq') return qqLoginConfigured();
  return alipayLoginConfigured();
}

// ── 自包含签名 state ──
// 格式 `<nonce>.<provider>.<intent>.<exp>.<sig>`(全 URL 安全字符,无点冲突)。回调只从 URL
// 读回、由服务端 HMAC 验签,**不依赖浏览器 sessionStorage** —— 手机唤起支付宝 App 授权后回调常
// 落到另一个浏览器上下文(系统浏览器 / App 内置浏览器),sessionStorage 会丢,故 CSRF 校验必须无状态。
// 长度 ~60 字符,满足微信 state ≤128 限制。
const STATE_TTL_SEC = 600; // 10 分钟
function stateSig(payload: string): string {
  return createHmac('sha256', JWT_SECRET).update(payload).digest('base64url').slice(0, 27);
}
export function signSocialState(provider: SocialProvider, intent: SocialIntent): string {
  const nonce = randomBytes(6).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SEC;
  const payload = `${nonce}.${provider}.${intent}.${exp}`;
  return `${payload}.${stateSig(payload)}`;
}
/** 验签 state:签名对 + 未过期 + provider 匹配 → 返 {intent};否则 null。 */
export function verifySocialState(state: string, expectProvider: SocialProvider): { intent: SocialIntent } | null {
  const parts = (state || '').split('.');
  if (parts.length !== 5) return null;
  const [nonce, p, i, expStr, sig] = parts;
  const expected = stateSig(`${nonce}.${p}.${i}.${expStr}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (p !== expectProvider) return null;
  if (i !== 'login' && i !== 'link') return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  return { intent: i };
}

/** 服务端下发的授权页 URL(内部生成签名 state,redirect_uri 固定为 SOCIAL_REDIRECT)。未配返 null。 */
export function socialAuthorizeUrl(provider: SocialProvider, intent: SocialIntent): string | null {
  if (!socialLoginConfigured(provider)) return null;
  const redirect = encodeURIComponent(SOCIAL_REDIRECT);
  const st = encodeURIComponent(signSocialState(provider, intent));
  if (provider === 'wechat') {
    // 网站应用扫码登录;#wechat_redirect 结尾为微信强制要求。
    return `https://open.weixin.qq.com/connect/qrconnect?appid=${WECHAT_APP_ID}&redirect_uri=${redirect}&response_type=code&scope=snsapi_login&state=${st}#wechat_redirect`;
  }
  if (provider === 'qq') {
    return `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${QQ_APP_ID}&redirect_uri=${redirect}&scope=get_user_info&state=${st}`;
  }
  return `https://openauth.alipay.com/oauth2/publicAppAuthorize.htm?app_id=${ALIPAY_APP_ID}&scope=auth_user&redirect_uri=${redirect}&state=${st}`;
}

/** 用回调 code 换取用户身份(登录/绑定共用)。任一步失败即抛异常。 */
export async function exchangeSocialCode(provider: SocialProvider, code: string): Promise<SocialUser> {
  if (provider === 'wechat') return exchangeWechat(code);
  if (provider === 'qq') return exchangeQq(code);
  return exchangeAlipay(code);
}

// ─────────────────────────── 微信 ───────────────────────────
async function exchangeWechat(code: string): Promise<SocialUser> {
  const tk = await getJson<{ access_token?: string; openid?: string; unionid?: string; errcode?: number }>(
    `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${WECHAT_APP_ID}&secret=${WECHAT_APP_SECRET}&code=${encodeURIComponent(code)}&grant_type=authorization_code`,
  );
  if (!tk.access_token || !tk.openid) throw new Error('wechat token exchange failed');
  const sub = tk.unionid || tk.openid; // 有 unionid(同主体多应用稳定)优先,否则 openid
  let name: string | undefined, avatar: string | undefined;
  try {
    const info = await getJson<{ nickname?: string; headimgurl?: string }>(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${tk.access_token}&openid=${tk.openid}`,
    );
    name = info.nickname || undefined;
    avatar = info.headimgurl || undefined;
  } catch { /* 资料可选,拿不到不阻塞登录 */ }
  return { sub, name, avatar };
}

// ─────────────────────────── QQ ───────────────────────────
async function exchangeQq(code: string): Promise<SocialUser> {
  const tk = await getJson<{ access_token?: string; error?: number }>(
    `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${QQ_APP_ID}&client_secret=${QQ_APP_KEY}&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(SOCIAL_REDIRECT)}&fmt=json`,
  );
  if (!tk.access_token) throw new Error('qq token exchange failed');
  const me = await getJson<{ openid?: string; unionid?: string }>(
    `https://graph.qq.com/oauth2.0/me?access_token=${tk.access_token}&fmt=json`,
  );
  if (!me.openid) throw new Error('qq openid failed');
  const sub = me.unionid || me.openid;
  let name: string | undefined, avatar: string | undefined;
  try {
    const info = await getJson<{ ret?: number; nickname?: string; figureurl_qq_2?: string; figureurl_qq_1?: string }>(
      `https://graph.qq.com/user/get_user_info?access_token=${tk.access_token}&oauth_consumer_key=${QQ_APP_ID}&openid=${me.openid}`,
    );
    if (info.ret === 0) {
      name = info.nickname || undefined;
      avatar = info.figureurl_qq_2 || info.figureurl_qq_1 || undefined;
    }
  } catch { /* 资料可选 */ }
  return { sub, name, avatar };
}

// ─────────────────────────── 支付宝 ───────────────────────────
async function exchangeAlipay(authCode: string): Promise<SocialUser> {
  const tokenResp = await alipayApi<{
    alipay_system_oauth_token_response?: { access_token?: string; user_id?: string };
    error_response?: { sub_msg?: string };
  }>('alipay.system.oauth.token', { grant_type: 'authorization_code', code: authCode });
  const t = tokenResp.alipay_system_oauth_token_response;
  if (!t?.user_id) throw new Error('alipay token exchange failed');
  const sub = t.user_id; // 支付宝 user_id 稳定唯一
  let name: string | undefined, avatar: string | undefined;
  if (t.access_token) {
    try {
      const infoResp = await alipayApi<{ alipay_user_info_share_response?: { nick_name?: string; avatar?: string } }>(
        'alipay.user.info.share', {}, t.access_token,
      );
      const info = infoResp.alipay_user_info_share_response;
      name = info?.nick_name || undefined;
      avatar = info?.avatar || undefined;
    } catch { /* 资料可选 */ }
  }
  return { sub, name, avatar };
}

/** 签名并调用支付宝网关(同 payment/alipay.ts 公钥模式;响应经 TLS 直连可信,不再验响应签名)。 */
async function alipayApi<T>(method: string, topLevel: Record<string, string>, authToken?: string): Promise<T> {
  const params: SignParams = {
    app_id: ALIPAY_APP_ID, method, format: 'JSON', charset: 'utf-8',
    sign_type: 'RSA2', timestamp: beijingTimestamp(), version: '1.0', ...topLevel,
  };
  if (authToken) params.auth_token = authToken;
  params.sign = createSign('RSA-SHA256')
    .update(buildAlipaySignContent(params, ['sign']), 'utf8')
    .sign(ALIPAY_PRIVATE_KEY, 'base64');
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) usp.set(k, String(v));
  const res = await fetch(ALIPAY_GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: usp.toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`alipay gateway ${res.status}`);
  return res.json() as Promise<T>;
}

// ─────────────────────────── 小工具 ───────────────────────────
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  // 微信 userinfo 声明 text/plain,QQ fmt=json 声明 text/html;都强解析为 JSON。
  const text = await res.text();
  return JSON.parse(text) as T;
}

// 与 payment/alipay.ts 同款(那边未导出,这里本地保留一份,避免耦合支付模块)。
function normalizePem(raw: string, type: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
  const s = raw.trim();
  if (!s) return '';
  if (s.includes('-----BEGIN')) return s.replace(/\\n/g, '\n');
  const body = s.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') ?? s;
  return `-----BEGIN ${type}-----\n${body}\n-----END ${type}-----`;
}

function beijingTimestamp(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/*
 * 环境变量(写 /root/core-api/.env 后 pm2 reload core-api --update-env 生效):
 *   微信:  WECHAT_LOGIN_APP_ID / WECHAT_LOGIN_APP_SECRET(微信开放平台「网站应用」,与微信支付 WECHAT_* 分开)
 *   QQ:    QQ_APP_ID / QQ_APP_KEY(QQ 互联「网站应用」APPID/APPKEY)
 *   支付宝: 复用 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY(支付那套),另需 ALIPAY_LOGIN_ENABLED=1 显式开启
 * 各平台后台回调域/地址统一登记:  https://cuberoot.me/auth/social/callback(域名 cuberoot.me 已 ICP 备案)
 */
