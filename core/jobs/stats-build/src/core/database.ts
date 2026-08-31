// NOTE: MySQL 数据库连接
// 从 database.yml 读取凭据
import mysql from 'mysql2/promise';
import { existsSync, readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// NOTE: database.yml 位于 stats-build/ 包根目录（已在 .gitignore 中排除，含数据库密码）
// NOTE: 路径：src/core → src → stats-build/database.yml
export const CONFIG_PATH = resolve(__dirname, '../../database.yml');

export interface DbConfig {
  database: string;
  username: string;
  password: string;
  host: string;
}

let DB_CONFIG: DbConfig | null = null;

function loadDbConfigFromEnv(): DbConfig | null {
  const host = process.env.MYSQL_HOST;
  const username = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASS;
  const database = process.env.MYSQL_DB;
  if (!host && !username && !password && !database) return null;
  if (!host || !username || !database) {
    throw new Error('MYSQL_* env vars must include MYSQL_HOST MYSQL_USER MYSQL_DB when using env DB config');
  }
  return {
    host,
    username,
    password: password ?? '',
    database,
  };
}

export function getDbConfig(): DbConfig {
  if (DB_CONFIG !== null) return DB_CONFIG;

  const envConfig = loadDbConfigFromEnv();
  if (envConfig) {
    DB_CONFIG = envConfig;
    return DB_CONFIG;
  }

  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `database.yml is missing at ${CONFIG_PATH}; ` +
      'provide MYSQL_* env vars or create database.yml from the template.',
    );
  }

  DB_CONFIG = parseYaml(readFileSync(CONFIG_PATH, 'utf-8'));
  return DB_CONFIG;
}

// NOTE: CI 导入时仅保留这些表;改一处影响整个 stats build / wca_stats_extra build.
// `eligible_country_iso2s_for_championship`(2026-05 加):wca_stats_extra_build 用来
// 判 greater_china 等多国共享 championship 在 grand_slam 中匹配选手国籍.
export const REQUIRED_TABLES = [
  'championships', 'competitions', 'competition_delegates', 'continents',
  'countries', 'eligible_country_iso2s_for_championship',
  'events', 'formats', 'persons', 'preferred_formats',
  'ranks_single', 'ranks_average', 'result_attempts', 'results',
  'round_types', 'scrambles', 'users',
  // gen_all_comps.ts 用:每场每项目 round-1 的 time_limit / cutoff / advancement_condition + qualification
  // （WCIF 形状 JSON）→ comp_round_meta.json。developer dump 自带这两张表。
  'rounds', 'competition_events',
] as const;

// NOTE: 导入后追加的自定义索引
export const INDICES = [
  'CREATE INDEX index_results_on_competition_id_person_id ON results (competition_id, person_id);',
] as const;

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const dbConfig = getDbConfig();
    pool = mysql.createPool({
      host: dbConfig.host,
      user: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database,
      // NOTE: session 初始化
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

// 从 result_attempts 表中获取各次成绩值（逗号分隔）
export const ATTEMPTS_SUBQUERY = '(SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number) FROM result_attempts ra WHERE ra.result_id = result.id)';
