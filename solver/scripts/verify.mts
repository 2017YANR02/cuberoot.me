/** Compare native analyzer output with checked-in golden CSVs. */
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const release = join(root, 'target', 'release');
const goldDir = join(root, 'testdata', 'golden');
const workDir = join(root, 'target', 'verify-work');
const exeSuffix = process.platform === 'win32' ? '.exe' : '';
const cases = [
  { name: 'std', bin: 'std_analyzer', suffix: '_std', env: { CUBE_RUN_FULL_STD: '1', CUBE_ALLOW_HUGE_TABLES: '1' } },
  { name: 'pseudo', bin: 'pseudo_analyzer', suffix: '_pseudo', env: { CUBE_ALLOW_HUGE_TABLES: '1' } },
  { name: 'pair', bin: 'pair_analyzer', suffix: '_pair', env: { CUBE_ALLOW_HUGE_TABLES: '1' } },
  { name: 'eo', bin: 'eo_cross_analyzer', suffix: '_eo', env: { CUBE_ALLOW_HUGE_TABLES: '1' } },
  { name: 'pseudo_pair', bin: 'pseudo_pair_analyzer', suffix: '_pseudo_pair', env: { CUBE_ALLOW_HUGE_TABLES: '1' } },
] as const;
const clearEnv = [
  'CUBE_RUN_FULL_STD', 'CUBE_ALLOW_HUGE_TABLES', 'CUBE_PSEUDO_SKIP_XCROSS',
  'CUBE_PSEUDO_SKIP_XXCROSS', 'CUBE_PSEUDO_SKIP_XXXCROSS', 'CUBE_PAIR_NO_DIAG', 'CUBE_EO_NO_DIAG',
];

let generate = false;
let plan = false;
let tableDir = join(root, 'tables');
let inputs = ['scramble_5.txt', 'scramble_100.txt'];
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === '--generate') generate = true;
  else if (arg === '--plan') plan = true;
  else if (arg === '--table-dir') tableDir = resolve(process.argv[++i] ?? '');
  else if (arg === '--inputs') inputs = (process.argv[++i] ?? '').split(',').filter(Boolean);
  else throw new Error(`Unknown option: ${arg}`);
}
if (inputs.length === 0) throw new Error('No inputs selected');
if (plan) {
  console.log(JSON.stringify({ inputs, tableDir, release, generate, analyzers: cases.map(item => item.name) }, null, 2));
  process.exit(0);
}

async function exists(file: string): Promise<boolean> {
  try { return (await stat(file)).isFile(); } catch { return false; }
}
async function run(exe: string, input: string, env: NodeJS.ProcessEnv): Promise<void> {
  const child = spawn(exe, [], { cwd: workDir, env, stdio: ['pipe', 'ignore', 'inherit'] });
  child.stdin.end(`${input}\nexit\n`);
  const code = await new Promise<number>((done, fail) => {
    child.on('error', fail);
    child.on('close', value => done(value ?? 1));
  });
  if (code !== 0) throw new Error(`${basename(exe)} exited with ${code}`);
}

if (!(await exists(join(tableDir, 'pt_cross_C4C5E0E1.bin')))) {
  console.warn(`[WARN] ${tableDir} lacks a huge table; some analyzers may generate it on demand.`);
}
await mkdir(workDir, { recursive: true });
await mkdir(goldDir, { recursive: true });
const results: Array<{ analyzer: string; input: string; seconds: number; rows: number; status: string }> = [];
for (const input of inputs) {
  const source = join(root, 'testdata', input);
  if (!(await exists(source))) { console.log(`[SKIP] missing ${input}`); continue; }
  const base = basename(input, extname(input));
  await copyFile(source, join(workDir, input));
  for (const item of cases) {
    const env = { ...process.env, CUBE_TABLE_DIR: tableDir };
    for (const key of clearEnv) delete env[key];
    Object.assign(env, item.env);
    const started = performance.now();
    await run(join(release, `${item.bin}${exeSuffix}`), input, env);
    const seconds = Math.round((performance.now() - started) / 10) / 100;
    const output = join(workDir, `${base}${item.suffix}.csv`);
    const golden = join(goldDir, `${base}${item.suffix}.csv`);
    const actual = await readFile(output, 'utf8');
    const rows = actual.trimEnd().split(/\r?\n/).length;
    let status: string;
    if (generate) { await copyFile(output, golden); status = 'GEN'; }
    else if (!(await exists(golden))) status = 'NO-GOLDEN';
    else status = actual.replaceAll('\r', '') === (await readFile(golden, 'utf8')).replaceAll('\r', '') ? 'OK' : 'FAIL';
    results.push({ analyzer: item.name, input, seconds, rows, status });
    console.log(`${item.name.padEnd(12)} ${input.padEnd(16)} ${seconds.toFixed(2).padStart(8)}s  rows=${rows} ${status}`);
  }
}
console.table(results);
const failed = results.filter(item => item.status === 'FAIL').length;
if (failed) { console.error(`FAILED: ${failed}`); process.exitCode = 1; }
else console.log(`all good (${results.length} runs)`);
