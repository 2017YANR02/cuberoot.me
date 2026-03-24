// NOTE: MySQL 数据库连接
// 从 _stats_build/database.yml 读取凭据，与 Ruby 管线共用同一配置
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// NOTE: database.yml 位于 _stats_build/ 目录（与 Ruby 共用）
// NOTE: 路径：src/core → src → stats-build → packages → trainer → repo root
const CONFIG_PATH = resolve(__dirname, '../../../../../_stats_build/database.yml');

interface DbConfig {
  database: string;
  username: string;
  password: string;
  host: string;
}

const config: DbConfig = parseYaml(readFileSync(CONFIG_PATH, 'utf-8'));

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.host,
      user: config.username,
      password: config.password,
      database: config.database,
      // NOTE: 与 Ruby 版一致的 session 初始化
      connectionLimit: 4,
      multipleStatements: false,
    });
  }
  return pool;
}

// NOTE: 执行 SQL 查询，返回行数组
export async function query<T extends mysql.RowDataPacket[]>(sql: string): Promise<T> {
  const p = getPool();
  const [rows] = await p.query<T>(sql);
  return rows;
}

// NOTE: 关闭连接池
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
