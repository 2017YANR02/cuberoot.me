// NOTE: WCA 数据库下载+导入——完全替代 Ruby update_database.rb + init.rb
// CI 用法：npx tsx src/bin/update_database.ts
// 步骤：
//   1. 下载 WCA export zip (~2GB)
//   2. 解压得到 .sql 文件
//   3. 设置 MySQL 高性能参数
//   4. 逐行解析 SQL dump，按表名过滤导入 REQUIRED_TABLES
//   5. 建覆盖索引 + 存储 export timestamp
import { createWriteStream, createReadStream, writeFileSync, statSync, mkdirSync, existsSync, copyFileSync, unlinkSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { pipeline } from 'stream/promises';
import { tmpdir } from 'os';
import { DB_CONFIG, REQUIRED_TABLES, INDICES } from '../core/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXPORT_URL = 'https://www.worldcubeassociation.org/wst/wca-developer-database-dump.zip';
const ZIP_FILENAME = 'wca-developer-database-dump.zip';
const SQL_FILENAME = 'wca-developer-database-dump.sql';

// NOTE: MySQL CLI 命令（与 Ruby 版一致，密码通过命令行传递）
function mysqlCmd(): string {
  const parts = ['mysql', `--user=${DB_CONFIG.username}`];
  if (DB_CONFIG.password) parts.push(`--password=${DB_CONFIG.password}`);
  if (DB_CONFIG.host && DB_CONFIG.host !== 'localhost') parts.push(`--host=${DB_CONFIG.host}`);
  return parts.join(' ');
}

// NOTE: 计时辅助函数——与 Ruby Helpers.timed_task 等价
async function timedTask<T>(message: string, fn: () => T | Promise<T>): Promise<T> {
  console.log(message);
  const start = Date.now();
  const result = await fn();
  const elapsed = (Date.now() - start) / 1000;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  if (minutes > 0) {
    console.log(`Took ${minutes} minutes and ${seconds.toFixed(2)} seconds`);
  } else {
    console.log(`Took ${seconds.toFixed(2)} seconds`);
  }
  return result;
}

// NOTE: 步骤 1——下载 WCA export zip
async function downloadExport(destPath: string): Promise<void> {
  await timedTask(`Downloading ${EXPORT_URL}`, async () => {
    const response = await fetch(EXPORT_URL);
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }
    // NOTE: 流式写入——2GB 文件不缓冲到内存
    const fileStream = createWriteStream(destPath);
    await pipeline(response.body!, fileStream);
    const size = statSync(destPath).size;
    console.log(`  Downloaded ${(size / 1024 / 1024).toFixed(0)} MB`);
  });
}

// NOTE: 步骤 2——解压（ubuntu CI 自带 unzip）
async function unzipExport(zipPath: string, destDir: string): Promise<void> {
  await timedTask(`Unzipping ${ZIP_FILENAME}`, () => {
    execSync(`unzip -o "${zipPath}"`, { cwd: destDir, stdio: 'pipe' });
  });
}

// NOTE: 步骤 3——设置 MySQL 高性能参数（与 Ruby 版完全一致）
async function setMysqlPerformanceParams(): Promise<void> {
  await timedTask('Setting MySQL performance parameters', () => {
    const mysql = mysqlCmd();
    const params = [
      'SET GLOBAL innodb_flush_log_at_trx_commit = 0',
      'SET GLOBAL innodb_buffer_pool_size = 2147483648',   // 2GB（CI runner 7GB RAM）
      'SET GLOBAL innodb_log_buffer_size = 268435456',     // 256MB
      'SET GLOBAL innodb_io_capacity = 10000',
      'SET GLOBAL innodb_io_capacity_max = 20000',
    ];
    for (const sql of params) {
      execSync(`${mysql} -e "${sql}" 2>&1 | grep -v "Using a password" || true`, { stdio: 'pipe' });
    }
    // NOTE: DISABLE REDO_LOG 大幅加速批量写入（崩溃时需重新导入，CI 可接受）
    execSync(`${mysql} -e "ALTER INSTANCE DISABLE INNODB REDO_LOG" 2>&1 | grep -v "Using a password" || true`, {
      stdio: 'pipe',
    });
  });
}

// NOTE: 步骤 4——逐行解析 SQL dump，按表名过滤导入
// 全流式架构：readline 逐行 → WriteStream 直接写磁盘 → 表切换时导入
// 内存峰值仅为当前行 + header（几十行），无论表多大都不会 OOM
async function importTables(sqlPath: string, workDir: string): Promise<Date> {
  const requiredSet = new Set<string>(REQUIRED_TABLES);
  const mysql = mysqlCmd();
  const db = DB_CONFIG.database;

  // NOTE: 先删除并重建数据库
  execSync(`${mysql} -e "DROP DATABASE IF EXISTS ${db}" 2>&1 | grep -v "Using a password" || true`, { stdio: 'pipe' });
  execSync(`${mysql} -e "CREATE DATABASE ${db}" 2>&1 | grep -v "Using a password" || true`, { stdio: 'pipe' });

  return timedTask(`Importing ${SQL_FILENAME} into ${db}`, async () => {
    let headerLines: string[] = [];  // NOTE: 第一个表之前的 SQL（SET 语句等），通常几十行
    let headerBuilt = false;
    let currentTable: string | null = null;
    let ws: ReturnType<typeof createWriteStream> | null = null;
    let lineCount = 0;
    let firstLine = true;
    const importedTables = new Set<string>();

    // NOTE: 辅助函数——关闭 WriteStream，追加 INDICES，执行 mysql 导入
    const flushAndImport = (tableName: string, count: number) => {
      if (!ws) return;
      // NOTE: 追加自定义索引语句
      ws.write('\n' + INDICES.join('\n') + '\n');
      ws.end();
      ws = null;

      console.log(`  - Importing table ${tableName} (${count} lines)`);
      const f = join(workDir, `${tableName}.sql`);
      execSync(`${mysql} ${db} < "${f}" 2>&1 | grep -v "Using a password" || true`, {
        stdio: 'pipe',
        maxBuffer: 50 * 1024 * 1024,
      });
      // NOTE: 导入后删除临时文件释放磁盘
      try { unlinkSync(f); } catch { /* ignore */ }
      importedTables.add(tableName);
    };

    // NOTE: 辅助函数——为目标表创建新的 WriteStream 并写入 header
    const startTable = (tableName: string): void => {
      const f = join(workDir, `${tableName}.sql`);
      ws = createWriteStream(f, { encoding: 'utf-8' });
      // NOTE: header 包含 charset/encoding 等全局 SET 语句，每张表都需要
      for (const hl of headerLines) {
        ws.write(hl + '\n');
      }
      lineCount = 0;
    };

    const rl = createInterface({
      input: createReadStream(sqlPath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (firstLine) {
        firstLine = false;
        if (line.includes('enable the sandbox mode')) continue;
      }

      const tableMatch = line.match(/-- Table structure for table `(.*?)`/);

      if (tableMatch) {
        const tableName = tableMatch[1];

        if (!headerBuilt) {
          // NOTE: 第一个表之前的内容作为 header（与 Ruby L68-69 对应）
          headerBuilt = true;
        } else if (currentTable && ws) {
          // NOTE: 上一张目标表结束——立即 flush 并导入
          flushAndImport(currentTable, lineCount);
        }

        if (requiredSet.has(tableName)) {
          currentTable = tableName;
          startTable(tableName);
        } else {
          currentTable = null;
        }
        continue;
      }

      if (!headerBuilt) {
        // NOTE: header 阶段——收集全局 SQL 语句
        headerLines.push(line);
      } else if (currentTable && ws) {
        // NOTE: 目标表行——直接写入 WriteStream，不存内存
        ws!.write(line + '\n');
        lineCount++;
      }
      // NOTE: 非目标表行被跳过，不占任何内存
    }

    // NOTE: 文件末尾残留的最后一个表
    if (currentTable && ws) {
      flushAndImport(currentTable, lineCount);
    }

    // NOTE: 释放 header（已不再需要）
    headerLines = [];

    for (const t of REQUIRED_TABLES) {
      if (!importedTables.has(t)) {
        console.log(`  - WARNING: table ${t} not found in dump`);
      }
    }

    return statSync(sqlPath).mtime;
  });
}

// NOTE: 步骤 5——建覆盖索引 + 存储 metadata
async function postImport(exportTimestamp: Date): Promise<void> {
  const mysql = mysqlCmd();
  const db = DB_CONFIG.database;

  await timedTask('Creating covering index on result_attempts', () => {
    execSync(
      `${mysql} ${db} -e "CREATE INDEX idx_ra_covering ON result_attempts(result_id, attempt_number, value)" 2>&1 | grep -v "Using a password" || true`,
      { stdio: 'pipe' },
    );
  });

  // NOTE: 存储 export timestamp（与 Ruby 版一致）
  const ts = exportTimestamp.toISOString();
  const metaSql = `CREATE TABLE wca_statistics_metadata (field varchar(255), value varchar(255)); INSERT INTO wca_statistics_metadata (field, value) VALUES ('export_timestamp', '${ts}')`;
  execSync(`${mysql} ${db} -e "${metaSql}" 2>&1 | grep -v "Using a password" || true`, { stdio: 'pipe' });
}

async function main() {
  // NOTE: 替代 init.rb——确保 database.yml 存在
  const repoRoot = resolve(__dirname, '../../../../..');
  const statsDir = resolve(repoRoot, '_stats_build');
  const templatePath = resolve(statsDir, 'bin/templates/database.yml');
  const configDest = resolve(statsDir, 'database.yml');
  if (existsSync(templatePath) && !existsSync(configDest)) {
    copyFileSync(templatePath, configDest);
    console.log(`Copied database.yml template to ${configDest}`);
  }

  // NOTE: 在临时目录中操作（与 Ruby Dir.mktmpdir 一致）
  const workDir = resolve(tmpdir(), `wca-stats-import-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  console.log(`Working directory: ${workDir}`);

  try {
    const zipPath = join(workDir, ZIP_FILENAME);
    const sqlPath = join(workDir, SQL_FILENAME);

    await downloadExport(zipPath);
    await unzipExport(zipPath, workDir);
    await setMysqlPerformanceParams();
    const exportTimestamp = await importTables(sqlPath, workDir);
    await postImport(exportTimestamp);

    console.log('\nDatabase update complete.');
  } finally {
    // NOTE: 清理临时目录
    try {
      execSync(`rm -rf "${workDir}"`, { stdio: 'pipe' });
    } catch {
      console.warn(`Warning: failed to clean up ${workDir}`);
    }
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
