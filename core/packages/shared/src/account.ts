// 内部账号相关的纯逻辑(无 DB / 无 crypto 依赖),前后端共用 + 可单测。
// 后端 packages/server/src/utils/account.ts 从这里再导出,前端可直接 import 校验输入。

/**
 * 归属键:业务表主键 / 所有权判定用它。绑了 WCA = 真实 wca_id(现有数据零迁移);
 * 没绑 = 合成 `u<uid>`。合成键小写 `u` 打头,WCA id 全大写,两者天然不撞(见 isWcaIdFormat)。
 */
export function ownerKey(uid: number | undefined | null, wcaId: string | null | undefined): string {
  if (wcaId) return wcaId;
  if (uid != null) return `u${uid}`;
  return '';
}

// WCA id 形如 2017YANR02:4 位年份 + 4 位大写字母 + 2 位序号。
const WCA_ID_RE = /^\d{4}[A-Z]{4}\d{2}$/;
export function isWcaIdFormat(s: string): boolean {
  return WCA_ID_RE.test(s);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
export function isValidEmail(e: string): boolean {
  return e.length <= 320 && EMAIL_RE.test(e);
}

// 目前只支持中国大陆手机号(阿里云个人免资质通道只发 +86)。规范化成 E.164 +86XXXXXXXXXXX。
const PHONE_RE = /^\+861\d{10}$/;
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (/^1\d{10}$/.test(digits)) return `+86${digits}`;
  if (/^861\d{10}$/.test(digits)) return `+${digits}`;
  return raw.trim();
}
export function isValidPhone(p: string): boolean {
  return PHONE_RE.test(p);
}

// 密码:仅长度约束(8..128)。不强制字符组成(NIST 800-63B:长度优先,组成规则反而降安全),
// 前后端共用同一判据。真正的抗爆破靠服务端 scrypt 慢哈希 + 每 IP 限流。
export function isValidPassword(pw: unknown): pw is string {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 128;
}
