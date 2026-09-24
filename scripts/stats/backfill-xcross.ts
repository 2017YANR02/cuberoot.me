/** Resume one xcross_2_col_10f variant without building or publishing incomplete distributions. */
import { availableParallelism } from 'node:os';
import { appendFile, mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzer, appendData, dataRoot, exe, exists, fileSize, ids, lineCount, lines, tableDir } from './common.js';

const analyzers: Record<string, string> = {
  daisy: 'daisy_analyzer', first_layer: 'first_layer_analyzer', f2leo: 'f2leo_analyzer',
  pseudo_f2leo: 'pseudo_f2leo_analyzer', '222': 'block222_analyzer', roux: 'roux_analyzer',
  '223': 'block223_analyzer', eoline: 'eoline_analyzer', dr: 'dr_analyzer', f2b: 'f2b_analyzer',
};
export type BackfillOptions = { variant?: string; hours?: number; threads?: number; chunkSize?: number; maxChunks?: number; setDir?: string };
export async function backfillXcross(options: BackfillOptions = {}): Promise<void> {
  const variant = options.variant ?? 'pseudo_f2leo';
  const binary = analyzers[variant];
  if (!binary) throw new Error(`Unsupported xcross variant ${variant}`);
  const hours = options.hours ?? 0;
  const threads = options.threads ?? availableParallelism();
  const chunkSize = options.chunkSize ?? 10_000;
  const maxChunks = options.maxChunks ?? 0;
  if (![hours, threads, chunkSize, maxChunks].every(Number.isFinite) || hours < 0 ||
      ![threads, chunkSize, maxChunks].every(Number.isInteger) || threads < 1 || chunkSize < 1 || maxChunks < 0)
    throw new Error('Invalid backfill limits');
  const setDir = resolve(options.setDir ?? process.env.CUBEROOT_XCROSS_DATA_DIR ?? join(dataRoot, 'xcross_2_col_10f'));
  const master = join(setDir, 'scrambles.txt');
  const target = join(setDir, 'stat', `${variant}.csv`);
  const work = join(setDir, '_backfill');
  const log = join(work, `backfill_${variant}.log`);
  if (!await exists(master) || !await exists(exe(binary))) throw new Error(`Missing corpus or analyzer: ${master}, ${exe(binary)}`);
  await mkdir(work, { recursive: true });
  const note = async (message: string) => { console.log(message); await appendFile(log, `[${new Date().toISOString()}] ${message}\n`); };
  const have = await ids(target, true);
  const missing: string[] = [];
  for await (const row of lines(master)) {
    const comma = row.indexOf(',');
    if (comma > 0 && !have.has(row.slice(0, comma))) missing.push(row);
  }
  await note(`${variant}: total ${have.size + missing.length}, done ${have.size}, missing ${missing.length}`);
  const deadline = hours > 0 ? Date.now() + hours * 3_600_000 : Infinity;
  const started = Date.now();
  let done = 0; let chunks = 0;
  for (let i = 0; i < missing.length;) {
    if (Date.now() >= deadline || (maxChunks && chunks >= maxChunks)) break;
    let count = Math.min(chunkSize, missing.length - i);
    if (Number.isFinite(deadline)) {
      const rate = done ? done / ((Date.now() - started) / 1000) : 20;
      count = Math.min(count, Math.floor((deadline - Date.now()) / 1000 * rate));
      if (count < 1) break;
    }
    const input = join(work, `chunk_${variant}.txt`);
    const output = join(work, `chunk_${variant}_${variant}.csv`);
    await writeFile(input, `${missing.slice(i, i + count).join('\n')}\n`);
    if (await exists(output)) await unlink(output);
    await analyzer(exe(binary), [input], join(work, `analyzer_${variant}.log`), {
      ...process.env, CUBE_TABLE_DIR: tableDir, CUBE_ALLOW_HUGE_TABLES: '1', RAYON_NUM_THREADS: String(threads),
    }, variant);
    const got = Math.max(0, await lineCount(output) - 1);
    if (got !== count) throw new Error(`${variant} analyzer returned ${got}/${count} rows`);
    await appendData(target, output, await fileSize(target) > 0);
    await unlink(output);
    i += count; done += count; chunks++;
    await note(`${variant}: ${have.size + done}/${have.size + missing.length}`);
  }
  if (have.size + done !== have.size + missing.length) await note('Partial result saved; do not build distribution until complete');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const val = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  const allowed = new Set(['--variant', '--hours', '--threads', '--chunk-size', '--max-chunks']);
  if (args.some((arg, i) => i % 2 === 0 && !allowed.has(arg)) || args.length % 2) throw new Error('Unknown or incomplete backfill option');
  void backfillXcross({ variant: val('--variant'), hours: val('--hours') === undefined ? undefined : Number(val('--hours')),
    threads: val('--threads') === undefined ? undefined : Number(val('--threads')),
    chunkSize: val('--chunk-size') === undefined ? undefined : Number(val('--chunk-size')),
    maxChunks: val('--max-chunks') === undefined ? undefined : Number(val('--max-chunks')) })
    .catch(error => { console.error(error); process.exitCode = 1; });
}
