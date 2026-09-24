import { availableParallelism } from 'node:os';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzer, appendData, exe, exists, fileSize, ids, jobDir, lineCount, lines, puzzleDir, runNode, runPnpm, runTs, tableDir, tsx, wcaDir } from './common.js';
import { grindSq1Monsters } from './sq1-grind.js';
import { runSq1Wca } from './sq1-wca.js';
import { runSq1Slash } from './sq1-slash.js';

type Puzzle = '222' | 'pyraminx' | 'skewb' | 'clock' | 'sq1';
const defaultPuzzles: Puzzle[] = ['222', 'pyraminx', 'skewb', 'clock', 'sq1'];
const registered = {
  '222': { event: '222', binary: 'cube222_analyzer' },
  pyraminx: { event: 'pyram', binary: 'pyraminx_analyzer' },
  skewb: { event: 'skewb', binary: 'skewb_analyzer' },
  clock: { event: 'clock', binary: '' },
} as const;

async function ensureTsv(): Promise<string> {
  const tsv = join(wcaDir, 'incremental', 'tsv', 'Scrambles.tsv');
  if (await exists(tsv)) return tsv;
  const cache = join(wcaDir, 'incremental', 'cache');
  if (!await exists(cache)) throw new Error(`Missing Scrambles.tsv and WCA export cache: ${tsv}`);
  const zip = (await readdir(cache)).filter(name => /^WCA_export_.*\.tsv\.zip$/.test(name)).sort().at(-1);
  if (!zip) throw new Error(`Missing Scrambles.tsv and WCA export ZIP in ${cache}`);
  const archive = join(cache, zip);
  const { spawn } = await import('node:child_process');
  const list = spawn('tar', ['-tf', archive], { stdio: ['ignore', 'pipe', 'inherit'] });
  let output = '';
  for await (const chunk of list.stdout) output += chunk.toString('utf8');
  const code = await new Promise<number>((done, fail) => { list.on('error', fail); list.on('close', value => done(value ?? 1)); });
  if (code !== 0) throw new Error(`Cannot list ${archive}`);
  const entry = output.split(/\r?\n/).find(name => /scrambles.*\.tsv$/i.test(name));
  if (!entry) throw new Error(`Scrambles TSV entry missing in ${archive}`);
  await mkdir(join(wcaDir, 'incremental', 'tsv'), { recursive: true });
  const child = spawn('tar', ['-xOf', archive, entry], { stdio: ['ignore', 'pipe', 'inherit'] });
  const { createWriteStream } = await import('node:fs');
  const { pipeline } = await import('node:stream/promises');
  await pipeline(child.stdout, createWriteStream(`${tsv}.tmp`));
  const extractCode = await new Promise<number>((done, fail) => { child.on('error', fail); child.on('close', value => done(value ?? 1)); });
  if (extractCode !== 0) throw new Error(`Cannot extract ${entry}`);
  const { rename } = await import('node:fs/promises');
  await rename(`${tsv}.tmp`, tsv);
  return tsv;
}
async function extractCorpus(selected: Puzzle[], maxNew = 0): Promise<Map<Puzzle, number>> {
  const tsv = await ensureTsv();
  const specs = selected.map(key => ({ key, event: key === 'sq1' ? 'sq1' : registered[key].event, file: join(puzzleDir, key, 'scrambles.txt') }));
  const known = new Map<Puzzle, Set<string>>();
  const pending = new Map<Puzzle, string[]>();
  for (const spec of specs) {
    await mkdir(join(puzzleDir, spec.key), { recursive: true });
    known.set(spec.key, await ids(spec.file));
    pending.set(spec.key, []);
  }
  let columns: Record<string, number> | undefined;
  for await (const row of lines(tsv)) {
    const cells = row.split('\t');
    if (!columns) {
      columns = Object.fromEntries(cells.map((name, index) => [name, index]));
      if (['id', 'scramble', 'event_id'].some(name => columns![name] === undefined)) throw new Error(`Scrambles.tsv missing columns: ${row}`);
      continue;
    }
    for (const spec of specs) {
      if (cells[columns.event_id] !== spec.event) continue;
      const id = cells[columns.id];
      const list = pending.get(spec.key)!;
      if (!id || known.get(spec.key)!.has(id) || (maxNew && list.length >= maxNew)) continue;
      list.push(`${id},${(cells[columns.scramble] ?? '').trim()}`);
      known.get(spec.key)!.add(id);
    }
  }
  const counts = new Map<Puzzle, number>();
  for (const spec of specs) {
    const rows = pending.get(spec.key)!;
    counts.set(spec.key, rows.length);
    if (rows.length) {
      const temp = join(puzzleDir, spec.key, '_new_scrambles.txt');
      await writeFile(temp, `${rows.join('\n')}\n`);
      await appendData(spec.file, temp, false);
      await unlink(temp);
    }
    console.log(`[${spec.key}] 新增 ${rows.length} 条打乱`);
  }
  return counts;
}
async function solvePuzzle(key: Exclude<Puzzle, 'sq1'>, chunkSize = 200_000): Promise<void> {
  const folder = join(puzzleDir, key);
  const corpus = join(folder, 'scrambles.txt');
  const output = join(folder, `${key}.csv`);
  const done = await ids(output, true);
  const todo: string[] = [];
  for await (const row of lines(corpus)) {
    const comma = row.indexOf(',');
    if (comma > 0 && !done.has(row.slice(0, comma))) todo.push(row);
  }
  console.log(`[${key}] 待计算 ${todo.length} 条，已完成 ${done.size} 条`);
  if (!todo.length) return;
  const spec = registered[key];
  const binary = key === 'clock' ? tsx : exe(spec.binary);
  if (!await exists(binary)) throw new Error(`[${key}] analyzer missing: ${binary}`);
  const args = key === 'clock' ? [join(jobDir, 'src', 'clock_analyzer.mts')] : [];
  const env = { ...process.env, CUBE_TABLE_DIR: tableDir, PUZZLE_EMIT_SOLN: '1', RAYON_NUM_THREADS: String(availableParallelism()) };
  for (let i = 0; i < todo.length; i += chunkSize) {
    const input = join(folder, `chunk_${key}.txt`);
    const chunkOutput = join(folder, `chunk_${key}_${key}.csv`);
    await writeFile(input, `${todo.slice(i, i + chunkSize).join('\n')}\n`);
    if (await exists(chunkOutput)) await unlink(chunkOutput);
    await analyzer(binary, [input], join(folder, `${key}.analyzer.log`), env, key, args, key === 'clock' ? jobDir : folder, key === 'clock' ? '' : 'exit');
    const expected = Math.min(chunkSize, todo.length - i);
    const actual = Math.max(0, (await lineCount(chunkOutput)) - 1);
    if (actual !== expected) throw new Error(`[${key}] analyzer returned ${actual}/${expected} rows`);
    await appendData(output, chunkOutput, await fileSize(output) > 0);
    await unlink(chunkOutput);
    console.log(`[${key}] ${Math.min(i + chunkSize, todo.length)}/${todo.length}`);
  }
}
async function monsterCount(): Promise<number> {
  const file = join(puzzleDir, 'sq1', 'sq1_wca_exact.csv');
  if (!await exists(file)) return 0;
  let count = 0;
  for await (const row of lines(file)) if (/^\d+,M(?:,|$)/.test(row)) count++;
  return count;
}

export type PuzzleOptions = { buildOnly?: boolean; chunkSize?: number; sampled?: boolean; sampledN?: number; sampledEvents?: string[]; rebuildTierB?: boolean };
export async function runPuzzles(selected: string[], maxNew = 0, options: PuzzleOptions = {}): Promise<string[]> {
  const keys = selected.length ? selected as Puzzle[] : defaultPuzzles;
  const partial: string[] = [];
  for (const key of keys) if (!(key in registered) && key !== 'sq1') throw new Error(`Unknown puzzle: ${key}`);
  await runNode(join(jobDir, 'prepare_config.mjs'));
  if (keys.some(key => key === '222' || key === 'pyraminx' || key === 'clock')) {
    await runPnpm(['--filter', '@cuberoot/puzzle-solvers', 'build']);
  }
  if (!options.buildOnly) {
  await extractCorpus(keys, maxNew);
  for (const key of keys) if (key !== 'sq1') await solvePuzzle(key, options.chunkSize);
  if (keys.includes('sq1')) {
    const sq1Full = join(tableDir, 'sq1_wca_jsqfull.bin');
    const exact = join(puzzleDir, 'sq1', 'sq1_wca_exact.csv');
    const done = await ids(exact, true);
    const corpus = await ids(join(puzzleDir, 'sq1', 'scrambles.txt'));
    const hasNewWca = done.size < corpus.size;
    if (hasNewWca) {
      if (await fileSize(sq1Full) !== 13_005_619_200) throw new Error(`SQ1 exact table missing/incomplete: ${sq1Full}`);
      await runSq1Wca();
    }
    const remaining = await monsterCount();
    if (remaining) {
      const afterGrind = await grindSq1Monsters();
      if (afterGrind) partial.push(`SQ1 WCA still has ${afterGrind} unresolved states`);
    }
    if (hasNewWca || remaining || !await exists(join(puzzleDir, 'sq1', 'sq1_slash_exact.csv'))) {
      const fallback = await runSq1Slash();
      if (fallback) partial.push(`SQ1 slash still has ${fallback} provisional states`);
    } else {
      console.log(`[SQ1] ${done.size}/${corpus.size} 已计算，跳过载表`);
      const metaFile = join(puzzleDir, 'sq1', 'sq1_slash_meta.json');
      if (await exists(metaFile)) {
        const meta = JSON.parse(await readFile(metaFile, 'utf8')) as { fallback?: number };
        if (meta.fallback) partial.push(`SQ1 slash still has ${meta.fallback} provisional states`);
      }
    }
  }
  }
  if (keys.includes('222') || keys.includes('pyraminx')) {
    await runTs(join(jobDir, 'src', 'build_puzzle_metrics.mts'), keys.filter(key => key === '222' || key === 'pyraminx'));
  }
  const stampFile = join(wcaDir, 'incremental', 'export_date.txt');
  const env = { ...process.env, SCRAMBLE_STATS_STAMP: await exists(stampFile) ? (await readFile(stampFile, 'utf8')).trim() : new Date().toISOString().slice(0, 10) };
  await runTs(join(jobDir, 'src', 'build_puzzle_dist.ts'), [], jobDir, env);
  if (options.sampled) {
    const events = options.sampledEvents?.length ? options.sampledEvents : [
      '335', '336', '337', '233', '334', 'crz3a', 'mpyrso', 'dino', 'sq2', 'ssq1', 'bsq', 'cm3', 'heli', 'helicv', 'ctico', 'sia222',
    ];
    for (const event of events) await runTs(join(jobDir, 'src', 'build_puzzle_sampled_dist.ts'),
      options.sampledN ? [event, String(options.sampledN)] : [event]);
  }
  if (options.rebuildTierB) {
    for (const script of ['build_bic_table.ts', 'build_sia222_table.ts']) await runTs(join(jobDir, 'src', script));
  }
  console.log('[puzzles] 分布已更新');
  return partial;
}
