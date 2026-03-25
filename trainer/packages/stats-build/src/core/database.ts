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
export const CONFIG_PATH = resolve(__dirname, '../../../../../_stats_build/database.yml');

export interface DbConfig {
  database: string;
  username: string;
  password: string;
  host: string;
}

// NOTE: 导出配置供 update_database.ts 复用
export const DB_CONFIG: DbConfig = parseYaml(readFileSync(CONFIG_PATH, 'utf-8'));

// NOTE: 与 Ruby Database::REQUIRED_TABLES 一致——CI 导入时仅保留这 15 张表
export const REQUIRED_TABLES = [
  'championships', 'competitions', 'competition_delegates', 'continents',
  'countries', 'events', 'formats', 'persons', 'preferred_formats',
  'ranks_single', 'ranks_average', 'result_attempts', 'results',
  'round_types', 'users',
] as const;

// NOTE: 与 Ruby Database::INDICES 一致——导入后追加的自定义索引
export const INDICES = [
  'CREATE INDEX index_results_on_competition_id_person_id ON results (competition_id, person_id);',
] as const;

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_CONFIG.host,
      user: DB_CONFIG.username,
      password: DB_CONFIG.password,
      database: DB_CONFIG.database,
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

// NOTE: 与 Ruby Database::ATTEMPTS_SUBQUERY 对应
// 从 result_attempts 表中获取各次成绩值（逗号分隔）
export const ATTEMPTS_SUBQUERY = '(SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number) FROM result_attempts ra WHERE ra.result_id = result.id)';

