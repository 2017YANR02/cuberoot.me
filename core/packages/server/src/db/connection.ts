import postgres from 'postgres';

// PostgreSQL 连接(porsager/postgres)
// 占位符 ? → $N 在 query() helper 内自动转换,业务 SQL 无需改写。
const sql = postgres({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'recon_user',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'recon_db',
  max: 10,
  idle_timeout: 60,
  // mariadb 之前对 undefined 视同 null,这里对齐
  transform: { undefined: null },
  // DATE 列 (oid 1082) 是无时区的日历日,driver 默认转 JS Date 会染上 UTC midnight
  // 然后 JSON.stringify 又输出 'YYYY-MM-DDT00:00:00.000Z' —— 前端拿到时刻而非日历日。
  // 这里强制 DATE 返原样字符串 'YYYY-MM-DD',跟 WCA 比赛日期当地时间语义一致。
  types: {
    date: {
      to: 1082,
      from: [1082],
      serialize: (x: string) => x,
      parse: (x: string) => x,
    },
  },
});

function rewriteQ(s: string): string {
  let i = 0;
  return s.replace(/\?/g, () => `$${++i}`);
}

/**
 * 与原 mariadb 风格一致的 query helper:接 `?` 占位符,返回纯数据数组。
 * 内部:
 *   1. `?` → `$1, $2, ...`
 *   2. `sql.unsafe(text, params)` 仍走 PG 参数化协议,values 安全。
 */
export async function query<T = unknown>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  // postgres@3 sql.unsafe 接受 ParameterOrJSON<T>[] —— 我们的 helpers 已经把 values 准备好了,
  // 强转 unknown[] 即可。
  const rows = await sql.unsafe(rewriteQ(text), params as unknown as never[]);
  return rows as unknown as T[];
}

/** 健康检查:ping 数据库 */
export async function pingDb(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * 直接拿 tagged-template `sql` 实例,以后想用原生 postgres@3 风格(JSONB 自动
 * 反序列化、tagged template、helpers)的路由可以 import 这个。本期迁移所有
 * 路由仍走 query() 走 sql.unsafe。
 */
export { sql };
