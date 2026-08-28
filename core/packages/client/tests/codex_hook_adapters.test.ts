// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const CORE_ROOT = join(REPO_ROOT, 'core');
const WRITE_ADAPTER = join(REPO_ROOT, '.codex/hooks/adapt-codex-write-payload.mjs');
const COMMAND_ADAPTER = join(REPO_ROOT, '.codex/hooks/adapt-codex-command-payload.mjs');
const HOOK_CONFIG = join(REPO_ROOT, '.codex/hooks.json');
const HOOKS = join(REPO_ROOT, '.codex', 'hooks');
const DELETE_FIXTURE = join(HERE, 'fixtures/block-rm-use-trash-fixture.mjs');
const WEBKIT_FIXTURE = join(HERE, 'fixtures/block-webkit-no-webrtc-fixture.mjs');
const ARCHITECTURE_HOOK = join(REPO_ROOT, 'core/scripts/check-architecture-boundaries.mjs');
const RAW_CHECKBOX_HOOK = join(REPO_ROOT, 'core/packages/client/scripts/hook-detect-raw-checkbox.mjs');

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

describe('Codex hook payload adapters', () => {
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
    const calc = runAdapter(join(HOOKS, 'calc-test-reminder.mjs'), [], {
      tool_input: { command: '*** Update File: core/packages/client/app/[lang]/calc/page.tsx' },
    });
    const migration = runAdapter(join(HOOKS, 'dev-data-sync-reminder.mjs'), [], {
      tool_input: { command: '*** Add File: core/apps/api/migrations/9999_probe.sql' },
    });

    expect(JSON.parse(calc.stdout).hookSpecificOutput.additionalContext).toContain('/zh/calc');
    expect(JSON.parse(migration.stdout).hookSpecificOutput.additionalContext).toContain('/dev/schema');
  });

  it('keeps the banned-word decision contract without embedding a banned term', () => {
    const list = JSON.parse(readFileSync(join(REPO_ROOT, '.codex', 'banned-words.json'), 'utf8')) as {
      words: Array<{ word: string }>;
    };
    const result = runAdapter(join(HOOKS, 'block-banned-words.mjs'), [], {
      tool_input: {
        file_path: join(REPO_ROOT, 'core/packages/client/app/probe/page.tsx'),
        content: String(list.words[0].word),
      },
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('reports no SessionStart guard-documentation drift', () => {
    const result = runAdapter(join(HOOKS, 'check-guards-drift-session.mjs'), [], {});

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
