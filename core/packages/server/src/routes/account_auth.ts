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
import { query } from '../db/connection.js';
import { requireAuth, checkRateLimit } from '../utils/recon_helpers.js';
import { signSession } from '../utils/session.js';
import {
  issueCode, verifyCode, loginWithIdentity, addIdentity, removeIdentity,
  getIdentities, getUserById, findUserByWcaId, publicUser,
  normalizeEmail, isValidEmail, normalizePhone, isValidPhone,
  type Provider,
} from '../utils/account.js';
import { emailConfigured, sendEmailCode } from '../utils/email.js';
import { smsConfigured, sendSmsCode } from '../utils/sms.js';
import { googleConfigured, googleClientId, fetchGoogleUser } from '../utils/google.js';

export const accountAuthRoutes = new Hono();

function getIp(c: Context): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

// 语言(仅用于验证码邮件文案),从 Accept-Language 粗判。
function langOf(c: Context): 'zh' | 'en' {
  return (c.req.header('Accept-Language') ?? '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
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
  return c.json({ email: emailConfigured(), phone: smsConfigured(), wca: true, googleClientId: googleClientId() });
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
  const token = signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name });
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
  if (r === 'conflict') return c.json({ error: 'email already linked to another account' }, 409);
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

// ── Google(客户端隐式授权拿到的 access_token,服务端转发 Google userinfo 验真)──
accountAuthRoutes.post('/auth/google', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  if (!googleConfigured()) return c.json({ error: 'google not configured' }, 503);
  const { accessToken } = await c.req.json<{ accessToken?: string }>().catch(() => ({ accessToken: undefined }));
  if (!accessToken) return c.json({ error: 'accessToken required' }, 400);
  let g: { sub: string; email?: string; name?: string; picture?: string };
  try {
    g = await fetchGoogleUser(accessToken);
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
  const { accessToken } = await c.req.json<{ accessToken?: string }>().catch(() => ({ accessToken: undefined }));
  if (!accessToken) return c.json({ error: 'accessToken required' }, 400);
  let g: { sub: string };
  try {
    g = await fetchGoogleUser(accessToken);
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
  const allowed: Provider[] = ['email', 'phone', 'wca', 'apple', 'google', 'wechat', 'alipay'];
  if (!allowed.includes(provider as Provider)) return c.json({ error: 'invalid provider' }, 400);
  const r = await removeIdentity(uid, provider as Provider, providerUid);
  if (r === 'last') return c.json({ error: 'cannot unlink your only login method' }, 409);
  if (r === 'not_found') return c.json({ error: 'identity not found' }, 404);
  const user = await getUserById(uid);
  const token = user ? signSession({ uid: user.id, wcaId: user.wca_id, name: user.display_name }) : undefined;
  return c.json({ ok: true, token, user: user ? publicUser(user) : undefined, identities: await getIdentities(uid) });
});

// ── 我的身份列表 ──
accountAuthRoutes.get('/auth/identities', async (c) => {
  c.header('Cache-Control', 'no-store');
  const uid = await requireUserId(c);
  return c.json({ identities: await getIdentities(uid) });
});
