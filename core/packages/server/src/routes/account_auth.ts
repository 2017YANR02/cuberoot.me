/**
 * 内部账号认证路由 —— 邮箱/手机验证码登录 + 多身份绑定(WCA / email / phone),挂在 /v1 下。
 *
 * 身份模型:内部 uid 为唯一账号;email/phone/wca 都是可绑定的 identity。requireAuth 已把
 *          uid + 真实 wcaId 从 JWT 解出,link/unlink 走当前登录用户的 uid。
 * 安全:验证码只存哈希(account.ts),6 位、10 分钟、5 次上限、60s 冷却;发/验都过 IP 限流。
 *      合并登录/注册为同一流程 → 天然免用户枚举(不泄露某邮箱是否已注册)。
 * 可选服务:email/sms 未配 env 时对应端点返 503(不崩),与 membership 同款降级。
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';
import { signSession, hasFreshEmailGrant } from '../utils/session.js';
import {
  issueCode, verifyCode, loginWithIdentity, addIdentity, removeIdentity, replaceEmailIdentity,
  getIdentities, getUserById, findUserByWcaId, publicUser,
  normalizeEmail, isValidEmail, normalizePhone, isValidPhone, isValidPassword,
  loginWithPassword, setPassword, clearPassword, getPasswordHash, verifyPassword,
  type Provider,
} from '../utils/account.js';
import { emailConfigured, sendEmailCode } from '../utils/email.js';
import { smsConfigured, sendSmsCode } from '../utils/sms.js';
import { googleConfigured, googleClientId, googleRelayUrl, verifyGoogleAssertion } from '../utils/google.js';
import {
  socialLoginConfigured, socialAppId, socialAuthorizeUrl, exchangeSocialCode, verifySocialState,
  isSocialProvider, SOCIAL_PROVIDERS, type SocialProvider, type SocialUser,
} from '../utils/social_login.js';

export const accountAuthRoutes = new Hono();

// 语言(仅用于验证码邮件文案),从 Accept-Language 粗判。
function langOf(c: Context): 'zh' | 'en' {
  return (c.req.header('Accept-Language') ?? '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

/**
 * 本次会话是否「刚用邮箱验证码登录」(15 分钟窗口,见 session.ts)。
 * 凭此可免旧密码设 / 改 / 移除密码 —— 即业界的「忘记密码」重置路径。
 */
function emailGrant(c: Context): boolean {
  const h = c.req.header('Authorization');
  return h?.startsWith('Bearer ') ? hasFreshEmailGrant(h.slice(7)) : false;
}

/** 解析当前登录用户的内部 uid(uid token 直接用;老 wca-only token 按真实 wcaId 查)。 */
async function requireUserId(c: Context): Promise<number> {
  const u = await requireAuth(c);
  if (u.uid != null) return u.uid;
  if (u.realWcaId) {
    const row = await findUserByWcaId(u.realWcaId);
    if (row) return row.id;
  }
  throw new Error('Authentication required'); // → 401
}

// ── 可用登录方式(供前端隐藏未配置的 tab;env 未配 email/sms 时对应值 false)──
accountAuthRoutes.get('/auth/providers', (c) => {
  c.header('Cache-Control', 'no-store');
  // 国内三方(微信/QQ/支付宝):配了凭据才亮 appId(公开值),没配为 null → 前端隐藏入口。
  const social: Record<string, string | null> = {};
  for (const p of SOCIAL_PROVIDERS) social[p] = socialAppId(p);
  return c.json({
    email: emailConfigured(), phone: smsConfigured(), wca: true,
    googleClientId: googleClientId(), googleRelayUrl: googleRelayUrl(),
    social,
  });
});

// ── 国内三方授权页 URL(服务端下发,redirect_uri 固定,state 为服务端签名的自包含 token)──
// state 内含 provider/intent/exp/签名,回调只从 URL 读回、服务端验签,不依赖浏览器 sessionStorage
// (手机唤起支付宝 App 授权后回调常落到另一浏览器上下文 → sessionStorage 会丢)。
accountAuthRoutes.get('/auth/social/authorize', (c) => {
  c.header('Cache-Control', 'no-store');
  const provider = c.req.query('provider') ?? '';
  const intent = c.req.query('intent') === 'link' ? 'link' : 'login';
  if (!isSocialProvider(provider)) return c.json({ error: 'invalid provider' }, 400);
  const url = socialAuthorizeUrl(provider, intent);
  if (!url) return c.json({ error: `${provider} not configured` }, 503);
  return c.json({ url });
});

// ── 国内三方登录(浏览器回调拿到 code → 此处服务端换 code → 建/取账号)──
accountAuthRoutes.post('/auth/social/:provider', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const provider = c.req.param('provider');
  if (!isSocialProvider(provider)) return c.json({ error: 'invalid provider' }, 400);
  if (!socialLoginConfigured(provider)) return c.json({ error: `${provider} not configured` }, 503);
  const { code, state } = await c.req.json<{ code?: string; state?: string }>().catch(() => ({ code: undefined, state: undefined }));
  if (!code) return c.json({ error: 'code required' }, 400);
  if (!verifySocialState(state ?? '', provider)) return c.json({ error: `invalid ${provider} state` }, 400);
  let g: SocialUser;
  try {
    g = await exchangeSocialCode(provider, code);
  } catch {
    return c.json({ error: `invalid ${provider} code` }, 401);
  }
  const user = await loginWithIdentity(provider as SocialProvider, g.sub, {
    name: g.name || '', avatar: g.avatar ?? null,
  });
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  return c.json({ token, user: publicUser(user) });
});

// ── 国内三方绑定(登录态,把该身份加到当前账号)──
accountAuthRoutes.post('/auth/link/social/:provider', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireUserId(c);
  const provider = c.req.param('provider');
  if (!isSocialProvider(provider)) return c.json({ error: 'invalid provider' }, 400);
  if (!socialLoginConfigured(provider)) return c.json({ error: `${provider} not configured` }, 503);
  const { code, state } = await c.req.json<{ code?: string; state?: string }>().catch(() => ({ code: undefined, state: undefined }));
  if (!code) return c.json({ error: 'code required' }, 400);
  if (!verifySocialState(state ?? '', provider)) return c.json({ error: `invalid ${provider} state` }, 400);
  let g: SocialUser;
  try {
    g = await exchangeSocialCode(provider, code);
  } catch {
    return c.json({ error: `invalid ${provider} code` }, 401);
  }
  const r = await addIdentity(uid, provider as SocialProvider, g.sub);
  if (r === 'conflict') return c.json({ error: `${provider} account already linked to another account` }, 409);
  return c.json({ ok: true, identities: await getIdentities(uid) });
});

// ── 发码(登录/注册)──
accountAuthRoutes.post('/auth/email/send', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  if (!emailConfigured()) return c.json({ error: 'email not configured' }, 503);
  const { email } = await c.req.json<{ email?: string }>().catch(() => ({ email: undefined }));
  const norm = normalizeEmail(email ?? '');
  if (!isValidEmail(norm)) return c.json({ error: 'invalid email' }, 400);
  const issued = await issueCode('email', norm, 'login');
  if ('error' in issued) return c.json({ error: 'too frequent' }, 429);
  try {
    await sendEmailCode(norm, issued.code, langOf(c));
  } catch {
    return c.json({ error: 'send failed' }, 502);
  }
  return c.json({ ok: true });
});

accountAuthRoutes.post('/auth/email/verify', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const { email, code } = await c.req.json<{ email?: string; code?: string }>().catch(() => ({ email: undefined, code: undefined }));
  const norm = normalizeEmail(email ?? '');
  if (!isValidEmail(norm) || !/^\d{6}$/.test(code ?? '')) return c.json({ error: 'invalid input' }, 400);
  const ok = await verifyCode('email', norm, 'login', code as string);
  if (!ok) return c.json({ error: 'wrong or expired code' }, 401);
  const user = await loginWithIdentity('email', norm, { name: norm.split('@')[0] });
  // amr=email_code:本次会话已证明邮箱所有权 → 15 分钟内可免旧密码重设密码(忘记密码路径)。
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name, amr: 'email_code' });
  return c.json({ token, user: publicUser(user) });
});

accountAuthRoutes.post('/auth/phone/send', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  if (!smsConfigured()) return c.json({ error: 'sms not configured' }, 503);
  const { phone } = await c.req.json<{ phone?: string }>().catch(() => ({ phone: undefined }));
  const norm = normalizePhone(phone ?? '');
  if (!isValidPhone(norm)) return c.json({ error: 'invalid phone' }, 400);
  const issued = await issueCode('phone', norm, 'login');
  if ('error' in issued) return c.json({ error: 'too frequent' }, 429);
  try {
    await sendSmsCode(norm, issued.code);
  } catch {
    return c.json({ error: 'send failed' }, 502);
  }
  return c.json({ ok: true });
});

accountAuthRoutes.post('/auth/phone/verify', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const { phone, code } = await c.req.json<{ phone?: string; code?: string }>().catch(() => ({ phone: undefined, code: undefined }));
  const norm = normalizePhone(phone ?? '');
  if (!isValidPhone(norm) || !/^\d{6}$/.test(code ?? '')) return c.json({ error: 'invalid input' }, 400);
  const ok = await verifyCode('phone', norm, 'login', code as string);
  if (!ok) return c.json({ error: 'wrong or expired code' }, 401);
  const name = `尾号${norm.slice(-4)}`;
  const user = await loginWithIdentity('phone', norm, { name });
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  return c.json({ token, user: publicUser(user) });
});

// ── 邮箱 + 密码登录(账号已存在且已设密码即可;不依赖邮件服务)──
// 失败一律返回同一句 generic 文案 + 相同耗时(loginWithPassword 含假哈希兜底),不区分
// 「邮箱未注册 / 未设密码 / 密码错」,避免用户枚举。前端在密码 pane 常挂「改用验证码」出口。
accountAuthRoutes.post('/auth/email/password', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const { email, password } = await c.req.json<{ email?: string; password?: string }>().catch(() => ({ email: undefined, password: undefined }));
  const norm = normalizeEmail(email ?? '');
  if (!isValidEmail(norm) || typeof password !== 'string' || !password) return c.json({ error: 'invalid input' }, 400);
  const user = await loginWithPassword(norm, password);
  if (!user) return c.json({ error: 'wrong email or password' }, 401);
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  return c.json({ token, user: publicUser(user) });
});

// ── 设置 / 修改 / 重置密码(登录态)──
// 业界(GitHub / Figma / Notion)把这件事分成两条路,凭据要求不同:
//   修改(知道旧密码)  → 必须先验旧密码,防「会话被劫持者直接换密码」。
//   重置(忘了 / 没设) → 邮件通道证明邮箱所有权即可,不问旧密码。
// 我们的 amr=email_code 会话就是后者的凭据(等价于别家的重置链接),故 grant 在手时跳过旧密码校验。
accountAuthRoutes.post('/auth/password/set', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireUserId(c);
  const { password, currentPassword } = await c.req.json<{ password?: string; currentPassword?: string }>().catch(() => ({ password: undefined, currentPassword: undefined }));
  if (!isValidPassword(password)) return c.json({ error: 'invalid password' }, 400);
  const existing = await getPasswordHash(uid);
  if (existing && !emailGrant(c) && !(typeof currentPassword === 'string' && await verifyPassword(currentPassword, existing))) {
    return c.json({ error: 'wrong current password' }, 401);
  }
  await setPassword(uid, password);
  return c.json({ ok: true, hasPassword: true });
});

// ── 移除密码(退回纯验证码登录,同 Notion 的 Remove password)。凭据要求同上 ──
accountAuthRoutes.post('/auth/password/remove', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireUserId(c);
  const { currentPassword } = await c.req.json<{ currentPassword?: string }>().catch(() => ({ currentPassword: undefined }));
  const existing = await getPasswordHash(uid);
  if (!existing) return c.json({ ok: true, hasPassword: false }); // 幂等
  if (!emailGrant(c) && !(typeof currentPassword === 'string' && await verifyPassword(currentPassword, existing))) {
    return c.json({ error: 'wrong current password' }, 401);
  }
  await clearPassword(uid);
  return c.json({ ok: true, hasPassword: false });
});

// ── 绑定(登录态下给当前账号加身份)──
accountAuthRoutes.post('/auth/link/email/send', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  await requireUserId(c); // 必须登录
  if (!emailConfigured()) return c.json({ error: 'email not configured' }, 503);
  const { email } = await c.req.json<{ email?: string }>().catch(() => ({ email: undefined }));
  const norm = normalizeEmail(email ?? '');
  if (!isValidEmail(norm)) return c.json({ error: 'invalid email' }, 400);
  const issued = await issueCode('email', norm, 'link');
  if ('error' in issued) return c.json({ error: 'too frequent' }, 429);
  try {
    await sendEmailCode(norm, issued.code, langOf(c));
  } catch {
    return c.json({ error: 'send failed' }, 502);
  }
  return c.json({ ok: true });
});

accountAuthRoutes.post('/auth/link/email/verify', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireUserId(c);
  const { email, code } = await c.req.json<{ email?: string; code?: string }>().catch(() => ({ email: undefined, code: undefined }));
  const norm = normalizeEmail(email ?? '');
  if (!isValidEmail(norm) || !/^\d{6}$/.test(code ?? '')) return c.json({ error: 'invalid input' }, 400);
  const ok = await verifyCode('email', norm, 'link', code as string);
  if (!ok) return c.json({ error: 'wrong or expired code' }, 401);
  const r = await addIdentity(uid, 'email', norm);
  if (r === 'has-email') return c.json({ error: 'account already has an email' }, 409);
  if (r === 'conflict') return c.json({ error: 'email already linked to another account' }, 409);
  return c.json({ ok: true, identities: await getIdentities(uid) });
});

/**
 * 换绑邮箱。发码复用 link/email/send(拿的是同一个 'link' 用途的码,新地址的所有权证明
 * 一模一样),只有落库这步不同:原地改那条 email 身份,不是新增一条。
 * 见 replaceEmailIdentity —— 「先解绑再绑定」对只有邮箱的账号走不通。
 */
accountAuthRoutes.post('/auth/email/replace', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireUserId(c);
  const { email, code } = await c.req.json<{ email?: string; code?: string }>().catch(() => ({ email: undefined, code: undefined }));
  const norm = normalizeEmail(email ?? '');
  if (!isValidEmail(norm) || !/^\d{6}$/.test(code ?? '')) return c.json({ error: 'invalid input' }, 400);
  const ok = await verifyCode('email', norm, 'link', code as string);
  if (!ok) return c.json({ error: 'wrong or expired code' }, 401);
  const r = await replaceEmailIdentity(uid, norm);
  if (r === 'conflict') return c.json({ error: 'email already linked to another account' }, 409);
  if (r === 'no-email') return c.json({ error: 'no email to replace' }, 409);
  return c.json({ ok: true, identities: await getIdentities(uid) });
});

accountAuthRoutes.post('/auth/link/phone/send', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  await requireUserId(c);
  if (!smsConfigured()) return c.json({ error: 'sms not configured' }, 503);
  const { phone } = await c.req.json<{ phone?: string }>().catch(() => ({ phone: undefined }));
  const norm = normalizePhone(phone ?? '');
  if (!isValidPhone(norm)) return c.json({ error: 'invalid phone' }, 400);
  const issued = await issueCode('phone', norm, 'link');
  if ('error' in issued) return c.json({ error: 'too frequent' }, 429);
  try {
    await sendSmsCode(norm, issued.code);
  } catch {
    return c.json({ error: 'send failed' }, 502);
  }
  return c.json({ ok: true });
});

accountAuthRoutes.post('/auth/link/phone/verify', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireUserId(c);
  const { phone, code } = await c.req.json<{ phone?: string; code?: string }>().catch(() => ({ phone: undefined, code: undefined }));
  const norm = normalizePhone(phone ?? '');
  if (!isValidPhone(norm) || !/^\d{6}$/.test(code ?? '')) return c.json({ error: 'invalid input' }, 400);
  const ok = await verifyCode('phone', norm, 'link', code as string);
  if (!ok) return c.json({ error: 'wrong or expired code' }, 401);
  const r = await addIdentity(uid, 'phone', norm);
  if (r === 'conflict') return c.json({ error: 'phone already linked to another account' }, 409);
  return c.json({ ok: true, identities: await getIdentities(uid) });
});

// ── 绑定 WCA(登录态下,用 WCA access_token 验证并把 wca 身份加到当前账号)──
accountAuthRoutes.post('/auth/link/wca', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireUserId(c);
  const { accessToken } = await c.req.json<{ accessToken?: string }>().catch(() => ({ accessToken: undefined }));
  if (!accessToken) return c.json({ error: 'accessToken required' }, 400);
  let me: { wca_id?: string; name?: string; avatar?: { url?: string } };
  try {
    const res = await fetch('https://www.worldcubeassociation.org/api/v0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return c.json({ error: 'invalid WCA token' }, 401);
    const data = (await res.json()) as { me?: typeof me };
    me = data.me ?? {};
  } catch {
    return c.json({ error: 'WCA API unavailable' }, 502);
  }
  if (!me.wca_id) return c.json({ error: 'this WCA account has no WCA ID (never competed)' }, 400);
  const r = await addIdentity(uid, 'wca', me.wca_id, me.wca_id);
  if (r === 'conflict') return c.json({ error: 'WCA account already linked elsewhere' }, 409);
  // 同步 wca_users 缓存(供其它路径复用),与 /auth/exchange 一致。
  await query(
    `INSERT INTO wca_users (wca_id, name, avatar_url, access_token, token_expires_at)
     VALUES (?, ?, ?, ?, NOW() + INTERVAL '7200 seconds')
     ON CONFLICT (wca_id) DO UPDATE SET
       name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url,
       access_token = EXCLUDED.access_token, token_expires_at = EXCLUDED.token_expires_at,
       updated_at = NOW()`,
    [me.wca_id, me.name ?? '', me.avatar?.url ?? null, accessToken],
  );
  const user = await getUserById(uid);
  // 绑定后重签 token,让新的 wcaId 立即进入会话。
  const token = user ? signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name }) : undefined;
  return c.json({ ok: true, token, user: user ? publicUser(user) : undefined, identities: await getIdentities(uid) });
});

// ── Google(浏览器拿 access_token → 墙外 Vercel 中继验真并签断言 → 此处只验断言 HMAC)──
// 本服务器出网到 Google 被墙,故不自己回调 Google;中继地址/密钥见 utils/google.ts 顶注。
accountAuthRoutes.post('/auth/google', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  if (!googleConfigured()) return c.json({ error: 'google not configured' }, 503);
  const { assertion } = await c.req.json<{ assertion?: string }>().catch(() => ({ assertion: undefined }));
  if (!assertion) return c.json({ error: 'assertion required' }, 400);
  let g: { sub: string; email?: string; name?: string; picture?: string };
  try {
    g = verifyGoogleAssertion(assertion);
  } catch {
    return c.json({ error: 'invalid Google token' }, 401);
  }
  const user = await loginWithIdentity('google', g.sub, {
    name: g.name || g.email?.split('@')[0] || '',
    avatar: g.picture ?? null,
  });
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  return c.json({ token, user: publicUser(user) });
});

accountAuthRoutes.post('/auth/link/google', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireUserId(c);
  if (!googleConfigured()) return c.json({ error: 'google not configured' }, 503);
  const { assertion } = await c.req.json<{ assertion?: string }>().catch(() => ({ assertion: undefined }));
  if (!assertion) return c.json({ error: 'assertion required' }, 400);
  let g: { sub: string };
  try {
    g = verifyGoogleAssertion(assertion);
  } catch {
    return c.json({ error: 'invalid Google token' }, 401);
  }
  const r = await addIdentity(uid, 'google', g.sub);
  if (r === 'conflict') return c.json({ error: 'Google account already linked to another account' }, 409);
  return c.json({ ok: true, identities: await getIdentities(uid) });
});

// ── 解绑 ──
accountAuthRoutes.post('/auth/unlink', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireUserId(c);
  const { provider, providerUid } = await c.req.json<{ provider?: string; providerUid?: string }>().catch(() => ({ provider: undefined, providerUid: undefined }));
  const allowed: Provider[] = ['email', 'phone', 'wca', 'apple', 'google', 'wechat', 'alipay', 'qq'];
  if (!allowed.includes(provider as Provider)) return c.json({ error: 'invalid provider' }, 400);
  const r = await removeIdentity(uid, provider as Provider, providerUid);
  if (r === 'last') return c.json({ error: 'cannot unlink your only login method' }, 409);
  if (r === 'not_found') return c.json({ error: 'identity not found' }, 404);
  const user = await getUserById(uid);
  const token = user ? signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name }) : undefined;
  return c.json({ ok: true, token, user: user ? publicUser(user) : undefined, identities: await getIdentities(uid) });
});

// ── 我的身份列表(附是否已设密码,供账号面板显示「设置 / 修改密码」)──
// canResetPassword:本次会话刚验过邮箱 → 改密码时前端不必再要当前密码(后端同样放行)。
accountAuthRoutes.get('/auth/identities', async (c) => {
  c.header('Cache-Control', 'no-store');
  const uid = await requireUserId(c);
  const [identities, pwHash] = await Promise.all([getIdentities(uid), getPasswordHash(uid)]);
  return c.json({ identities, hasPassword: pwHash != null, canResetPassword: emailGrant(c) });
});
