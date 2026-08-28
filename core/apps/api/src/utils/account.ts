/**
 * 内部账号核心逻辑:身份查找/创建、多身份绑定、验证码生命周期、归属键派生。
 * 全部纯函数 + 单表操作,便于单测(tests/account_*.test.ts 覆盖码校验与 ownerKey)。
 *
 * 归属键(ownerKey)是本设计的关键:requireAuth 对外暴露的 `wcaId` = ownerKey ——
 * 绑了 WCA 就是真 wca_id(现有 801 处业务键零改动、老数据零迁移),没绑就是合成 `u<uid>`。
 * 合成键以小写 `u` 打头,WCA id 全大写(^\d{4}[A-Z]{4}\d{2}$),两者天然不可能相撞。
 */
import crypto from 'node:crypto';
import type { AvatarSource, ClawdAvatarPresetId } from '@cuberoot/shared/account-avatar';
import type { WebSessionUser } from '@cuberoot/shared/auth/web-session';
import { query, sql } from '../db/connection.js';
import { JWT_SECRET } from './session.js';

// 纯逻辑(归属键 + 输入校验)在 shared,前后端共用 + 客户端可单测;这里再导出保持调用方不变。
export {
  ownerKey, isWcaIdFormat, normalizeEmail, isValidEmail, normalizePhone, isValidPhone, isValidPassword,
  normalizeDisplayName, isValidDisplayName,
  primaryHandle, deletedOwnerKey, isDeletedOwner,
} from '@cuberoot/shared/account';

export type Provider = 'email' | 'phone' | 'wca' | 'apple' | 'google' | 'wechat' | 'alipay' | 'qq';
export type Channel = 'email' | 'phone';
export type CodePurpose = 'login' | 'link';

export interface AppUser {
  id: number;
  display_name: string;
  avatar_url: string | null;
  avatar_source: AvatarSource;
  avatar_preset: ClawdAvatarPresetId | null;
  wca_id: string | null;
}

type AppUserRow = Omit<AppUser, 'id'> & { id: unknown };

/** PostgreSQL BIGINT 默认以字符串返回；在账号数据边界统一收窄为前端契约要求的安全整数。 */
function appUserId(rawId: unknown): number {
  const id = typeof rawId === 'bigint'
    ? Number(rawId)
    : typeof rawId === 'string' && /^[1-9]\d*$/.test(rawId)
      ? Number(rawId)
      : rawId;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
    throw new RangeError('app user id must be a positive safe integer');
  }
  return id;
}

function appUserFromRow(row: AppUserRow): AppUser {
  return {
    id: appUserId(row.id),
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    avatar_source: row.avatar_source,
    avatar_preset: row.avatar_preset,
    wca_id: row.wca_id,
  };
}

function firstAppUser(rows: AppUserRow[]): AppUser | null {
  return rows[0] ? appUserFromRow(rows[0]) : null;
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
 * 移除密码(退回纯 passwordless)。密码从来不是登录方式的最后一根稻草 —— 邮箱验证码永远在,
 * 故移除它不会让账号失联(不像 removeIdentity 需要「最后一个身份」保护)。
 */
export async function clearPassword(userId: number): Promise<void> {
  await query(
    'UPDATE app_users SET password_hash = NULL, password_updated_at = NOW() WHERE id = ?',
    [userId],
  );
}

/**
 * 邮箱 + 密码登录:按 email 身份找账号 → 验密码。成功返 AppUser;无账号 / 未设密码 / 密码错都返 null
 * (统一走一次 scrypt,含假哈希兜底,不泄露具体失败原因 + 无时序侧信道)。
 */
export async function loginWithPassword(email: string, pw: string): Promise<AppUser | null> {
  const rows = await query<AppUserRow & { password_hash: string | null }>(
    `SELECT u.id, u.display_name, u.avatar_url, u.avatar_source, u.avatar_preset, u.wca_id, u.password_hash
     FROM auth_identities i JOIN app_users u ON u.id = i.user_id
     WHERE i.provider = 'email' AND i.provider_uid = ?`,
    [email],
  );
  const row = rows[0];
  const ok = await verifyPassword(pw, row?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!row || !row.password_hash || !ok) return null;
  return appUserFromRow(row);
}

// ── 账号 / 身份 ──
export async function getUserById(id: number): Promise<AppUser | null> {
  const rows = await query<AppUserRow>(
    'SELECT id, display_name, avatar_url, avatar_source, avatar_preset, wca_id FROM app_users WHERE id = ?',
    [id],
  );
  return firstAppUser(rows);
}

/**
 * 修改当前账号的站内展示名。调用方负责鉴权并先做 normalize + validate。
 * wca_id 条件是最终写入闸门:即使改名与绑定 WCA 并发,也不能在实名绑定后落入自定义名。
 */
export async function updateDisplayName(id: number, displayName: string): Promise<AppUser | null> {
  const rows = await query<AppUserRow>(
    `UPDATE app_users SET display_name = ? WHERE id = ? AND wca_id IS NULL
     RETURNING id, display_name, avatar_url, avatar_source, avatar_preset, wca_id`,
    [displayName, id],
  );
  return firstAppUser(rows);
}

export async function updateClawdAvatar(
  id: number,
  preset: ClawdAvatarPresetId,
): Promise<AppUser | null> {
  const rows = await query<AppUserRow>(
    `UPDATE app_users
     SET avatar_source = 'clawd', avatar_preset = ?, avatar_url = NULL
     WHERE id = ?
     RETURNING id, display_name, avatar_url, avatar_source, avatar_preset, wca_id`,
    [preset, id],
  );
  return firstAppUser(rows);
}

export async function updateUploadedAvatar(
  id: number,
  ownershipKey: string,
  imageId: number,
  avatarUrl: string,
): Promise<AppUser | null> {
  const rows = await query<AppUserRow>(
    `UPDATE app_users AS app
     SET avatar_source = 'upload', avatar_preset = NULL, avatar_url = ?
     WHERE app.id = ?
       AND EXISTS (
         SELECT 1 FROM article_image AS image
         WHERE image.id = ? AND image.owner_wca_id = ?
       )
     RETURNING app.id, app.display_name, app.avatar_url,
               app.avatar_source, app.avatar_preset, app.wca_id`,
    [avatarUrl, id, imageId, ownershipKey],
  );
  return firstAppUser(rows);
}

export async function resetAvatarToWca(id: number): Promise<AppUser | null> {
  const rows = await query<AppUserRow>(
    `UPDATE app_users AS app
     SET avatar_source = 'auto',
         avatar_preset = NULL,
         avatar_url = (
           SELECT wca.avatar_url FROM wca_users AS wca WHERE wca.wca_id = app.wca_id
         )
     WHERE app.id = ? AND app.wca_id IS NOT NULL
     RETURNING app.id, app.display_name, app.avatar_url,
               app.avatar_source, app.avatar_preset, app.wca_id`,
    [id],
  );
  return firstAppUser(rows);
}

export async function findUserByWcaId(wcaId: string): Promise<AppUser | null> {
  const rows = await query<AppUserRow>(
    'SELECT id, display_name, avatar_url, avatar_source, avatar_preset, wca_id FROM app_users WHERE wca_id = ?',
    [wcaId],
  );
  return firstAppUser(rows);
}

export async function findUserByIdentity(provider: Provider, providerUid: string): Promise<AppUser | null> {
  const rows = await query<AppUserRow>(
    `SELECT u.id, u.display_name, u.avatar_url, u.avatar_source, u.avatar_preset, u.wca_id
     FROM auth_identities i JOIN app_users u ON u.id = i.user_id
     WHERE i.provider = ? AND i.provider_uid = ?`,
    [provider, providerUid],
  );
  return firstAppUser(rows);
}

/**
 * 用某身份登录:命中已有身份即返回其账号;否则新建账号 + 该身份(单事务,唯一约束防并发重复)。
 * profile.wcaId 非空时同步写 app_users.wca_id 镜像列(仅 wca provider 用)。
 *
 * isNew 区分「注册」与「登录」—— 登录/注册合并成一条流程(免用户枚举)后,服务端是唯一
 * 知道这次到底建没建账号的一方。前端只在 isNew 时才做新人引导(问有没有 WCA ID),
 * 老用户每次登录都被问一遍会很烦。**不进 JWT**:它只描述这一次请求,不是会话属性。
 */
export async function loginWithIdentity(
  provider: Provider,
  providerUid: string,
  profile: { name?: string; avatar?: string | null; wcaId?: string | null },
): Promise<{ user: AppUser; isNew: boolean }> {
  const existing = await findUserByIdentity(provider, providerUid);
  if (existing) {
    // WCA 姓名是实名认证来源,每次 WCA 登录都刷新;其它来源仍只机会式回填空展示名。
    if ((provider === 'wca' && profile.name) || (!existing.display_name && profile.name)) {
      await query(
        `UPDATE app_users SET
           display_name = CASE WHEN ? = 'wca' THEN ? WHEN display_name = '' THEN ? ELSE display_name END,
           avatar_url = CASE WHEN ? = 'wca' AND avatar_source = 'auto' THEN ? ELSE avatar_url END
         WHERE id = ?`,
        [provider, profile.name ?? '', profile.name ?? '', provider, profile.avatar ?? null, existing.id],
      );
    }
    return { user: (await getUserById(existing.id)) ?? existing, isNew: false };
  }
  try {
    const created = await sql.begin(async (tx) => {
      const rows = await tx`
        INSERT INTO app_users (display_name, avatar_url, avatar_source, avatar_preset, wca_id)
        VALUES (
          ${profile.name ?? ''},
          ${provider === 'wca' ? profile.avatar ?? null : null},
          'auto',
          NULL,
          ${profile.wcaId ?? null}
        )
        RETURNING id, display_name, avatar_url, avatar_source, avatar_preset, wca_id`;
      const row = rows[0] as unknown as AppUserRow | undefined;
      if (!row) throw new Error('account creation returned no user');
      const u = appUserFromRow(row);
      await tx`
        INSERT INTO auth_identities (user_id, provider, provider_uid, verified_at)
        VALUES (${u.id}, ${provider}, ${providerUid}, NOW())`;
      return u;
    });
    return { user: created, isNew: true };
  } catch {
    // 并发下另一个请求已创建同一身份(唯一约束触发,事务回滚无孤儿)→ 重查返回。
    // 账号确实是这一瞬间建的,但建它的是另一个请求,本次不认领 isNew(引导只做一次)。
    const raced = await findUserByIdentity(provider, providerUid);
    if (raced) return { user: raced, isNew: false };
    throw new Error('account creation failed');
  }
}

/** 一个账号至多一条的凭据类 provider。各有一条偏唯一索引兜底:邮箱 0078,手机 0103。 */
export const SINGLE_PER_ACCOUNT = ['email', 'phone'] as const;
export type SingleProvider = (typeof SINGLE_PER_ACCOUNT)[number];

/**
 * 给「当前已登录用户」绑定一个新身份。返回:
 *   'ok'        绑定成功(或该身份本就属于本人 → 幂等)
 *   'conflict'  该身份已属于另一个账号(不做静默合并,交产品引导)
 *   'has-email' / 'has-phone'
 *               本账号已有邮箱 / 手机号 —— 各只能绑一个(见 0078 / 0103)。与 'conflict' 分开
 *               是因为两者要给用户的话完全不同:一个是「去解绑你自己的」,一个是「这是别人的」。
 */
export async function addIdentity(
  userId: number,
  provider: Provider,
  providerUid: string,
  wcaMirror?: string | null,
  verifiedDisplayName?: string | null,
  verifiedAvatarUrl?: string | null,
): Promise<'ok' | 'conflict' | `has-${SingleProvider}`> {
  const owner = await findUserByIdentity(provider, providerUid);
  if (owner) {
    if (owner.id !== userId) return 'conflict';
    // 幂等重绑也要刷新 WCA 官方姓名,不能让旧自定义名继续留在实名账号上。
    if (provider === 'wca' && verifiedDisplayName) {
      await query(
        `UPDATE app_users SET
           wca_id = ?,
           display_name = ?,
           avatar_url = CASE WHEN avatar_source = 'auto' THEN ? ELSE avatar_url END
         WHERE id = ?`,
        [wcaMirror ?? providerUid, verifiedDisplayName, verifiedAvatarUrl ?? null, userId],
      );
    }
    return 'ok';
  }
  try {
    const status = await sql.begin(async (tx) => {
      // 单账号仅允许一个 WCA(app_users 只有一列 wca_id 镜像)。先占镜像列:已有非空
      // wca_id 时 0 行受影响 → 冲突,不插入孤儿身份(否则镜像与 auth_identities 失同步)。
      if (provider === 'wca') {
        const upd = await tx`
          UPDATE app_users SET
            wca_id = ${wcaMirror ?? providerUid},
            display_name = ${verifiedDisplayName ?? ''},
            avatar_url = CASE
              WHEN avatar_source = 'auto' THEN ${verifiedAvatarUrl ?? null}
              ELSE avatar_url
            END
          WHERE id = ${userId} AND wca_id IS NULL`;
        if (upd.count === 0) return 'conflict';
      }
      // 单账号仅允许一个邮箱 / 一个手机号。这只是先行检查,好给出准确文案;真正的保证是
      // 0078 / 0103 的偏唯一索引 —— 并发双绑会绕过这里,由索引在 catch 里兜住。
      if ((SINGLE_PER_ACCOUNT as readonly string[]).includes(provider)) {
        const dup = await tx`
          SELECT 1 FROM auth_identities
          WHERE user_id = ${userId} AND provider = ${provider} LIMIT 1`;
        if (dup.count > 0) return `has-${provider}`;
      }
      await tx`
        INSERT INTO auth_identities (user_id, provider, provider_uid, verified_at)
        VALUES (${userId}, ${provider}, ${providerUid}, NOW())`;
      return 'ok';
    });
    return status as 'ok' | 'conflict' | `has-${SingleProvider}`;
  } catch (e) {
    // 并发绑第二个邮箱 / 手机时晚到的那条落这里 —— 认约束名还原成准确状态,别混进「已被他人占用」。
    const detail = `${(e as { constraint_name?: string }).constraint_name ?? ''} ${(e as Error).message ?? ''}`;
    if (detail.includes('uq_auth_identity_one_email')) return 'has-email';
    if (detail.includes('uq_auth_identity_one_phone')) return 'has-phone';
    // 其余唯一约束(provider,uid 或 wca 镜像)冲突 → 视为已被他人占用。
    return 'conflict';
  }
}

/**
 * 换绑邮箱 / 手机号:把本账号那条身份原地改成新地址。返回:
 *   'ok'       换成功(或新旧同一个地址 → 幂等)
 *   'conflict' 新地址已属于另一个账号
 *   'none'     本账号还没有这条身份 —— 那是「绑定」不是「更换」,让调用方走 addIdentity
 *
 * 为什么不是「先解绑再绑定」:一个账号只能有一个邮箱 / 一个手机号(0078 / 0103),而唯一的
 * 登录方式又不许解绑(removeIdentity 的 'last')。拆成两步时,只有这一条凭据的账号会在中间
 * 那一刻手里零个登录方式,两条规矩迎面撞上,换绑直接没路。原地 UPDATE 全程不空手,也全程
 * 不超过一条。
 */
export async function replaceCredentialIdentity(
  userId: number,
  provider: SingleProvider,
  newUid: string,
): Promise<'ok' | 'conflict' | 'none'> {
  const owner = await findUserByIdentity(provider, newUid);
  if (owner && owner.id !== userId) return 'conflict';
  try {
    return await sql.begin(async (tx) => {
      // 锁住本账号那一行:并发两次换绑各读到旧值再各改一次,后写的赢且前一次静默丢失。
      const rows = await tx`
        SELECT id FROM auth_identities
        WHERE user_id = ${userId} AND provider = ${provider} FOR UPDATE`;
      if (rows.count === 0) return 'none';
      await tx`
        UPDATE auth_identities
        SET provider_uid = ${newUid}, verified_at = NOW()
        WHERE id = ${rows[0].id}`;
      return 'ok';
    });
  } catch {
    // 唯一约束 (provider, provider_uid):新地址在我们检查之后被别人抢注。
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
        await tx`
          UPDATE app_users SET
            wca_id = NULL,
            avatar_url = CASE WHEN avatar_source = 'auto' THEN NULL ELSE avatar_url END
          WHERE id = ${userId}`;
      }
    }
    return 'ok';
  }) as Promise<'ok' | 'last' | 'not_found'>;
}

/** 组装给前端的用户对象(与客户端 WcaUser 对齐:wcaId 可空 + uid)。 */
export function publicUser(user: AppUser): WebSessionUser {
  return {
    uid: appUserId(user.id),
    wcaId: user.wca_id,
    name: user.display_name,
    avatar: user.avatar_url ?? '',
    avatarSource: user.avatar_source,
    avatarPreset: user.avatar_preset,
  };
}

/**
 * Resolve opaque owner keys to public CubeRoot account IDs in one batch.
 * Deleted owners and WCA-only people without an app_users row intentionally have no ID.
 */
export async function publicUserIdsForOwnerKeys(
  ownerKeys: readonly (string | null | undefined)[],
): Promise<Map<string, number>> {
  const keys = [...new Set(ownerKeys.filter((key): key is string => typeof key === 'string' && key.length > 0))];
  const wcaKeys = keys.filter((key) => /^\d{4}[A-Z]{4}\d{2}$/.test(key));
  const uidKeys = keys
    .map((key) => /^u([1-9]\d*)$/.exec(key))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]))
    .filter((id) => Number.isSafeInteger(id));
  const result = new Map<string, number>();

  if (wcaKeys.length > 0) {
    const rows = await query<{ id: number | string; wca_id: string }>(
      `SELECT id, wca_id FROM app_users WHERE wca_id IN (${wcaKeys.map(() => '?').join(',')})`,
      wcaKeys,
    );
    for (const row of rows) result.set(row.wca_id, appUserId(row.id));
  }
  if (uidKeys.length > 0) {
    const rows = await query<{ id: number | string }>(
      `SELECT id FROM app_users WHERE id IN (${uidKeys.map(() => '?').join(',')})`,
      uidKeys,
    );
    for (const row of rows) result.set(`u${row.id}`, appUserId(row.id));
  }

  return result;
}
