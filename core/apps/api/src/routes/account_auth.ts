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
import { isClawdAvatarPreset } from '@cuberoot/shared/account-avatar';
import type { AccountBasicProfile } from '@cuberoot/shared/account';
import {
  isMobileAuthCodeChallenge,
  webSessionError,
  type WebSession,
} from '@cuberoot/shared/auth/web-session';
import { getIp } from '../utils/analytics_helpers.js';
import { query } from '../db/connection.js';
import { checkRateLimit, requireAdmin } from '../utils/recon_helpers.js';
import { signSession, hasFreshEmailGrant, hasFreshPhonePasswordResetGrant } from '../utils/session.js';
import { captureAccountDevice } from '../utils/account_device.js';
import {
  issueCode, verifyCode, loginWithIdentity, addIdentity, removeIdentity, replaceCredentialIdentity,
  getIdentities, getUserById, findUserByIdentity, publicUser,
  normalizeEmail, isValidEmail, normalizePhone, isValidPhone, isValidPassword,
  normalizeDisplayName, isValidDisplayName, updateDisplayName,
  getAccountBasicProfile, updateAccountBasicProfile,
  isAccountGender, isValidBirthDate, normalizeCountryIso2, isValidCountryIso2,
  normalizeAccountRegionCode, isValidAccountRegionCode,
  normalizeAccountCityName, isValidAccountCityName, isValidAccountLocation,
  updateClawdAvatar, updateUploadedAvatar, resetAvatarToWca,
  loginWithPassword, setPassword, clearPassword, getPasswordHash, verifyPassword,
  ownerKey, primaryHandle,
  type Provider,
} from '../utils/account.js';
import { AccountOwnsOrganizationError, deleteAccount } from '../utils/account_delete.js';
import { emailConfigured, sendEmailCode } from '../utils/email.js';
import { smsConfigured, sendSmsCode } from '../utils/sms.js';
import { googleConfigured, googleClientId, googleRelayUrl, verifyGoogleAssertion } from '../utils/google.js';
import {
  socialLoginConfigured, socialAppId, socialAuthorizeUrl, exchangeSocialCode, verifySocialState,
  isSocialProvider, SOCIAL_PROVIDERS, type SocialProvider, type SocialUser,
} from '../utils/social_login.js';
import {
  exchangeWechatMiniProgramCode,
  WechatMiniProgramError,
  wechatMiniProgramConfigured,
} from '../utils/wechat_miniprogram.js';
import {
  douyinMiniProgramConfigured,
  exchangeDouyinMiniProgramCode,
  DouyinMiniProgramError,
} from '../utils/douyin_miniprogram.js';
import {
  consumeMobileSessionTicket,
  consumeWebSessionTicket,
  issueMobileSessionTicket,
  issueWebSessionTicket,
} from '../utils/web_session_ticket.js';
import { requireAppUserId } from '../utils/app_user_auth.js';
import { apiOrigin } from '../utils/api_origin.js';

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

/** 本次会话是否由「找回密码」用途的手机验证码签出。普通短信登录明确不算。 */
function phonePasswordResetGrant(c: Context): boolean {
  const h = c.req.header('Authorization');
  return h?.startsWith('Bearer ') ? hasFreshPhonePasswordResetGrant(h.slice(7)) : false;
}

function parsePhoneCodePurpose(value: unknown): 'login' | 'password_reset' | null {
  if (value == null || value === 'login') return 'login';
  return value === 'password_reset' ? value : null;
}

/** Keep the six auth contract endpoints on a stable error wire shape. */
function authRateLimitResponse(c: Context): Response | null {
  try {
    checkRateLimit(getIp(c));
    return null;
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'Rate limit exceeded') throw error;
    c.header('Retry-After', '5');
    return c.json(webSessionError('RATE_LIMITED', error.message), 429);
  }
}

async function ticketApplicant(c: Context): Promise<{ uid: number } | { response: Response }> {
  try {
    return { uid: await requireAppUserId(c) };
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return { response: c.json(webSessionError('UNAUTHENTICATED', error.message), 401) };
    }
    if (error instanceof Error && error.message.includes('suspended')) {
      return { response: c.json(webSessionError('ACCOUNT_BLOCKED', error.message), 403) };
    }
    throw error;
  }
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
  const { user, isNew } = await loginWithIdentity(provider as SocialProvider, g.sub, {
    name: g.name || '', avatar: g.avatar ?? null,
  });
  await captureAccountDevice(user.id, c.req.header('User-Agent'));
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  return c.json({ token, user: publicUser(user), isNew });
});

// ── 微信小程序登录(wx.login code → code2Session → UnionID)──
// UnionID 缺失时绝不退回 openid:两者命名空间不同,回退会给同一个人创建第二个账号。
accountAuthRoutes.post('/auth/wechat/miniprogram', async (c) => {
  c.header('Cache-Control', 'no-store');
  const rateLimited = authRateLimitResponse(c);
  if (rateLimited) return rateLimited;
  if (!wechatMiniProgramConfigured()) {
    return c.json(webSessionError('WECHAT_NOT_CONFIGURED', 'wechat miniprogram not configured'), 503);
  }
  const body = await c.req.json<{ code?: unknown }>().catch(() => ({ code: undefined }));
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code || code.length > 512) {
    return c.json(webSessionError('INVALID_REQUEST', 'invalid code'), 400);
  }

  let wechatSession;
  try {
    wechatSession = await exchangeWechatMiniProgramCode(code);
  } catch (error) {
    if (error instanceof WechatMiniProgramError) {
      if (error.code === 'invalid-code') {
        return c.json(webSessionError('INVALID_WECHAT_CODE', 'invalid wechat code'), 401);
      }
      if (error.code === 'rate-limited') {
        return c.json(webSessionError('RATE_LIMITED', 'wechat login rate limited'), 429);
      }
      if (error.code === 'blocked-user') {
        return c.json(webSessionError('ACCOUNT_BLOCKED', 'wechat login blocked'), 403);
      }
    }
    console.error('[auth] wechat miniprogram exchange failed:', error instanceof Error ? error.message : error);
    return c.json(webSessionError('WECHAT_UNAVAILABLE', 'wechat service unavailable'), 502);
  }
  if (!wechatSession.unionid) {
    return c.json(webSessionError('WECHAT_UNIONID_REQUIRED', 'wechat unionid required'), 409);
  }

  const { user, isNew } = await loginWithIdentity('wechat', wechatSession.unionid, { name: '' });
  await captureAccountDevice(user.id, c.req.header('User-Agent'));
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  const session: WebSession = { token, user: publicUser(user) };
  return c.json({ ...session, isNew });
});

// ── 抖音小程序登录(tt.login code → code2Session → openid)──
accountAuthRoutes.post('/auth/douyin/miniprogram', async (c) => {
  c.header('Cache-Control', 'no-store');
  const rateLimited = authRateLimitResponse(c);
  if (rateLimited) return rateLimited;
  if (!douyinMiniProgramConfigured()) {
    return c.json(webSessionError('DOUYIN_NOT_CONFIGURED', 'douyin miniprogram not configured'), 503);
  }
  const body = await c.req.json<{ code?: unknown }>().catch(() => ({ code: undefined }));
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code || code.length > 512) {
    return c.json(webSessionError('INVALID_REQUEST', 'invalid code'), 400);
  }

  try {
    const { openid } = await exchangeDouyinMiniProgramCode(code);
    const { user, isNew } = await loginWithIdentity('douyin', openid, { name: '' });
    await captureAccountDevice(user.id, c.req.header('User-Agent'));
    const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
    const session: WebSession = { token, user: publicUser(user) };
    return c.json({ ...session, isNew });
  } catch (error) {
    if (error instanceof DouyinMiniProgramError && error.code === 'invalid-code') {
      return c.json(webSessionError('INVALID_DOUYIN_CODE', 'invalid douyin code'), 401);
    }
    console.error('[auth] douyin miniprogram exchange failed:', error instanceof Error ? error.message : error);
    return c.json(webSessionError('DOUYIN_UNAVAILABLE', 'douyin service unavailable'), 502);
  }
});

// ── 小程序原生会话 → web-view 网站会话 ──
// 长期 JWT 只用于带 Authorization 申请 90 秒单次票据；票据经 URL fragment 交给网页，
// 服务端原子核销后重签常规会话。网页最终仍走现有 applySession/localStorage 契约。
accountAuthRoutes.post('/auth/web-session/ticket', async (c) => {
  c.header('Cache-Control', 'no-store');
  const rateLimited = authRateLimitResponse(c);
  if (rateLimited) return rateLimited;
  const applicant = await ticketApplicant(c);
  if ('response' in applicant) return applicant.response;
  return c.json(await issueWebSessionTicket(applicant.uid));
});

accountAuthRoutes.post('/auth/web-session/exchange', async (c) => {
  c.header('Cache-Control', 'no-store');
  const rateLimited = authRateLimitResponse(c);
  if (rateLimited) return rateLimited;
  const body = await c.req.json<{ ticket?: unknown }>().catch(() => ({ ticket: undefined }));
  const ticket = typeof body.ticket === 'string' ? body.ticket.trim() : '';
  const uid = await consumeWebSessionTicket(ticket);
  if (!uid) {
    return c.json(webSessionError('INVALID_WEB_SESSION_TICKET', 'invalid web session ticket'), 401);
  }

  const user = await getUserById(uid);
  if (!user) {
    return c.json(webSessionError('INVALID_WEB_SESSION_TICKET', 'invalid web session ticket'), 401);
  }
  await captureAccountDevice(user.id, c.req.header('User-Agent'));
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  const session: WebSession = { token, user: publicUser(user) };
  return c.json(session);
});

// ── 网站统一登录页 → Android / iOS 原生会话 ──
// 浏览器只拿 90 秒单次 ticket；原生 App 持有的 PKCE verifier 才能核销，长期 JWT
// 不进入 URL。Android/iOS 共用同一 Hono 契约与移动 React 客户端。
accountAuthRoutes.post('/auth/mobile-session/ticket', async (c) => {
  c.header('Cache-Control', 'no-store');
  const rateLimited = authRateLimitResponse(c);
  if (rateLimited) return rateLimited;
  const applicant = await ticketApplicant(c);
  if ('response' in applicant) return applicant.response;

  const body = await c.req.json<{ codeChallenge?: unknown }>()
    .catch(() => ({ codeChallenge: undefined }));
  if (!isMobileAuthCodeChallenge(body.codeChallenge)) {
    return c.json(webSessionError('INVALID_REQUEST', 'invalid code challenge'), 400);
  }
  return c.json(await issueMobileSessionTicket(applicant.uid, body.codeChallenge));
});

accountAuthRoutes.post('/auth/mobile-session/exchange', async (c) => {
  c.header('Cache-Control', 'no-store');
  const rateLimited = authRateLimitResponse(c);
  if (rateLimited) return rateLimited;
  const body = await c.req.json<{ ticket?: unknown; codeVerifier?: unknown }>()
    .catch(() => ({ ticket: undefined, codeVerifier: undefined }));
  const ticket = typeof body.ticket === 'string' ? body.ticket.trim() : '';
  const codeVerifier = typeof body.codeVerifier === 'string' ? body.codeVerifier.trim() : '';
  const uid = await consumeMobileSessionTicket(ticket, codeVerifier);
  if (!uid) {
    return c.json(webSessionError(
      'INVALID_MOBILE_SESSION_TICKET',
      'invalid mobile session ticket',
    ), 401);
  }

  const user = await getUserById(uid);
  if (!user) {
    return c.json(webSessionError(
      'INVALID_MOBILE_SESSION_TICKET',
      'invalid mobile session ticket',
    ), 401);
  }
  await captureAccountDevice(user.id, c.req.header('User-Agent'));
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  const session: WebSession = { token, user: publicUser(user) };
  return c.json(session);
});

// ── 国内三方绑定(登录态,把该身份加到当前账号)──
accountAuthRoutes.post('/auth/link/social/:provider', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireAppUserId(c);
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
  } catch (e) {
    console.error('[auth] email send failed:', e instanceof Error ? e.message : e);
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
  const { user, isNew } = await loginWithIdentity('email', norm, { name: norm.split('@')[0] });
  await captureAccountDevice(user.id, c.req.header('User-Agent'));
  // amr=email_code:本次会话已证明邮箱所有权 → 15 分钟内可免旧密码重设密码(忘记密码路径)。
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name, amr: 'email_code' });
  return c.json({ token, user: publicUser(user), isNew });
});

accountAuthRoutes.post('/auth/phone/send', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  if (!smsConfigured()) return c.json({ error: 'sms not configured' }, 503);
  const { phone, purpose: rawPurpose } = await c.req.json<{ phone?: string; purpose?: unknown }>().catch(() => ({ phone: undefined, purpose: undefined }));
  const norm = normalizePhone(phone ?? '');
  const purpose = parsePhoneCodePurpose(rawPurpose);
  if (!isValidPhone(norm) || !purpose) return c.json({ error: 'invalid phone' }, 400);
  const issued = await issueCode('phone', norm, purpose);
  if ('error' in issued) return c.json({ error: 'too frequent' }, 429);
  try {
    await sendSmsCode(norm, issued.code);
  } catch (e) {
    // 服务商的拒绝理由(余额不足 / 签名未报备 / 模板停用)只有这一处能看到,吞掉就只剩前端一句
    // 「发送失败」,线上无从定位。只打 message —— 里面是阿里云的 Code+Message,不含验证码。
    console.error('[auth] sms send failed:', e instanceof Error ? e.message : e);
    return c.json({ error: 'send failed' }, 502);
  }
  return c.json({ ok: true });
});

accountAuthRoutes.post('/auth/phone/verify', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const { phone, code, purpose: rawPurpose } = await c.req.json<{ phone?: string; code?: string; purpose?: unknown }>().catch(() => ({ phone: undefined, code: undefined, purpose: undefined }));
  const norm = normalizePhone(phone ?? '');
  const purpose = parsePhoneCodePurpose(rawPurpose);
  if (!isValidPhone(norm) || !purpose || !/^\d{6}$/.test(code ?? '')) return c.json({ error: 'invalid input' }, 400);
  const ok = await verifyCode('phone', norm, purpose, code as string);
  if (!ok) return c.json({ error: 'wrong or expired code' }, 401);
  if (purpose === 'password_reset') {
    const user = await findUserByIdentity('phone', norm);
    if (!user) return c.json({ error: 'phone not linked to an account' }, 404);
    await captureAccountDevice(user.id, c.req.header('User-Agent'));
    const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name, amr: 'phone_password_reset' });
    return c.json({ token, user: publicUser(user) });
  }
  const name = `尾号${norm.slice(-4)}`;
  const { user, isNew } = await loginWithIdentity('phone', norm, { name });
  await captureAccountDevice(user.id, c.req.header('User-Agent'));
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  return c.json({ token, user: publicUser(user), isNew });
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
  await captureAccountDevice(user.id, c.req.header('User-Agent'));
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  return c.json({ token, user: publicUser(user) });
});

// ── 设置 / 修改 / 重置密码(登录态)──
// 业界(GitHub / Figma / Notion)把这件事分成两条路,凭据要求不同:
//   修改(知道旧密码)  → 必须先验旧密码,防「会话被劫持者直接换密码」。
//   重置(忘了 / 没设) → 邮件通道证明邮箱所有权即可,不问旧密码。
// 邮箱验证码或「找回密码」用途的手机验证码会话就是后者的凭据,故 grant 在手时跳过旧密码校验。
accountAuthRoutes.post('/auth/password/set', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireAppUserId(c);
  const { password, currentPassword } = await c.req.json<{ password?: string; currentPassword?: string }>().catch(() => ({ password: undefined, currentPassword: undefined }));
  if (!isValidPassword(password)) return c.json({ error: 'invalid password' }, 400);
  const existing = await getPasswordHash(uid);
  if (existing && !emailGrant(c) && !phonePasswordResetGrant(c) && !(typeof currentPassword === 'string' && await verifyPassword(currentPassword, existing))) {
    return c.json({ error: 'wrong current password' }, 401);
  }
  await setPassword(uid, password);
  return c.json({ ok: true, hasPassword: true });
});

// ── 移除密码(退回纯验证码登录,同 Notion 的 Remove password)。凭据要求同上 ──
accountAuthRoutes.post('/auth/password/remove', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireAppUserId(c);
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
  await requireAppUserId(c); // 必须登录
  if (!emailConfigured()) return c.json({ error: 'email not configured' }, 503);
  const { email } = await c.req.json<{ email?: string }>().catch(() => ({ email: undefined }));
  const norm = normalizeEmail(email ?? '');
  if (!isValidEmail(norm)) return c.json({ error: 'invalid email' }, 400);
  const issued = await issueCode('email', norm, 'link');
  if ('error' in issued) return c.json({ error: 'too frequent' }, 429);
  try {
    await sendEmailCode(norm, issued.code, langOf(c));
  } catch (e) {
    console.error('[auth] email send failed:', e instanceof Error ? e.message : e);
    return c.json({ error: 'send failed' }, 502);
  }
  return c.json({ ok: true });
});

accountAuthRoutes.post('/auth/link/email/verify', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireAppUserId(c);
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
 * 见 replaceCredentialIdentity —— 「先解绑再绑定」对只有邮箱的账号走不通。
 */
accountAuthRoutes.post('/auth/email/replace', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireAppUserId(c);
  const { email, code } = await c.req.json<{ email?: string; code?: string }>().catch(() => ({ email: undefined, code: undefined }));
  const norm = normalizeEmail(email ?? '');
  if (!isValidEmail(norm) || !/^\d{6}$/.test(code ?? '')) return c.json({ error: 'invalid input' }, 400);
  const ok = await verifyCode('email', norm, 'link', code as string);
  if (!ok) return c.json({ error: 'wrong or expired code' }, 401);
  const r = await replaceCredentialIdentity(uid, 'email', norm);
  if (r === 'conflict') return c.json({ error: 'email already linked to another account' }, 409);
  if (r === 'none') return c.json({ error: 'no email to replace' }, 409);
  return c.json({ ok: true, identities: await getIdentities(uid) });
});

/** 换绑手机号。与上面同构,理由同上(0103 起手机也是一个账号一条)。 */
accountAuthRoutes.post('/auth/phone/replace', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireAppUserId(c);
  const { phone, code } = await c.req.json<{ phone?: string; code?: string }>().catch(() => ({ phone: undefined, code: undefined }));
  const norm = normalizePhone(phone ?? '');
  if (!isValidPhone(norm) || !/^\d{6}$/.test(code ?? '')) return c.json({ error: 'invalid input' }, 400);
  const ok = await verifyCode('phone', norm, 'link', code as string);
  if (!ok) return c.json({ error: 'wrong or expired code' }, 401);
  const r = await replaceCredentialIdentity(uid, 'phone', norm);
  if (r === 'conflict') return c.json({ error: 'phone already linked to another account' }, 409);
  if (r === 'none') return c.json({ error: 'no phone to replace' }, 409);
  return c.json({ ok: true, identities: await getIdentities(uid) });
});

accountAuthRoutes.post('/auth/link/phone/send', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  await requireAppUserId(c);
  if (!smsConfigured()) return c.json({ error: 'sms not configured' }, 503);
  const { phone } = await c.req.json<{ phone?: string }>().catch(() => ({ phone: undefined }));
  const norm = normalizePhone(phone ?? '');
  if (!isValidPhone(norm)) return c.json({ error: 'invalid phone' }, 400);
  const issued = await issueCode('phone', norm, 'link');
  if ('error' in issued) return c.json({ error: 'too frequent' }, 429);
  try {
    await sendSmsCode(norm, issued.code);
  } catch (e) {
    // 服务商的拒绝理由(余额不足 / 签名未报备 / 模板停用)只有这一处能看到,吞掉就只剩前端一句
    // 「发送失败」,线上无从定位。只打 message —— 里面是阿里云的 Code+Message,不含验证码。
    console.error('[auth] sms send failed:', e instanceof Error ? e.message : e);
    return c.json({ error: 'send failed' }, 502);
  }
  return c.json({ ok: true });
});

accountAuthRoutes.post('/auth/link/phone/verify', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireAppUserId(c);
  const { phone, code } = await c.req.json<{ phone?: string; code?: string }>().catch(() => ({ phone: undefined, code: undefined }));
  const norm = normalizePhone(phone ?? '');
  if (!isValidPhone(norm) || !/^\d{6}$/.test(code ?? '')) return c.json({ error: 'invalid input' }, 400);
  const ok = await verifyCode('phone', norm, 'link', code as string);
  if (!ok) return c.json({ error: 'wrong or expired code' }, 401);
  const r = await addIdentity(uid, 'phone', norm);
  if (r === 'has-phone') return c.json({ error: 'account already has a phone' }, 409);
  if (r === 'conflict') return c.json({ error: 'phone already linked to another account' }, 409);
  return c.json({ ok: true, identities: await getIdentities(uid) });
});

// ── 绑定 WCA(登录态下,用 WCA access_token 验证并把 wca 身份加到当前账号)──
accountAuthRoutes.post('/auth/link/wca', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireAppUserId(c);
  const { accessToken } = await c.req.json<{ accessToken?: string }>().catch(() => ({ accessToken: undefined }));
  if (!accessToken) return c.json({ error: 'accessToken required' }, 400);
  let me: { wca_id?: string; name?: string; country_iso2?: string; avatar?: { url?: string } };
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
  const verifiedName = me.name?.normalize('NFC').trim();
  if (!verifiedName) return c.json({ error: 'WCA profile has no verified name' }, 502);
  const countryIso2 = typeof me.country_iso2 === 'string'
    ? normalizeCountryIso2(me.country_iso2)
    : null;
  const verifiedCountryIso2 = countryIso2 && isValidCountryIso2(countryIso2) ? countryIso2 : null;
  const r = await addIdentity(
    uid,
    'wca',
    me.wca_id,
    me.wca_id,
    verifiedName,
    me.avatar?.url ?? null,
    verifiedCountryIso2,
  );
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
  const { user, isNew } = await loginWithIdentity('google', g.sub, {
    name: g.name || g.email?.split('@')[0] || '',
    avatar: g.picture ?? null,
  });
  await captureAccountDevice(user.id, c.req.header('User-Agent'));
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  return c.json({ token, user: publicUser(user), isNew });
});

accountAuthRoutes.post('/auth/link/google', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireAppUserId(c);
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
  const uid = await requireAppUserId(c);
  const { provider, providerUid } = await c.req.json<{ provider?: string; providerUid?: string }>().catch(() => ({ provider: undefined, providerUid: undefined }));
  const allowed: Provider[] = ['email', 'phone', 'wca', 'apple', 'google', 'wechat', 'douyin', 'alipay', 'qq'];
  if (!allowed.includes(provider as Provider)) return c.json({ error: 'invalid provider' }, 400);
  const r = await removeIdentity(uid, provider as Provider, providerUid);
  if (r === 'last') return c.json({ error: 'cannot unlink your only login method' }, 409);
  if (r === 'not_found') return c.json({ error: 'identity not found' }, 404);
  const user = await getUserById(uid);
  const token = user ? signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name }) : undefined;
  return c.json({ ok: true, token, user: user ? publicUser(user) : undefined, identities: await getIdentities(uid) });
});

// ── 站内资料(展示名 + 头像 + 本人私密基本资料)──
accountAuthRoutes.get('/auth/profile', async (c) => {
  c.header('Cache-Control', 'no-store');
  const uid = await requireAppUserId(c);
  const profile = await getAccountBasicProfile(uid);
  if (!profile) return c.json({ error: 'account not found' }, 404);
  return c.json({ profile });
});

accountAuthRoutes.post('/auth/profile', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireAppUserId(c);
  const body: { name?: unknown; avatar?: unknown; basic?: unknown } = await c.req
    .json<{ name?: unknown; avatar?: unknown; basic?: unknown }>()
    .catch(() => ({}));
  const hasName = body.name !== undefined;
  const hasAvatar = body.avatar !== undefined;
  const hasBasic = body.basic !== undefined;
  if ([hasName, hasAvatar, hasBasic].filter(Boolean).length !== 1) {
    return c.json({ error: 'provide exactly one profile field' }, 400);
  }

  if (hasBasic) {
    const basic = body.basic !== null && typeof body.basic === 'object'
      ? body.basic as Record<string, unknown>
      : null;
    const allowedKeys = new Set(['birthDate', 'gender', 'countryIso2', 'regionCode', 'cityName']);
    if (!basic
      || Object.keys(basic).some((key) => !allowedKeys.has(key))
      || !Object.hasOwn(basic, 'birthDate')
      || !Object.hasOwn(basic, 'gender')
      || !Object.hasOwn(basic, 'countryIso2')
      || !Object.hasOwn(basic, 'regionCode')
      || !Object.hasOwn(basic, 'cityName')) {
      return c.json({ error: 'invalid basic profile' }, 400);
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const birthDate = basic.birthDate === null ? null : basic.birthDate;
    if (birthDate !== null && !isValidBirthDate(birthDate, todayIso)) {
      return c.json({ error: 'invalid birth date' }, 400);
    }
    const gender = basic.gender === null ? null : basic.gender;
    if (gender !== null && !isAccountGender(gender)) {
      return c.json({ error: 'invalid gender' }, 400);
    }
    const normalizedCountry = basic.countryIso2 === null
      ? null
      : typeof basic.countryIso2 === 'string'
        ? normalizeCountryIso2(basic.countryIso2)
        : basic.countryIso2;
    if (normalizedCountry !== null && !isValidCountryIso2(normalizedCountry)) {
      return c.json({ error: 'invalid country' }, 400);
    }
    const regionCode = basic.regionCode === null
      ? null
      : typeof basic.regionCode === 'string'
        ? normalizeAccountRegionCode(basic.regionCode)
        : basic.regionCode;
    if (regionCode !== null && !isValidAccountRegionCode(regionCode)) {
      return c.json({ error: 'invalid region' }, 400);
    }
    const cityName = basic.cityName === null
      ? null
      : typeof basic.cityName === 'string'
        ? normalizeAccountCityName(basic.cityName)
        : basic.cityName;
    if (cityName !== null && !isValidAccountCityName(cityName)) {
      return c.json({ error: 'invalid city' }, 400);
    }
    if (!isValidAccountLocation(normalizedCountry, regionCode, cityName)) {
      return c.json({ error: 'invalid location hierarchy' }, 400);
    }

    const profile = await updateAccountBasicProfile(uid, {
      birthDate,
      gender,
      countryIso2: normalizedCountry,
      regionCode,
      cityName,
    } as Pick<AccountBasicProfile, 'birthDate' | 'gender' | 'countryIso2' | 'regionCode' | 'cityName'>);
    if (!profile) return c.json({ error: 'account not found' }, 404);
    return c.json({ ok: true, profile });
  }

  let user = null;
  if (hasName) {
    if (typeof body.name !== 'string') return c.json({ error: 'invalid display name' }, 400);
    const name = normalizeDisplayName(body.name);
    if (!isValidDisplayName(name)) return c.json({ error: 'invalid display name' }, 400);
    user = await updateDisplayName(uid, name);
    if (!user) {
      const current = await getUserById(uid);
      if (!current) return c.json({ error: 'account not found' }, 404);
      return c.json({ error: 'WCA-linked accounts use their verified WCA name' }, 409);
    }
  } else {
    const avatar = body.avatar !== null && typeof body.avatar === 'object'
      ? body.avatar as Record<string, unknown>
      : null;
    if (!avatar || typeof avatar.kind !== 'string') return c.json({ error: 'invalid avatar choice' }, 400);

    if (avatar.kind === 'clawd') {
      if (!isClawdAvatarPreset(avatar.preset)) return c.json({ error: 'invalid Clawd avatar preset' }, 400);
      user = await updateClawdAvatar(uid, avatar.preset);
    } else if (avatar.kind === 'upload') {
      if (typeof avatar.imageId !== 'number'
        || !Number.isSafeInteger(avatar.imageId)
        || avatar.imageId <= 0) {
        return c.json({ error: 'invalid avatar image' }, 400);
      }
      const current = await getUserById(uid);
      if (!current) return c.json({ error: 'account not found' }, 404);
      const ownershipKey = ownerKey(current.id, current.wca_id);
      const avatarUrl = `${apiOrigin(c)}/v1/article/img/${avatar.imageId}`;
      user = await updateUploadedAvatar(uid, ownershipKey, avatar.imageId, avatarUrl);
      if (!user) return c.json({ error: 'avatar image is not owned by this account' }, 403);
    } else if (avatar.kind === 'wca') {
      user = await resetAvatarToWca(uid);
      if (!user) return c.json({ error: 'WCA account is not linked' }, 409);
    } else {
      return c.json({ error: 'invalid avatar choice' }, 400);
    }
  }

  if (!user) return c.json({ error: 'account not found' }, 404);
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
  return c.json({ ok: true, token, user: publicUser(user) });
});

// ── 管理员编辑账号资料 ──
const ADMIN_USER_PROVIDERS = new Set([
  'all', 'password', 'none',
  'email', 'phone', 'wca', 'apple', 'google', 'wechat', 'douyin', 'alipay', 'qq',
]);
const ADMIN_USER_SORTS = new Set(['created', 'name', 'id']);

interface AdminUserListRow {
  id: number | string;
  display_name: string;
  avatar_url: string | null;
  wca_id: string | null;
  birth_date: string | null;
  gender: string | null;
  country_iso2: string | null;
  region_code: string | null;
  city_name: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  password_updated_at: string | Date | null;
  has_password: boolean;
  email_notify: boolean;
  lang: string | null;
  device_type: string | null;
  device_os_family: string | null;
  device_os_major: number | string | null;
  device_browser_family: string | null;
  device_browser_major: number | string | null;
  device_container: string | null;
  device_last_seen_at: string | Date | null;
  identities: Array<{
    provider: string;
    providerUid: string;
    verifiedAt: string | Date | null;
    createdAt: string | Date;
  }> | null;
}

/** 管理员账号总览:统计、近 30 天注册量和分页用户明细。敏感身份仅在管理员 no-store 响应中返回。 */
accountAuthRoutes.get('/auth/admin/users', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdmin(c);

  const rawPage = Number(c.req.query('page') ?? '1');
  const rawPageSize = Number(c.req.query('pageSize') ?? '25');
  if (!Number.isSafeInteger(rawPage) || rawPage < 1) return c.json({ error: 'invalid page' }, 400);
  if (!Number.isSafeInteger(rawPageSize) || rawPageSize < 1 || rawPageSize > 100) {
    return c.json({ error: 'invalid page size' }, 400);
  }
  const q = (c.req.query('q') ?? '').trim();
  if (q.length > 100) return c.json({ error: 'search query is too long' }, 400);
  const provider = (c.req.query('provider') ?? 'all').toLowerCase();
  if (!ADMIN_USER_PROVIDERS.has(provider)) return c.json({ error: 'invalid provider' }, 400);
  const sort = (c.req.query('sort') ?? 'created').toLowerCase();
  if (!ADMIN_USER_SORTS.has(sort)) return c.json({ error: 'invalid sort' }, 400);
  const direction = (c.req.query('direction') ?? 'desc').toLowerCase();
  if (direction !== 'asc' && direction !== 'desc') return c.json({ error: 'invalid sort direction' }, 400);

  const filters: string[] = [];
  const params: unknown[] = [];
  if (q) {
    const escaped = q.replace(/[\\%_]/g, '\\$&');
    filters.push(`(
      u.display_name ILIKE ? ESCAPE '\\'
      OR COALESCE(u.wca_id, '') ILIKE ? ESCAPE '\\'
      OR CAST(u.id AS TEXT) = ?
      OR EXISTS (
        SELECT 1 FROM auth_identities search_identity
        WHERE search_identity.user_id = u.id
          AND search_identity.provider_uid ILIKE ? ESCAPE '\\'
      )
    )`);
    params.push(`%${escaped}%`, `%${escaped}%`, q, `%${escaped}%`);
  }
  if (provider === 'password') {
    filters.push('u.password_hash IS NOT NULL');
  } else if (provider === 'none') {
    filters.push('u.password_hash IS NULL AND NOT EXISTS (SELECT 1 FROM auth_identities empty_identity WHERE empty_identity.user_id = u.id)');
  } else if (provider === 'wca') {
    filters.push('u.wca_id IS NOT NULL');
  } else if (provider !== 'all') {
    filters.push('EXISTS (SELECT 1 FROM auth_identities provider_identity WHERE provider_identity.user_id = u.id AND provider_identity.provider = ?)');
    params.push(provider);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const orderColumn = sort === 'name' ? 'LOWER(u.display_name)' : sort === 'id' ? 'u.id' : 'u.created_at';
  const orderDirection = direction === 'asc' ? 'ASC' : 'DESC';
  const offset = (rawPage - 1) * rawPageSize;

  const [summaryRows, dailyRows, providerRows, countRows, users] = await Promise.all([
    query<{
      total_users: number | string;
      registered_today: number | string;
      registered_last_7_days: number | string;
      wca_users: number | string;
      password_users: number | string;
      completed_profiles: number | string;
      users_without_identity: number | string;
    }>(`SELECT
      COUNT(*) AS total_users,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS registered_today,
      COUNT(*) FILTER (WHERE created_at >= (date_trunc('day', NOW() AT TIME ZONE 'UTC') - INTERVAL '6 days') AT TIME ZONE 'UTC') AS registered_last_7_days,
      COUNT(*) FILTER (WHERE wca_id IS NOT NULL) AS wca_users,
      COUNT(*) FILTER (WHERE password_hash IS NOT NULL) AS password_users,
      COUNT(*) FILTER (WHERE birth_date IS NOT NULL AND gender IS NOT NULL AND country_iso2 IS NOT NULL) AS completed_profiles,
      COUNT(*) FILTER (WHERE password_hash IS NULL AND NOT EXISTS (
        SELECT 1 FROM auth_identities no_identity WHERE no_identity.user_id = app_users.id
      )) AS users_without_identity
      FROM app_users`),
    query<{ day: string; count: number | string }>(`WITH days AS (
      SELECT generate_series(
        (NOW() AT TIME ZONE 'UTC')::date - 29,
        (NOW() AT TIME ZONE 'UTC')::date,
        INTERVAL '1 day'
      )::date AS day
    )
    SELECT days.day, COUNT(app_users.id) AS count
    FROM days
    LEFT JOIN app_users
      ON app_users.created_at >= days.day AT TIME ZONE 'UTC'
      AND app_users.created_at < (days.day + 1) AT TIME ZONE 'UTC'
    GROUP BY days.day
    ORDER BY days.day`),
    query<{ provider: string; count: number | string }>(
      'SELECT provider, COUNT(DISTINCT user_id) AS count FROM auth_identities GROUP BY provider ORDER BY provider',
    ),
    query<{ count: number | string }>(`SELECT COUNT(*) AS count FROM app_users u ${where}`, params),
    query<AdminUserListRow>(`SELECT
      u.id, u.display_name, u.avatar_url, u.wca_id, u.birth_date, u.gender,
      u.country_iso2, u.region_code, u.city_name, u.created_at, u.updated_at,
      u.password_updated_at, (u.password_hash IS NOT NULL) AS has_password, u.email_notify, u.lang,
      device.device_type, device.os_family AS device_os_family, device.os_major AS device_os_major,
      device.browser_family AS device_browser_family, device.browser_major AS device_browser_major,
      device.container AS device_container, device.last_seen_at AS device_last_seen_at,
      COALESCE(
        json_agg(json_build_object(
          'provider', identity.provider,
          'providerUid', identity.provider_uid,
          'verifiedAt', identity.verified_at,
          'createdAt', identity.created_at
        ) ORDER BY identity.created_at) FILTER (WHERE identity.id IS NOT NULL),
        '[]'::json
      ) AS identities
    FROM app_users u
    LEFT JOIN auth_identities identity ON identity.user_id = u.id
    LEFT JOIN account_last_devices device ON device.user_id = u.id
    ${where}
    GROUP BY u.id, device.user_id
    ORDER BY ${orderColumn} ${orderDirection}, u.id ${orderDirection}
    LIMIT ? OFFSET ?`, [...params, rawPageSize, offset]),
  ]);

  const summary = summaryRows[0];
  const providerCounts = new Map(
    providerRows.map((row) => [row.provider, Number(row.count)]),
  );
  providerCounts.set('wca', Number(summary?.wca_users ?? 0));
  return c.json({
    summary: {
      totalUsers: Number(summary?.total_users ?? 0),
      registeredToday: Number(summary?.registered_today ?? 0),
      registeredLast7Days: Number(summary?.registered_last_7_days ?? 0),
      wcaUsers: Number(summary?.wca_users ?? 0),
      passwordUsers: Number(summary?.password_users ?? 0),
      completedProfiles: Number(summary?.completed_profiles ?? 0),
      usersWithoutIdentity: Number(summary?.users_without_identity ?? 0),
    },
    daily: dailyRows.map((row) => ({ date: row.day, count: Number(row.count) })),
    providerCounts: Array.from(providerCounts, ([providerName, count]) => ({
      provider: providerName,
      count,
    })).sort((a, b) => a.provider.localeCompare(b.provider)),
    users: users.map((row) => ({
      id: Number(row.id),
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      wcaId: row.wca_id,
      birthDate: row.birth_date,
      gender: row.gender,
      countryIso2: row.country_iso2,
      regionCode: row.region_code,
      cityName: row.city_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      passwordUpdatedAt: row.password_updated_at,
      hasPassword: row.has_password,
      emailNotify: row.email_notify,
      lang: row.lang,
      lastDevice: row.device_type && row.device_os_family && row.device_browser_family && row.device_container && row.device_last_seen_at ? {
        deviceType: row.device_type,
        osFamily: row.device_os_family,
        osMajor: row.device_os_major === null ? null : Number(row.device_os_major),
        browserFamily: row.device_browser_family,
        browserMajor: row.device_browser_major === null ? null : Number(row.device_browser_major),
        container: row.device_container,
        lastSeenAt: row.device_last_seen_at,
      } : null,
      identities: row.identities ?? [],
    })),
    pagination: {
      page: rawPage,
      pageSize: rawPageSize,
      total: Number(countRows[0]?.count ?? 0),
    },
  });
});

accountAuthRoutes.get('/auth/admin/users/:userId', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdmin(c);
  const userId = Number(c.req.param('userId'));
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return c.json({ error: 'invalid user id' }, 400);
  }
  const user = await getUserById(userId);
  if (!user) return c.json({ error: 'account not found' }, 404);
  return c.json({ user: publicUser(user) });
});

accountAuthRoutes.post('/auth/admin/users/:userId/profile', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  await requireAdmin(c);
  const userId = Number(c.req.param('userId'));
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return c.json({ error: 'invalid user id' }, 400);
  }
  const body = await c.req.json<{ name?: unknown }>().catch((): { name?: unknown } => ({}));
  if (typeof body.name !== 'string') return c.json({ error: 'invalid display name' }, 400);
  const name = normalizeDisplayName(body.name);
  if (!isValidDisplayName(name)) return c.json({ error: 'invalid display name' }, 400);

  const user = await updateDisplayName(userId, name);
  if (!user) {
    const current = await getUserById(userId);
    if (!current) return c.json({ error: 'account not found' }, 404);
    return c.json({ error: 'WCA-linked accounts use their verified WCA name' }, 409);
  }
  return c.json({ ok: true, user: publicUser(user) });
});

/**
 * ── 注销账号(立即生效,不可恢复)──
 *
 * 两道闸,缺一不可:
 *   ① 照抄主标识 —— 防手滑。会话已经证明「是本人」,这一步证明的是「不是点错了」,
 *      故比对的串要用户自己认得出(邮箱 / 手机 / WCA ID,见 shared 的 primaryHandle)。
 *   ② 设了密码的账号必须再输一次密码 —— localStorage 里的 token 有可能是被人拿走的,
 *      注销不可撤销,不能只凭一个会话就执行。**这里不认 amr=email_code 的 grant**:
 *      那个 grant 是为「忘了密码还能重设」开的口子,给不可逆操作放行等于把它变成后门。
 *      真忘了密码的人:先移除密码(那才是 grant 该管的事),再回来注销。
 */
accountAuthRoutes.post('/auth/account/delete', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const uid = await requireAppUserId(c);
  const { confirm, password } = await c.req.json<{ confirm?: string; password?: string }>().catch(() => ({ confirm: undefined, password: undefined }));
  const user = await getUserById(uid);
  if (!user) return c.json({ error: 'account not found' }, 404);

  const handle = primaryHandle(await getIdentities(uid), uid);
  // 邮箱按小写存、WCA ID 全大写,用户照抄时大小写常对不上 —— 比对前统一折叠,别为这个卡人。
  if (!handle || (confirm ?? '').trim().toLowerCase() !== handle.toLowerCase()) {
    return c.json({ error: 'confirmation does not match' }, 400);
  }

  const pwHash = await getPasswordHash(uid);
  if (pwHash && !(typeof password === 'string' && await verifyPassword(password, pwHash))) {
    return c.json({ error: 'wrong current password' }, 401);
  }

  // 业务表按归属键存(不是 uid),两个键都要传进去。
  try {
    await deleteAccount(uid, ownerKey(uid, user.wca_id));
  } catch (error) {
    if (error instanceof AccountOwnsOrganizationError) {
      return c.json({ error: error.message }, 409);
    }
    throw error;
  }
  return c.json({ ok: true });
});

// ── 我的身份列表(附是否已设密码,供账号面板显示「设置 / 修改密码」)──
// canResetPassword:本次会话刚验过邮箱 → 改密码时前端不必再要当前密码(后端同样放行)。
accountAuthRoutes.get('/auth/identities', async (c) => {
  c.header('Cache-Control', 'no-store');
  const uid = await requireAppUserId(c);
  const [identities, pwHash] = await Promise.all([getIdentities(uid), getPasswordHash(uid)]);
  return c.json({ identities, hasPassword: pwHash != null, canResetPassword: emailGrant(c) });
});
