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

/** 令牌载荷。uid = 内部账号 id;wcaId = 真实 WCA id(未绑定则不带);name = 展示名。 */
export interface SessionPayload {
  uid?: number;
  wcaId?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

/**
 * 签发会话 JWT。wcaId 为空(纯邮箱/手机账号)时不写入该字段,前端据此判断
 * 「是否为 WCA 选手」。
 */
export function signSession(p: { uid: number; wcaId?: string | null; name?: string }): string {
  const payload: SessionPayload = { uid: p.uid, name: p.name ?? '' };
  if (p.wcaId) payload.wcaId = p.wcaId; // 仅在绑定了 WCA 时带上真实 id
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TTL });
}

/** 验证并解出载荷;非法/过期抛异常(与 jwt.verify 一致)。 */
export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, JWT_SECRET) as SessionPayload;
}
