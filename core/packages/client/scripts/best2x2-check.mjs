#!/usr/bin/env node
// Best 2x2 Algs Google Sheet drift detector (zero dependencies).
//
// Exit: 0 = in sync, 3 = changed, 2 = no baseline, 1 = fetch/parse error.
// --write refreshes the normalized per-sheet snapshots and hash index.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ALL_SHEETS, DOC_URL, fetchSheetCsv, parseCsv } from './best2x2/sheets.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAP_DIR = path.join(HERE, 'best2x2', 'source-snapshot');
const INDEX = path.join(HERE, 'best2x2', 'source.hashes.json');
const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const reportAt = args.indexOf('--report');
const REPORT_PATH = reportAt >= 0 ? args[reportAt + 1] : null;

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const fileOf = (sheet) => `${encodeURIComponent(sheet).replaceAll('%', '_')}.jsonl`;

function normalizedRows(csv) {
  const rows = parseCsv(csv).map((row) => {
    const cells = row.map((cell) => cell.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, ''));
    while (cells.length && cells[cells.length - 1] === '') cells.pop();
    return cells;
  });
  while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
  return rows;
}

const render = (rows) => rows.map((row) => JSON.stringify(row)).join('\n') + '\n';

async function liveSheets() {
  const entries = await Promise.all(ALL_SHEETS.map(async (sheet) => {
    const rows = normalizedRows(await fetchSheetCsv(sheet));
    const text = render(rows);
    return [sheet, { sheet, rows, text, sha: sha(text), file: fileOf(sheet) }];
  }));
  return new Map(entries);
}

function rowChanges(oldText, nextText) {
  const before = oldText.trimEnd().split('\n');
  const after = nextText.trimEnd().split('\n');
  const changed = [];
  for (let i = 0; i < Math.max(before.length, after.length); i++) {
    if (before[i] === after[i]) continue;
    changed.push({ row: i + 1, before: before[i], after: after[i] });
    if (changed.length === 12) break;
  }
  return { before: before.length, after: after.length, changed };
}

function report(live, snap) {
  const changed = [];
  const added = [];
  for (const sheet of ALL_SHEETS) {
    const item = live.get(sheet);
    const old = snap.sheets?.[sheet];
    if (!old) added.push(sheet);
    else if (old.sha !== item.sha) changed.push(sheet);
  }
  const removed = Object.keys(snap.sheets ?? {}).filter((sheet) => !live.has(sheet));
  const drift = changed.length + added.length + removed.length > 0;
  const lines = [
    '# Best 2x2 Algs 表格漂移检测', '',
    `- 数据源: ${DOC_URL}`,
    `- 快照时间: ${snap.fetchedAt ?? '(unknown)'}`,
    `- 检查表页: ${live.size}`, '',
  ];
  if (!drift) {
    lines.push('与仓库快照一致，无需更新。');
    return { drift, text: lines.join('\n') };
  }
  if (changed.length) {
    lines.push(`## 内容变化 (${changed.length})`, '');
    for (const sheet of changed) {
      const item = live.get(sheet);
      const old = snap.sheets[sheet];
      const oldPath = path.join(SNAP_DIR, old.file);
      const diff = rowChanges(fs.existsSync(oldPath) ? fs.readFileSync(oldPath, 'utf8') : '', item.text);
      lines.push(`### ${sheet}`, '', `行数: ${diff.before} → ${diff.after}`, '');
      for (const row of diff.changed) {
        lines.push(`- 第 ${row.row} 行`, `  - 快照: \`${(row.before ?? '(none)').slice(0, 240)}\``, `  - 线上: \`${(row.after ?? '(none)').slice(0, 240)}\``);
      }
      lines.push('');
    }
  }
  if (added.length) lines.push(`## 新增表页\n\n${added.map((s) => `- ${s}`).join('\n')}\n`);
  if (removed.length) lines.push(`## 删除表页\n\n${removed.map((s) => `- ${s}`).join('\n')}\n`);
  lines.push('## 更新步骤', '');
  lines.push('1. 在本地重新抓取并运行 `scripts/best2x2/report.mts`，先处理新出现的异常分支。');
  lines.push('2. 运行 `build-import.mts` 与 SQL 生成器；已经部署过 0104 时必须生成新的迁移编号，不能改旧迁移。');
  lines.push('3. 跑 `verify-import.mts`、`verify-finder.mts`、相关 Vitest 和本地迁移。');
  lines.push('4. 确认无误后运行 `node packages/client/scripts/best2x2-check.mjs --write` 更新快照。');
  return { drift, text: lines.join('\n') };
}

try {
  const live = await liveSheets();
  if (WRITE) {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    const sheets = {};
    for (const [name, item] of live) {
      fs.writeFileSync(path.join(SNAP_DIR, item.file), item.text);
      sheets[name] = { sha: item.sha, rows: item.rows.length, file: item.file };
    }
    fs.writeFileSync(INDEX, JSON.stringify({ source: DOC_URL, fetchedAt: new Date().toISOString(), sheets }, null, 2) + '\n');
    console.log(`[best2x2-check] baseline written: ${live.size} sheets`);
    process.exitCode = 0;
  } else if (!fs.existsSync(INDEX)) {
    console.error('[best2x2-check] no baseline; run with --write');
    process.exitCode = 2;
  } else {
    const snap = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
    const result = report(live, snap);
    console.log(result.text);
    if (REPORT_PATH) fs.writeFileSync(REPORT_PATH, result.text + '\n');
    process.exitCode = result.drift ? 3 : 0;
  }
} catch (error) {
  console.error(`[best2x2-check] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
