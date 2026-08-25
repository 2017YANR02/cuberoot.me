// 内部账号相关的纯逻辑(无 DB / 无 crypto 依赖),前后端共用 + 可单测。
// 后端 apps/api/src/utils/account.ts 从这里再导出,前端可直接 import 校验输入。

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

/**
 * 注销账号后留在公开内容上的墓碑键 —— 账号没了,帖子 / 复盘 / 评论还在,作者位换成它。
 * 与 ownerKey 同域不撞:WCA id 全大写(见 isWcaIdFormat),合成键 `u` 打头,墓碑键 `deleted:` 打头。
 *
 * 带 uid 而不是共用一个 'deleted':同一个人的历史发言仍串成一条线(论坛看得出连着几楼是同一位
 * 已注销用户),但这个 uid 已从 app_users 删除、也不会被复用,回溯不到任何身份。
 * 长度必须 ≤ 20 —— comments.author_id / notifications.user_key 是 VARCHAR(20)。
 */
export const DELETED_OWNER_PREFIX = 'deleted:';
export function deletedOwnerKey(uid: number): string {
  return `${DELETED_OWNER_PREFIX}${uid}`;
}
export function isDeletedOwner(key: string | null | undefined): boolean {
  return !!key && key.startsWith(DELETED_OWNER_PREFIX);
}

/**
 * 注销确认要用户照抄的账号主标识:邮箱 > 手机 > WCA ID > 合成键。
 * 前后端共用同一优先级 —— 否则前端提示抄 A、后端拿 B 比对,谁都注销不掉。
 * 取「用户认得出是自己的那个串」:三方(微信/Google)的 uid 是不透明数字串,人抄不出来,故排除。
 */
export function primaryHandle(
  identities: readonly { provider: string; providerUid: string }[],
  uid: number | undefined | null,
): string {
  for (const p of ['email', 'phone', 'wca'] as const) {
    const hit = identities.find((i) => i.provider === p);
    if (hit) return hit.providerUid;
  }
  return uid != null ? `u${uid}` : '';
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

// 站内用户名只是展示名,不是唯一 handle,也不参与登录。按 Unicode code point 计数,
// 避免 emoji 等代理对被当成两个字符;拒绝控制符和双向文本控制符,防止换行 / 欺骗显示。
export const DISPLAY_NAME_MAX_LENGTH = 50;
const DISPLAY_NAME_FORBIDDEN_RE = /[\u0000-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E\u2066-\u2069\uD800-\uDFFF]/u;

export function normalizeDisplayName(raw: string): string {
  return raw.normalize('NFC').trim();
}

export function displayNameLength(name: string): number {
  return Array.from(name).length;
}

export function isValidDisplayName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const length = displayNameLength(name);
  return length >= 1 && length <= DISPLAY_NAME_MAX_LENGTH && !DISPLAY_NAME_FORBIDDEN_RE.test(name);
}

// 密码:仅长度约束(8..128)。不强制字符组成(NIST 800-63B:长度优先,组成规则反而降安全),
// 前后端共用同一判据。真正的抗爆破靠服务端 scrypt 慢哈希 + 每 IP 限流。
export function isValidPassword(pw: unknown): pw is string {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 128;
}
