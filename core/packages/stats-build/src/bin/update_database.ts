// NOTE: WCA 数据库下载+导入——完全替代 Ruby update_database.rb + init.rb
// CI 用法：npx tsx src/bin/update_database.ts
// 步骤：
//   1. 下载 WCA export zip (~2GB)
//   2. 解压得到 .sql 文件
//   3. 设置 MySQL 高性能参数
//   4. 逐行解析 SQL dump，按表名过滤导入 REQUIRED_TABLES
//   5. 建覆盖索引 + 存储 export timestamp
import { createWriteStream, createReadStream, writeFileSync, statSync, mkdirSync, existsSync, copyFileSync, unlinkSync, openSync, writeSync, closeSync } from 'fs';
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
// 全流式架构：readline 逐行 -> 8MB 写缓冲合并 I/O -> 表切换时导入
// 性能优化（与 Ruby 版对齐）：
//   1. 8MB 写缓冲：将 ~3600 万次 writeSync 合并为几百次，大幅减少 syscall
//   2. 延迟建索引：从 CREATE TABLE 中剥离 KEY 定义，INSERT 完成后再一次性建索引
//      避免每条 INSERT 都维护二级索引，这是 Ruby 版快 10 分钟的主因
// 内存峰值：8MB 写缓冲 + header（几十行）+ CREATE TABLE 块（~20 行），安全可控
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
    let fd: number | null = null;  // NOTE: 同步 fd，closeSync 保证写完再导入
    let lineCount = 0;
    let firstLine = true;
    const importedTables = new Set<string>();

    // --- 写缓冲机制：减少 syscall ---
    const FLUSH_SIZE = 8 * 1024 * 1024;  // 8MB
    let writeBuf = '';

    const bufWrite = (text: string): void => {
      writeBuf += text;
      if (writeBuf.length >= FLUSH_SIZE) {
        writeSync(fd!, Buffer.from(writeBuf));
        writeBuf = '';
      }
    };

    const bufFlush = (): void => {
      if (writeBuf.length > 0) {
        writeSync(fd!, Buffer.from(writeBuf));
        writeBuf = '';
      }
    };

    // --- CREATE TABLE KEY 剥离（与 Ruby gsub! 逻辑一致）---
    // CREATE TABLE 块很小（~20 行），缓冲在内存安全无 OOM 风险
    let inCreateTable = false;
    let createTableLines: string[] = [];
    let deferredIndexes: string[] = [];  // NOTE: 从 CREATE TABLE 中剥离的 KEY -> INSERT 后建索引

    // NOTE: 辅助函数——flush 缓冲 -> 追加延迟索引 + INDICES -> 关闭 fd -> mysql 导入
    const flushAndImport = (tableName: string, count: number) => {
      if (fd === null) return;
      // NOTE: 追加从 CREATE TABLE 剥离的 KEY 索引 + 自定义 INDICES
      const allIndexes = [...deferredIndexes, ...INDICES].join('\n');
      bufWrite('\n' + allIndexes + '\n');
      bufFlush();
      closeSync(fd);
      fd = null;
      deferredIndexes = [];

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

    // NOTE: 辅助函数——为目标表创建同步 fd 并写入 header
    const startTable = (tableName: string): void => {
      const f = join(workDir, `${tableName}.sql`);
      fd = openSync(f, 'w');
      // NOTE: header 包含 charset/encoding 等全局 SET 语句，每张表都需要
      for (const hl of headerLines) {
        writeSync(fd, hl + '\n');
      }
      lineCount = 0;
      writeBuf = '';
      inCreateTable = false;
      createTableLines = [];
      deferredIndexes = [];
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
        } else if (currentTable && fd !== null) {
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
      } else if (currentTable && fd !== null) {
        // NOTE: 目标表行——区分 CREATE TABLE 块和 INSERT 数据行
        if (!inCreateTable && line.startsWith('CREATE TABLE')) {
          // NOTE: 进入 CREATE TABLE 块——缓冲到内存（~20 行，安全）
          inCreateTable = true;
          createTableLines = [line];
        } else if (inCreateTable) {
          createTableLines.push(line);
          // NOTE: CREATE TABLE 闭合行以 ')' 开头（如 `) ENGINE=InnoDB ...;`）
          if (line.startsWith(')')) {
            inCreateTable = false;
            const createSql = createTableLines.join('\n');
            // NOTE: 与 Ruby gsub!(/,\s*KEY (.\w+.) (\([^)]*\))/m) 完全一致
            // 移除 CREATE TABLE 内的 KEY 定义，收集为延迟 CREATE INDEX
            const processed = createSql.replace(
              /,\s*KEY (.\w+.) (\([^)]*\))/g,
              (_match: string, name: string, cols: string) => {
                deferredIndexes.push(`CREATE INDEX ${name} ON ${currentTable} ${cols};`);
                return '';
              },
            );
            bufWrite(processed + '\n');
            createTableLines = [];
          }
        } else {
          // NOTE: INSERT / LOCK / UNLOCK 等数据行——写入缓冲
          bufWrite(line + '\n');
          lineCount++;
        }
      }
      // NOTE: 非目标表行被跳过，不占任何内存
    }

    // NOTE: 文件末尾残留的最后一个表
    if (currentTable && fd !== null) {
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
