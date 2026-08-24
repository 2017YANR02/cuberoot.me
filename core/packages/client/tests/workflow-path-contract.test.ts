import { readFileSync } from 'node:fs';
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

function readWorkflow(workflowName: string): string {
  return readFileSync(join(REPO_ROOT, '.github', 'workflows', workflowName), 'utf8');
}

function readStepRun(workflowName: string, stepName: string): string {
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
  const run = lines.findIndex((line, index) => (
    index > stepStart
    && index < end
    && indentation(line) === stepIndent + 2
    && line.trim() === 'run: |'
  ));
  if (run < 0) throw new Error(`Missing run block for ${stepName} in ${workflowName}`);
  const runIndent = indentation(lines[run]);
  return lines.slice(run + 1, end)
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    .map((line) => line.slice(Math.min(line.length, runIndent + 2)))
    .join('\n');
}

const WORKSPACE_INPUT_OVERRIDES: Readonly<Record<string, readonly string[]>> = {
  '@cuberoot/stack-kernel': [
    packagePath('stack-kernel', 'package.json'),
    packagePath('stack-kernel', 'pkg', '**'),
  ],
};

function workspaceDependencyInputs(consumer: 'client' | 'server'): string[] {
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'core', 'packages', consumer, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  return Object.entries(packageJson.dependencies ?? {})
    .filter(([name, version]) => name.startsWith('@cuberoot/') && version.startsWith('workspace:'))
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([name]) => WORKSPACE_INPUT_OVERRIDES[name] ?? [packagePath(name.slice('@cuberoot/'.length), '**')]);
}

const CORE_PATHS = [
  packagePath('server', '**'),
  ...workspaceDependencyInputs('server'),
  corePath('cube555-daemon', 'Daemon.java'),
  corePath('package.json'),
  corePath('pnpm-lock.yaml'),
  corePath('pnpm-workspace.yaml'),
  corePath('tsconfig.base.json'),
  corePath('patches', '**'),
  repoPath('.github', 'workflows', 'deploy_core.yml'),
] as const;

const NEXT_PATHS = [
  packagePath('client', '**'),
  ...workspaceDependencyInputs('client'),
  corePath('package.json'),
  corePath('pnpm-lock.yaml'),
  corePath('pnpm-workspace.yaml'),
  corePath('tsconfig.base.json'),
  corePath('patches', '**'),
  repoPath('ops', 'systemd', 'cuberoot-next.service'),
  repoPath('.github', 'workflows', 'deploy_next.yml'),
] as const;

const TEST_PATHS = [
  corePath('**'),
  `!${packagePath('platform', '**')}`,
  repoPath('docs', 'platform-capability-manifest.json'),
  repoPath('docs', 'platform-unification-plan.md'),
  repoPath('ops', 'nginx', '**'),
  repoPath('.github', 'workflows', 'deploy_core.yml'),
  repoPath('.github', 'workflows', 'deploy_next.yml'),
  repoPath('.github', 'workflows', 'test.yml'),
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
      source += '.*';
      index += 1;
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
  const testPushPaths = readEventPaths('test.yml', 'push');
  const testPullRequestPaths = readEventPaths('test.yml', 'pull_request');

  it('keeps the Core deploy boundary limited to real API production inputs', () => {
    expect(corePaths).toEqual(CORE_PATHS);

    const cases = [
      [packagePath('server', 'src', 'index.ts'), true],
      [packagePath('shared', 'src', 'account.ts'), true],
      [packagePath('visualcube', 'src', 'index.ts'), true],
      [packagePath('vendor-sr-puzzlegen', 'src', 'index.ts'), true],
      [packagePath('puzzle-render-core', 'src', 'index.ts'), true],
      [corePath('cube555-daemon', 'Daemon.java'), true],
      [corePath('package.json'), true],
      [corePath('pnpm-lock.yaml'), true],
      [corePath('pnpm-workspace.yaml'), true],
      [corePath('tsconfig.base.json'), true],
      [corePath('patches', 'cubing@0.63.3.patch'), true],
      [repoPath('.github', 'workflows', 'deploy_core.yml'), true],
      [packagePath('client', 'app', '[lang]', 'page.tsx'), false],
      [packagePath('mobile', 'src', 'App.tsx'), false],
      [packagePath('miniprogram', 'src', 'app.ts'), false],
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
      [packagePath('shared', 'src', 'account.ts'), true],
      [packagePath('visualcube', 'src', 'index.ts'), true],
      [packagePath('vendor-sr-puzzlegen', 'src', 'index.ts'), true],
      [packagePath('stack-kernel', 'pkg', 'stack_kernel_bg.wasm'), true],
      [packagePath('stack-kernel', 'src', 'lib.rs'), false],
      [packagePath('puzzle-render-core', 'src', 'index.ts'), true],
      [corePath('package.json'), true],
      [corePath('pnpm-lock.yaml'), true],
      [corePath('pnpm-workspace.yaml'), true],
      [corePath('tsconfig.base.json'), true],
      [corePath('patches', 'cubing@0.63.3.patch'), true],
      [repoPath('ops', 'systemd', 'cuberoot-next.service'), true],
      [repoPath('.github', 'workflows', 'deploy_next.yml'), true],
      [packagePath('server', 'src', 'index.ts'), false],
      [packagePath('mobile', 'src', 'App.tsx'), false],
      [packagePath('miniprogram', 'src', 'app.ts'), false],
      [repoPath('ops', 'nginx', 'www.cuberoot.me.conf'), false],
    ] as const;

    for (const [path, expected] of cases) {
      expect(workflowTriggers(nextPaths, [path]), path).toBe(expected);
    }
  });

  it('runs cross-layer contract tests when their nginx evidence changes', () => {
    expect(testPushPaths).toEqual(TEST_PATHS);
    expect(testPullRequestPaths).toEqual(TEST_PATHS);
    for (const paths of [testPushPaths, testPullRequestPaths]) {
      expect(workflowTriggers(paths, [repoPath('ops', 'nginx', 'www.cuberoot.me.conf')])).toBe(true);
      expect(workflowTriggers(paths, [repoPath('ops', 'nginx', 'api.cuberoot.me.conf')])).toBe(true);
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
    const buildCommand = 'pnpm --filter @cuberoot/puzzle-render-core build';
    expect(readStepRun('test.yml', 'Build shared deps').split('\n')).toContain(buildCommand);
    expect(readStepRun('deploy_core.yml', 'Build shared deps').split('\n')).toContain(buildCommand);
  });

  it('atomically deploys CubeOpt with the same dotenv gate and rollback contract', () => {
    const run = readStepRun('deploy_core.yml', 'Deploy server');
    const enabledBranch = run.match(/if node --env-file=\.env -e '[^']+'; then([\s\S]*?)\n\s*else/)?.[1] ?? '';
    const provisionArtifact = packagePath('server', 'dist', 'cubeopt', 'provision.mjs');
    const verifyArtifact = packagePath('server', 'dist', 'cubeopt', 'verify.mjs');
    const provisionCopied = run.indexOf(provisionArtifact);
    const verifyCopied = run.indexOf(verifyArtifact);
    const provisioned = run.indexOf('node --env-file=.env "$staging/dist/cubeopt/provision.mjs"');
    const verified = run.indexOf('node --env-file=.env "$staging/dist/cubeopt/verify.mjs"', provisioned);
    const immutable = run.indexOf('chmod -R a-w "$final"', verified);
    const switched = run.indexOf('mv -Tf "$pending_link" dist', immutable);
    const reloaded = run.indexOf('reload_core', switched);
    const healthy = run.indexOf('curl -fsS http://127.0.0.1:3001/v1/health', reloaded);
    const smoked = run.indexOf('node --env-file=.env dist/cubeopt/smoke.mjs', healthy);

    expect(provisionCopied).toBeGreaterThan(-1);
    expect(verifyCopied).toBeGreaterThan(provisionCopied);
    expect(provisioned).toBeGreaterThan(verifyCopied);
    expect(verified).toBeGreaterThan(provisioned);
    expect(immutable).toBeGreaterThan(verified);
    expect(switched).toBeGreaterThan(immutable);
    expect(reloaded).toBeGreaterThan(switched);
    expect(healthy).toBeGreaterThan(reloaded);
    expect(smoked).toBeGreaterThan(healthy);
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
