import * as mariadb from 'mariadb';

// NOTE: MariaDB 连接池——复用 ECS 现有实例
// 生产环境通过环境变量配置，本地开发通过 .env 文件
const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'trainer',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'trainer_db',
  connectionLimit: 5,
  idleTimeout: 60000,
});

/** 获取连接并执行查询 */
export async function query<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(sql, params);
    // mariadb 驱动返回的 rows 包含 meta 属性，用 spread 提取纯数据
    return Array.isArray(rows) ? [...rows] : rows;
  } finally {
    if (conn) conn.release();
  }
}

/** 健康检查：ping 数据库 */
export async function pingDb(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export { pool };
