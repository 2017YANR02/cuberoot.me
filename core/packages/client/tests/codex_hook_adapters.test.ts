// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const CORE_ROOT = join(REPO_ROOT, 'core');
const WRITE_ADAPTER = join(REPO_ROOT, '.codex/hooks/adapt-codex-write-payload.mts');
const COMMAND_ADAPTER = join(REPO_ROOT, '.codex/hooks/adapt-codex-command-payload.mts');
const HOOK_CONFIG = join(REPO_ROOT, '.codex/hooks.json');
const HOOKS = join(REPO_ROOT, '.codex', 'hooks');
const DELETE_FIXTURE = join(HERE, 'fixtures/block-rm-use-trash-fixture.mjs');
const WEBKIT_FIXTURE = join(HERE, 'fixtures/block-webkit-no-webrtc-fixture.mjs');
const ARCHITECTURE_HOOK = join(REPO_ROOT, 'core/scripts/check-architecture-boundaries.mjs');
const RAW_CHECKBOX_HOOK = join(REPO_ROOT, 'core/packages/client/scripts/hook-detect-raw-checkbox.mjs');
const MEMORY_COMPUTE_HOOK = join(HOOKS, 'block-unprotected-memory-compute.mts');

function runProcess(command: string, args: string[], cwd: string, input: string, shell = false) {
  return spawnSync(command, args, {
    cwd,
    input,
    encoding: 'utf8',
    shell,
    windowsHide: true,
  });
}

function runAdapter(adapter: string, target: string | string[], payload: object) {
  return runProcess(
    process.execPath,
    [adapter, ...(Array.isArray(target) ? target : [target])],
    REPO_ROOT,
    JSON.stringify(payload),
  );
}

describe('unprotected memory computation command guard', () => {
  it.each([
    'pnpm --filter @cuberoot/alg-build double-zbll',
    'NO_SWAP=1 pnpm --filter @cuberoot/alg-build double-zbll --limit 1',
    'cd core && pnpm --filter @cuberoot/alg-build double-zbll',
    'node --import tsx core/jobs/alg-build/src/double-zbll.ts',
    'cargo run --release --bin table_generator -- --only h48-h10',
    'cargo run --bin=table_generator',
    './solver/target/release/table_generator --help',
    './solver/target/release/f2leo_analyzer input.csv',
    'node .tmp/double-zbll-1000/run.mts',
    'pnpm stats:scramble:local',
    'pnpm stats:scramble --jobs 333opt',
    'tsx ../scripts/stats/update-local.ts',
    'tsx ../scripts/stats/update-published.ts --publish',
    'pnpm stats:scramble:local --plan; pnpm stats:scramble:local',
    'python3 research/reconer/vision/baseline.py train --annotations data.json',
    'uv run --project research/reconer/vision python research/reconer/vision/baseline.py evaluate --checkpoint model.pt',
    'cd research/reconer && python3 -m vision.baseline predict --image frame.png',
    'cd research/reconer/vision && python3 baseline.py train --batch-size 1',
    'cd research/reconer/vision && python3 -m baseline train',
    'python3 research/reconer/vision/baseline.py doctor; python3 research/reconer/vision/baseline.py train',
    'NO_SWAP=1 python3 research/reconer/vision/baseline.py train',
    'python3 research/reconer/vision/baseline.py train --output ssh',
    'node --import tsx research/reconer/scripts/prepare-video-frames.ts --video sample.mp4',
    'cd research/reconer && pnpm video:reconstruct --request request.json',
    'pnpm -C research/reconer video:prepare --video sample.mp4',
    'cd research/reconer && node --import tsx scripts/reconstruct-observations.ts --request request.json',
    'cd research/reconer && pnpm video:prepare --plan; pnpm video:prepare --video sample.mp4',
    'pnpm --filter @cuberoot/alg-build double-zbll --plan',
    'node .tmp/double-zbll-auf-20261011/run.mts --solve',
    'node .tmp/double-zbll-auf-20261011/full.mts --run',
    'node core/jobs/alg-build/src/double-zbll-symmetry.mts --run',
    'tsgo --noEmit core/jobs/alg-build/src/double-zbll-symmetry.mts; node core/jobs/alg-build/src/double-zbll-symmetry.mts --run',
    'pnpm --filter @cuberoot/alg-build double-zbll:symmetry --plan --run',
    'pnpm --filter @cuberoot/alg-build double-zbll:symmetry --watch --run',
    'bash -lc "pnpm --filter @cuberoot/alg-build double-zbll"',
    'node -e "require(\'node:child_process\').spawnSync(\'solver/target/release/table_generator\', [])"',
    './solver/target/release/solve_h48_h10_16; cargo run --bin table_generator',
    'echo $(pnpm --filter @cuberoot/alg-build double-zbll)',
    'pnpm --filter @cuberoot/alg-build \\\n double-zbll',
  ])('denies without executing the computation: %s', command => {
    const result = runAdapter(COMMAND_ADAPTER, MEMORY_COMPUTE_HOOK, {
      cwd: REPO_ROOT, tool_input: { command },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const output = JSON.parse(result.stdout).hookSpecificOutput;
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toContain(/double-zbll(?:-symmetry|:symmetry)/.test(command)
      ? '受保护入口登记未匹配' : '系统级防交换保护');
  });

  it.each([
    'node solver/333opt/solve_h10.mts --no-counts',
    'nohup caffeinate -i node solver/333opt/solve_h10.mts > run.log &',
    './solver/333opt/solve_h48_h10',
    './solver/target/release/solve_h48_h10_16',
    './solver/target/release/solve_h48_h10_16.exe',
    './solver/target/release/h48_corners_bench',
    './solver/target/release/h48_corners_bench.exe',
    './solver/target/release/h48_bpmx_bench',
    './solver/target/release/h48_bpmx_face_bench',
    './solver/target/release/h48_bpmx_recursive_bench',
    './solver/target/release/h48_survivor_sample_bench',
    'node solver/experiments/h48-corners/run.mts --run --threads=1 --variant=survivor-sample',
    'bash -lc "node solver/333opt/solve_h10.mts --no-counts"',
    'node -e "require(\'node:child_process\').spawnSync(\'node\', [\'solver/333opt/solve_h10.mts\'])"',
    'node -e "require(\'node:child_process\').spawnSync(\'solver/target/release/solve_h48_h10_16\', [])"',
    'node -e "require(\'node:child_process\').spawnSync(\'solver/target/release/h48_corners_bench\', [])"',
  ])('allows H10 solving without an OS no-swap launcher: %s', command => {
    // This checks startup policy only. Resource monitoring belongs to the runner.
    const result = runAdapter(COMMAND_ADAPTER, MEMORY_COMPUTE_HOOK, {
      cwd: REPO_ROOT, tool_input: { command },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('');
  });

  it.each([
    'CUBEOPT_BACKEND=h48 CUBEOPT_H=0 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research solve-h48 0 table.dat 8 20 0',
    'env CUBEOPT_BACKEND=h48 CUBEOPT_H=10 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research query-h48 10 table.dat',
    'cargo run --release --manifest-path solver/experiments/cube48opt-rust/Cargo.toml -- solve-h48 7 table.dat',
    './solver/experiments/cube48opt-rust/target/release/cube48opt-research-snapshot query-h48 9 renamed.dat',
    'CUBEOPT_BACKEND=h48 CUBEOPT_H=7 node solver/experiments/cube48opt-rust/guard.mts h7 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research query-h48 7 table.dat; ./solver/experiments/cube48opt-rust/target/release/cube48opt-research solve-h48 7 table.dat',
    'CUBEOPT_BACKEND=h48 CUBEOPT_H=11 node solver/experiments/cube48opt-rust/guard.mts h11 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research solve-h48 11 renamed.dat',
    'CUBEOPT_BACKEND=h48 CUBEOPT_H=10 node solver/experiments/cube48opt-rust/guard.mts mismatch ./solver/experiments/cube48opt-rust/target/release/cube48opt-research query-h48 11 table.dat',
    'node solver/experiments/cube48opt-rust/guard.mts alias ./solver/experiments/cube48opt-rust/target/release/cube48opt-research solve-h11 renamed.dat',
    '/tmp/renamed-native query-h48 11 /tmp/innocent-name.dat',
    'node -e "require(\'node:child_process\').spawnSync(\'solver/experiments/cube48opt-rust/target/release/cube48opt-research\', [\'solve-h48\', \'11\', \'renamed.dat\'])"',
    'CUBEOPT_BACKEND=h10 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research solve-h10 table.dat 8 20 0',
    'env CUBEOPT_BACKEND=h10 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research query-h10 table.dat',
    'CUBEOPT_BACKEND=h10 node solver/experiments/cube48opt-rust/h10-benchmark.mjs rust c table out --probe',
    'node solver/experiments/cube48opt-rust/verify-h10.mjs rust c table out',
    'node solver/experiments/cube48opt-rust/zbll-benchmark.mjs out',
    '/Users/eula/Developer/cube20src/nxopt22 -t 16 -',
    'node solver/experiments/cube48opt-rust/nxopt-benchmark.mjs',
    'node solver/experiments/cube48opt-rust/guard.mts first node solver/experiments/cube48opt-rust/nxopt-benchmark.mjs; /Users/eula/Developer/cube20src/nxopt22 -t 16 -',
    './solver/experiments/cube48opt-rust/target/zbll/release/cube48opt-research solve-h10 table 8 20 0',
    'CUBEOPT_BACKEND=h10 node solver/experiments/cube48opt-rust/validate-h10.mjs rust c table out',
    'CUBEOPT_BACKEND=h10 node solver/experiments/cube48opt-rust/guard.mts first node solver/experiments/cube48opt-rust/verify-h10.mjs c rust table fixture out; node solver/experiments/cube48opt-rust/validate-h10.mjs rust c table other',
    'node /tmp/guard.mts h10 node solver/experiments/cube48opt-rust/h10-benchmark.mjs rust c table out',
    'node solver/experiments/cube48opt-rust/guard.mts h10 node solver/experiments/cube48opt-rust/h10-benchmark.mjs rust c table out; node solver/experiments/cube48opt-rust/verify-h10.mjs rust c table other',
    'node -e "require(\'node:child_process\').spawnSync(\'node\', [\'solver/experiments/cube48opt-rust/h10-benchmark.mjs\', \'rust\', \'c\', \'table\', \'out\'])"',
    'CUBEOPT_VARIANT=9 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research solve small.bin table.dat',
    'env CUBEOPT_VARIANT=2 node solver/experiments/cube48opt-rust/oracle.mjs generate out',
    'node solver/experiments/cube48opt-rust/oracle.mjs query table.dat fixtures.json out.json',
    'node solver/experiments/cube48opt-rust/oracle.mjs solve table.dat cases.json out.jsonl',
    'node solver/experiments/cube48opt-rust/validate.mjs shallow native small table out',
    'node solver/experiments/cube48opt-rust/benchmark.mjs native small table out --probe',
    'cargo run --release --manifest-path solver/experiments/cube48opt-rust/Cargo.toml -- solve small.bin table.dat',
    'cargo run --bin=cube48opt-research -- solve small.bin table.dat',
    'cd solver/experiments/cube48opt-rust && node oracle.mjs generate out',
    'cd solver/experiments/cube48opt-rust && cargo run --release -- solve small.bin table.dat',
    'bash -lc "node solver/experiments/cube48opt-rust/oracle.mjs generate out"',
    'node solver/experiments/cube48opt-rust/oracle.mjs generate out solver/experiments/cube48opt-rust/guard.mts',
    'node /tmp/guard.mts label node solver/experiments/cube48opt-rust/oracle.mjs generate out',
    './solver/experiments/cube48opt-rust/target/release/cube48opt-research solve small.bin table.dat node solver/experiments/cube48opt-rust/guard.mts',
    'node solver/experiments/cube48opt-rust/guard.mts first node solver/experiments/cube48opt-rust/oracle.mjs generate out; node solver/experiments/cube48opt-rust/oracle.mjs generate unguarded',
    'node solver/experiments/cube48opt-rust/guard.mts first node solver/experiments/cube48opt-rust/oracle.mjs generate out && ./solver/experiments/cube48opt-rust/target/release/cube48opt-research solve small.bin table.dat',
    'node solver/experiments/cube48opt-rust/guard.mts first node solver/experiments/cube48opt-rust/oracle.mjs generate out\nnode solver/experiments/cube48opt-rust/benchmark.mjs native small table other',
    'node solver/experiments/cube48opt-rust/guard.mts first node solver/experiments/cube48opt-rust/oracle.mjs generate "$(node solver/experiments/cube48opt-rust/oracle.mjs generate unguarded)"',
    'node -e "require(\'node:child_process\').spawnSync(\'node\', [\'solver/experiments/cube48opt-rust/oracle.mjs\', \'generate\', \'out\'])"',
    'cp solver/experiments/cube48opt-rust/target/release/cube48opt-research /tmp/snapshot; solver/experiments/cube48opt-rust/target/release/cube48opt-research solve small.bin table.dat',
    'cp solver/experiments/cube48opt-rust/target/release/cube48opt-research /tmp/snapshot && node solver/experiments/cube48opt-rust/benchmark.mjs native small table out',
    'cp "$(solver/experiments/cube48opt-rust/target/release/cube48opt-research solve small.bin table.dat)" /tmp/snapshot',
    'cp <(node solver/experiments/cube48opt-rust/oracle.mjs generate out) /tmp/snapshot',
    'node -e "require(\'node:child_process\').spawnSync(\'solver/experiments/cube48opt-rust/target/release/cube48opt-research\', [\'solve\', \'small.bin\', \'table.dat\'])"',
  ])('requires the cubeopt research guard for each computation segment: %s', command => {
    const result = runAdapter(COMMAND_ADAPTER, MEMORY_COMPUTE_HOOK, {
      cwd: REPO_ROOT, tool_input: { command },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const output = JSON.parse(result.stdout).hookSpecificOutput;
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toContain('cube48opt-rust/guard.mts');
  });

  it.each([
    'CUBEOPT_BACKEND=h48 CUBEOPT_H=0 node --experimental-strip-types solver/experiments/cube48opt-rust/guard.mts h0 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research solve-h48 0 table.dat 8 20 0',
    'env CUBEOPT_BACKEND=h48 CUBEOPT_H=10 tsx solver/experiments/cube48opt-rust/guard.mts h10 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research query-h48 10 table.dat',
    'cp /tmp/h48h11.dat /tmp/h48h11-backup.dat',
    'CUBEOPT_BACKEND=h10 node --experimental-strip-types solver/experiments/cube48opt-rust/guard.mts h10 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research solve-h10 table.dat 8 20 0',
    'env CUBEOPT_BACKEND=h10 node --experimental-strip-types solver/experiments/cube48opt-rust/guard.mts h10 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research query-h10 table.dat',
    'CUBEOPT_BACKEND=h10 tsx solver/experiments/cube48opt-rust/guard.mts h10 node solver/experiments/cube48opt-rust/h10-benchmark.mjs rust c table out --probe',
    'CUBEOPT_BACKEND=h10 node solver/experiments/cube48opt-rust/guard.mts h10 node solver/experiments/cube48opt-rust/verify-h10.mjs rust c table out',
    'CUBEOPT_BACKEND=h10 node solver/experiments/cube48opt-rust/guard.mts h10 node solver/experiments/cube48opt-rust/validate-h10.mjs rust c table out',
    'node --check solver/experiments/cube48opt-rust/h10-benchmark.mjs',
    'CUBEOPT_BACKEND=h10 node solver/experiments/cube48opt-rust/guard.mts double-zbll-batch ./solver/experiments/cube48opt-rust/target/zbll/release/cube48opt-research solve-h10 table 8 20 0',
    'node --check solver/experiments/cube48opt-rust/verify-h10.mjs',
    'CUBEOPT_VARIANT=9 node --experimental-strip-types solver/experiments/cube48opt-rust/guard.mts opt9 node solver/experiments/cube48opt-rust/oracle.mjs generate out',
    'node --import ./core/node_modules/tsx/dist/loader.mjs solver/experiments/cube48opt-rust/guard.mts opt2 ./solver/experiments/cube48opt-rust/target/release/cube48opt-research solve small.bin table.dat',
    'tsx solver/experiments/cube48opt-rust/guard.mts opt3 node solver/experiments/cube48opt-rust/validate.mjs suite native small table out',
    'cd solver/experiments/cube48opt-rust && CUBEOPT_VARIANT=4 node --experimental-strip-types guard.mts opt4 node oracle.mjs generate out',
    'node solver/experiments/cube48opt-rust/guard.mts one node solver/experiments/cube48opt-rust/oracle.mjs generate out; node solver/experiments/cube48opt-rust/guard.mts two node solver/experiments/cube48opt-rust/benchmark.mjs native small table other',
    'node solver/experiments/cube48opt-rust/oracle.mjs inspect',
    'node solver/experiments/cube48opt-rust/oracle.mjs small out',
    'node solver/experiments/cube48opt-rust/oracle.mjs verify-small out',
    'node --check solver/experiments/cube48opt-rust/benchmark.mjs',
    './solver/experiments/cube48opt-rust/target/release/cube48opt-research inspect small.bin',
    'cargo run --release --manifest-path solver/experiments/cube48opt-rust/Cargo.toml -- inspect small.bin',
    'cargo run --release --manifest-path solver/experiments/cube48opt-rust/Cargo.toml --example verify_coordinates -- small',
    'cargo build --release --manifest-path solver/experiments/cube48opt-rust/Cargo.toml',
    "rg 'cube48opt-research solve|oracle.mjs generate' solver/experiments/cube48opt-rust",
    'cp solver/experiments/cube48opt-rust/target/release/cube48opt-research /tmp/snapshot',
    '/bin/cp -p solver/experiments/cube48opt-rust/target/release/cube48opt-research /tmp/cube48opt-research-before-h10',
    'cp solver/experiments/cube48opt-rust/benchmark.mjs /tmp/benchmark.mjs',
    'cp /tmp/snapshot solver/experiments/cube48opt-rust/target/release/cube48opt-research-before-h10',
  ])('allows the exact cubeopt guard or small-table inspection: %s', command => {
    const result = runAdapter(COMMAND_ADAPTER, MEMORY_COMPUTE_HOOK, {
      cwd: REPO_ROOT, tool_input: { command },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('');
  });

  it('resolves research-relative commands using the tool working directory', () => {
    for (const command of ['node oracle.mjs generate out', './target/release/cube48opt-research solve small.bin table.dat']) {
      const result = runAdapter(COMMAND_ADAPTER, MEMORY_COMPUTE_HOOK, {
        cwd: REPO_ROOT, tool_input: { command, workdir: join(REPO_ROOT, 'solver/experiments/cube48opt-rust') },
      });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
    }
  });

  it.each([
    'pnpm --filter @cuberoot/client dev',
    'pnpm --filter @cuberoot/client typecheck',
    'pnpm --filter @cuberoot/alg-build typecheck',
    'pnpm --filter @cuberoot/alg-build double-zbll:symmetry --plan',
    'pnpm --filter @cuberoot/alg-build double-zbll:symmetry --verify-checkpoint',
    'pnpm --filter @cuberoot/alg-build double-zbll:symmetry --watch',
    'shasum -a 256 solver/333opt/solve_h10.mts',
    'pnpm stats:scramble:local --plan',
    'tsx ../scripts/stats/update-local.ts --plan',
    'pnpm stats:scramble:publish --publish --publish-only',
    "rg -n 'double-zbll|table_generator' .codex",
    'cat solver/333opt/solve_h10.mts',
    'ls solver/target/release/solve_h48_h10_16',
    'git diff -- solver/src/bin/table_generator.rs',
    'cargo build --release --bin table_generator',
    'core/packages/client/node_modules/.bin/tsgo --noEmit core/jobs/alg-build/src/double-zbll-symmetry.mts',
    'tsc --noEmit core/jobs/alg-build/src/double-zbll-symmetry.mts',
    'node .tmp/double-zbll-expanded-benchmark/prepare.mts',
    'python3 research/reconer/vision/baseline.py doctor',
    'python3 research/reconer/vision/baseline.py audit --annotations data.json',
    'python3 research/reconer/vision/baseline.py train --help',
    'cd research/reconer && python3 -m vision.baseline --help',
    'ssh gpu-host python3 /srv/cuberoot.me/research/reconer/vision/baseline.py train',
    'cd research/reconer && pnpm video:prepare --plan --video sample.mp4',
    'node --import tsx research/reconer/scripts/reconstruct-observations.ts --help',
    'pnpm -C research/reconer video:reconstruct --plan --request request.json',
    '# pnpm --filter @cuberoot/alg-build double-zbll\nnode --version',
  ])('allows ordinary development and inspection: %s', command => {
    const result = runAdapter(COMMAND_ADAPTER, MEMORY_COMPUTE_HOOK, {
      cwd: REPO_ROOT, tool_input: { command },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('supports cmd payloads and honors tool workdir for scope', () => {
    for (const cwd of [CORE_ROOT, '/tmp']) {
      const result = runAdapter(COMMAND_ADAPTER, MEMORY_COMPUTE_HOOK, {
        cwd: REPO_ROOT, tool_input: { cmd: 'pnpm stats:scramble:local', workdir: cwd },
      });
      expect(result.status).toBe(0);
      if (cwd === CORE_ROOT) expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
      else expect(result.stdout).toBe('');
    }
  });

  it('fails open for missing or malformed payloads', () => {
    for (const input of ['bad JSON', '{}', '{"tool_input":null}']) {
      const result = runProcess(process.execPath, [MEMORY_COMPUTE_HOOK], CORE_ROOT, input);
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    }
  });

  it('registers the guard through the shared adapter on both hosts', () => {
    const config = JSON.parse(readFileSync(HOOK_CONFIG, 'utf8'));
    const entry = config.hooks.PreToolUse.find((group: { matcher: string }) => group.matcher === '^Bash$');
    for (const field of ['command', 'commandWindows']) {
      expect(entry.hooks.some((hook: Record<string, string>) => hook[field]?.includes('adapt-codex-command-payload.mts')
        && hook[field]?.includes('block-unprotected-memory-compute.mts'))).toBe(true);
    }
  });
});

describe('Codex hook payload adapters', () => {
  it('passes full search patches directly and preserves deny/fail-open output', () => {
    const config = JSON.parse(readFileSync(HOOK_CONFIG, 'utf8'));
    const hook = config.hooks.PreToolUse.find((entry: { matcher: string }) => entry.matcher === 'apply_patch').hooks.find((entry: { command: string }) => entry.command.endsWith('scripts/hook-detect-manual-search.mjs'));
    expect(hook).toBeDefined();
    expect(hook.command).not.toContain('adapt-codex-write-payload');
    const patch = `*** Begin Patch\n*** Add File: core/packages/client/components/SearchProbe.tsx\n+<SearchInput onKeyDown={e => e.key === 'Enter' && search()} />\n*** End Patch`;
    const result = runProcess(hook.command, [], REPO_ROOT, JSON.stringify({ tool_input: { command: patch } }), true);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
    for (const input of ['bad JSON', '{}', '{"tool_input":null}']) {
      const result = runProcess(hook.command, [], CORE_ROOT, input, true);
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    }
  });

  it('denies duplicate scenery material through the shared write adapter', () => {
    const patch = '*** Begin Patch\n*** Add File: core/packages/client/app/[lang]/probe/material.css\n+body[data-site-scenery] .menu { background: var(--popover); }\n*** End Patch';
    const result = runAdapter(WRITE_ADAPTER, join(CORE_ROOT, 'packages/client/scripts/hook-detect-site-material.mjs'), {
      tool_name: 'apply_patch', tool_input: { command: patch },
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('denies shared-control positioning regressions through the registered write hook', () => {
    const target = join(HOOKS, 'block-css-position-cascade.mts');
    const config = JSON.parse(readFileSync(HOOK_CONFIG, 'utf8'));
    const command = config.hooks.PreToolUse.find((entry: { matcher: string }) => entry.matcher === 'apply_patch').hooks[0].command;
    expect(command).toContain('block-css-position-cascade.mts');
    const file = join(CORE_ROOT, 'packages/client/components/position-hook-probe.css');
    for (const selector of ['.trainer-opts--top', '.mem-pay-close']) {
      const patch = `*** Begin Patch\n*** Add File: ${file}\n+${selector} { position: absolute; }\n*** End Patch`;
      const result = runAdapter(WRITE_ADAPTER, target, { tool_input: { command: patch } });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
    }
    const legalPatch = `*** Begin Patch\n*** Add File: ${file}\n+.settings-popover.trainer-opts--top { position: absolute; }\n*** End Patch`;
    const legal = runAdapter(WRITE_ADAPTER, target, { tool_input: { command: legalPatch } });
    expect(legal.status).toBe(0);
    expect(legal.stdout).toBe('');
    for (const input of ['bad JSON', '{}', '{"tool_input":null}']) {
      const result = runProcess(process.execPath, [target], CORE_ROOT, input);
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    }
  });

  it('registers only cross-platform Node hooks', () => {
    const config = JSON.parse(readFileSync(HOOK_CONFIG, 'utf8')) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string; commandWindows: string }> }>>;
    };
    const commands: string[] = [];
    for (const groups of Object.values(config.hooks)) {
      for (const group of groups) {
        for (const hook of group.hooks) {
          expect(hook.commandWindows).toBe(hook.command);
          commands.push(hook.command);
        }
      }
    }

    expect(commands.join('\n')).not.toMatch(/(?:pwsh|powershell|\.ps1)/i);
    expect(commands.join('\n')).not.toContain('$(');
  });

  it.each([REPO_ROOT, CORE_ROOT])('runs every configured hook independently of cwd: %s', (cwd) => {
    const config = JSON.parse(readFileSync(HOOK_CONFIG, 'utf8')) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    for (const [event, groups] of Object.entries(config.hooks)) {
      for (const group of groups) {
        for (const hook of group.hooks) {
          const result = runProcess(hook.command, [], cwd, '{}', true);
          expect(result.status, `${event} failed from ${cwd}: ${result.stderr}`).toBe(0);
        }
      }
    }
  });

  it('emits both PostToolUse reminders through Node', () => {
    const calc = runAdapter(join(HOOKS, 'calc-test-reminder.mts'), [], {
      tool_input: { command: '*** Update File: core/packages/client/app/[lang]/calc/page.tsx' },
    });
    const migration = runAdapter(join(HOOKS, 'dev-data-sync-reminder.mts'), [], {
      tool_input: { command: '*** Add File: core/apps/api/migrations/9999_probe.sql' },
    });

    expect(JSON.parse(calc.stdout).hookSpecificOutput.additionalContext).toContain('/zh/calc');
    expect(JSON.parse(migration.stdout).hookSpecificOutput.additionalContext).toContain('/dev/schema');
  });

  it('keeps the banned-word decision contract without embedding a banned term', () => {
    const list = JSON.parse(readFileSync(join(REPO_ROOT, '.codex', 'banned-words.json'), 'utf8')) as {
      words: Array<{ word: string }>;
    };
    const result = runAdapter(join(HOOKS, 'block-banned-words.mts'), [], {
      tool_input: {
        file_path: join(REPO_ROOT, 'core/packages/client/app/probe/page.tsx'),
        content: String(list.words[0].word),
      },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('reports no SessionStart guard-documentation drift', () => {
    const result = runAdapter(join(HOOKS, 'check-guards-drift-session.mts'), [], {});

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('uses Codex canonical hook matcher names', () => {
    const config = JSON.parse(readFileSync(HOOK_CONFIG, 'utf8')) as {
      hooks: { PreToolUse: Array<{ matcher: string }> };
    };
    const matchers = config.hooks.PreToolUse.map(({ matcher }) => matcher);

    expect(matchers).toContain('^Bash$');
    expect(matchers).toContain('apply_patch');
    expect(matchers).not.toContain('shell_command');
  });

  it('runs the architecture detector before slower general write guards', () => {
    const config = JSON.parse(readFileSync(HOOK_CONFIG, 'utf8')) as {
      hooks: {
        PreToolUse: Array<{
          matcher: string;
          hooks: Array<{ command: string; commandWindows: string }>;
        }>;
      };
    };
    const writeHook = config.hooks.PreToolUse
      .find(({ matcher }) => matcher === 'apply_patch')
      ?.hooks[0];

    expect(writeHook?.commandWindows).toBe(writeHook?.command);
    for (const command of [writeHook?.command ?? '', writeHook?.commandWindows ?? '']) {
      expect(command.indexOf('check-architecture-boundaries.mjs')).toBeGreaterThanOrEqual(0);
      expect(command.indexOf('check-architecture-boundaries.mjs'))
        .toBeLessThan(command.indexOf('hook-detect-component-reimplementation.mjs'));
    }
  });

  it('extracts an embedded apply_patch and preserves the affected file path', () => {
    const target = RAW_CHECKBOX_HOOK;
    const patch = [
      '*** Begin Patch',
      '*** Add File: core/packages/client/app/probe/page.tsx',
      '+export default function Probe() {',
      '+  return <input type="checkbox" />;',
      '+}',
      '*** End Patch',
    ].join('\n');
    const result = runAdapter(WRITE_ADAPTER, target, {
      tool_name: 'exec',
      cwd: REPO_ROOT,
      tool_input: `const patch = ${JSON.stringify(patch)}; text(await tools.apply_patch(patch));`,
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('passes harmless patches without hook output', () => {
    const target = RAW_CHECKBOX_HOOK;
    const patch = [
      '*** Begin Patch',
      '*** Add File: core/packages/client/app/probe/page.tsx',
      '+export default function Probe() { return null; }',
      '*** End Patch',
    ].join('\n');
    const result = runAdapter(WRITE_ADAPTER, target, {
      tool_name: 'exec',
      cwd: REPO_ROOT,
      tool_input: `const patch = ${JSON.stringify(patch)}; text(await tools.apply_patch(patch));`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('routes an architecture violation through the write adapter', () => {
    const probe = ['core', 'packages', 'client/lib/architecture-hook-probe.ts'].join('/');
    const patch = [
      '*** Begin Patch',
      `*** Add File: ${probe}`,
      "+import type { Lang } from '@cuberoot/shared';",
      '*** End Patch',
    ].join('\n');
    const result = runAdapter(WRITE_ADAPTER, ARCHITECTURE_HOOK, {
      tool_name: 'apply_patch',
      cwd: REPO_ROOT,
      tool_input: { command: patch },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('batches all writes through architecture checks before any general guard', () => {
    const files = Array.from({ length: 4 }, (_, index) => [
      '*** Add File: core/packages/client/app/probe-' + index + '/page.tsx',
      index === 0
        ? '+export default function Probe() { return <input type="checkbox" />; }'
        : '+export default function Probe() { return null; }',
    ]).flat();
    const patch = [
      '*** Begin Patch',
      ...files,
      '*** Add File: core/apps/api/src/late-architecture-probe.ts',
      "+import '@/components/AppLink';",
      '*** End Patch',
    ].join('\n');
    const result = runAdapter(WRITE_ADAPTER, [RAW_CHECKBOX_HOOK, ARCHITECTURE_HOOK], {
      tool_name: 'apply_patch',
      cwd: REPO_ROOT,
      tool_input: { command: patch },
    });
    const output = JSON.parse(result.stdout).hookSpecificOutput;

    expect(result.status).toBe(0);
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toContain('cross-package-alias-import');
  });

  it.each([
    ['vendor wildcard', '@cuberoot/vendor-sr-puzzlegen/private'],
    ['workspace private subpath', '@cuberoot/visualcube/private'],
  ])('does not bypass %s imports on Windows paths', (_label, specifier) => {
    const probe = ['core', 'packages', 'client/lib/workspace-hook-probe.ts'].join('/');
    const patch = [
      '*** Begin Patch',
      `*** Add File: ${probe}`,
      `+import puzzle from '${specifier}';`,
      '*** End Patch',
    ].join('\n');
    const result = runAdapter(WRITE_ADAPTER, ARCHITECTURE_HOOK, {
      tool_name: 'apply_patch',
      cwd: REPO_ROOT,
      tool_input: { command: patch },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('allows a declared public workspace entrypoint', () => {
    const probe = ['core', 'packages', 'client/lib/workspace-hook-probe.ts'].join('/');
    const patch = [
      '*** Begin Patch',
      `*** Add File: ${probe}`,
      "+import { cubeSVG } from '@cuberoot/visualcube';",
      '*** End Patch',
    ].join('\n');
    const result = runAdapter(WRITE_ADAPTER, ARCHITECTURE_HOOK, {
      tool_name: 'apply_patch',
      cwd: REPO_ROOT,
      tool_input: { command: patch },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('extracts the native apply_patch command payload', () => {
    const target = RAW_CHECKBOX_HOOK;
    const patch = [
      '*** Begin Patch',
      '*** Add File: core/packages/client/app/probe/page.tsx',
      '+export default function Probe() { return <input type="checkbox" />; }',
      '*** End Patch',
    ].join('\n');
    const result = runAdapter(WRITE_ADAPTER, target, {
      tool_name: 'apply_patch',
      cwd: REPO_ROOT,
      tool_input: { command: patch },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('does not drop added content that begins with two plus signs', () => {
    const target = RAW_CHECKBOX_HOOK;
    const patch = [
      '*** Begin Patch',
      '*** Add File: core/packages/client/app/probe/page.tsx',
      '+++<input type="checkbox" />',
      '*** End Patch',
    ].join('\n');
    const result = runAdapter(WRITE_ADAPTER, target, {
      tool_name: 'apply_patch',
      cwd: REPO_ROOT,
      tool_input: { command: patch },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('checks moved files using the destination path', () => {
    const target = RAW_CHECKBOX_HOOK;
    const patch = [
      '*** Begin Patch',
      '*** Update File: probe.txt',
      '*** Move to: core/packages/client/app/probe/page.tsx',
      '@@',
      '-plain text',
      '+export default function Probe() { return <input type="checkbox" />; }',
      '*** End Patch',
    ].join('\n');
    const result = runAdapter(WRITE_ADAPTER, target, {
      tool_name: 'apply_patch',
      cwd: REPO_ROOT,
      tool_input: { command: patch },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('checks the existing source content for a move without hunks', () => {
    const target = RAW_CHECKBOX_HOOK;
    const patch = [
      '*** Begin Patch',
      '*** Update File: core/packages/client/tests/codex_hook_adapters.test.ts',
      '*** Move to: core/packages/client/app/probe/page.tsx',
      '*** End Patch',
    ].join('\n');
    const result = runAdapter(WRITE_ADAPTER, target, {
      tool_name: 'apply_patch',
      cwd: REPO_ROOT,
      tool_input: { command: patch },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('extracts an embedded tools.shell_command call for older clients', () => {
    const target = DELETE_FIXTURE;
    const command = 'Remove-Item -LiteralPath D:/cube/cuberoot.me/probe.txt';
    const result = runAdapter(COMMAND_ADAPTER, target, {
      tool_name: 'exec',
      cwd: REPO_ROOT,
      tool_input: `const r = await tools.shell_command({ command: ${JSON.stringify(command)} }); text(r);`,
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('passes the canonical Bash payload to command guards', () => {
    const target = DELETE_FIXTURE;
    const command = 'Remove-Item -LiteralPath D:/cube/cuberoot.me/probe.txt';
    const result = runAdapter(COMMAND_ADAPTER, target, {
      tool_name: 'Bash',
      cwd: REPO_ROOT,
      tool_input: { command },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it.each([
    "[System.IO.File]::Delete('D:/cube/cuberoot.me/probe.txt')",
    'find D:/cube/cuberoot.me -name probe.txt -delete',
  ])('does not fast-gate alternate deletion syntax: %s', (command) => {
    const target = DELETE_FIXTURE;
    const result = runAdapter(COMMAND_ADAPTER, target, {
      tool_name: 'Bash',
      cwd: REPO_ROOT,
      tool_input: { command },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('does not fast-gate spaced Playwright launch syntax', () => {
    const target = WEBKIT_FIXTURE;
    const patch = [
      '*** Begin Patch',
      '*** Add File: .tmp/probe.mjs',
      '+const browser = await webkit . launch();',
      '*** End Patch',
    ].join('\n');
    const result = runAdapter(WRITE_ADAPTER, target, {
      tool_name: 'apply_patch',
      cwd: REPO_ROOT,
      tool_input: { command: patch },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });
});
