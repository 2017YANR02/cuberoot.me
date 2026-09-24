/** One local command: build/generate solver tables, then run the full statistics pipeline. */
import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const solverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(solverDir, '..');
const tableDir = path.resolve(process.env.CUBE_TABLE_DIR || path.join(solverDir, 'tables'));
const pipeline = path.join(repoRoot, 'scripts/stats/update-local.ts');
const tsx = path.join(repoRoot, 'core/node_modules/.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const exe = path.join(solverDir, 'target/release', process.platform === 'win32' ? 'table_generator.exe' : 'table_generator');
const solversPage = path.join(repoRoot, 'core/packages/client/app/[lang]/dev/solvers/page.tsx');
const afterPidOption = process.argv.indexOf('--after-pid');
const afterPid = afterPidOption < 0 ? undefined : Number(process.argv[afterPidOption + 1]);
if (afterPid !== undefined && (!Number.isSafeInteger(afterPid) || afterPid < 1)) throw new Error('--after-pid requires a positive process ID');
const summaryPath = path.join(tableDir, `local-pipeline-run-${new Date().toISOString().replaceAll(':', '-')}.json`);
const summary: { startedAt: string; updatedAt?: string; finishedAt?: string; status: string; activeStep?: { name: string; startedAt: string; elapsedSeconds: number }; steps: Array<{ name: string; startedAt: string; seconds: number; exitCode: number }>; tableTimings?: string; pipelineTimes?: string } = {
  startedAt: new Date().toISOString(), status: 'running', steps: [],
};
if (process.argv.includes('--plan')) {
  console.log(JSON.stringify({ solverDir, tableDir, pipeline, exe, afterPid, publish: false }, null, 2));
  process.exit(0);
}
await mkdir(tableDir, { recursive: true });
let pendingWrite = Promise.resolve();
function persist(): Promise<void> {
  const snapshot = `${JSON.stringify({ ...summary, updatedAt: new Date().toISOString() }, null, 2)}\n`;
  pendingWrite = pendingWrite.then(async () => {
    await writeFile(`${summaryPath}.new`, snapshot);
    await rename(`${summaryPath}.new`, summaryPath);
  });
  return pendingWrite;
}
async function run(name: string, command: string, args: string[], cwd: string): Promise<void> {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  summary.activeStep = { name, startedAt, elapsedSeconds: 0 };
  await persist();
  const heartbeat = setInterval(() => {
    if (summary.activeStep?.name !== name) return;
    summary.activeStep.elapsedSeconds = (performance.now() - started) / 1000;
    void persist();
  }, 10_000);
  console.log(`\n=== ${name}: ${command} ${args.join(' ')} ===`);
  let exitCode: number;
  try {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && /\.cmd$/i.test(command), env: { ...process.env, CUBE_TABLE_DIR: tableDir } });
    exitCode = await new Promise<number>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', code => resolve(code ?? 1));
    });
  } finally {
    clearInterval(heartbeat);
  }
  const seconds = (performance.now() - started) / 1000;
  delete summary.activeStep;
  summary.steps.push({ name, startedAt, seconds, exitCode });
  await persist();
  if (exitCode !== 0) throw new Error(`${name} failed (exit ${exitCode})`);
}
async function waitExisting(pid: number): Promise<void> {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  summary.activeStep = { name: 'wait-existing-table-generator', startedAt, elapsedSeconds: 0 };
  await persist();
  while (true) {
    try { process.kill(pid, 0); }
    catch { break; }
    summary.activeStep.elapsedSeconds = (performance.now() - started) / 1000;
    await persist();
    await delay(30_000);
  }
  const table = path.join(tableDir, 'h48-nissy-core/h48h10.dat');
  const size = await stat(table).then(value => value.size).catch(() => -1);
  if (size !== 30_336_314_216) throw new Error(`Existing generator exited without a complete H10 table: ${table}`);
  delete summary.activeStep;
  summary.steps.push({ name: 'wait-existing-table-generator', startedAt, seconds: (performance.now() - started) / 1000, exitCode: 0 });
  await persist();
}
async function syncH10Snapshot(): Promise<void> {
  const source = await readFile(solversPage, 'utf8');
  const start = source.indexOf("  '333': {");
  const end = source.indexOf("  '222': {", start);
  if (start < 0 || end < 0) throw new Error('Cannot locate the 333 solver table snapshot');
  let section = source.slice(start, end);
  const changes: Array<[string, string]> = [
    ['本机 H10 大表正在生成，完成并验算前统计尚未运行。旧 cubeopt9 不再是默认表。', '本机 H10 大表已生成并通过样例验算；离线三阶整解统计统一由 H10 原生求解器续跑。旧 opt9 已退役。'],
    ['The local H10 table is being generated; statistics have not run before generation and validation finish. The old cubeopt9 table is no longer the default.', 'The local H10 table has been generated and passed a sample solve. Offline 3x3 optimal statistics now resume through the native H10 solver; the old opt9 path is retired.'],
    ['当前等待完整表与样本验算；GPU 计算路径尚未实现。', '本机已完成建表与样本验算；GPU 计算路径尚未实现。'],
    ['completion and sample validation are pending. No GPU compute path exists yet.', 'the local table and sample solve are verified. No GPU compute path exists yet.'],
    ['generated: false,', 'generated: true,'],
  ];
  for (const [before, after] of changes) {
    if (section.includes(before)) section = section.replace(before, after);
    else if (!section.includes(after)) throw new Error(`Unexpected 333 solver snapshot; missing ${before}`);
  }
  await writeFile(solversPage, source.slice(0, start) + section + source.slice(end));
  console.log(`Updated local /dev/solvers H48 h10 snapshot: ${solversPage}`);
}
await persist();
try {
  if (afterPid) {
    await waitExisting(afterPid);
    await run('verify-all-tables', exe, [], solverDir);
  } else {
    await run('build-table-generator', 'cargo', ['build', '--release', '--bin', 'table_generator'], solverDir);
    await run('generate-all-tables', exe, [], solverDir);
  }
  await run('smoke-h48-h10', tsx, ['../solver/333opt/solve_h10.mts', '--smoke'], path.join(repoRoot, 'core'));
  await syncH10Snapshot();
  await run('build-all-local-statistics', tsx, [pipeline, '--jobs', 'all', '--no-publish'], path.join(repoRoot, 'core'));
  summary.status = 'complete';
} catch (error) {
  summary.status = `failed: ${String(error)}`;
  process.exitCode = 1;
  console.error(error);
} finally {
  summary.finishedAt = new Date().toISOString();
  for (const [file, key] of [['generation-times.csv', 'tableTimings'], ['stats-pipeline-times.csv', 'pipelineTimes']] as const) {
    try { summary[key] = await readFile(path.join(tableDir, file), 'utf8'); } catch { /* step may have stopped before producing it */ }
  }
  await persist();
  console.log(`Run summary: ${summaryPath}`);
}
