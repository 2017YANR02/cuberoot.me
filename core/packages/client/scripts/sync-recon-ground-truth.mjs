import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(SCRIPT_DIR, '..');
const WORKBOOK_PATH = resolve(CLIENT_ROOT, 'tests/fixtures/recon-ground-truth.xlsx');
const SNAPSHOT_PATH = resolve(CLIENT_ROOT, 'tests/fixtures/recon-ground-truth.json');
const REQUIRED_HEADERS = ['打乱和解法来源', '链接', '打乱+真实解法'];

function text(value) {
  return value === null || value === undefined ? '' : String(value).replace(/\r\n?/g, '\n').trim();
}

function rowError(rowNumber, message) {
  throw new Error(`recon-ground-truth.xlsx 第 ${rowNumber} 行：${message}`);
}

export function readWorkbookFixtures() {
  if (!existsSync(WORKBOOK_PATH)) throw new Error(`缺少工作簿：${WORKBOOK_PATH}`);
  const workbook = XLSX.read(readFileSync(WORKBOOK_PATH), { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('recon-ground-truth.xlsx 没有工作表');

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    raw: false,
    defval: '',
  });
  const headers = (rows[0] ?? []).map(text);
  for (let column = 0; column < REQUIRED_HEADERS.length; column += 1) {
    if (headers[column] !== REQUIRED_HEADERS[column]) {
      throw new Error(
        `recon-ground-truth.xlsx 第 ${column + 1} 列表头应为“${REQUIRED_HEADERS[column]}”，当前为“${headers[column] ?? ''}”`,
      );
    }
  }

  const fixtures = [];
  const ids = new Set();
  for (let index = 1; index < rows.length; index += 1) {
    const rowNumber = index + 1;
    const cells = rows[index].map(text);
    if (cells.every((cell) => cell === '')) continue;

    const [source, replayUrl, truth, currentWrong = '', note = ''] = cells;
    if (!source) rowError(rowNumber, 'A 列“打乱和解法来源”不能为空');
    if (!replayUrl) rowError(rowNumber, 'B 列“链接”不能为空');
    if (!truth) rowError(rowNumber, 'C 列“打乱+真实解法”不能为空');

    const idMatch = /\/recon\/(\d+)(?:[/?#]|$)/.exec(source);
    if (!idMatch) rowError(rowNumber, 'A 列必须包含 /recon/<数字 ID>');
    const id = idMatch[1];
    if (ids.has(id)) rowError(rowNumber, `复盘 ID ${id} 重复`);

    let replay;
    try {
      replay = new URL(replayUrl).searchParams.get('replay')?.trim();
    } catch {
      rowError(rowNumber, 'B 列不是有效 URL');
    }
    if (!replay) rowError(rowNumber, 'B 列 URL 缺少 replay 参数');

    ids.add(id);
    fixtures.push({ id, source, replay, truth, currentWrong, note });
  }
  if (fixtures.length === 0) throw new Error('recon-ground-truth.xlsx 没有有效复盘行');
  return fixtures;
}

export function serializedSnapshot() {
  return `${JSON.stringify({ version: 1, fixtures: readWorkbookFixtures() }, null, 2)}\n`;
}

function main() {
  const mode = process.argv[2] ?? 'sync';
  const expected = serializedSnapshot();
  const current = existsSync(SNAPSHOT_PATH) ? readFileSync(SNAPSHOT_PATH, 'utf8') : '';

  if (mode === 'check') {
    if (current !== expected) {
      process.stderr.write('recon-ground-truth.json 与 Excel 不一致；运行 test:recon-ground-truth 自动同步。\n');
      return 1;
    }
    return 0;
  }
  if (mode !== 'sync') {
    process.stderr.write(`未知模式：${mode}\n`);
    return 2;
  }

  if (current !== expected) writeFileSync(SNAPSHOT_PATH, expected, 'utf8');
  const count = JSON.parse(expected).fixtures.length;
  process.stdout.write(`Ground-truth Excel synced: ${count} fixtures\n`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
