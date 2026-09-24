import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzer, exe, exists, lines, puzzleDir } from './common.js';

type Wca = { moves: number; slashes: number; optimal: string };
type Resolved = { value: string; optimal: string };
const dir = join(puzzleDir, 'sq1');
const source = join(dir, 'scrambles.txt');
const wcaFile = join(dir, 'sq1_wca_exact.csv');
const ambiguousFile = join(dir, 'sq1_slash_ambiguous.csv');
const finalFile = join(dir, 'sq1_slash_exact.csv');
const monsterFile = join(dir, 'sq1_slash_monsters.csv');
const work = join(dir, '_slash_chunks');
const header = 'id,slash_exact,opt_scramble';

function numeric(value: string): boolean { return /^\d+$/.test(value); }
function addResolved(map: Map<string, Resolved>, ambiguous: Set<string>, id: string, value: string, optimal: string): void {
  if (!ambiguous.has(id)) return;
  const current = map.get(id);
  if (!current || (numeric(value) && (!numeric(current.value) || Number(value) < Number(current.value)))) {
    map.set(id, { value, optimal });
  }
}
async function ingestFile(file: string, map: Map<string, Resolved>, ambiguous: Set<string>): Promise<void> {
  if (!await exists(file)) return;
  for await (const row of lines(file)) {
    if (!row || row.startsWith('id,')) continue;
    const [id, value, optimal = ''] = row.split(',', 3);
    if (id && value) addResolved(map, ambiguous, id, value, optimal);
  }
}
async function ingestDir(folder: string, map: Map<string, Resolved>, ambiguous: Set<string>, clear: boolean): Promise<void> {
  if (!await exists(folder)) return;
  for (const name of (await readdir(folder)).filter(name => name.endsWith('_sq1.csv')).sort()) {
    const file = join(folder, name);
    await ingestFile(file, map, ambiguous);
    if (clear) await unlink(file);
  }
}
async function saveResolved(map: Map<string, Resolved>): Promise<void> {
  const rows = [header, ...[...map].map(([id, result]) => `${id},${result.value},${result.optimal}`)];
  await writeFile(ambiguousFile, `${rows.join('\n')}\n`);
}
async function saveFinal(wca: Map<string, Wca>, ambiguous: Set<string>, resolved: Map<string, Resolved>): Promise<number> {
  const rows = [header];
  let proven = 0; let equal = 0; let less = 0; let fallback = 0;
  for (const [id, entry] of wca) {
    const result = resolved.get(id);
    if (!ambiguous.has(id)) { rows.push(`${id},${entry.slashes},${entry.optimal}`); proven++; }
    else if (!result || !numeric(result.value)) { rows.push(`${id},${entry.slashes},${entry.optimal}`); fallback++; }
    else if (Number(result.value) < entry.slashes && result.optimal) { rows.push(`${id},${result.value},${result.optimal}`); less++; }
    else { rows.push(`${id},${result.value},${entry.optimal}`); equal++; }
  }
  await writeFile(finalFile, `${rows.join('\n')}\n`);
  await writeFile(join(dir, 'sq1_slash_meta.json'), JSON.stringify({ ambiguous: ambiguous.size, eq: equal, less, fallback, provisional: fallback > 0 }));
  console.log(`[SQ1 slash] ${proven + equal + less + fallback} 条，待定 ${fallback} 条`);
  return fallback;
}
async function decideOne(binary: string, input: string): Promise<string> {
  const child = spawn(binary, [], { cwd: dir, stdio: ['pipe', 'pipe', 'ignore'] });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => { output += chunk; });
  child.stdin.end(`${input}\n`);
  const code = await new Promise<number>((done, fail) => { child.on('error', fail); child.on('close', value => done(value ?? 1)); });
  if (code !== 0) return '';
  let result = '';
  for (const line of output.split(/\r?\n/)) if (/^\d+,\d+$/.test(line.trim())) result = line.trim();
  return result;
}

export type SlashOptions = { chunkSize?: number; threads?: number; timeoutSecs?: number; split?: boolean; splitDepth?: number; splitTimeoutSecs?: number; mergeOnly?: boolean; noMitm?: boolean };
export async function runSq1Slash(options: SlashOptions = {}): Promise<number> {
  const chunkSize = options.chunkSize ?? 140;
  if (chunkSize < 1) throw new Error('SQ1 slash chunk size must be positive');
  await mkdir(work, { recursive: true });
  if (!await exists(source) || !await exists(wcaFile)) throw new Error('SQ1 corpus or WCA exact CSV is missing');
  if (!await exists(exe('sq1_analyzer'))) throw new Error(`Missing ${exe('sq1_analyzer')}`);
  const wca = new Map<string, Wca>();
  const ambiguous = new Set<string>();
  for await (const row of lines(wcaFile)) {
    if (!row || row.startsWith('id,')) continue;
    const [id, raw, optimal] = row.split(',', 3);
    if (!id || !optimal || !numeric(raw)) continue;
    const moves = Number(raw);
    const slashes = optimal.length - optimal.replaceAll('/', '').length;
    wca.set(id, { moves, slashes, optimal });
    if (moves === 2 * slashes - 1) ambiguous.add(id);
  }
  const compact = new Map<string, string>();
  for await (const row of lines(source)) {
    const comma = row.indexOf(',');
    if (comma > 0) compact.set(row.slice(0, comma), row.slice(comma + 1));
  }
  const resolved = new Map<string, Resolved>();
  await ingestFile(ambiguousFile, resolved, ambiguous);
  await ingestFile(join(dir, '_xval_resolved.csv'), resolved, ambiguous);
  await ingestDir(join(dir, '_tier1'), resolved, ambiguous, false);
  await ingestDir(work, resolved, ambiguous, true);
  await saveResolved(resolved);
  const todo: string[] = [];
  for (const id of ambiguous) {
    if (!resolved.has(id) && compact.has(id)) todo.push(`${id},${compact.get(id)},${wca.get(id)!.moves}`);
  }
  console.log(`[SQ1 slash] 歧义态 ${ambiguous.size}，本次待判 ${todo.length}`);
  if (todo.length && !options.mergeOnly) {
    for (const name of await readdir(work)) {
      if (/^chunk_\d+\.txt$/.test(name)) await unlink(join(work, name));
    }
    const inputs: string[] = [];
    for (let i = 0; i < todo.length; i += chunkSize) {
      const file = join(work, `chunk_${String(i / chunkSize).padStart(5, '0')}.txt`);
      await writeFile(file, `${todo.slice(i, i + chunkSize).join('\n')}\n`);
      inputs.push(file);
    }
    const progress = join(dir, '_slash_progress.log');
    await writeFile(progress, '');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      SQ1_SLASH_VIA_WCA: '1', RAYON_NUM_THREADS: String(options.threads ?? availableParallelism()),
      ANALYZER_PROGRESS_FILE: progress, ANALYZER_PROGRESS_EVERY: '20',
      ANALYZER_PROGRESS_TOTAL: String(todo.length), ANALYZER_PROGRESS_BASE: '0',
      SQ1_SOLVE_TIMEOUT_SECS: String(options.split ? options.splitTimeoutSecs ?? 600 : options.timeoutSecs ?? 60),
      ANALYZER_STUCK_SECS: String((options.split ? options.splitTimeoutSecs ?? 600 : options.timeoutSecs ?? 60) + 120),
    };
    if (options.split) env.SQ1_SOLVE_PARALLEL = String(options.splitDepth ?? 2);
    let failure: unknown;
    try { await analyzer(exe('sq1_analyzer'), inputs, join(dir, '_slash_run.err'), env, 'SQ1 slash'); }
    catch (error) { failure = error; }
    finally { await ingestDir(work, resolved, ambiguous, true); await saveResolved(resolved); }
    if (failure) throw failure;
  }
  const mitm = exe('sq1_slash_mitm');
  if (!options.noMitm && !options.mergeOnly && await exists(mitm)) {
    let confirmed = 0;
    for (const id of ambiguous) {
      if (numeric(resolved.get(id)?.value ?? '') || !compact.has(id)) continue;
      const entry = wca.get(id)!;
      const result = await decideOne(mitm, `${id},${entry.optimal},${entry.slashes}`);
      const match = result.match(/^\d+,(\d+)$/);
      if (match && Number(match[1]) === entry.slashes) {
        addResolved(resolved, ambiguous, id, match[1], '');
        confirmed++;
      }
    }
    if (confirmed) { console.log(`[SQ1 slash] MITM 确认 ${confirmed} 条`); await saveResolved(resolved); }
  }
  const monsters: string[] = [];
  for (const id of ambiguous) {
    if (!numeric(resolved.get(id)?.value ?? '') && compact.has(id)) monsters.push(`${id},${compact.get(id)}`);
  }
  if (monsters.length) await writeFile(monsterFile, `${monsters.join('\n')}\n`);
  return saveFinal(wca, ambiguous, resolved);
}
