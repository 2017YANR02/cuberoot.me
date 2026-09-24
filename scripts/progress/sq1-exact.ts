/** Read-only snapshot of the SQ1 exact injection corpus. */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dataRoot = resolve(process.env.CUBEROOT_DATA_ROOT || join(repoRoot, '../scramble'));
const puzzleRoot = resolve(process.env.CUBEROOT_PUZZLE_DATA_DIR || process.env.PUZZLE_DATA_DIR || join(dataRoot, 'puzzle'));
const dir = join(puzzleRoot, 'sq1');
const work = join(dir, '_exact_chunks');
const total = 125_605;
const json = process.argv.includes('--json');
if (process.argv.slice(2).some(arg => arg !== '--json')) throw new Error('Usage: progress:sq1 [--json]');

function rows(file: string): number {
  if (!existsSync(file)) return 0;
  const text = readFileSync(file, 'utf8');
  if (!text) return 0;
  return Math.max(0, text.split(/\r?\n/).length - (text.endsWith('\n') ? 2 : 1));
}
const mainRows = rows(join(dir, 'sq1_wca_exact.csv'));
const chunks = existsSync(work) ? readdirSync(work).filter(name => name.endsWith('_sq1.csv')) : [];
const chunkRows = chunks.reduce((sum, name) => sum + rows(join(work, name)), 0);
const done = mainRows + chunkRows;
let alive = false;
try {
  if (process.platform === 'win32') {
    const output = execFileSync('tasklist', ['/FI', 'IMAGENAME eq sq1_analyzer.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
    alive = output.toLowerCase().includes('sq1_analyzer.exe');
  } else {
    alive = execFileSync('pgrep', ['-x', 'sq1_analyzer'], { encoding: 'utf8' }).trim().length > 0;
  }
} catch { /* no matching process */ }
const snapshot = { done, total, pct: Math.round(done / total * 10_000) / 100, mainRows, chunkRows, chunks: chunks.length, alive };
if (json) console.log(JSON.stringify(snapshot));
else {
  console.log(`SQ1 精确灌注: ${done} / ${total} (${snapshot.pct}%)  [主 ${mainRows} + 块 ${chunkRows} / ${chunks.length} 块]`);
  console.log(`  analyzer ${alive ? '运行中' : '未运行'}`);
}
