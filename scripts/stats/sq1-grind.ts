/** Resume the bounded SQ1 WCA monster ladder without loading two 13 GiB tables at once. */
import { availableParallelism } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzer, exe, exists, lines, puzzleDir, tableDir } from './common.js';

const dir = join(puzzleDir, 'sq1');
const output = join(dir, 'sq1_wca_exact.csv');
const monsters = join(dir, 'sq1_wca_monsters.csv');
const work = join(dir, '_monster_chunks');

async function unresolved(): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!await exists(output)) return ids;
  for await (const row of lines(output)) {
    const comma = row.indexOf(',');
    if (comma > 0 && row.slice(comma + 1).split(',', 1)[0] === 'M') ids.add(row.slice(0, comma));
  }
  return ids;
}

async function mergeChunks(): Promise<number> {
  if (!await exists(work)) return 0;
  const chunks = (await readdir(work)).filter(name => name.endsWith('_sq1.csv')).sort();
  if (!chunks.length) return 0;
  const solved = new Map<string, string>();
  for (const name of chunks) {
    for await (const row of lines(join(work, name))) {
      const [id, value] = row.split(',', 2);
      if (id && /^\d+$/.test(value ?? '')) solved.set(id, row);
    }
  }
  if (solved.size) {
    const temp = `${output}.tmp`;
    const { createWriteStream } = await import('node:fs');
    const stream = createWriteStream(temp, { encoding: 'utf8' });
    try {
      for await (const row of lines(output)) {
        const comma = row.indexOf(',');
        const id = comma > 0 ? row.slice(0, comma) : '';
        const replacement = id && row.slice(comma + 1).split(',', 1)[0] === 'M' ? solved.get(id) : undefined;
        if (!stream.write(`${replacement ?? row}\n`)) await new Promise<void>(done => stream.once('drain', done));
      }
      await new Promise<void>((done, fail) => { stream.end(done); stream.once('error', fail); });
      await rename(temp, output);
    } catch (error) { stream.destroy(); throw error; }
  }
  for (const name of chunks) await unlink(join(work, name));
  return solved.size;
}

async function todo(): Promise<string[]> {
  const ids = await unresolved();
  if (!ids.size || !await exists(monsters)) return [];
  const rows: string[] = [];
  const seen = new Set<string>();
  for await (const row of lines(monsters)) {
    const comma = row.indexOf(',');
    if (comma < 1) continue;
    const id = row.slice(0, comma);
    if (ids.has(id) && !seen.has(id)) { rows.push(row); seen.add(id); }
  }
  if (rows.length !== ids.size) throw new Error(`SQ1 monster list missing ${ids.size - rows.length} unresolved IDs`);
  return rows;
}

export type GrindOptions = { threads?: number; ttBudget?: number; timeoutSecs?: number; chunkSize?: number; split?: number; ladder?: boolean };
async function ensureNoAnalyzer(): Promise<void> {
  const command = process.platform === 'win32' ? 'tasklist' : 'ps';
  const args = process.platform === 'win32' ? ['/FO', 'CSV', '/NH'] : ['-axo', 'comm='];
  const { stdout } = await promisify(execFile)(command, args, { encoding: 'utf8' });
  if (stdout.split(/\r?\n/).some(line => /(?:^|[\\/",])sq1_analyzer(?:\.exe)?(?:$|[,"\s])/i.test(line.trim())))
    throw new Error('sq1_analyzer is already running; a second 13 GiB SQ1 table could exhaust memory');
}

export async function grindSq1Monsters(options: GrindOptions = {}): Promise<number> {
  await ensureNoAnalyzer();
  if (!await exists(output)) throw new Error(`SQ1 WCA CSV missing: ${output}`);
  if (!await exists(exe('sq1_analyzer'))) throw new Error(`SQ1 analyzer missing: ${exe('sq1_analyzer')}`);
  await mkdir(work, { recursive: true });
  const recovered = await mergeChunks();
  if (recovered) console.log(`[SQ1] 恢复上轮已解 ${recovered} 条`);
  const ladder = options.ladder === false ? [{
    label: '手动', split: options.split ?? 0, budget: options.ttBudget ?? 240_000_000,
    chunkSize: options.chunkSize ?? (options.split ? 1 : 12),
  }] : [
    { label: '常规', split: 0, budget: 240_000_000, chunkSize: 12 },
    { label: '并行', split: 2, budget: 240_000_000, chunkSize: 1 },
    { label: '高 TT', split: 2, budget: 300_000_000, chunkSize: 1 },
  ];
  for (const rung of ladder) {
    const rows = await todo();
    if (!rows.length) break;
    console.log(`[SQ1 ${rung.label}] 难题剩余 ${rows.length} 条`);
    for (const name of await readdir(work)) if (/^mchunk_\d+\.txt$/.test(name)) await unlink(join(work, name));
    const files: string[] = [];
    for (let i = 0; i < rows.length; i += rung.chunkSize) {
      const file = join(work, `mchunk_${String(i / rung.chunkSize).padStart(5, '0')}.txt`);
      await writeFile(file, `${rows.slice(i, i + rung.chunkSize).join('\n')}\n`);
      files.push(file);
    }
    const progress = join(dir, '_monster_progress.log');
    await writeFile(progress, '');
    const env: NodeJS.ProcessEnv = {
      ...process.env, CUBE_TABLE_DIR: tableDir, SQ1_WCA_EXACT: '1', SQ1_WCA_SOLN: '1',
      RAYON_NUM_THREADS: String(options.threads ?? availableParallelism()), SQ1_TT_BUDGET: String(rung.budget),
      ANALYZER_STUCK_SECS: String((options.timeoutSecs ?? 600) > 0 ? (options.timeoutSecs ?? 600) + 120 : 1800),
      ANALYZER_PROGRESS_FILE: progress, ANALYZER_PROGRESS_EVERY: '1',
      ANALYZER_PROGRESS_TOTAL: String(rows.length), ANALYZER_PROGRESS_BASE: '0',
    };
    if ((options.timeoutSecs ?? 600) > 0) env.SQ1_SOLVE_TIMEOUT_SECS = String(options.timeoutSecs ?? 600);
    else delete env.SQ1_SOLVE_TIMEOUT_SECS;
    if (rung.split) env.SQ1_SOLVE_PARALLEL = String(rung.split);
    else delete env.SQ1_SOLVE_PARALLEL;
    let failure: unknown;
    try { await analyzer(exe('sq1_analyzer'), files, join(dir, '_monster_run.err'), env, `SQ1 ${rung.label}`); }
    catch (error) { failure = error; }
    finally { await mergeChunks(); }
    if (failure) throw failure;
  }
  const remaining = (await unresolved()).size;
  console.log(`[SQ1] WCA 难题剩余 ${remaining} 条`);
  return remaining;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (name: string) => { const at = args.indexOf(name); return at < 0 ? undefined : Number(args[at + 1]); };
  const known = new Set(['--threads', '--tt-budget', '--timeout-secs', '--chunk-size', '--split']);
  if (args.length % 2 || args.some((arg, i) => i % 2 === 0 && !known.has(arg))) throw new Error('Unknown or incomplete SQ1 grind option');
  const options = { ladder: false, threads: value('--threads'), ttBudget: value('--tt-budget'),
    timeoutSecs: value('--timeout-secs'), chunkSize: value('--chunk-size'), split: value('--split') };
  if (Object.values(options).some((number) => typeof number === 'number' && (!Number.isInteger(number) || number < 0))) throw new Error('Invalid SQ1 grind numeric option');
  void grindSq1Monsters(options).catch(error => { console.error(error); process.exitCode = 1; });
}
