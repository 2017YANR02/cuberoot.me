import { availableParallelism } from 'node:os';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzer, appendData, appendUniqueById, exe, exists, ids, lineCount, lines, puzzleDir, tableDir } from './common.js';

const dir = join(puzzleDir, 'sq1');
const source = join(dir, 'scrambles.txt');
const output = join(dir, 'sq1_wca_exact.csv');
const monsters = join(dir, 'sq1_wca_monsters.csv');
const work = join(dir, '_exact_chunks');
const log = join(dir, '_exact_run.err');

async function chunks(): Promise<string[]> {
  if (!await exists(work)) return [];
  return (await readdir(work)).filter(name => name.endsWith('_sq1.csv')).sort().map(name => join(work, name));
}
async function ingest(): Promise<number> {
  const files = await chunks();
  let added = 0;
  for (const file of files) {
    added += await appendUniqueById(output, file, true, true);
    await unlink(file);
  }
  if (added) console.log(`[SQ1 WCA] 保存 ${added} 条已完成结果`);
  return added;
}
async function updateMonsters(): Promise<number> {
  if (!await exists(output)) return 0;
  const unresolved = new Set<string>();
  let first = true;
  for await (const row of lines(output)) {
    if (first) { first = false; continue; }
    const comma = row.indexOf(',');
    if (comma > 0 && row.slice(comma + 1).startsWith('M')) unresolved.add(row.slice(0, comma));
  }
  if (!unresolved.size) return 0;
  const known = await ids(monsters);
  const missing = new Set([...unresolved].filter(id => !known.has(id)));
  if (!missing.size) return unresolved.size;
  const rows: string[] = [];
  for await (const row of lines(source)) {
    const comma = row.indexOf(',');
    if (comma > 0 && missing.has(row.slice(0, comma))) rows.push(row);
  }
  if (rows.length) {
    const scratch = await writeScratch(rows);
    try { await appendData(monsters, scratch, false); }
    finally { await unlink(scratch); }
  }
  return unresolved.size;
}
async function writeScratch(rows: string[]): Promise<string> {
  const file = join(work, '_new_monsters.txt');
  await writeFile(file, `${rows.join('\n')}\n`);
  return file;
}

export type WcaOptions = { chunkSize?: number; threads?: number; buildOnly?: boolean };
export async function runSq1Wca(options: WcaOptions = {}): Promise<void> {
  const chunkSize = options.chunkSize ?? 500;
  if (chunkSize < 1) throw new Error('SQ1 chunk size must be positive');
  await mkdir(work, { recursive: true });
  if (!await exists(exe('sq1_analyzer'))) throw new Error(`Missing ${exe('sq1_analyzer')}`);
  if (!await exists(source)) throw new Error(`Missing SQ1 corpus: ${source}`);
  await ingest();
  await updateMonsters();
  if (options.buildOnly) return;
  const done = await ids(output, true);
  const todo: string[] = [];
  let total = 0;
  for await (const row of lines(source)) {
    if (!row) continue;
    total++;
    const comma = row.indexOf(',');
    if (comma > 0 && !done.has(row.slice(0, comma))) todo.push(row);
  }
  console.log(`[SQ1 WCA] 已处理 ${done.size}/${total}，本次待解 ${todo.length}`);
  if (!todo.length) {
    const rows = Math.max(0, (await lineCount(output)) - 1);
    if (rows !== total || done.size !== total) throw new Error(`SQ1 WCA result is incomplete or duplicated: rows=${rows}, unique=${done.size}, expected=${total}`);
    return;
  }
  for (const name of await readdir(work)) {
    if (/^chunk_\d+\.txt$/.test(name)) await unlink(join(work, name));
  }
  const inputFiles: string[] = [];
  for (let i = 0; i < todo.length; i += chunkSize) {
    const file = join(work, `chunk_${String(i / chunkSize).padStart(5, '0')}.txt`);
    await writeFile(file, `${todo.slice(i, i + chunkSize).join('\n')}\n`);
    inputFiles.push(file);
  }
  const progress = join(dir, '_exact_progress.log');
  await writeFile(progress, '');
  const env = {
    ...process.env,
    CUBE_TABLE_DIR: tableDir,
    SQ1_WCA_EXACT: '1', SQ1_WCA_SOLN: '1',
    RAYON_NUM_THREADS: String(options.threads ?? availableParallelism()),
    ANALYZER_PROGRESS_FILE: progress, ANALYZER_PROGRESS_EVERY: '10',
    ANALYZER_PROGRESS_TOTAL: String(total), ANALYZER_PROGRESS_BASE: String(done.size),
    SQ1_SOLVE_TIMEOUT_SECS: '60', ANALYZER_STUCK_SECS: '120',
  };
  let failed: unknown;
  try { await analyzer(exe('sq1_analyzer'), inputFiles, log, env, 'SQ1 WCA'); }
  catch (error) { failed = error; }
  finally { await ingest(); await updateMonsters(); }
  if (failed) throw failed;
  const rows = Math.max(0, (await lineCount(output)) - 1);
  const unique = (await ids(output, true)).size;
  if (rows !== total || unique !== total) throw new Error(`SQ1 WCA result is incomplete or duplicated: rows=${rows}, unique=${unique}, expected=${total}`);
  console.log(`[SQ1 WCA] 完成 ${rows}/${total}`);
}
