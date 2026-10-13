#!/usr/bin/env node
// Startup interlock, not an OS swap setting. H10 solving is authorized with
// runtime resource monitoring; it does not require an OS no-swap launcher.
// Other protected computations still require the documented safeguards.
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const native = /^(?:table_generator(?:_high_memory)?|(?:pseudo_f2leo|f2leo|pseudo_pair|pair|std)_analyzer)(?:\.exe)?$/;
const script = /(?:^|\/)(?:double-zbll\.ts|gen-table\.mjs|backfill_xcross_variant\.[cm]?[jt]s)$/;
const base = (word: string) => word.replaceAll('\\', '/').split('/').pop() ?? '';
const cubeoptRoot = resolve(repoRoot, 'solver/experiments/cube48opt-rust');
const cubeoptLabel = 'cube48opt Opt1–9 / Rust Opt10 / Rust H0–H10 研究计算';
const cubeoptComputations = ['validate.mjs', 'benchmark.mjs', 'wasm-benchmark.mjs', 'verify-h10.mjs', 'validate-h10.mjs', 'h10-benchmark.mjs', 'zbll-benchmark.mjs'];

// Only the actual interpreter entrypoint can authorize its child arguments.
// Merely mentioning guard.mts after oracle.mjs must not grant an exemption.
function interpreterScript(words: string[]): { index: number; checkOnly: boolean } | undefined {
  let interpreter = 0;
  while (interpreter < words.length) {
    const word = words[interpreter];
    if (/^[\w]+=/.test(word) || /^(?:env|nohup|caffeinate|time|command)$/.test(base(word)) || /^-[a-z]+$/.test(word)) {
      interpreter++;
      continue;
    }
    break;
  }
  if (!/^(?:node(?:\.exe)?|tsx(?:\.cmd)?)$/.test(base(words[interpreter] ?? ''))) return undefined;
  let checkOnly = false;
  for (let index = interpreter + 1; index < words.length; index++) {
    const word = words[index];
    if (['-e', '--eval', '-p', '--print'].includes(word)) return undefined;
    if (['-c', '--check'].includes(word)) { checkOnly = true; continue; }
    if (['--import', '--require', '-r', '--loader', '--experimental-loader', '--conditions', '-C', '--input-type'].includes(word)) { index++; continue; }
    if (word === '--' || word.startsWith('-')) continue;
    return { index, checkOnly };
  }
  return undefined;
}

function blockedCubeopt(words: string[], cwd: string): boolean {
  const invocation = interpreterScript(words);
  if (invocation?.checkOnly) return false;
  // Even the real guard is not an H11 authorization. Runtime policy and the
  // native CLI also reject it before file IO; no path/alias bypass is provided.
  const h48Mode = words.findIndex(word => ['solve-h48', 'query-h48'].includes(word));
  if (words.some(word => /^CUBEOPT_H=/.test(word) && Number(word.slice('CUBEOPT_H='.length)) >= 11)
      || h48Mode >= 0 && Number(words[h48Mode + 1]) >= 11
      || words.some(word => /^(?:solve|query)-h11$/.test(word))) return true;
  if (invocation) {
    const entry = resolve(cwd, words[invocation.index].replaceAll('\\', '/'));
    if (entry === resolve(cubeoptRoot, 'guard.mts')) return false;
    if (entry === resolve(cubeoptRoot, 'oracle.mjs'))
      return ['generate', 'query', 'solve'].includes(words[invocation.index + 1]);
    if (cubeoptComputations.some(name => entry === resolve(cubeoptRoot, name))) return true;
  }
  if (words.includes('--verify-opt1') && words.some(word =>
      base(word) === 'verify_opt10_generation' || word === '--example=verify_opt10_generation')) return true;
  // A lookalike wrapper is not the authorized guard, even when its arguments
  // visibly name the real computation entrypoint.
  for (const [index, word] of words.entries()) {
    const path = resolve(cwd, word.replaceAll('\\', '/'));
    if (path === resolve(cubeoptRoot, 'oracle.mjs') && ['generate', 'query', 'solve'].includes(words[index + 1])) return true;
    if (cubeoptComputations.some(name => path === resolve(cubeoptRoot, name))) return true;
  }
  const cargo = words.findIndex(word => base(word) === 'cargo');
  if (cargo >= 0 && words.includes('run')) {
    const manifestFlag = words.findIndex(word => word === '--manifest-path' || word.startsWith('--manifest-path='));
    const manifest = manifestFlag < 0 ? '' : words[manifestFlag].includes('=')
      ? words[manifestFlag].slice('--manifest-path='.length) : words[manifestFlag + 1] ?? '';
    const researchPackage = cwd === cubeoptRoot || manifest && resolve(cwd, manifest) === resolve(cubeoptRoot, 'Cargo.toml')
      || words.some(word => word === 'cube48opt-research' || word === '--bin=cube48opt-research');
    if (researchPackage && !words.some(word => word === '--example' || word.startsWith('--example='))) {
      const delimiter = words.indexOf('--');
      return delimiter < 0 || !['inspect', '--help', '-h'].includes(words[delimiter + 1]);
    }
    return false;
  }
  const executable = words.findIndex(word => /^cube48opt-research(?:[-_.][\w.-]+)?$/.test(base(word)));
  return executable >= 0 && !['inspect', '--help', '-h'].includes(words[executable + 1]);
}

// Preserve quoted arguments so `rg 'table_generator' ...` is inspection, while
// command lists and shell -c wrappers are checked independently. This is not a
// general shell interpreter: aliases and opaque/generated scripts need review.
function segments(command: string): string[][] {
  const result: string[][] = [];
  let words: string[] = [], word = '', quote = '';
  const flushWord = () => { if (word) words.push(word); word = ''; };
  const flush = () => { flushWord(); if (words.length) result.push(words); words = []; };
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (char === '\\' && command[i + 1] === '\n') { i++; continue; }
    if (quote) {
      if (char === quote) quote = '';
      else if (char === '\\' && quote !== "'" && ['"', '\\', '`'].includes(command[i + 1])) word += command[++i];
      else word += char;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '#' && !word) {
      while (i < command.length && command[i] !== '\n') i++;
      flush();
    } else if (';&|\n(){}'.includes(char)) flush();
    else if (/\s/.test(char)) flushWord();
    else word += char;
  }
  flush();
  return result;
}

export function blockedCompute(command: string, depth = 0, cwd = repoRoot): string | undefined {
  if (command.includes('double-zbll-auf-20261011/run.mts') && command.includes('--solve')) return '双底 AUF 小样本';
  if (command.includes('double-zbll-auf-20261011/full.mts') && command.includes('--run')) return '双底 AUF 长期计算';
  if (depth > 8) return undefined;
  for (const words of segments(command)) {
    const first = base(words.find(word => !/^[\w]+=.*/.test(word)) ?? '');
    if (first === 'cd') {
      const index = words.findIndex(word => word === 'cd');
      const destination = words[index + 1] === '--' ? words[index + 2] : words[index + 1];
      if (destination) cwd = resolve(cwd, destination.replaceAll('\\', '/'));
      continue;
    }
    // These commands read or display their arguments; names in source/fixtures
    // are not launches. Command substitution is checked separately below.
    if (/^(?:rg|grep|cat|head|tail|sed|less|echo|printf|git|ls|stat|du|wc|file|shasum)$/.test(first)) continue;
    // A direct cp copies bytes; a solver-looking source/destination is not an
    // executable. This exemption is segment-local, and substitutions are still
    // checked below. Do not extend it to Node or arbitrary file-operation code.
    if (first === 'cp') continue;
    if (first === 'cargo' && !words.includes('run')) continue;
    if (blockedCubeopt(words, cwd)) return cubeoptLabel;
    // H9-only generation was explicitly authorized on 2026-10-13. The guard
    // validates the exact target, directory, threads and process-tree budget.
    const guarded = interpreterScript(words);
    if (guarded && resolve(cwd, words[guarded.index]) === resolve(cubeoptRoot, 'guard.mts')) {
      const args = words.slice(guarded.index + 1);
      if (args.length === 4 && words.includes('CUBEOPT_BACKEND=h9gen')
          && resolve(cwd, args[1]) === resolve(repoRoot, 'solver/target/release/table_generator')
          && args[2] === '--only' && args[3] === 'h48-h9') continue;
    }
    for (const [index, word] of words.entries()) {
      const normalized = word.replaceAll('\\', '/');
      const name = base(word).replace(/^--bin=/, '');
      if (word === 'double-zbll:symmetry' || /(?:^|\/)double-zbll-symmetry\.mts$/.test(normalized)) {
        if (!words.includes('--plan') && !words.includes('--verify-checkpoint') && !words.includes('--watch')) return '双底对称去重长期计算';
        if (words.includes('--run')) return '双底对称去重长期计算';
      }
      if (native.test(name) || script.test(normalized)
        || /(?:^|\/)double-zbll-1000\/run\.mts$/.test(normalized)) return name;
      if (word === 'double-zbll' && words.some(w => /^(?:pnpm|npm|yarn)(?:\.cmd)?$/.test(base(w)))) return word;
      const localStats = word === 'stats:scramble:local' || /(?:^|\/)scripts\/stats\/update-local\.ts$/.test(normalized);
      if (localStats && !words.slice(index + 1).includes('--plan')) return '打乱统计计算';
      const publishedStats = /^stats:scramble(?::publish)?$/.test(word)
        || /(?:^|\/)scripts\/stats\/update-published\.ts$/.test(normalized);
      if (publishedStats && !words.slice(index + 1).includes('--publish-only')) return '打乱统计计算';
      if (/^-(?:[a-z]*c|e|eval)$/.test(word) || word === '--eval' || word === '-Command') {
        const nested = words[index + 1] ?? '';
        const blocked = blockedCompute(nested, depth + 1, cwd);
        if (blocked) return blocked;
        // Visible child-process calls in inline JS/Python/PowerShell. Do not
        // execute or import arbitrary code in order to classify it.
        if (/spawn|exec|subprocess|Start-Process/.test(nested)
          && /table_generator|double-zbll|stats:scramble|scripts[\\/]stats[\\/]update-/.test(nested)) return '内联脚本中的大内存计算';
        if (/spawn|exec|subprocess|Start-Process/.test(nested)
          && /cube48opt-research|cube48opt-rust[\\/](?:oracle|validate|benchmark|wasm-benchmark|verify-h10|validate-h10|h10-benchmark)\.mjs/.test(nested)) return cubeoptLabel;
      }
    }
  }
  for (const match of command.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)) {
    const blocked = blockedCompute(match[1] ?? match[2], depth + 1, cwd);
    if (blocked) return blocked;
  }
  return undefined;
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let request;
  try { request = JSON.parse(raw || '{}'); } catch { return; }
  const command = request?.tool_input?.command;
  if (typeof command !== 'string') return;
  const cwd = request?.tool_input?.workdir ?? request?.tool_input?.cwd ?? request?.cwd;
  // Some code-mode harnesses supply the repository cwd instead of the nested
  // exec workdir. This exact absolute entry is unambiguous in either directory;
  // it receives the same source-hash and runtime-guard checks as the shortcut.
  const absoluteSymmetryCommand = `node --max-old-space-size=512 --import ${resolve(repoRoot, 'core/node_modules/tsx/dist/loader.mjs')} ${resolve(repoRoot, 'core/jobs/alg-build/src/double-zbll-symmetry.mts')} --run`;
  if (['pnpm --filter @cuberoot/alg-build double-zbll:symmetry --run',
    'node --max-old-space-size=512 --import ./node_modules/tsx/dist/loader.mjs jobs/alg-build/src/double-zbll-symmetry.mts --run', absoluteSymmetryCommand].includes(command)
    && (command === absoluteSymmetryCommand || typeof cwd === 'string' && resolve(cwd) === resolve(repoRoot, 'core'))
    && Date.now() < Date.parse('2026-12-01T00:00:00Z')) {
    // Reviewed local shortcut: fixed coordinator and exact audited dependencies.
    const files = {
      "solver/experiments/cube48opt-rust/guard.mts": "659929576edeea6421b62e8278fb3dc8180d4527aa827f83dba3ca8f21d58191",
      "solver/333opt/rust-h10-adapter.mts": "bfb3ae07fc4dd86f88ba5d540b08cdda23b7b699ccf1c7de5583820d4e8e019d",
      "core/jobs/alg-build/src/double-zbll-symmetry.mts": "74fa8d827a18a3fecd0c7e870db90cf84e3fb1945272253f7e233b0df505ea95",
      "core/jobs/alg-build/src/double-zbll-selection.mts": "0de647807f60be78c8386fe2ea1243af6768c88399f6128e1a067b645d433439",
      "core/jobs/alg-build/src/double-zbll-dashboard.mts": "fdda9d09c104170d81547cb6d26d8b998747ad1a4358ad18435bc52e0cd97e23",
      "core/jobs/alg-build/src/double-zbll-website-stats.mts": "1909aa32d3794c45c64490cd0e56ec27efa79cd4de805f4d3c362f6dfd098143",
      "core/jobs/alg-build/src/double-zbll-symmetry-state.mts": "50561cb176c7c9e5776ac7d76ce970e982325ab7f8933a296ac6562137802e5a",
      ".tmp/double-zbll-symmetry-v2/model.mts": "ec36d0ba647796b8c979863aa81ab9cb7162a7083398fa898f7b17b76cf4f3a1",
      ".tmp/double-zbll-auf-20261011/run.mts": "cba0a6c888532ab1c606af9bd0c7d811f4afe786c220a0daa2c3c84e80f3e8b0",
      "solver/333opt/solve_h10.mts": "ae894eab51504aacd0d0a15881d0ce26a425788ff26ef212db0fb00a51b4e0a8",
    };
    try {
      const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'core/jobs/alg-build/package.json'), 'utf8'));
      if (pkg.scripts?.['double-zbll:symmetry'] === 'node --max-old-space-size=512 --import tsx src/double-zbll-symmetry.mts'
        && Object.entries(files).every(([file, hash]) => createHash('sha256').update(readFileSync(resolve(repoRoot, file))).digest('hex') === hash)) return;
    } catch { /* Missing/changed task code is not exempt. */ }
  }
  // User explicitly accepted monitoring on 2026-10-11, then authorized this
  // long-running task. Only this fixed coordinator and its guarded batch code
  // qualify; other commands remain blocked. Never treat this as OS no-swap.
  if (command === 'node --import ./core/node_modules/tsx/dist/loader.mjs .tmp/double-zbll-auf-20261011/full.mts --run'
    && Date.now() < Date.parse('2026-12-01T00:00:00Z')) {
    try {
      const digest = (file: string) => createHash('sha256').update(readFileSync(resolve(repoRoot, '.tmp/double-zbll-auf-20261011', file))).digest('hex');
      if (digest('full.mts') === '2323368ecb756f54776844db3d40289d6f840a76a1e4e3264424a523c825e9bf'
        && digest('run.mts') === 'dae9e46d66678afc2c9b7c0f34e02f650e3934fdffee702b8e3439741b3535ef') return;
    } catch { /* Missing or changed task code is not authorized. */ }
  }
  const root = repoRoot.toLowerCase();
  const directory = typeof cwd === 'string' ? resolve(cwd).toLowerCase() : '';
  if (directory !== root && !directory.startsWith(root + sep)
    && !command.replaceAll('\\', '/').toLowerCase().includes(root.replaceAll('\\', '/'))) return;
  const blocked = blockedCompute(command, 0, typeof cwd === 'string' ? resolve(cwd) : repoRoot);
  if (!blocked) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny',
    permissionDecisionReason: blocked === '双底对称去重长期计算'
      ? `双底任务已授权，但受保护入口登记未匹配：工作目录=${String(cwd)}；请核对 core 工作目录、完整命令和登记源码 hash。保留断点，不得绕过运行时资源保护。`
      : blocked === cubeoptLabel
      ? `禁止直接启动 ${blocked}：本轮授权仅适用于 solver/experiments/cube48opt-rust/guard.mts。请经 node --experimental-strip-types solver/experiments/cube48opt-rust/guard.mts LABEL EXECUTABLE [ARGS] 启动，由入口按 CUBEOPT_VARIANT=1..9、显式 CUBEOPT_BACKEND=h10，或 CUBEOPT_BACKEND=h48 加 CUBEOPT_H=0..10 核对预算。H48 档位必须匹配 CLI、实际表大小和表头；H11 仅实现代码，不允许运行，即使通过 guard 也拒绝。持续监控进程树 RSS、内存压力、同次系统启动的 Swapouts 与至少 2 GiB 余量，H10 基准仅允许顺序单表驻留。保护触发后不得重设基线自动重启。inspect、small、verify-small 和小表坐标校验可直接运行；此授权不是操作系统禁用 swap。`
      : `禁止启动 ${blocked}：尚无经核验、覆盖进程及其子进程的系统级防交换保护。现有轮询监控、NO_SWAP 环境变量及缩小批次不能保证零换出。保留结果和断点，先配置并核验系统级保护，再登记受保护入口；不要重设基线或绕过 hook。只读查看统计计划可用 pnpm stats:scramble:local --plan。见 AGENTS.md「本地计算内存与交换保护」；H10 独立求解已按新规则放行，此限制仍适用于上述其他计算。`,
  } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
