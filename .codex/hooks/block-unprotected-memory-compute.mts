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
const cubeoptComputations = ['validate.mjs', 'benchmark.mjs', 'wasm-benchmark.mjs', 'wasm-browser-benchmark.mjs', 'nxopt-benchmark.mjs', 'verify-h10.mjs', 'validate-h10.mjs', 'h10-benchmark.mjs', 'zbll-benchmark.mjs'];
const reconVisionEntry = resolve(repoRoot, 'research/reconer/vision/baseline.py');
const reconResearchRoot = resolve(repoRoot, 'research/reconer');
const reconPipelineEntries = ['prepare-video-frames.ts', 'reconstruct-observations.ts']
  .map(name => resolve(reconResearchRoot, 'scripts', name));

function blockedReconVision(words: string[], cwd: string): boolean {
  // These are local PyTorch workloads. An SSH command runs on the remote host,
  // whose resource policy is separate from this Mac's no-swap policy.
  const executable = words.find(word => !/^\w+=/.test(word) && base(word) !== 'env');
  if (base(executable ?? '') === 'ssh') return false;
  const directoryOption = words.findIndex(word => ['-C', '--dir', '--prefix'].includes(word));
  const runDirectory = directoryOption >= 0 && words[directoryOption + 1] ? resolve(cwd, words[directoryOption + 1]) : cwd;
  if (runDirectory === reconResearchRoot && ['pnpm', 'npm', 'yarn'].includes(base(executable ?? ''))
    && words.some(word => ['video:prepare', 'video:reconstruct'].includes(word))
    && !words.some(word => ['--plan', '--help', '-h'].includes(word))) return true;
  for (const [index, word] of words.entries()) {
    const file = resolve(cwd, word.replaceAll('\\', '/'));
    if (reconPipelineEntries.includes(file)) {
      const args = words.slice(index + 1);
      if (!args.some(arg => ['--plan', '--help', '-h'].includes(arg))) return true;
      continue;
    }
    const module = words[index - 1] === '-m' && (
      word === 'vision.baseline' && resolve(cwd, 'vision/baseline.py') === reconVisionEntry
      || word === 'baseline' && resolve(cwd, 'baseline.py') === reconVisionEntry
    );
    if (file !== reconVisionEntry && !module) continue;
    const args = words.slice(index + 1);
    if (args.includes('--help') || args.includes('-h')) continue;
    if (['train', 'evaluate', 'predict'].includes(args[0])) return true;
  }
  return false;
}

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
    if (entry === resolve(cubeoptRoot, 'wasm-browser-benchmark.mjs')) {
      // Only separately bounded no-PDB probes/three-case Rust fixtures may
      // bypass the compute guard. A flag anywhere in a larger command is not enough.
      const args = words.slice(invocation.index + 1);
      const out = resolve(cwd, args[4] ?? '');
      const probeDir = resolve(repoRoot, '.tmp/cubeopt-reverse/wasm-browser-probes');
      const boundedMode = args[0] === '--probe' && ['original8', 'rust8', 'original9', 'rust9'].includes(args[2])
        || args[0] === '--fixture' && ['rust8', 'rust9'].includes(args[2]);
      return !(args.length === 5 && boundedMode && args[1] === '--slot' && args[3] === '--out'
        && dirname(out) === probeDir && /^[a-z0-9][a-z0-9-]{0,63}$/.test(base(out)));
    }
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
  if (words.some(word => /^nxopt\d+(?:\.exe)?$/.test(base(word)))) return true;
  if (cargo >= 0 && words.includes('run')) {
    const manifestFlag = words.findIndex(word => word === '--manifest-path' || word.startsWith('--manifest-path='));
    const manifest = manifestFlag < 0 ? '' : words[manifestFlag].includes('=')
      ? words[manifestFlag].slice('--manifest-path='.length) : words[manifestFlag + 1] ?? '';
    const researchPackage = cwd === cubeoptRoot || manifest && resolve(cwd, manifest) === resolve(cubeoptRoot, 'Cargo.toml')
      || words.some(word => ['cube48opt-research', '--bin=cube48opt-research', 'corner-research', '--bin=corner-research'].includes(word));
    if (researchPackage && !words.some(word => word === '--example' || word.startsWith('--example='))) {
      const delimiter = words.indexOf('--');
      return delimiter < 0 || !['inspect', '--help', '-h', '--server-info'].includes(words[delimiter + 1]);
    }
    return false;
  }
  const executable = words.findIndex(word => /^(?:cube48opt-research(?:[-_.][\w.-]+)?|cube48opt-native|corner-research)$/.test(base(word)));
  return executable >= 0 && !['inspect', '--help', '-h', '--server-info'].includes(words[executable + 1]);
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
    // Plain scp transfers operands; it does not execute the solver filename.
    // No option exemptions (e.g. -S / ProxyCommand); substitutions are still
    // inspected below and subsequent command segments retain their checks.
    if (first === 'scp' && words.length >= 3 && words.slice(1).every(word => !word.startsWith('-'))) continue;
    if (first === 'cargo' && !words.includes('run')) continue;
    // Static TypeScript checking reads the entry file; it never executes it.
    // Keep this segment-local so a following compute command is still checked.
    if (['tsgo', 'tsc'].includes(first) && words.includes('--noEmit')) continue;
    if (blockedReconVision(words, cwd)) return 'Reconer 视觉模型训练/批量推理、视频处理或观测搜索';
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
          && /cube48opt-research|corner-research|cube48opt-rust[\\/](?:oracle|validate|benchmark|wasm-benchmark|wasm-browser-benchmark|verify-h10|validate-h10|h10-benchmark)\.mjs/.test(nested)) return cubeoptLabel;
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
      "solver/experiments/cube48opt-rust/stats-resume-review.mts": "6f609b721bee3a645280a238a94f3c5093cc9d085244dc4f13824c51c0bb6f97",
      "solver/333opt/stats-engine.mts": "ac25211efc875ca6d48446a5ed65d992d6a5f59122f0c10c8d18716c02ce4e16",
      "solver/experiments/cube48opt-rust/native-release.mts": "d9fefcf461c9831dec7ab5076d48d64c607f19c71e8843b7a5f2ca4e9bc72e3d",
      "solver/333opt/resident-rust-session.mts": "313215e251bc666811b4fab4794c3667d93c9ddeadb3eaec8eb03e6a32b85fff",
      "solver/experiments/cube48opt-rust/guard.mts": "b028fa2bbd51c94a72d141cc5c63f78635c12ee973d63f9c90285aff32ff324b",
      "solver/experiments/cube48opt-rust/wasm-browser-policy.mts": "1176e270d28c8666ae300e7854f23d11e571de210d80eba46977ba15115ebf0d",
      "solver/experiments/cube48opt-rust/wasm-dual-candidate-policy.mts": "abca4884edc63d97dca715dd55510c7c23cfd96e65b06219830dd6c3b1f3a5f8",
      "solver/experiments/cube48opt-rust/opt9-wasm-candidate-policy.mts": "65b30139f4dec1dc0cc46a7e4a318777926cef4bf0c96f46a2d795d421eabd12",
      "solver/experiments/cube48opt-rust/original-resume-policy.mts": "1dd8b04e7561d4a3788197f70dc61b1223670eaf411805ed28502bcf5ba913bf",
      "solver/experiments/cube48opt-rust/original-wasm-compat.mjs": "c07fc2c68bd80970a97bc10bff9cf379079a0ea23bd81f1273e2d5a8b545e0c8",
      "solver/experiments/cube48opt-rust/open-benchmark-policy.mts": "35da3ed00440d19001f2d38b306d4a3c520733ba02d54b1bf358f717dcd3e841",
      "solver/experiments/cube48opt-rust/opt9-release.mts": "5351b3caa48e26377f77c4ee5cab58fcf605fea0895d5f065889f9c62123bb65",
      "solver/experiments/cube48opt-rust/opt9-release.json": "bd1c345eb97088127f3358ed8db3c387c4f48e5334caa179da7d06f8bfb01080",
      "solver/333opt/rust-h10-adapter.mts": "e7b1aca3c8d635d353826e68117ad545aeb8d12c4719c2a2e77601cc0beba392",
      "core/jobs/alg-build/src/double-zbll-symmetry.mts": "d9eec0df2c8a9bf733254c12374c411a55743e6d1e31136cf34a42379bb24901",
      "core/jobs/alg-build/src/double-zbll-selection.mts": "182a07e4a54060c51844279eb2c9cf052e063271b05f19f3ed5e522c97f6d8af",
      "core/jobs/alg-build/src/double-zbll-dashboard.mts": "3bb82da52d3c3297028917a7f63cf124a6f8505b6cdc5a8eb9fe7bd4c2583708",
      "core/jobs/alg-build/src/double-zbll-website-stats.mts": "1909aa32d3794c45c64490cd0e56ec27efa79cd4de805f4d3c362f6dfd098143",
      "core/jobs/alg-build/src/double-zbll-symmetry-state.mts": "98783dad8592761349dcc6cb852e07a4a3fee5caf265bafcf0ab3ca35eedc04b",
      ".tmp/double-zbll-symmetry-v2/model.mts": "ec36d0ba647796b8c979863aa81ab9cb7162a7083398fa898f7b17b76cf4f3a1",
      ".tmp/double-zbll-auf-20261011/run.mts": "20308805d6aef28a4cc94dd4a4140bfb6065ec7fac854c20162067fb55878cbd",
      "solver/333opt/solve_h10.mts": "bc65a841175e08fc71c7aa493132501399e863870e4613a90a2bc9bbca36ecf2",
      "solver/experiments/cube48opt-rust/opt10-zbll-policy.mts": "82492332b5c81d252a1f37fe5fff46494c02d8cb8f28c172e3be2045f17c755c",
      "core/scripts/zbll-memory-budget.mts": "9ff1980d29ab3d1976158daf85c68f99b91eb19098872ceea47fdbe5045bc231",
      "core/scripts/mac-memory-menu.mts": "085791ed113fd3d309fadcfd9302e6b037664cb6b5d3b98e99f1f3279cd9111d",
      "core/scripts/mac-system-recorder.mts": "6256247971dec4bac1c09ba26e2f0b4296fbe63225cbe75c573b6b989339c3ee",
      "solver/experiments/cube48opt-rust/opt10-release.mts": "d0576ec7ada98db00a3d213546a22e7070e57fa2c80329cfd82c1d4518d9900f",
      "solver/experiments/cube48opt-rust/opt10-release.json": "ef1b8403b0ff3d2fe29a4f381c21f121b0c9f57817107dab0265aad474a2d3e6",
      "solver/experiments/cube48opt-rust/opt10-official-policy.mts": "bb6a23a7483b58a065a42065f17611801a2b38b44aaaec961107de3608a7bc89",
      "solver/experiments/cube48opt-rust/multithread-policy.mts": "8c05063016b55b9179731eaf6225e840b4df8e004bed7dcdd95badaf4dd7f47b",
      "solver/experiments/cube48opt-rust/wasm-benchmark.mjs": "9ac4435ab7d9d35b4ae33c78e38b87a0a67d3f0cf0e0e5df233c454d44b8eb2b",
      "solver/experiments/cube48opt-rust/zbll-resume-review.mts": "defdfe34d4fc51664a86bb1a2e342c870389af5147f48bdb6e0eab3294a0af7a"
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
