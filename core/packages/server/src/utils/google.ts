/**
 * Google 登录/绑定 —— 因本服务器出网到 Google 全域被墙(googleapis.com / accounts.google.com
 * 连不出去),无法自己回调 Google userinfo 验真。改走「墙外中继」:
 *
 *   浏览器 --access_token--> Vercel 中继(墙外,能到 Google)--验真--> 签一个我们自己密钥的短期断言
 *   浏览器 --断言--> 本服务器  ← 只验这个断言的 HMAC 签名,永不碰 Google
 *
 * 中继(Next 路由 app/api/google-verify)拿 access_token 去 Google userinfo 换 sub/email/name/picture,
 * 校验通过后用 GOOGLE_RELAY_SECRET 签一个 HS256 JWT(iss=cuberoot-google-relay,exp 120s)。本服务器
 * 只需 verify 这个断言的签名 + 时效 + issuer,完全不依赖出网到 Google。
 *
 * 三个 env 齐全(GOOGLE_CLIENT_ID + GOOGLE_RELAY_URL + GOOGLE_RELAY_SECRET)才算已配置,否则
 * googleConfigured() 返 false,路由据此返回 503 / 前端隐藏入口,与 email/sms 同款降级。
 */
import jwt from 'jsonwebtoken';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_RELAY_URL = process.env.GOOGLE_RELAY_URL || '';
const GOOGLE_RELAY_SECRET = process.env.GOOGLE_RELAY_SECRET || '';

/** 中继断言的 issuer,签发方(Vercel 路由)与验证方(本文件)必须逐字一致。 */
export const RELAY_ISS = 'cuberoot-google-relay';

export function googleConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_RELAY_URL && GOOGLE_RELAY_SECRET);
}

export function googleClientId(): string | null {
  return GOOGLE_CLIENT_ID || null;
}

/** 前端拿到 access_token 后应 POST 到的墙外中继地址(未配返 null)。 */
export function googleRelayUrl(): string | null {
  return GOOGLE_RELAY_URL || null;
}

export interface GoogleUserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

/** 验中继签发的断言(HS256),取出中继已替我们向 Google 核实过的 sub/email/name/picture;
 *  签名非法 / 过期 / issuer 不符时抛异常(与 jwt.verify 一致)。 */
export function verifyGoogleAssertion(assertion: string): GoogleUserInfo {
  const p = jwt.verify(assertion, GOOGLE_RELAY_SECRET, { issuer: RELAY_ISS }) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!p.sub) throw new Error('missing Google sub');
  return { sub: p.sub, email: p.email, name: p.name, picture: p.picture };
}
