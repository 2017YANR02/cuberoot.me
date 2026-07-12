/**
 * 内部账号核心逻辑:身份查找/创建、多身份绑定、验证码生命周期、归属键派生。
 * 全部纯函数 + 单表操作,便于单测(tests/account_*.test.ts 覆盖码校验与 ownerKey)。
 *
 * 归属键(ownerKey)是本设计的关键:requireAuth 对外暴露的 `wcaId` = ownerKey ——
 * 绑了 WCA 就是真 wca_id(现有 801 处业务键零改动、老数据零迁移),没绑就是合成 `u<uid>`。
 * 合成键以小写 `u` 打头,WCA id 全大写(^\d{4}[A-Z]{4}\d{2}$),两者天然不可能相撞。
 */
import crypto from 'node:crypto';
import { query, sql } from '../db/connection.js';
import { JWT_SECRET } from './session.js';

// 纯逻辑(归属键 + 输入校验)在 shared,前后端共用 + 客户端可单测;这里再导出保持调用方不变。
export {
  ownerKey, isWcaIdFormat, normalizeEmail, isValidEmail, normalizePhone, isValidPhone, isValidPassword,
} from '@cuberoot/shared/account';

export type Provider = 'email' | 'phone' | 'wca' | 'apple' | 'google' | 'wechat' | 'alipay' | 'qq';
export type Channel = 'email' | 'phone';
export type CodePurpose = 'login' | 'link';

export interface AppUser {
  id: number;
  display_name: string;
  avatar_url: string | null;
  wca_id: string | null;
}

const CODE_TTL_MS = 10 * 60 * 1000;      // 验证码有效期 10 分钟
const CODE_MAX_ATTEMPTS = 5;             // 单码最多校验 5 次,超限作废(防爆破)
const SEND_COOLDOWN_MS = 60 * 1000;      // 同一 target 两次发码最小间隔 60s
// 哈希 pepper:优先专用 env,回退 JWT_SECRET,保证永不为空(空 pepper = 无盐等于明文可预测)。
const CODE_PEPPER = process.env.AUTH_CODE_PEPPER || JWT_SECRET;

// ── 验证码 ──
export function genCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}
function hashCode(channel: Channel, target: string, code: string): string {
  return crypto.createHash('sha256').update(`${CODE_PEPPER}:${channel}:${target}:${code}`).digest('hex');
}
function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * 发一张新验证码。返回明文 code(交给 email/sms 发送),或 cooldown(距上次发码不足 60s)。
 * 发新码前把该 target+purpose 的旧未核销码全部作废,保证同时只有一张有效码。
 */
export async function issueCode(
  channel: Channel,
  target: string,
  purpose: CodePurpose,
): Promise<{ code: string } | { error: 'cooldown' }> {
  const recent = await query<{ created_at: string | Date }>(
    'SELECT created_at FROM auth_codes WHERE channel = ? AND target = ? ORDER BY created_at DESC LIMIT 1',
    [channel, target],
  );
  if (recent.length) {
    const age = Date.now() - new Date(recent[0].created_at).getTime();
    if (age < SEND_COOLDOWN_MS) return { error: 'cooldown' };
  }
  await query(
    'UPDATE auth_codes SET consumed_at = NOW() WHERE channel = ? AND target = ? AND purpose = ? AND consumed_at IS NULL',
    [channel, target, purpose],
  );
  const code = genCode();
  const codeHash = hashCode(channel, target, code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  await query(
    'INSERT INTO auth_codes (channel, target, purpose, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
    [channel, target, purpose, codeHash, expiresAt],
  );
  return { code };
}

/**
 * 校验验证码。成功即核销(一次性)。失败累加 attempts,达上限即烧掉该码。
 * 取最新一张「未核销 + 未过期」的码;常量时间比较哈希,防时序侧信道。
 */
export async function verifyCode(
  channel: Channel,
  target: string,
  purpose: CodePurpose,
  code: string,
): Promise<boolean> {
  // 事务 + FOR UPDATE 锁住那张码:把「读 attempts → 判 5 次上限 → 累加」串成一步。
  // 否则并发 verify 会各自读到同一份 attempts=0 全过闸,单码可被猜远超 5 次(TOCTOU 爆破)。
  return sql.begin(async (tx) => {
    const rows = await tx`
      SELECT id, code_hash, attempts FROM auth_codes
      WHERE channel = ${channel} AND target = ${target} AND purpose = ${purpose}
        AND consumed_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
      FOR UPDATE`;
    if (!rows.length) return false;
    const row = rows[0] as unknown as { id: number; code_hash: string; attempts: number };
    if (row.attempts >= CODE_MAX_ATTEMPTS) {
      await tx`UPDATE auth_codes SET consumed_at = NOW() WHERE id = ${row.id}`;
      return false;
    }
    const expected = hashCode(channel, target, code);
    if (timingSafeEqualHex(expected, row.code_hash)) {
      await tx`UPDATE auth_codes SET consumed_at = NOW() WHERE id = ${row.id}`;
      return true;
    }
    await tx`UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;
    return false;
  }) as Promise<boolean>;
}

// ── 密码(scrypt:自带随机盐 + 自描述参数串,明文永不落库)──
// 串格式 scrypt$N$r$p$saltB64$hashB64 —— 参数随哈希一起存,将来调参不破坏旧密码。
const SCRYPT_N = 16384;      // 2^14,~16MB 内存开销(128*N*r),抗 GPU 爆破
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;  // 默认 32MB 会被 N=2^14 顶到临界,放宽到 64MB 兜底

function scryptDerive(pw: string, salt: Buffer, keylen: number, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pw, salt, keylen, { N, r, p, maxmem: SCRYPT_MAXMEM }, (err, dk) => (err ? reject(err) : resolve(dk)));
  });
}

/** 生成自描述密码哈希。调用方负责先 isValidPassword 校验。 */
export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const dk = await scryptDerive(pw, salt, SCRYPT_KEYLEN, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

/** 常量时间校验密码;串格式非法 / 不匹配一律返 false(不抛)。 */
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  try {
    const [algo, nStr, rStr, pStr, saltB64, hashB64] = stored.split('$');
    if (algo !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    if (!salt.length || !expected.length) return false;
    const dk = await scryptDerive(pw, salt, expected.length, Number(nStr), Number(rStr), Number(pStr));
    return dk.length === expected.length && crypto.timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

// 无账号 / 未设密码时也跑一次 scrypt(对一个真实格式的假哈希),消除「邮箱是否存在 / 是否设了密码」
// 的时序侧信道 —— 失败路径的耗时与真实校验一致。verifyPassword 对它永远返回 false。
const DUMMY_PASSWORD_HASH = `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(SCRYPT_KEYLEN).toString('base64')}`;

/** 当前账号存的密码哈希(未设为 null)。 */
export async function getPasswordHash(userId: number): Promise<string | null> {
  const rows = await query<{ password_hash: string | null }>(
    'SELECT password_hash FROM app_users WHERE id = ?',
    [userId],
  );
  return rows[0]?.password_hash ?? null;
}

/** 设置 / 覆盖密码。调用方负责鉴权、校验新密码合法、以及(改密时)先验旧密。 */
export async function setPassword(userId: number, pw: string): Promise<void> {
  const hash = await hashPassword(pw);
  await query(
    'UPDATE app_users SET password_hash = ?, password_updated_at = NOW() WHERE id = ?',
    [hash, userId],
  );
}

/**
 * 邮箱 + 密码登录:按 email 身份找账号 → 验密码。成功返 AppUser;无账号 / 未设密码 / 密码错都返 null
 * (统一走一次 scrypt,含假哈希兜底,不泄露具体失败原因 + 无时序侧信道)。
 */
export async function loginWithPassword(email: string, pw: string): Promise<AppUser | null> {
  const rows = await query<AppUser & { password_hash: string | null }>(
    `SELECT u.id, u.display_name, u.avatar_url, u.wca_id, u.password_hash
     FROM auth_identities i JOIN app_users u ON u.id = i.user_id
     WHERE i.provider = 'email' AND i.provider_uid = ?`,
    [email],
  );
  const row = rows[0];
  const ok = await verifyPassword(pw, row?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!row || !row.password_hash || !ok) return null;
  return { id: row.id, display_name: row.display_name, avatar_url: row.avatar_url, wca_id: row.wca_id };
}

// ── 账号 / 身份 ──
export async function getUserById(id: number): Promise<AppUser | null> {
  const rows = await query<AppUser>(
    'SELECT id, display_name, avatar_url, wca_id FROM app_users WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

export async function findUserByWcaId(wcaId: string): Promise<AppUser | null> {
  const rows = await query<AppUser>(
    'SELECT id, display_name, avatar_url, wca_id FROM app_users WHERE wca_id = ?',
    [wcaId],
  );
  return rows[0] ?? null;
}

export async function findUserByIdentity(provider: Provider, providerUid: string): Promise<AppUser | null> {
  const rows = await query<AppUser>(
    `SELECT u.id, u.display_name, u.avatar_url, u.wca_id
     FROM auth_identities i JOIN app_users u ON u.id = i.user_id
     WHERE i.provider = ? AND i.provider_uid = ?`,
    [provider, providerUid],
  );
  return rows[0] ?? null;
}

/**
 * 用某身份登录:命中已有身份即返回其账号;否则新建账号 + 该身份(单事务,唯一约束防并发重复)。
 * profile.wcaId 非空时同步写 app_users.wca_id 镜像列(仅 wca provider 用)。
 */
export async function loginWithIdentity(
  provider: Provider,
  providerUid: string,
  profile: { name?: string; avatar?: string | null; wcaId?: string | null },
): Promise<AppUser> {
  const existing = await findUserByIdentity(provider, providerUid);
  if (existing) {
    // 机会式回填展示名/头像(不覆盖用户已自定义的非空名)。
    if ((!existing.display_name && profile.name) || (!existing.avatar_url && profile.avatar)) {
      await query(
        `UPDATE app_users SET
           display_name = CASE WHEN display_name = '' THEN ? ELSE display_name END,
           avatar_url   = COALESCE(avatar_url, ?)
         WHERE id = ?`,
        [profile.name ?? '', profile.avatar ?? null, existing.id],
      );
    }
    return (await getUserById(existing.id)) ?? existing;
  }
  try {
    const created = await sql.begin(async (tx) => {
      const rows = await tx`
        INSERT INTO app_users (display_name, avatar_url, wca_id)
        VALUES (${profile.name ?? ''}, ${profile.avatar ?? null}, ${profile.wcaId ?? null})
        RETURNING id, display_name, avatar_url, wca_id`;
      const u = rows[0] as unknown as AppUser;
      await tx`
        INSERT INTO auth_identities (user_id, provider, provider_uid, verified_at)
        VALUES (${u.id}, ${provider}, ${providerUid}, NOW())`;
      return u;
    });
    return created as AppUser;
  } catch {
    // 并发下另一个请求已创建同一身份(唯一约束触发,事务回滚无孤儿)→ 重查返回。
    const raced = await findUserByIdentity(provider, providerUid);
    if (raced) return raced;
    throw new Error('account creation failed');
  }
}

/**
 * 给「当前已登录用户」绑定一个新身份。返回:
 *   'ok'       绑定成功(或该身份本就属于本人 → 幂等)
 *   'conflict' 该身份已属于另一个账号(不做静默合并,交产品引导)
 */
export async function addIdentity(
  userId: number,
  provider: Provider,
  providerUid: string,
  wcaMirror?: string | null,
): Promise<'ok' | 'conflict'> {
  const owner = await findUserByIdentity(provider, providerUid);
  if (owner) return owner.id === userId ? 'ok' : 'conflict';
  try {
    const status = await sql.begin(async (tx) => {
      // 单账号仅允许一个 WCA(app_users 只有一列 wca_id 镜像)。先占镜像列:已有非空
      // wca_id 时 0 行受影响 → 冲突,不插入孤儿身份(否则镜像与 auth_identities 失同步)。
      if (provider === 'wca') {
        const upd = await tx`
          UPDATE app_users SET wca_id = ${wcaMirror ?? providerUid}
          WHERE id = ${userId} AND wca_id IS NULL`;
        if (upd.count === 0) return 'conflict';
      }
      await tx`
        INSERT INTO auth_identities (user_id, provider, provider_uid, verified_at)
        VALUES (${userId}, ${provider}, ${providerUid}, NOW())`;
      return 'ok';
    });
    return status as 'ok' | 'conflict';
  } catch {
    // 唯一约束(provider,uid 或 wca 镜像)冲突 → 视为已被他人占用。
    return 'conflict';
  }
}

export interface IdentityRow {
  provider: string;
  providerUid: string;
  createdAt: string | Date;
}
export async function getIdentities(userId: number): Promise<IdentityRow[]> {
  return query<IdentityRow>(
    `SELECT provider, provider_uid AS "providerUid", created_at AS "createdAt"
     FROM auth_identities WHERE user_id = ? ORDER BY created_at ASC`,
    [userId],
  );
}

/**
 * 解绑一个身份。拒绝解绑「最后一个身份」(否则账号永久失联)。
 * 传 providerUid 精确解绑某一条;不传则解绑该 provider 的全部。
 */
export async function removeIdentity(
  userId: number,
  provider: Provider,
  providerUid?: string,
): Promise<'ok' | 'last' | 'not_found'> {
  // FOR UPDATE 锁住该用户全部身份行,把「最后一个身份」判定与删除放进同一事务。
  // 否则两个并发解绑各读到同一份 [email,phone] 各删一条 → 账号被删空、永久失联(TOCTOU)。
  return sql.begin(async (tx) => {
    const rows = await tx`
      SELECT provider, provider_uid FROM auth_identities WHERE user_id = ${userId} FOR UPDATE`;
    const all = rows as unknown as { provider: string; provider_uid: string }[];
    const toRemove = all.filter(
      (r) => r.provider === provider && (providerUid == null || r.provider_uid === providerUid),
    );
    if (!toRemove.length) return 'not_found';
    if (all.length - toRemove.length < 1) return 'last';
    if (providerUid == null) {
      await tx`DELETE FROM auth_identities WHERE user_id = ${userId} AND provider = ${provider}`;
    } else {
      await tx`DELETE FROM auth_identities WHERE user_id = ${userId} AND provider = ${provider} AND provider_uid = ${providerUid}`;
    }
    // 仅当账号已无任何 WCA 身份时才清镜像列;还留着别的 wca 身份就清 = 把它和镜像拆散,
    // ownerKey 会悄悄从真实 wca_id 降级成合成 u<uid>,拿不到原 wca 名下的业务数据。
    if (provider === 'wca') {
      const wcaLeft = all.some(
        (r) => r.provider === 'wca' && !toRemove.some((t) => t.provider_uid === r.provider_uid),
      );
      if (!wcaLeft) {
        await tx`UPDATE app_users SET wca_id = NULL WHERE id = ${userId}`;
      }
    }
    return 'ok';
  }) as Promise<'ok' | 'last' | 'not_found'>;
}

/** 组装给前端的用户对象(与客户端 WcaUser 对齐:wcaId 可空 + uid)。 */
export function publicUser(user: AppUser): {
  uid: number;
  wcaId: string | null;
  name: string;
  avatar: string;
} {
  return {
    uid: user.id,
    wcaId: user.wca_id,
    name: user.display_name,
    avatar: user.avatar_url ?? '',
  };
}
