import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Read the existing build plan instead of maintaining a second command list.
// Reject shell syntax we cannot split faithfully before executing any stage.
export function buildStages(scripts: Record<string, string>): string[][] {
  const expand = (script: string, expandingDeps = false): string[][] => script.split('&&').flatMap(part => {
    const command = part.trim();
    if (command === 'pnpm run build:deps' && !expandingDeps) return expand(scripts['build:deps'], true);
    if (!/^[\w@./:=+-]+(?:\s+[\w@./:=+-]+)*$/.test(command) || command === 'pnpm run build:deps') {
      throw new Error(`Unsupported build command for profiling: ${command}`);
    }
    return [command.split(/\s+/)];
  });
  return expand(scripts.build);
}

export function profileBuild(
  stages: string[][],
  run: (command: string, args: string[]) => Pick<ReturnType<typeof spawnSync>, 'status' | 'signal' | 'error'>,
  report: (markdown: string) => void,
) {
  const started = performance.now();
  const rows = ['| Stage | Seconds | Result |', '| --- | ---: | --- |'];
  let status = 0;
  let signal: NodeJS.Signals | null = null;
  for (const [command, ...args] of stages) {
    const label = [command, ...args].join(' ');
    console.log(`[build-profile] Starting ${label}`);
    const start = performance.now();
    const result = run(command, args);
    const seconds = ((performance.now() - start) / 1000).toFixed(2);
    status = result.status ?? 1;
    signal = result.signal;
    if (result.error) console.error(result.error.message);
    rows.push(`| \`${label}\` | ${seconds} | ${signal ?? (status === 0 ? 'OK' : `exit ${status}`)} |`);
    console.log(`[build-profile] ${seconds}s: ${label}`);
    if (status !== 0 || signal) break;
  }
  rows.push(`| **Total wall time** | **${((performance.now() - started) / 1000).toFixed(2)}** | |`);
  report(`### Client build timings\n\n${rows.join('\n')}\n\n`);
  return { status, signal };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const result = profileBuild(buildStages(scripts), (command, args) => spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }), markdown => {
    console.log(markdown);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  });
  if (result.signal) process.kill(process.pid, result.signal);
  else process.exitCode = result.status;
}
