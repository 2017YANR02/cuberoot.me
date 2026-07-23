/**
 * Recon 后端工具函数
 * 功能：JSON↔SQL 字段映射、白名单、数据校验、WCA 认证、速率限制
 * NOTE: 1:1 移植自 PHP db.php + index.php 的工具函数
 */
import type { Context } from 'hono';
import jwt from 'jsonwebtoken';
import { ADMIN_WCA_IDS, BANNED_WCA_IDS } from '@cuberoot/shared/admin';
export { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';
import { JWT_SECRET } from './session.js';
import { ownerKey } from './account.js';

// 装饰性标注字符:`·`(间隔)、`↑↓`(regrip 方向记号)、分数 `⅓⅔`、ASCII `.`、各类零宽字符。
// 这些不是真转动,记号区校验前先剥掉(与客户端 lib/recon-alg-utils.ts 的 COSMETIC_ANNOTATION_CHARS
// 一一对应;改一处必须改另一处,CI tests/recon-server-validation.test.ts 守卫两端一致)。
// 含 ASCII `.`、`·↑↓⅓⅔` 与四个零宽字符(U+200B/200C/200D/FEFF)。
const COSMETIC_ANNOTATION_RE = /[.·↑↓⅓⅔​‌‍﻿]/g;

// ── JSON camelCase ↔ SQL snake_case 映射 ──

// NOTE: 只列出名称不同的字段，同名字段（如 id, event, method）无需映射
const FIELD_MAP_JSON_TO_SQL: Record<string, string> = {
  rawTime: 'raw_time',
  execTime: 'exec_time',
  memoTime: 'memo_time',
  solveNum: 'solve_num',
  personId: 'person_id',
  regionalSingleRecord: 'regional_single_record',
  regionalAverageRecord: 'regional_average_record',
  aoType: 'ao_type',
  regionalAoxrRecord: 'regional_aoxr_record',
  wcaScramble: 'wca_scramble',
  optimalScramble: 'optimal_scramble',
  ollShort: 'oll_short',
  pllShort: 'pll_short',
  freePair: 'free_pair',
  yRot: 'y_rot',
  crossType: 'cross_type',
  crossStm: 'cross_stm',
  sMove: 's_move',
  crossColor: 'cross_color',
  groupId: 'group_id',
  reconDate: 'recon_date',
  createdAt: 'created_at',
  addedBy: 'added_by',
  addedById: 'added_by_id',
  compWcaId: 'comp_wca_id',
  reconerId: 'reconer_id',
  personCountry: 'person_country',
  coPersons: 'co_persons',
  videoUrl: 'video_url',
  dupReason: 'dup_reason',
};

// NOTE: 反向映射（运行时自动生成）
const FIELD_MAP_SQL_TO_JSON: Record<string, string> = {};
for (const [json, sql] of Object.entries(FIELD_MAP_JSON_TO_SQL)) {
  FIELD_MAP_SQL_TO_JSON[sql] = json;
}

// NOTE: 允许 INSERT/UPDATE 的列白名单（防止前端注入非数据库字段）
const ALLOWED_COLUMNS = new Set([
  'official', 'event', 'method', 'date', 'comp', 'country', 'city', 'round',
  'solve_num', 'person', 'person_id', 'raw_time', 'exec_time', 'memo_time',
  'average', 'value', 'regional_single_record', 'regional_average_record',
  'ao_type', 'regional_aoxr_record', 'solution', 'optimal_scramble',
  'wca_scramble', 'caption', 'note', 'stm', 'tps', 'oll', 'pll',
  'oll_short', 'pll_short', 'free_pair', 'y_rot', 'regrip', 'lockup',
  'cross_type', 'cross_stm', 'f2l', 'll', 's_move', 'cross_color',
  'cube', 'reconer', 'reconer_id', 'group_id', 'recon_date', 'created_at',
  'added_by', 'added_by_id', 'comp_wca_id', 'person_country', 'co_persons',
  'video_url', 'alternatives', 'dup_reason', 'visibility',
]);

// 同选手+同打乱重复提交时,用户必须二选一说明原因(否则后端拒收)。空=非重复提交。
export const DUP_REASONS = ['repeat_scramble', 'different_comp'] as const;
export type DupReason = (typeof DUP_REASONS)[number];

// 复盘性质三值枚举(2026-07,原 0/1 布尔迁移而来:1→wca,0→practice)。
export const RECON_OFFICIAL = ['wca', 'non_wca', 'practice'] as const;
export type ReconOfficial = (typeof RECON_OFFICIAL)[number];

// 可见性三值枚举(YouTube 风格,见 migrations/0085)。缺省 = 'public'。
export const RECON_VISIBILITY = ['public', 'unlisted', 'private'] as const;
export type ReconVisibility = (typeof RECON_VISIBILITY)[number];

/**
 * 归一化 official 到三值枚举字符串,兼容:新枚举串 / 旧布尔(0|1) / 旧数字串('0'|'1')/ boolean。
 * 未知值兜底 'wca'(与旧默认 official=1 一致)。
 */
export function normalizeOfficial(v: unknown): ReconOfficial {
  if (v === 'non_wca') return 'non_wca';
  if (v === 'practice' || v === 0 || v === '0' || v === false) return 'practice';
  return 'wca'; // 'wca' | 1 | '1' | true | 其它
}

// ── 数据转换 ──

// NOTE: rowToJson 中需要强转类型的字段集合
const INT_FIELDS = new Set([
  'id', 'stm', 'solveNum', 'freePair', 'yRot', 'regrip', 'lockup',
  'crossType', 'crossStm', 'f2l', 'll', 'sMove', 'createdAt',
]);
const FLOAT_FIELDS = new Set(['rawTime', 'execTime', 'memoTime', 'average', 'tps']);

/**
 * SQL 行 → 前端 JSON 对象
 * NOTE: snake_case → camelCase，类型强转，过滤 null 值
 */
export function rowToJson(row: Record<string, unknown>): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  for (const [col, val] of Object.entries(row)) {
    const key = FIELD_MAP_SQL_TO_JSON[col] ?? col;
    json[key] = val;
  }

  // NOTE: 类型修正——official 归一化为三值枚举串(兼容旧 0/1 数据)
  if (json.official !== undefined) json.official = normalizeOfficial(json.official);
  for (const k of INT_FIELDS) {
    if (json[k] !== undefined && json[k] !== null) json[k] = Number(json[k]);
  }
  for (const k of FLOAT_FIELDS) {
    if (json[k] !== undefined && json[k] !== null) json[k] = Number(json[k]);
  }

  // NOTE: alternatives JSON 列——驱动可能返回字符串,parse 成数组
  if (typeof json.alternatives === 'string') {
    try { json.alternatives = JSON.parse(json.alternatives); } catch { json.alternatives = []; }
  }

  // NOTE: co_persons JSON 列(同 alternatives,TEXT 存 JSON 串)
  if (typeof json.coPersons === 'string') {
    try { json.coPersons = JSON.parse(json.coPersons); } catch { json.coPersons = []; }
  }

  // NOTE: 移除 null 值——与原 PHP 行为一致
  for (const k of Object.keys(json)) {
    if (json[k] === null) delete json[k];
  }
  return json;
}

/**
 * 前端 JSON 对象 → SQL 列名+值（用于 INSERT/UPDATE）
 * NOTE: camelCase → snake_case，只保留白名单内的列
 */
export function jsonToRow(json: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(json)) {
    const col = FIELD_MAP_JSON_TO_SQL[key] ?? key;
    if (!ALLOWED_COLUMNS.has(col) && col !== 'id') continue;
    // NOTE: 空字符串转 null（与 PHP 行为一致）
    row[col] = val === '' ? null : val;
  }
  // NOTE: official 归一化为三值枚举串(兼容前端传旧布尔 / 新枚举)
  if (row.official !== undefined && row.official !== null) {
    row.official = normalizeOfficial(row.official);
  }
  // NOTE: co_persons 是 TEXT 存 JSON 串——数组直接 stringify(空数组存 null),
  //       已是字符串则原样透传(防 driver 把数组当 PG array literal 写坏)
  if (Array.isArray(row.co_persons)) {
    const arr = (row.co_persons as unknown[]).filter(Boolean);
    row.co_persons = arr.length ? JSON.stringify(arr) : null;
  }
  return row;
}

// ── 数据校验 ──

/**
 * 校验 SQL 行的字段类型/范围/长度
 * NOTE: 按数据库 Schema 校验，防非法输入
 * @returns 错误消息数组（空=通过）
 */
export function validateRow(row: Record<string, unknown>): string[] {
  const errors: string[] = [];

  // DECIMAL(8,3)
  for (const col of ['raw_time', 'average', 'exec_time', 'memo_time']) {
    const v = row[col];
    if (v !== undefined && v !== null) {
      if (isNaN(Number(v))) errors.push(`${col} must be a number`);
      else if (Math.abs(Number(v)) > 99999.999) errors.push(`${col} out of range`);
    }
  }

  // DECIMAL(5,2)
  if (row.tps !== undefined && row.tps !== null) {
    if (isNaN(Number(row.tps))) errors.push('tps must be a number');
    else if (Math.abs(Number(row.tps)) > 999.99) errors.push('tps out of range');
  }

  // DATE
  for (const col of ['date', 'recon_date']) {
    const v = row[col];
    if (v !== undefined && v !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || isNaN(Date.parse(String(v)))) {
        errors.push(`${col} must be a valid YYYY-MM-DD date`);
      }
    }
  }

  // TINYINT (-128 ~ 127)
  for (const col of ['solve_num', 'free_pair', 'y_rot', 'regrip', 'lockup', 'cross_type', 's_move']) {
    const v = row[col];
    if (v !== undefined && v !== null) {
      const n = Number(v);
      if (!Number.isInteger(n)) errors.push(`${col} must be an integer`);
      else if (n < -128 || n > 127) errors.push(`${col} out of range (-128~127)`);
    }
  }

  // SMALLINT (-32768 ~ 32767)
  for (const col of ['stm', 'cross_stm', 'f2l', 'll']) {
    const v = row[col];
    if (v !== undefined && v !== null) {
      const n = Number(v);
      if (!Number.isInteger(n)) errors.push(`${col} must be an integer`);
      else if (n < -32768 || n > 32767) errors.push(`${col} out of range (-32768~32767)`);
    }
  }

  // INT UNSIGNED: created_at
  if (row.created_at !== undefined && row.created_at !== null) {
    const n = Number(row.created_at);
    if (!Number.isInteger(n) || n < 0) errors.push('created_at must be a non-negative integer');
  }

  // VARCHAR 长度限制
  const varcharLimits: Record<string, number> = {
    event: 20, method: 20, round: 20, comp: 200, comp_wca_id: 100,
    country: 100, city: 100, person: 100, person_id: 20, person_country: 10,
    cube: 100, reconer: 100, reconer_id: 20, group_id: 10,
    added_by: 100, added_by_id: 20, value: 20,
    regional_single_record: 20, regional_average_record: 20,
    ao_type: 50, regional_aoxr_record: 20,
    oll: 100, pll: 100, oll_short: 50, pll_short: 50,
  };
  for (const [col, max] of Object.entries(varcharLimits)) {
    const v = row[col];
    if (v !== undefined && v !== null && String(v).length > max) {
      errors.push(`${col} exceeds max length (${max})`);
    }
  }

  // CHAR(1): cross_color
  if (row.cross_color !== undefined && row.cross_color !== null && String(row.cross_color).length > 1) {
    errors.push('cross_color must be a single character');
  }

  // dup_reason: 仅允许两个枚举值(或空)
  if (row.dup_reason !== undefined && row.dup_reason !== null
      && !(DUP_REASONS as readonly string[]).includes(String(row.dup_reason))) {
    errors.push(`dup_reason must be one of: ${DUP_REASONS.join(', ')}`);
  }

  // official: 三值枚举(jsonToRow 已归一化,此处兜底防绕过)
  if (row.official !== undefined && row.official !== null
      && !(RECON_OFFICIAL as readonly string[]).includes(String(row.official))) {
    errors.push(`official must be one of: ${RECON_OFFICIAL.join(', ')}`);
  }

  // visibility: 三值枚举(public / unlisted / private);空由 DB 默认兜底
  if (row.visibility !== undefined && row.visibility !== null
      && !(RECON_VISIBILITY as readonly string[]).includes(String(row.visibility))) {
    errors.push(`visibility must be one of: ${RECON_VISIBILITY.join(', ')}`);
  }

  // co_persons: JSON 数组 [{name, id?, country?}],各字段长度对齐 person 列
  if (row.co_persons !== undefined && row.co_persons !== null) {
    let arr: unknown;
    try { arr = JSON.parse(String(row.co_persons)); } catch { arr = undefined; }
    if (!Array.isArray(arr)) {
      errors.push('co_persons must be a JSON array');
    } else if (arr.length > 10) {
      errors.push('co_persons too many entries (max 10)');
    } else {
      for (const e of arr as Record<string, unknown>[]) {
        if (!e || typeof e.name !== 'string' || !e.name.trim()) {
          errors.push('co_persons entry must have a name'); break;
        }
        if (String(e.name).length > 100) { errors.push('co_persons name exceeds max length (100)'); break; }
        if (e.id != null && String(e.id).length > 20) { errors.push('co_persons id exceeds max length (20)'); break; }
        if (e.country != null && String(e.country).length > 10) { errors.push('co_persons country exceeds max length (10)'); break; }
      }
    }
  }

  // TEXT 上限 64KB
  for (const col of ['recon', 'solution', 'optimal_scramble', 'wca_scramble', 'caption', 'note', 'video_url']) {
    const v = row[col];
    if (v !== undefined && v !== null && Buffer.byteLength(String(v), 'utf8') > 65535) {
      errors.push(`${col} exceeds max size (64KB)`);
    }
  }

  // 记号列(解法 / 打乱):每行 `//` 注释之外只能用 ASCII(英文字母+符号)。
  // 中文等文字会被播放器当成转动 → 复盘无法播放,要写说明请放进 `//` 注释。
  // (客户端表单已拦,这里是权威后端兜底。)
  // 例外:装饰性标注字符(`·↑↓⅓⅔` + 零宽)放行 —— 播放器(cleanForPlayer)喂播放器前会静默剥掉,
  // 不影响复盘。必须与客户端 lib/recon-alg-utils.ts 的 COSMETIC_ANNOTATION_CHARS 同步,否则带
  // regrip 箭头(↑↓)的解法过得了前端校验却被后端拒("Validation failed")。
  for (const col of ['solution', 'wca_scramble', 'optimal_scramble']) {
    const v = row[col];
    if (v === undefined || v === null) continue;
    const lines = String(v).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const idx = lines[i].indexOf('//');
      const raw = idx >= 0 ? lines[i].slice(0, idx) : lines[i];
      const instr = raw.replace(COSMETIC_ANNOTATION_RE, '');
      // eslint-disable-next-line no-control-regex
      if (/[^\x00-\x7F]/.test(instr)) {
        errors.push(`${col} line ${i + 1} has non-ASCII characters outside // comments`);
        break;
      }
    }
  }

  return errors;
}

// ── WCA 认证 ──

export interface WcaUser {
  /** 归属键:绑了 WCA = 真实 wca_id;没绑 = 合成 `u<uid>`。业务表主键 / 所有权判定都用它。 */
  wcaId: string;
  name: string;
  /** 内部账号 id(带 uid 的新 token 才有;老 wca-only token 为 undefined)。 */
  uid?: number;
  /** 真实 WCA id(仅绑定了 WCA 时非空;/person 链接、WCA 数据 join 用它,合成键不可用)。 */
  realWcaId?: string;
}

// NOTE: 内存缓存——token → user（永不过期，与 PHP 行为一致）
const tokenCache = new Map<string, WcaUser>();

/**
 * 验证认证 token 并返回用户信息
 * NOTE: 优先尝试 JWT 验证（快速，无网络调用），失败后回退到 WCA access_token 验证
 */
export async function authenticateUser(authHeader: string | undefined): Promise<WcaUser | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  // NOTE: 优先尝试 JWT 验证（自签令牌，365 天有效期，无需网络调用）
  // 载荷三种:{ wcaId }(老 token)/ { uid }(纯邮箱手机账号)/ { uid, wcaId }(绑了 WCA)。
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { uid?: number; wcaId?: string; name?: string };
    if (payload.uid != null || payload.wcaId) {
      return {
        wcaId: ownerKey(payload.uid, payload.wcaId),
        name: payload.name ?? '',
        uid: payload.uid,
        realWcaId: payload.wcaId,
      };
    }
  } catch {
    // NOTE: 不是有效 JWT，继续尝试 WCA token
  }

  // NOTE: 缓存命中（WCA access_token）
  const cached = tokenCache.get(token);
  if (cached) return cached;

  // NOTE: 回退：调 WCA /me API 验证（WCA access_token 2 小时过期）
  try {
    const res = await fetch('https://www.worldcubeassociation.org/api/v0/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { me: { wca_id: string; name: string } };
    const me = data.me;
    if (!me?.wca_id) return null;

    const user: WcaUser = { wcaId: me.wca_id, name: me.name ?? '' };
    tokenCache.set(token, user);
    return user;
  } catch {
    return null;
  }
}

/**
 * 要求登录——从 Hono Context 取 Authorization header
 */
export async function requireAuth(c: Context): Promise<WcaUser> {
  const user = await authenticateUser(c.req.header('Authorization'));
  if (!user) {
    throw new Error('Authentication required');
  }
  if (BANNED_WCA_IDS.includes(user.wcaId)) {
    throw new Error('Your account has been suspended');
  }
  return user;
}

/**
 * 可选认证——有合法 token 返回用户,否则返回 null(不抛)。
 * 给公开 GET 端点做「所有者可见自己的非公开数据」的鉴权用(如可见性过滤)。
 */
export async function optionalAuth(c: Context): Promise<WcaUser | null> {
  const user = await authenticateUser(c.req.header('Authorization'));
  if (!user || BANNED_WCA_IDS.includes(user.wcaId)) return null;
  return user;
}

/**
 * 可见性读过滤——纯发现面(社区总表 / 比赛页):
 *   管理员看全部;其余人(含内容所有者本人)只看 public。
 * 与 YouTube 一致:你的非公开(unlisted / private)不进公共发现流,即便你自己浏览也不混入。
 * ⚠️ 仅可用于 no-store 端点——响应随「是否管理员」变化,若被共享缓存(nginx/CDN)缓存会把
 *    非公开泄露给匿名者。带 public/max-age 的端点(/today /latest /same-scramble)禁用本过滤,
 *    一律硬编码 visibility='public'。
 * 返回 { clause, params }:clause 直接拼进 WHERE,params 依序追加到查询参数。
 */
export function visibilityDiscoverFilter(
  me: WcaUser | null,
  visCol = 'visibility',
): { clause: string; params: string[] } {
  if (me && ADMIN_WCA_IDS.includes(me.wcaId)) return { clause: '1=1', params: [] };
  return { clause: `${visCol} = 'public'`, params: [] };
}

/**
 * 可见性读过滤——定向面(个人主页 / 按选手查):
 *   管理员看全部;内容所有者(added_by_id 命中)额外看到自己添加的非公开;匿名只看 public。
 * ⚠️ 同上,仅可用于 no-store 端点。
 * visCol / ownerCol 支持带表前缀(如 'recons.visibility'),用于 JOIN 查询。
 */
export function visibilityOwnerFilter(
  me: WcaUser | null,
  visCol = 'visibility',
  ownerCol = 'added_by_id',
): { clause: string; params: string[] } {
  if (me && ADMIN_WCA_IDS.includes(me.wcaId)) return { clause: '1=1', params: [] };
  if (me) return { clause: `(${visCol} = 'public' OR ${ownerCol} = ?)`, params: [me.wcaId] };
  return { clause: `${visCol} = 'public'`, params: [] };
}

/**
 * 要求管理员权限
 */
export async function requireAdmin(c: Context): Promise<WcaUser> {
  const user = await requireAuth(c);
  if (!ADMIN_WCA_IDS.includes(user.wcaId)) {
    throw new Error('Admin access required');
  }
  return user;
}

/**
 * 要求管理员权限,但允许通过 X-Admin-Key header 走 API key 通道(给 AI / 脚本用)。
 * key 在 server `.env` 里 `ADMIN_API_KEY=xxx`,匹配则视为 admin,绕开 OAuth。
 * 不影响普通 admin 用户走 OAuth 的正常流程。
 */
export async function requireAdminOrApiKey(c: Context): Promise<WcaUser> {
  const key = c.req.header('X-Admin-Key');
  const expected = process.env.ADMIN_API_KEY;
  if (key && expected && key === expected) {
    return { wcaId: '__api_key__', name: 'API Key' };
  }
  return requireAdmin(c);
}

// ── 速率限制 ──

// NOTE: 内存速率限制——每 IP 每分钟 30 次写操作
const rateLimitMap = new Map<string, number[]>();
const RATE_WINDOW = 60_000; // 60 秒（毫秒）
const RATE_MAX = 30;

export function checkRateLimit(ip: string): void {
  const now = Date.now();
  let timestamps = rateLimitMap.get(ip) ?? [];
  // NOTE: 清理过期记录
  timestamps = timestamps.filter(t => t > now - RATE_WINDOW);

  if (timestamps.length >= RATE_MAX) {
    throw new Error('Rate limit exceeded');
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
}

// ── SQL 构建工具 ──

/**
 * 构建 INSERT 语句(列名双引号包裹,PG 兼容)
 */
export function buildInsert(table: string, row: Record<string, unknown>): {
  sql: string; values: unknown[];
} {
  const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
  const placeholders = Object.keys(row).map(() => '?').join(', ');
  return {
    sql: `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
    values: Object.values(row),
  };
}

/**
 * 构建 UPDATE SET 子句
 */
export function buildUpdate(table: string, row: Record<string, unknown>, whereCol: string, whereVal: unknown): {
  sql: string; values: unknown[];
} {
  const setParts = Object.keys(row).map(c => `"${c}" = ?`);
  const values = [...Object.values(row), whereVal];
  return {
    sql: `UPDATE ${table} SET ${setParts.join(', ')} WHERE "${whereCol}" = ?`,
    values,
  };
}

// 打乱占位符:不是真打乱(未知 / 待补),不参与判重。`?` 这类常用于「打乱未知」的复盘,
// 同一选手可合法地有多条占位打乱的复盘(各为不同的把),不能当重复。
const SCRAMBLE_PLACEHOLDERS = new Set(['?', '??', '???', '-', '--', '.', 'n/a', 'na', 'tbd', 'none', 'unknown']);

/** 是否真打乱(够长 + 非占位符)。真打乱才参与「同选手 + 同打乱」判重。 */
export function isRealScramble(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  const t = s.trim().toLowerCase();
  // 真 WCA 打乱总是 ≥ 多个 token;< 5 字符的一律视作占位 / 空
  return t.length >= 5 && !SCRAMBLE_PLACEHOLDERS.has(t);
}

/**
 * 构建「同选手 + 同打乱」去重查询(命中即重复)。
 * 同一打乱所有选手共用,所以选手 + 打乱必须同时相同才算重复(光打乱相同是同组不同人)。
 *   选手 = person_id(优先 WCA ID)否则 person 名;
 *   打乱 = wca_scramble(优先官方打乱)否则 optimal_scramble。
 * 打乱为占位/空(isRealScramble=false)或选手为空 → 无法判重(返回 null,直接放行)。
 * @param excludeId 编辑模式排除自身
 * @returns {sql, params} 查到行即重复,null = 不判重
 */
export function buildDuplicateQuery(
  row: Record<string, unknown>,
  excludeId?: number,
): { sql: string; params: unknown[] } | null {
  const personId = typeof row.person_id === 'string' ? row.person_id.trim() : '';
  const person = typeof row.person === 'string' ? row.person.trim() : '';
  const wcaScramble = typeof row.wca_scramble === 'string' ? row.wca_scramble : '';
  const optScramble = typeof row.optimal_scramble === 'string' ? row.optimal_scramble : '';

  // 打乱:优先官方打乱,占位/空则退回最优打乱;都不是真打乱 → 不判重
  let scrambleCol = '';
  let scrambleVal = '';
  if (isRealScramble(wcaScramble)) { scrambleCol = 'wca_scramble'; scrambleVal = wcaScramble; }
  else if (isRealScramble(optScramble)) { scrambleCol = 'optimal_scramble'; scrambleVal = optScramble; }
  if (!scrambleCol || (!personId && !person)) return null;

  const params: unknown[] = [];
  const personClause = personId ? 'person_id = ?' : 'person = ?';
  params.push(personId || person);
  let sql = `SELECT id FROM recons WHERE ${personClause} AND "${scrambleCol}" = ?`;
  params.push(scrambleVal);
  if (excludeId != null && Number.isFinite(Number(excludeId))) {
    sql += ' AND id != ?';
    params.push(Number(excludeId));
  }
  sql += ' LIMIT 1';
  return { sql, params };
}
