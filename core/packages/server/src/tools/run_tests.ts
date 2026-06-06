/**
 * 批量回归 gen_title.ts —— 移植自退役 Python run_tests.py。
 *
 * 读 test_input.csv,逐行 spawn `node --import tsx gen_title.ts <title> --uploader <up> [--channel-id <id>]`,
 * 提取 info_chs / info_eng 与期望值比对(排名数字随时间漂移,用 /?WR\d+ → WR? 模糊匹配)。
 * 完整输出写 test_output.txt(gitignored)。这是联网整合测试,不进 CI。
 *
 * 跑法(从 core/):pnpm --filter @cuberoot/server exec tsx src/tools/run_tests.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TEST_CSV = join(SCRIPT_DIR, 'test_input.csv');
const GEN_TITLE = join(SCRIPT_DIR, 'gen_title.ts');
const OUTPUT_FILE = join(SCRIPT_DIR, 'test_output.txt');

/** 极简 RFC4180 CSV 解析(支持引号字段含逗号 + "" 转义)。 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c === '\r') {
      /* 跳过 */
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      return obj;
    });
}

function extractInfoLines(output: string): { info_chs?: string; info_eng?: string } {
  const result: { info_chs?: string; info_eng?: string } = {};
  for (const raw of output.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('info_chs:')) result.info_chs = line.slice('info_chs:'.length).trim();
    else if (line.startsWith('info_eng:')) result.info_eng = line.slice('info_eng:'.length).trim();
  }
  return result;
}

function runTest(title: string, uploader: string, channelId = ''): { output: string; info: ReturnType<typeof extractInfoLines> } {
  const args = ['--import', 'tsx', GEN_TITLE, title, '--uploader', uploader];
  if (channelId) args.push('--channel-id', channelId);
  const res = spawnSync(process.execPath, args, {
    encoding: 'utf-8',
    cwd: SCRIPT_DIR,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (res.error) throw res.error; // 启动失败要响,别伪装成内容 FAIL
  const fullOutput = (res.stdout ?? '') + (res.stderr ?? '');
  return { output: fullOutput, info: extractInfoLines(fullOutput) };
}

// 排名数字随时间漂移,归一成 WR? 只验格式不验具体数字(裸 WR28 和 /WR43 都归一)
const normalizeRank = (s: string) => s.replace(/\/?WR\d+/g, 'WR?');

function main(): void {
  const cases = parseCsv(readFileSync(TEST_CSV, 'utf-8'));
  const total = cases.length;
  let passed = 0;
  const lines: string[] = [];

  cases.forEach((c, i) => {
    const title = c.Title ?? '';
    const uploader = c.Uploader ?? '';
    const channelId = (c['Channel ID'] ?? '').trim();
    const expectEng = (c.info_eng ?? '').trim();
    const expectChs = (c.info_chs ?? '').trim();

    lines.push('='.repeat(60));
    lines.push(`Test ${i + 1}/${total}`);
    lines.push(`  Title:    ${title}`);
    lines.push(`  Uploader: ${uploader}`);
    if (channelId) lines.push(`  Channel:  ${channelId}`);
    lines.push('─'.repeat(60));

    process.stdout.write(`[${i + 1}/${total}] ${uploader}: ${title.slice(0, 50)}${title.length > 50 ? '...' : ''}\n`);

    const { output, info } = runTest(title, uploader, channelId);
    lines.push(output);
    lines.push('─'.repeat(60));

    let ok = true;
    const actualEng = info.info_eng ?? '';
    const actualChs = info.info_chs ?? '';

    if (expectEng && normalizeRank(actualEng) !== normalizeRank(expectEng)) {
      lines.push('  FAIL info_eng:');
      lines.push(`    expect: ${expectEng}`);
      lines.push(`    actual: ${actualEng}`);
      ok = false;
    }
    if (expectChs && normalizeRank(actualChs) !== normalizeRank(expectChs)) {
      lines.push('  FAIL info_chs:');
      lines.push(`    expect: ${expectChs}`);
      lines.push(`    actual: ${actualChs}`);
      ok = false;
    }

    if (ok) { lines.push('  ✓ PASS'); passed++; }
    lines.push('');
  });

  lines.push('='.repeat(60));
  lines.push(`Result: ${passed}/${total} passed`);
  if (passed < total) lines.push(`  ${total - passed} FAILED`);

  const outputText = lines.join('\n');
  console.log(outputText);
  writeFileSync(OUTPUT_FILE, outputText + '\n', 'utf-8');
  console.log(`\n完整输出已写入: ${OUTPUT_FILE}`);
  if (passed < total) process.exit(1);
}

main();
