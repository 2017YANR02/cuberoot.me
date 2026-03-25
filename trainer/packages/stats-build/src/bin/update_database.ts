// NOTE: WCA 数据库下载+导入——完全替代 Ruby update_database.rb + init.rb
// CI 用法：npx tsx src/bin/update_database.ts
// 步骤：
//   1. 下载 WCA export zip (~2GB)
//   2. 解压得到 .sql 文件
//   3. 设置 MySQL 高性能参数
//   4. 逐行解析 SQL dump，按表名过滤导入 REQUIRED_TABLES
//   5. 建覆盖索引 + 存储 export timestamp
import { createWriteStream, createReadStream, writeFileSync, statSync, mkdirSync, existsSync, copyFileSync } from 'fs';
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
// 与 Ruby 版 1:1 对应：按 "-- Table structure for table `xxx`" 分段
async function importTables(sqlPath: string, workDir: string): Promise<Date> {
  const requiredSet = new Set<string>(REQUIRED_TABLES);
  const mysql = mysqlCmd();
  const db = DB_CONFIG.database;

  // NOTE: 先删除并重建数据库
  execSync(`${mysql} -e "DROP DATABASE IF EXISTS ${db}" 2>&1 | grep -v "Using a password" || true`, { stdio: 'pipe' });
  execSync(`${mysql} -e "CREATE DATABASE ${db}" 2>&1 | grep -v "Using a password" || true`, { stdio: 'pipe' });

  return timedTask(`Importing ${SQL_FILENAME} into ${db}`, async () => {
    const tableSqls = new Map<string, string[]>();
    let header: string[] | null = null;
    let lines: string[] = [];
    let currentTable: string | null = null;
    let firstLine = true;

    const rl = createInterface({
      input: createReadStream(sqlPath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      // NOTE: 跳过 MariaDB 沙盒模式行（与 Ruby file.readline 对应）
      if (firstLine) {
        firstLine = false;
        if (line.includes('enable the sandbox mode')) continue;
      }

      const tableMatch = line.match(/-- Table structure for table `(.*?)`/);

      if (tableMatch) {
        const tableName = tableMatch[1];

        if (header === null) {
          // NOTE: 第一个表之前的内容作为 header（包含 SET、charset 等全局语句）
          header = [...lines];
        } else if (currentTable) {
          tableSqls.set(currentTable, [...lines]);
          currentTable = null;
        }

        if (requiredSet.has(tableName)) {
          currentTable = tableName;
        }

        lines = [];
      }

      lines.push(line);
    }

    // NOTE: 文件末尾残留的最后一个表
    if (currentTable && lines.length > 0) {
      tableSqls.set(currentTable, [...lines]);
    }

    // NOTE: 逐表导入（与 Ruby 版逻辑完全一致）
    for (const tableName of REQUIRED_TABLES) {
      const tableLines = tableSqls.get(tableName);
      if (!tableLines) {
        console.log(`  - WARNING: table ${tableName} not found in dump`);
        continue;
      }

      console.log(`  - Importing table ${tableName}`);
      let tableSql = (header || []).join('\n') + '\n' + tableLines.join('\n');

      // NOTE: 与 Ruby 一致——去掉 CREATE TABLE 中的 KEY 定义，改为 CREATE INDEX
      let indexCreations = '';
      tableSql = tableSql.replace(/,\s*KEY\s+(\S+)\s+(\([^)]*\))/gm, (_match, keyName, keyDef) => {
        indexCreations += `CREATE INDEX ${keyName} ON ${tableName} ${keyDef};\n`;
        return '';
      });
      tableSql += '\n' + indexCreations;
      // NOTE: 追加自定义索引
      tableSql += '\n' + INDICES.join('\n');

      const tableFile = join(workDir, `${tableName}.sql`);
      writeFileSync(tableFile, tableSql, 'utf-8');
      execSync(`${mysql} ${db} < "${tableFile}" 2>&1 | grep -v "Using a password" || true`, {
        stdio: 'pipe',
        maxBuffer: 50 * 1024 * 1024,  // 50MB 缓冲区
      });
    }

    // NOTE: 返回 export 文件的修改时间作为 timestamp
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
