// NOTE: Ruby .md 与 TS .json 自动对比验证脚本
// 解析 Ruby markdown 表格的前 N 行，与 JSON rows 做关键字段抽样对比
// 用法: npx tsx src/bin/validate.ts [stat_id]
//   不传 stat_id 则检查所有有 .md 和 .json 的统计
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// NOTE: ESM 模式下无 __dirname，需手动推导
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATS_DIR = resolve(__dirname, '../../../../../stats');
const DATA_DIR  = resolve(STATS_DIR, 'data');

// NOTE: 对比的前 N 行
const SAMPLE_SIZE = 5;

interface ValidationResult {
  stat: string;
  status: 'MATCH' | 'MISMATCH' | 'SKIP' | 'ERROR';
  details: string;
}

// --- Markdown 表格解析器 ---
// 从 .md 文件中提取 markdown 表格的数据行
// 返回值: string[][] — 每行的单元格文本（已 trim）
function parseMdTables(mdContent: string): { rows: string[][] }[] {
  const lines = mdContent.split('\n');
  const tables: { rows: string[][] }[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // NOTE: 检测 markdown 表格的分隔行（如 | ---: | :--- |）
    if (/^\|[\s\-:]+\|/.test(line) && i > 0) {
      // 分隔行上面是表头，下面是数据
      const rows: string[][] = [];
      let j = i + 1;
      while (j < lines.length) {
        const dataLine = lines[j].trim();
        if (!dataLine.startsWith('|')) break;
        const cells = dataLine.split('|')
          .slice(1, -1)                // 去掉首尾空段
          .map(c => c.trim());
        rows.push(cells);
        j++;
      }
      if (rows.length > 0) tables.push({ rows });
      i = j;
    } else {
      i++;
    }
  }

  return tables;
}

// --- 从 markdown link 中提取显示文本 ---
// [Daniel Vædele Egdal](https://...) → Daniel Vædele Egdal
function stripMdLink(text: string): string {
  return text
    .replace(/\*\*/g, '')           // NOTE: strip bold markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // strip markdown links
    .trim();
}

// --- 从 JSON rows 中提取文本值 ---
function jsonCellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  const s = String(cell);
  // 去掉 markdown bold 标记
  return stripMdLink(s.replace(/\*\*/g, ''));
}

// --- 比较两个表格行 ---
// 比较第一列（数值）和第二列（选手名）的前 N 行
function compareTables(
  mdRows: string[][],
  jsonRows: unknown[][],
  sampleSize: number,
): { match: boolean; details: string } {
  const n = Math.min(sampleSize, mdRows.length, jsonRows.length);

  if (n === 0) {
    if (mdRows.length === 0 && jsonRows.length === 0) {
      return { match: true, details: 'both empty' };
    }
    return { match: false, details: `md has ${mdRows.length} rows, json has ${jsonRows.length} rows` };
  }

  const mismatches: string[] = [];

  for (let i = 0; i < n; i++) {
    const mdCells = mdRows[i].map(stripMdLink);
    const jsonCells = jsonRows[i].map(jsonCellToString);

    // NOTE: 比较第一个非空单元格（通常是数值或排名）
    const mdFirst = mdCells[0] || '';
    const jsonFirst = jsonCells[0] || '';

    // NOTE: 比较第二个单元格（通常是选手名带 link）
    const mdSecond = mdCells.length > 1 ? mdCells[1] : '';
    const jsonSecond = jsonCells.length > 1 ? jsonCells[1] : '';

    // 分别比对
    if (mdFirst !== jsonFirst) {
      mismatches.push(`row${i + 1} col1: md="${mdFirst}" vs json="${jsonFirst}"`);
    }
    if (mdSecond !== jsonSecond) {
      mismatches.push(`row${i + 1} col2: md="${mdSecond}" vs json="${jsonSecond}"`);
    }
  }

  // NOTE: 也检查行数差异
  const rowDiff = Math.abs(mdRows.length - jsonRows.length);
  if (rowDiff > 0) {
    mismatches.push(`row count: md=${mdRows.length} vs json=${jsonRows.length}`);
  }

  if (mismatches.length === 0) {
    return { match: true, details: `${n} rows matched` };
  }
  return { match: false, details: mismatches.join('; ') };
}

// --- 主逻辑 ---
function validateStat(statId: string): ValidationResult {
  const mdPath = resolve(STATS_DIR, `${statId}.md`);
  const jsonPath = resolve(DATA_DIR, `${statId}.json`);

  if (!existsSync(mdPath)) {
    return { stat: statId, status: 'SKIP', details: 'no .md file' };
  }
  if (!existsSync(jsonPath)) {
    return { stat: statId, status: 'SKIP', details: 'no .json file' };
  }

  try {
    const mdContent = readFileSync(mdPath, 'utf-8');
    const jsonContent = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    const mdTables = parseMdTables(mdContent);

    if (mdTables.length === 0) {
      return { stat: statId, status: 'SKIP', details: 'no markdown tables found in .md' };
    }

    // NOTE: 对于简单统计（无 sections / panels），md 只有一个表格，json 有 rows
    // 对于 grouped 统计，md 有多个表格（按 section），json 有 sections[].rows
    // 对于 panel 统计（panels + metricPanels），结构更复杂——跳过深层对比

    if (jsonContent.metricPanels) {
      // NOTE: metricPanels 类型的统计结构太复杂，仅检查 panels 非空
      const totalPanels = jsonContent.metricPanels.length;
      const hasSections = jsonContent.metricPanels.some((mp: Record<string, unknown>) =>
        Array.isArray(mp.panels) && mp.panels.length > 0
      );
      if (totalPanels > 0 && hasSections) {
        return { stat: statId, status: 'MATCH', details: `${totalPanels} metricPanels with data (structure only)` };
      }
      return { stat: statId, status: 'MISMATCH', details: `metricPanels empty or no sections` };
    }

    if (jsonContent.panels) {
      // NOTE: panels 类型——从第一个 panel 的 sections 中取数据对比
      const panel = jsonContent.panels[0];
      if (!panel || !panel.sections || panel.sections.length === 0) {
        return { stat: statId, status: 'MISMATCH', details: 'panels[0] has no sections' };
      }

      // 按 section 逐个对比
      let matchCount = 0;
      let mismatchDetails: string[] = [];

      for (let si = 0; si < Math.min(panel.sections.length, mdTables.length); si++) {
        const section = panel.sections[si];
        const mdTable = mdTables[si];
        if (!section.rows || section.rows.length === 0) continue;

        const result = compareTables(mdTable.rows, section.rows, SAMPLE_SIZE);
        if (result.match) matchCount++;
        else mismatchDetails.push(`section[${si}] "${section.title}": ${result.details}`);
      }

      if (mismatchDetails.length === 0) {
        return { stat: statId, status: 'MATCH', details: `${matchCount} sections matched` };
      }
      return { stat: statId, status: 'MISMATCH', details: mismatchDetails.join('; ') };
    }

    if (jsonContent.sections) {
      // NOTE: grouped 统计——逐 section 对比
      let matchCount = 0;
      let mismatchDetails: string[] = [];

      for (let si = 0; si < Math.min(jsonContent.sections.length, mdTables.length); si++) {
        const section = jsonContent.sections[si];
        const mdTable = mdTables[si];
        if (!section.rows || section.rows.length === 0) continue;

        const result = compareTables(mdTable.rows, section.rows, SAMPLE_SIZE);
        if (result.match) matchCount++;
        else mismatchDetails.push(`section[${si}] "${section.title}": ${result.details}`);
      }

      if (mismatchDetails.length === 0) {
        return { stat: statId, status: 'MATCH', details: `${matchCount} sections matched` };
      }
      return { stat: statId, status: 'MISMATCH', details: mismatchDetails.join('; ') };
    }

    if (jsonContent.rows) {
      // NOTE: 简单统计——单表格对比
      const result = compareTables(mdTables[0].rows, jsonContent.rows, SAMPLE_SIZE);
      return {
        stat: statId,
        status: result.match ? 'MATCH' : 'MISMATCH',
        details: result.details,
      };
    }

    return { stat: statId, status: 'SKIP', details: 'unknown json structure' };

  } catch (err) {
    return { stat: statId, status: 'ERROR', details: String(err).slice(0, 200) };
  }
}

// --- 入口 ---
function main() {
  const targetStat = process.argv[2];

  let statIds: string[];

  if (targetStat) {
    statIds = [targetStat];
  } else {
    // 取所有同时有 .md 和 .json 的统计
    const mdFiles = readdirSync(STATS_DIR).filter(f => f.endsWith('.md') && f !== 'index.md');
    statIds = mdFiles.map(f => f.replace('.md', '')).sort();
  }

  console.log(`\n=== WCA Stats Validation ===`);
  console.log(`Comparing ${statIds.length} stats\n`);

  const results: ValidationResult[] = [];

  for (const statId of statIds) {
    const r = validateStat(statId);
    results.push(r);

    const icon = r.status === 'MATCH' ? '✅' :
                 r.status === 'SKIP'  ? '⏭️' :
                 r.status === 'ERROR' ? '💥' : '❌';
    console.log(`${icon} ${r.stat}: ${r.details}`);
  }

  // 汇总
  const match = results.filter(r => r.status === 'MATCH').length;
  const mismatch = results.filter(r => r.status === 'MISMATCH').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  const err = results.filter(r => r.status === 'ERROR').length;

  console.log(`\n=== Summary ===`);
  console.log(`Match:    ${match}`);
  console.log(`Mismatch: ${mismatch}`);
  console.log(`Skip:     ${skip}`);
  console.log(`Error:    ${err}`);

  if (mismatch > 0) {
    console.log(`\n--- Mismatches ---`);
    results.filter(r => r.status === 'MISMATCH').forEach(r => {
      console.log(`  ❌ ${r.stat}: ${r.details}`);
    });
  }

  // 写入验证报告
  const reportPath = resolve(STATS_DIR, 'data', 'validation_report.txt');
  const report = results.map(r => `[${r.status}] ${r.stat}: ${r.details}`).join('\n');
  writeFileSync(reportPath, report, 'utf-8');
  console.log(`\nReport: ${reportPath}`);
}

main();
