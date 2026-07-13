/**
 * 会话令牌(自签 JWT)单一来源。
 *
 * 历史上 JWT_SECRET 在 auth.ts / recon_helpers.ts 各定义一份,两处必须逐字一致
 * (auth.ts 签、recon_helpers.ts 验)。这里收敛成唯一导出,两边 import 同一常量,
 * 消除「改一处漏另一处 → 全站掉线」的风险。
 *
 * 向后兼容铁律(勿动,否则现存 365 天 token 全部失效):
 *   1. JWT_SECRET 默认值不变;
 *   2. 算法保持默认 HS256(sign/verify 都不显式传 algorithm);
 *   3. verify 不加 audience/issuer/maxAge 等限制项(老 token 没带,会被拒);
 *   4. uid 是纯加法字段,老 token 无 uid → 读取方必须容忍 undefined。
 */
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/** JWT 有效期:365 天(配合前端滑动续签,一年内活跃即不掉线)。 */
export const SESSION_TTL = '365d';

/**
 * 令牌载荷。uid = 内部账号 id;wcaId = 真实 WCA id(未绑定则不带);name = 展示名。
 * amr = 本次会话的认证方式(RFC 8176);仅 'email_code' 有特殊语义,见 EMAIL_GRANT_TTL_S。
 */
export interface SessionPayload {
  uid?: number;
  wcaId?: string;
  name?: string;
  amr?: string;
  iat?: number;
  exp?: number;
}

/**
 * 「刚验过邮箱」的授权窗口:邮箱验证码登录后 15 分钟内,可免旧密码重设密码。
 *
 * 这就是业界的「忘记密码」路径:GitHub / Figma 的重置邮件链接同样不问旧密码(GitHub 链接 3h 有效),
 * 只认「你能收到这个邮箱的信」。我们的验证码已经证明了同一件事,故复用它、不再另发一封重置邮件。
 * 安全下限没被拉低 —— 能收邮件的人本来就能重置密码。
 */
export const EMAIL_GRANT_TTL_S = 15 * 60;

/**
 * 签发会话 JWT。wcaId 为空(纯邮箱/手机账号)时不写入该字段,前端据此判断
 * 「是否为 WCA 选手」。
 */
export function signSession(p: { uid: number; wcaId?: string | null; name?: string; amr?: string }): string {
  const payload: SessionPayload = { uid: p.uid, name: p.name ?? '' };
  if (p.wcaId) payload.wcaId = p.wcaId; // 仅在绑定了 WCA 时带上真实 id
  if (p.amr) payload.amr = p.amr;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TTL });
}

/** 该会话是否处于「刚用邮箱验证码登录」的窗口内(据此免旧密码设/改/移除密码)。 */
export function hasFreshEmailGrant(token: string): boolean {
  try {
    const p = verifySession(token);
    if (p.amr !== 'email_code' || typeof p.iat !== 'number') return false;
    return Date.now() / 1000 - p.iat < EMAIL_GRANT_TTL_S;
  } catch {
    return false;
  }
}

/** 验证并解出载荷;非法/过期抛异常(与 jwt.verify 一致)。 */
export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, JWT_SECRET) as SessionPayload;
}
