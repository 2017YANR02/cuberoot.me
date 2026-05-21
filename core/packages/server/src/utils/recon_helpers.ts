/**
 * Recon 后端工具函数
 * 功能：JSON↔SQL 字段映射、白名单、数据校验、WCA 认证、速率限制
 * NOTE: 1:1 移植自 PHP db.php + index.php 的工具函数
 */
import type { Context } from 'hono';
import jwt from 'jsonwebtoken';
import { ADMIN_WCA_IDS, BANNED_WCA_IDS } from '@cuberoot/shared/admin';
export { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

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
  videoUrl: 'video_url',
};

// NOTE: 反向映射（运行时自动生成）
const FIELD_MAP_SQL_TO_JSON: Record<string, string> = {};
for (const [json, sql] of Object.entries(FIELD_MAP_JSON_TO_SQL)) {
  FIELD_MAP_SQL_TO_JSON[sql] = json;
}

// NOTE: 允许 INSERT/UPDATE 的列白名单（防止前端注入非数据库字段）
const ALLOWED_COLUMNS = new Set([
  'official', 'event', 'method', 'date', 'comp', 'country', 'round',
  'solve_num', 'person', 'person_id', 'raw_time', 'exec_time', 'memo_time',
  'average', 'value', 'regional_single_record', 'regional_average_record',
  'ao_type', 'regional_aoxr_record', 'solution', 'optimal_scramble',
  'wca_scramble', 'caption', 'note', 'stm', 'tps', 'oll', 'pll',
  'oll_short', 'pll_short', 'free_pair', 'y_rot', 'regrip', 'lockup',
  'cross_type', 'cross_stm', 'f2l', 'll', 's_move', 'cross_color',
  'cube', 'reconer', 'reconer_id', 'group_id', 'recon_date', 'created_at',
  'added_by', 'added_by_id', 'comp_wca_id', 'person_country', 'video_url',
  'alternatives',
]);

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

  // NOTE: 类型修正——MariaDB 驱动可能返回字符串
  if (json.official !== undefined) json.official = Boolean(json.official);
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
  // NOTE: 布尔值转换（MySQL TINYINT）
  if (row.official !== undefined) {
    row.official = row.official ? 1 : 0;
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
    country: 100, person: 100, person_id: 20, person_country: 10,
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

  // TEXT 上限 64KB
  for (const col of ['recon', 'solution', 'optimal_scramble', 'wca_scramble', 'caption', 'note', 'video_url']) {
    const v = row[col];
    if (v !== undefined && v !== null && Buffer.byteLength(String(v), 'utf8') > 65535) {
      errors.push(`${col} exceeds max size (64KB)`);
    }
  }

  return errors;
}

// ── WCA 认证 ──

interface WcaUser {
  wcaId: string;
  name: string;
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
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { wcaId: string; name: string };
    if (payload.wcaId) {
      return { wcaId: payload.wcaId, name: payload.name ?? '' };
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
