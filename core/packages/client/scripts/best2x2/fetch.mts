/**
 * 抓 Best 2x2 Algs 全表 → CSV 落盘。
 *
 *   NODE_USE_ENV_PROXY=1 pnpm -w exec tsx packages/client/scripts/best2x2/fetch.mts [outDir]
 *
 * 默认落在仓库根的 .tmp/best2x2/(gitignored)。漂移检测走同一个抓取层,
 * 见 sheets.mts —— 抓取只此一份,不许第二处再写一个 URL 拼装。
 *
 * ⚠ 本机走代理才能连 Google:Node 的 fetch **不读** HTTPS_PROXY,必须显式
 * `NODE_USE_ENV_PROXY=1`(Node ≥ 24 内建)。GitHub runner 直连,不需要。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_SHEETS, fetchSheetCsv } from './sheets.mjs';

/** 仓库根 = 本文件往上 5 层(scripts/best2x2 → scripts → client → packages → core → repo)。 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const outDir = process.argv[2] ? resolve(process.argv[2]) : resolve(REPO_ROOT, '.tmp/best2x2');

await mkdir(outDir, { recursive: true });

let failed = 0;
for (const sheet of ALL_SHEETS) {
  try {
    const csv = await fetchSheetCsv(sheet);
    const file = resolve(outDir, `${sheet.replace(/[/\\]/g, '_')}.csv`);
    await writeFile(file, csv, 'utf8');
    console.log(`${sheet.padEnd(18)} ${String(csv.length).padStart(7)} B`);
  } catch (err) {
    failed++;
    console.error(`${sheet.padEnd(18)} FAILED  ${(err as Error).message}`);
  }
}

console.log(`\n${ALL_SHEETS.length - failed}/${ALL_SHEETS.length} → ${outDir}`);
process.exit(failed ? 1 : 0);
