import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

function repoPath(...segments: string[]): string {
  return segments.join('/');
}

function corePath(...segments: string[]): string {
  return repoPath('core', ...segments);
}

function packagePath(packageName: string, ...segments: string[]): string {
  return corePath('packages', packageName, ...segments);
}

function appPath(appName: string, ...segments: string[]): string {
  return corePath('apps', appName, ...segments);
}

function jobPath(jobName: string, ...segments: string[]): string {
  return corePath('jobs', jobName, ...segments);
}

function readWorkflow(workflowName: string): string {
  return readFileSync(join(REPO_ROOT, '.github', 'workflows', workflowName), 'utf8');
}

function readStepLines(workflowName: string, stepName: string): { lines: string[]; stepIndent: number } {
  const lines = readWorkflow(workflowName).split(/\r?\n/);
  const header = `- name: ${stepName}`;
  const stepStart = lines.findIndex((line) => line.trim() === header);
  if (stepStart < 0) throw new Error(`Missing workflow step ${stepName} in ${workflowName}`);
  const stepIndent = indentation(lines[stepStart]);
  const stepEnd = lines.findIndex((line, index) => (
    index > stepStart
    && line.trim().startsWith('- ')
    && indentation(line) <= stepIndent
  ));
  const end = stepEnd < 0 ? lines.length : stepEnd;
  return { lines: lines.slice(stepStart + 1, end), stepIndent };
}

function readStepRun(workflowName: string, stepName: string): string {
  const { lines, stepIndent } = readStepLines(workflowName, stepName);
  const run = lines.findIndex((line) => (
    indentation(line) === stepIndent + 2
    && line.trim() === 'run: |'
  ));
  if (run < 0) throw new Error(`Missing run block for ${stepName} in ${workflowName}`);
  const runIndent = indentation(lines[run]);
  return lines.slice(run + 1)
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    .map((line) => line.slice(Math.min(line.length, runIndent + 2)))
    .join('\n');
}

function readStepEnv(workflowName: string, stepName: string): Record<string, string> {
  const { lines, stepIndent } = readStepLines(workflowName, stepName);
  const envStart = lines.findIndex((line) => (
    indentation(line) === stepIndent + 2
    && line.trim() === 'env:'
  ));
  if (envStart < 0) throw new Error(`Missing env block for ${stepName} in ${workflowName}`);
  const envIndent = indentation(lines[envStart]);
  const envEndOffset = lines.slice(envStart + 1).findIndex((line) => (
    line.trim() && indentation(line) <= envIndent
  ));
  const envEnd = envEndOffset < 0 ? lines.length : envStart + 1 + envEndOffset;
  return Object.fromEntries(lines.slice(envStart + 1, envEnd)
    .filter((line) => line.trim())
    .map((line) => {
      const entry = line.trim().match(/^([A-Z0-9_]+):\s*(.+)$/);
      if (!entry) throw new Error(`Unsupported env YAML for ${stepName}: ${line.trim()}`);
      return [entry[1], entry[2]];
    }));
}

const WORKSPACE_INPUT_OVERRIDES: Readonly<Record<string, readonly string[]>> = {
  '@cuberoot/stack-kernel': [
    packagePath('stack-kernel', 'package.json'),
    packagePath('stack-kernel', 'pkg', '**'),
  ],
};

const CONSUMER_WORKSPACE_ROOTS = {
  client: [packagePath('client'), appPath('web')],
  server: [packagePath('server'), appPath('api')],
} as const;

function readConsumerPackageJson(consumer: keyof typeof CONSUMER_WORKSPACE_ROOTS): {
  dependencies?: Record<string, string>;
} {
  const expectedName = `@cuberoot/${consumer}`;
  const matches = CONSUMER_WORKSPACE_ROOTS[consumer].filter((root) => {
    const manifestPath = join(REPO_ROOT, ...root.split('/'), 'package.json');
    if (!existsSync(manifestPath)) return false;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name?: string };
    return manifest.name === expectedName;
  });
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${expectedName} workspace, found ${matches.length}`);
  }
  const workspaceRoot = matches[0];
  if (!workspaceRoot) throw new Error(`Missing ${expectedName} workspace after validation`);
  return JSON.parse(readFileSync(join(REPO_ROOT, ...workspaceRoot.split('/'), 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
}

function workspaceDependencyInputs(consumer: keyof typeof CONSUMER_WORKSPACE_ROOTS): string[] {
  return Object.entries(readConsumerPackageJson(consumer).dependencies ?? {})
    .filter(([name, version]) => name.startsWith('@cuberoot/') && version.startsWith('workspace:'))
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([name]) => WORKSPACE_INPUT_OVERRIDES[name] ?? [packagePath(name.slice('@cuberoot/'.length), '**')]);
}

const CORE_PATHS = [
  repoPath('.node-version'),
  packagePath('server', '**'),
  appPath('api', '**'),
  ...workspaceDependencyInputs('server'),
  corePath('cube555-daemon', 'Daemon.java'),
  corePath('package.json'),
  corePath('pnpm-lock.yaml'),
  corePath('pnpm-workspace.yaml'),
  corePath('tsconfig.base.json'),
  corePath('patches', '**'),
  corePath('scripts', 'resolve-workspace-path.mjs'),
  repoPath('.github', 'workflows', 'deploy_core.yml'),
] as const;

const NEXT_PATHS = [
  repoPath('.node-version'),
  packagePath('client', '**'),
  appPath('web', '**'),
  ...workspaceDependencyInputs('client'),
  corePath('package.json'),
  corePath('pnpm-lock.yaml'),
  corePath('pnpm-workspace.yaml'),
  corePath('tsconfig.base.json'),
  corePath('patches', '**'),
  corePath('scripts', 'resolve-workspace-path.mjs'),
  corePath('scripts', 'build-cubing-worker.mjs'),
  repoPath('ops', 'systemd', 'cuberoot-next.service'),
  repoPath('.github', 'workflows', 'deploy_next.yml'),
] as const;

const STATS_PATHS = [
  packagePath('stats-build', 'src', '**', '*.ts'),
  jobPath('stats-build', 'src', '**', '*.ts'),
  corePath('scripts', 'resolve-workspace-path.mjs'),
] as const;

const TEST_PATHS = [
  repoPath('.node-version'),
  corePath('**'),
  `!${packagePath('platform', '**')}`,
  repoPath('docs', 'platform-capability-manifest.json'),
  repoPath('docs', 'platform-unification-plan.md'),
  '*.ps1',
  repoPath('.sync', '**'),
  repoPath('scripts', 'upstream', '**'),
  repoPath('ops', 'nginx', '**'),
  repoPath('.github', 'workflows', 'backup_recon.yml'),
  repoPath('.github', 'workflows', 'best2x2_drift.yml'),
  repoPath('.github', 'workflows', 'deploy_core.yml'),
  repoPath('.github', 'workflows', 'deploy_next.yml'),
  repoPath('.github', 'workflows', 'elev_backfill.yml'),
  repoPath('.github', 'workflows', 'icons_drift.yml'),
  repoPath('.github', 'workflows', 'regulation_drift.yml'),
  repoPath('.github', 'workflows', 'sq1_pbl_drift.yml'),
  repoPath('.github', 'workflows', 'stats.yml'),
  repoPath('.github', 'workflows', 'test.yml'),
  repoPath('.github', 'workflows', 'update_upcoming.yml'),
] as const;

function indentation(line: string): number {
  return line.length - line.trimStart().length;
}

function blockEnd(lines: string[], start: number, parentIndent: number): number {
  for (let index = start + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed && !trimmed.startsWith('#') && indentation(lines[index]) <= parentIndent) {
      return index;
    }
  }
  return lines.length;
}

function findMappingKey(
  lines: string[],
  key: string,
  start: number,
  end: number,
  expectedIndent: number,
): number {
  const needle = `${key}:`;
  for (let index = start; index < end; index += 1) {
    if (indentation(lines[index]) === expectedIndent && lines[index].trim() === needle) {
      return index;
    }
  }
  throw new Error(`Missing YAML mapping key ${key}`);
}

function parseYamlScalar(source: string): string {
  if (source.startsWith("'")) {
    if (!source.endsWith("'")) throw new Error(`Unterminated single-quoted YAML scalar: ${source}`);
    return source.slice(1, -1).replaceAll("''", "'");
  }
  if (source.startsWith('"')) return JSON.parse(source) as string;
  if (/\s+#/.test(source)) return source.replace(/\s+#.*$/, '');
  return source;
}

function readEventPaths(workflowName: string, eventName: 'pull_request' | 'push'): string[] {
  const source = readWorkflow(workflowName);
  const lines = source.split(/\r?\n/);
  const on = findMappingKey(lines, 'on', 0, lines.length, 0);
  const onEnd = blockEnd(lines, on, 0);
  const event = findMappingKey(lines, eventName, on + 1, onEnd, 2);
  const eventEnd = blockEnd(lines, event, 2);
  const paths = findMappingKey(lines, 'paths', event + 1, eventEnd, 4);
  const pathsEnd = blockEnd(lines, paths, 4);

  const values: string[] = [];
  for (let index = paths + 1; index < pathsEnd; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (indentation(lines[index]) <= 4 || !trimmed.startsWith('- ')) {
      throw new Error(`Unsupported paths YAML at ${workflowName}:${index + 1}`);
    }
    values.push(parseYamlScalar(trimmed.slice(2).trim()));
  }
  if (!values.length) throw new Error(`No on.${eventName}.paths entries in ${workflowName}`);
  return values;
}

function globPattern(pattern: string): RegExp {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      if (pattern[index + 2] === '/') {
        source += '(?:.*/)?';
        index += 2;
      } else {
        source += '.*';
        index += 1;
      }
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`);
}

function workflowTriggers(patterns: string[], changedPaths: string[]): boolean {
  if (!patterns.some((pattern) => !pattern.startsWith('!'))) {
    throw new Error('GitHub paths filters require at least one positive pattern');
  }
  return changedPaths.some((changedPath) => {
    const normalizedPath = changedPath.replaceAll('\\', '/');
    let included = false;
    for (const entry of patterns) {
      const excluded = entry.startsWith('!');
      const pattern = excluded ? entry.slice(1) : entry;
      if (globPattern(pattern).test(normalizedPath)) included = !excluded;
    }
    return included;
  });
}

describe('deployment workflow path contracts', () => {
  const corePaths = readEventPaths('deploy_core.yml', 'push');
  const nextPaths = readEventPaths('deploy_next.yml', 'push');
  const statsPaths = readEventPaths('stats.yml', 'push');
  const testPushPaths = readEventPaths('test.yml', 'push');
  const testPullRequestPaths = readEventPaths('test.yml', 'pull_request');

  it('keeps the Core deploy boundary limited to real API production inputs', () => {
    expect(corePaths).toEqual(CORE_PATHS);

    const cases = [
      [packagePath('server', 'src', 'index.ts'), true],
      [appPath('api', 'src', 'index.ts'), true],
      [packagePath('shared', 'src', 'account.ts'), true],
      [packagePath('visualcube', 'src', 'index.ts'), true],
      [packagePath('vendor-sr-puzzlegen', 'src', 'index.ts'), true],
      [packagePath('puzzle-render-core', 'src', 'index.ts'), true],
      [packagePath('puzzle-solvers', 'src', 'clock.ts'), false],
      [packagePath('puzzle-solvers', 'src', 'sq2.ts'), false],
      [corePath('cube555-daemon', 'Daemon.java'), true],
      [corePath('package.json'), true],
      [corePath('pnpm-lock.yaml'), true],
      [corePath('pnpm-workspace.yaml'), true],
      [corePath('tsconfig.base.json'), true],
      [corePath('patches', 'cubing@0.63.3.patch'), true],
      [corePath('scripts', 'resolve-workspace-path.mjs'), true],
      [repoPath('.github', 'workflows', 'deploy_core.yml'), true],
      [packagePath('client', 'app', '[lang]', 'page.tsx'), false],
      [appPath('web', 'app', '[lang]', 'page.tsx'), false],
      [packagePath('mobile', 'src', 'App.tsx'), false],
      [appPath('mobile', 'src', 'App.tsx'), false],
      [packagePath('miniprogram', 'src', 'app.ts'), false],
      [appPath('miniprogram', 'src', 'app.ts'), false],
      [packagePath('stack-kernel', 'src', 'lib.rs'), false],
      [repoPath('ops', 'nginx', 'api.cuberoot.me.conf'), false],
    ] as const;

    for (const [path, expected] of cases) {
      expect(workflowTriggers(corePaths, [path]), path).toBe(expected);
    }
  });

  it('keeps the Next deploy boundary aligned with its build and runtime inputs', () => {
    expect(nextPaths).toEqual(NEXT_PATHS);

    const cases = [
      [packagePath('client', 'app', '[lang]', 'page.tsx'), true],
      [appPath('web', 'app', '[lang]', 'page.tsx'), true],
      [packagePath('shared', 'src', 'account.ts'), true],
      [packagePath('visualcube', 'src', 'index.ts'), true],
      [packagePath('vendor-sr-puzzlegen', 'src', 'index.ts'), true],
      [packagePath('stack-kernel', 'pkg', 'stack_kernel_bg.wasm'), true],
      [packagePath('stack-kernel', 'src', 'lib.rs'), false],
      [packagePath('puzzle-render-core', 'src', 'index.ts'), true],
      [packagePath('puzzle-solvers', 'src', 'clock.ts'), true],
      [packagePath('puzzle-solvers', 'src', 'sq2.ts'), true],
      [corePath('package.json'), true],
      [corePath('pnpm-lock.yaml'), true],
      [corePath('pnpm-workspace.yaml'), true],
      [corePath('tsconfig.base.json'), true],
      [corePath('patches', 'cubing@0.63.3.patch'), true],
      [corePath('scripts', 'resolve-workspace-path.mjs'), true],
      [corePath('scripts', 'build-cubing-worker.mjs'), true],
      [repoPath('ops', 'systemd', 'cuberoot-next.service'), true],
      [repoPath('.github', 'workflows', 'deploy_next.yml'), true],
      [packagePath('server', 'src', 'index.ts'), false],
      [appPath('api', 'src', 'index.ts'), false],
      [packagePath('mobile', 'src', 'App.tsx'), false],
      [appPath('mobile', 'src', 'App.tsx'), false],
      [packagePath('miniprogram', 'src', 'app.ts'), false],
      [appPath('miniprogram', 'src', 'app.ts'), false],
      [repoPath('ops', 'nginx', 'www.cuberoot.me.conf'), false],
    ] as const;

    for (const [path, expected] of cases) {
      expect(workflowTriggers(nextPaths, [path]), path).toBe(expected);
    }
  });

  it('keeps the stats workflow limited to stats-build source changes in either layout', () => {
    expect(statsPaths).toEqual(STATS_PATHS);

    const cases = [
      [packagePath('stats-build', 'src', 'elevation.ts'), true],
      [packagePath('stats-build', 'src', 'bin', 'compute.ts'), true],
      [jobPath('stats-build', 'src', 'elevation.ts'), true],
      [jobPath('stats-build', 'src', 'bin', 'compute.ts'), true],
      [corePath('scripts', 'resolve-workspace-path.mjs'), true],
      [jobPath('wb-build', 'src', 'index.ts'), false],
      [jobPath('alg-build', 'src', 'index.ts'), false],
      [appPath('web', 'app', '[lang]', 'page.tsx'), false],
      [appPath('api', 'src', 'index.ts'), false],
    ] as const;

    for (const [path, expected] of cases) {
      expect(workflowTriggers(statsPaths, [path]), path).toBe(expected);
    }
  });

  it('fails workspace resolution before publishing an empty workflow output', () => {
    const expectedResolverCalls = {
      'backup_recon.yml': 1,
      'best2x2_drift.yml': 1,
      'deploy_core.yml': 1,
      'deploy_next.yml': 1,
      'elev_backfill.yml': 1,
      'icons_drift.yml': 1,
      'regulation_drift.yml': 1,
      'sq1_pbl_drift.yml': 1,
      'stats.yml': 2,
      'test.yml': 4,
      'update_upcoming.yml': 1,
    } as const;

    for (const [workflowName, expectedCalls] of Object.entries(expectedResolverCalls)) {
      const workflow = readWorkflow(workflowName);
      expect(workflow).not.toMatch(
        /echo\s+"(?:api|icons|mobile|stats|web)=\$\(node scripts\/resolve-workspace-path\.mjs/,
      );
      const assignments = [...workflow.matchAll(
        /^[ \t]+(api|icons|mobile|stats|web)="\$\(node scripts\/resolve-workspace-path\.mjs (@cuberoot\/[^)]+)\)"$/gm,
      )];
      expect(assignments, workflowName).toHaveLength(expectedCalls);
      const assignmentOutputPairs = [...workflow.matchAll(
        /^[ \t]+(api|icons|mobile|stats|web)="\$\(node scripts\/resolve-workspace-path\.mjs @cuberoot\/[^)]+\)"\n[ \t]+echo "\1=\$\1" >> "\$GITHUB_OUTPUT"$/gm,
      )];
      expect(assignmentOutputPairs, workflowName).toHaveLength(expectedCalls);
    }
  });

  it('runs cross-layer contract tests when their nginx evidence changes', () => {
    expect(testPushPaths).toEqual(TEST_PATHS);
    expect(testPullRequestPaths).toEqual(TEST_PATHS);
    for (const paths of [testPushPaths, testPullRequestPaths]) {
      expect(workflowTriggers(paths, [repoPath('ops', 'nginx', 'www.cuberoot.me.conf')])).toBe(true);
      expect(workflowTriggers(paths, [repoPath('ops', 'nginx', 'api.cuberoot.me.conf')])).toBe(true);
      expect(workflowTriggers(paths, [repoPath('.github', 'workflows', 'stats.yml')])).toBe(true);
      expect(workflowTriggers(paths, [repoPath('sync_upstream.ps1')])).toBe(true);
      expect(workflowTriggers(paths, [repoPath('_sync_blddb.ps1')])).toBe(true);
      expect(workflowTriggers(paths, [repoPath('_sync_cstimer.ps1')])).toBe(true);
      expect(workflowTriggers(paths, [repoPath('nested', '_sync_cstimer.ps1')])).toBe(false);
      expect(workflowTriggers(paths, [repoPath('.sync', 'sync_utils.ps1')])).toBe(true);
      expect(workflowTriggers(paths, [repoPath('scripts', 'upstream', 'sync-all.ps1')])).toBe(true);
      expect(workflowTriggers(paths, [packagePath('platform', 'README.md')])).toBe(false);
      expect(workflowTriggers(paths, [packagePath('server', 'src', 'index.ts')])).toBe(true);
    }
  });

  it('applies GitHub path patterns in order, including exclusion and re-inclusion', () => {
    const clientPath = packagePath('client');
    const patterns = [corePath('**'), `!${clientPath}/**`, `${clientPath}/public/server-owned/**`];
    expect(workflowTriggers(patterns, [packagePath('server', 'src', 'index.ts')])).toBe(true);
    expect(workflowTriggers(patterns, [packagePath('client', 'app', 'page.tsx')])).toBe(false);
    expect(workflowTriggers(patterns, [packagePath('client', 'public', 'server-owned', 'manifest.json')])).toBe(true);
  });

  it('builds every workspace package consumed through Node exports in clean CI', () => {
    const renderBuild = 'pnpm --filter @cuberoot/puzzle-render-core build';
    const solverBuild = 'pnpm --filter @cuberoot/puzzle-solvers build';
    const clientPackage = JSON.parse(readFileSync(
      join(REPO_ROOT, 'core', 'packages', 'client', 'package.json'),
      'utf8',
    )) as { scripts: Record<string, string> };
    const clientDepBuilds = clientPackage.scripts['build:deps'].split(' && ');
    const coreBuilds = readStepRun('deploy_core.yml', 'Build shared deps').split('\n');

    expect(readStepRun('test.yml', 'Build shared deps')).toBe(
      'pnpm --filter @cuberoot/client build:deps',
    );
    expect(clientPackage.scripts.build).toMatch(/^pnpm run build:deps && /);
    expect(clientDepBuilds).toContain(renderBuild);
    expect(clientDepBuilds).toContain(solverBuild);
    expect(coreBuilds).toContain(renderBuild);
    expect(coreBuilds).not.toContain(solverBuild);
  });

  it('uses the clean client dependency build and non-failing summary channel for pnpm bumps', () => {
    const workflow = readWorkflow('pnpm_bump.yml');
    const verify = readStepRun('pnpm_bump.yml', '拿候选 pnpm 真跑一遍');
    expect(verify).toContain('pnpm --filter @cuberoot/client build:deps');
    expect(workflow).toContain('$GITHUB_STEP_SUMMARY');
    expect(workflow).not.toContain('$GITHUB_SUMMARY');
  });

  it('runs the package and analyzer gates explicitly in CI', () => {
    const packageGate = readStepRun('test.yml', 'Verify puzzle solvers package');
    expect(packageGate).toContain('pnpm --filter @cuberoot/puzzle-solvers typecheck');
    expect(packageGate).toContain('pnpm --filter @cuberoot/puzzle-solvers test');
    expect(packageGate).toContain('pnpm --filter @cuberoot/client test:solvers clock_solver');
    expect(readStepRun('test.yml', 'Verify Clock analyzer runtime')).toBe(
      'pnpm --filter @cuberoot/scramble-stats-build test:clock',
    );
    const sq2Step = 'Verify SQ2 sampled builder runtime';
    expect(readStepEnv('test.yml', sq2Step)).toEqual({
      SCRAMBLE_STATS_OUT_DIR: '${{ runner.temp }}/cuberoot-sq2-sampled',
      SCRAMBLE_STATS_STAMP: '2000-01-01T00:00:00.000Z',
    });
    const sq2Run = readStepRun('test.yml', sq2Step);
    expect(sq2Run).toContain(
      'pnpm --filter @cuberoot/scramble-stats-build exec tsx src/build_puzzle_sampled_dist.ts sq2 1',
    );
    expect(sq2Run).toContain("node --input-type=module <<'NODE'");
    expect(sq2Run).toMatch(
      /dist_sq2\.json[\s\S]*event:\s*'sq2'[\s\S]*sampleCount:\s*1[\s\S]*generated_at:\s*process\.env\.SCRAMBLE_STATS_STAMP/,
    );
    expect(sq2Run).toContain('git diff --exit-code -- ../stats/scramble/dist_sq2.json');
  });

  it('atomically deploys CubeOpt with the same dotenv gate and rollback contract', () => {
    const run = readStepRun('deploy_core.yml', 'Deploy server');
    expect(readStepEnv('deploy_core.yml', 'Deploy server')).toEqual({
      API_DIR: 'core/${{ steps.workspace.outputs.api }}',
    });
    const enabledBranch = run.match(/if node --env-file=\.env -e '[^']+'; then([\s\S]*?)\n\s*else/)?.[1] ?? '';
    const provisionArtifact = '$API_DIR/dist/cubeopt/provision.mjs';
    const verifyArtifact = '$API_DIR/dist/cubeopt/verify.mjs';
    const prepareArtifact = '$API_DIR/dist/cubeopt/prepare.mjs';
    const promoteArtifact = '$API_DIR/dist/cubeopt/promote.mjs';
    const prepareCopied = run.indexOf(prepareArtifact);
    const provisionCopied = run.indexOf(provisionArtifact);
    const verifyCopied = run.indexOf(verifyArtifact);
    const promoteCopied = run.indexOf(promoteArtifact);
    const provisioned = run.indexOf('node --env-file=.env "$staging/dist/cubeopt/provision.mjs"');
    const verified = run.indexOf('node --env-file=.env "$staging/dist/cubeopt/verify.mjs"', provisioned);
    const immutable = run.indexOf('chmod -R a-w "$final"', verified);
    const switched = run.indexOf('mv -Tf "$pending_link" dist', immutable);
    const reloaded = run.indexOf('reload_core_without_cubeopt_warm', switched);
    const healthy = run.indexOf('curl -fsS http://127.0.0.1:3001/v1/health', reloaded);
    const smoked = run.indexOf('node --env-file=.env dist/cubeopt/smoke.mjs', healthy);
    const residentReloaded = run.indexOf('reload_core_with_cubeopt_warm', smoked);
    const residentReady = run.indexOf('/v1/scramble/optimal-solve/ready', residentReloaded);

    expect(prepareCopied).toBeGreaterThan(-1);
    expect(provisionCopied).toBeGreaterThan(prepareCopied);
    expect(verifyCopied).toBeGreaterThan(provisionCopied);
    expect(promoteCopied).toBeGreaterThan(verifyCopied);
    expect(provisioned).toBeGreaterThan(promoteCopied);
    expect(verified).toBeGreaterThan(provisioned);
    expect(immutable).toBeGreaterThan(verified);
    expect(switched).toBeGreaterThan(immutable);
    expect(reloaded).toBeGreaterThan(switched);
    expect(healthy).toBeGreaterThan(reloaded);
    expect(smoked).toBeGreaterThan(healthy);
    expect(residentReloaded).toBeGreaterThan(smoked);
    expect(residentReady).toBeGreaterThan(residentReloaded);
    expect(run).toContain('CUBEOPT_WARM_ON_BOOT=0 pm2 reload core-api --update-env');
    expect(run).toContain('CUBEOPT_WARM_ON_BOOT="$cubeopt_warm_on_boot" pm2 reload core-api --update-env');
    expect(run).toContain('node --env-file=.env -e \'process.exit(process.env.CUBEOPT_SOLVE_ENABLED === "1" ? 0 : 1)\'');
    expect(enabledBranch).toContain('node --env-file=.env "$staging/dist/cubeopt/provision.mjs"');
    expect(enabledBranch).toContain('--env-file /root/core-api/.env');
    expect(enabledBranch).toContain('--default-store /root/core-api/artifacts/cubeopt');
    expect(enabledBranch).toContain('--bundle-suffix legacy-runtime-v1');
    expect(enabledBranch).toContain('--source-url legacy-runtime://cubeopt');
    expect(enabledBranch).toContain('--source-revision pre-api-artifact-store');
    expect(enabledBranch).toContain('--source-build-command "byte-for-byte migration from legacy production paths"');
    expect(enabledBranch).toContain('node --env-file=.env "$staging/dist/cubeopt/verify.mjs"');
    expect(run).not.toMatch(/CUBEOPT_ENABLED=.*sed/);
    expect(run).toContain('rollback_link=".dist.rollback.${release_id}.$$"');
    expect(run).toContain('mv -Tf "$rollback_link" dist');
    expect(run).toContain('unlink "$pending_link"');
    expect(run).toContain('mv "$legacy_moved" dist');
    expect(run).toContain('refusing a switch without rollback state');
    expect(run).toContain('chmod -R a-w "$final"');
    expect(readWorkflow('deploy_core.yml')).toContain('group: deploy-core-production');
  });
});
