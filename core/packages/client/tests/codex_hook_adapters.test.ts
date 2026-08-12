import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const WRITE_ADAPTER = join(REPO_ROOT, '.codex/hooks/adapt-codex-write-payload.mjs');
const COMMAND_ADAPTER = join(REPO_ROOT, '.codex/hooks/adapt-codex-command-payload.mjs');
const HOOK_CONFIG = join(REPO_ROOT, '.codex/hooks.json');
const DELETE_FIXTURE = join(HERE, 'fixtures/block-rm-use-trash-fixture.mjs');
const WEBKIT_FIXTURE = join(HERE, 'fixtures/block-webkit-no-webrtc-fixture.mjs');

function runAdapter(adapter: string, target: string, payload: object) {
  return spawnSync(process.execPath, [adapter, target], {
    cwd: REPO_ROOT,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    windowsHide: true,
  });
}

describe('Codex hook payload adapters', () => {
  it('uses Codex canonical hook matcher names', () => {
    const config = JSON.parse(readFileSync(HOOK_CONFIG, 'utf8')) as {
      hooks: { PreToolUse: Array<{ matcher: string }> };
    };
    const matchers = config.hooks.PreToolUse.map(({ matcher }) => matcher);

    expect(matchers).toContain('^Bash$');
    expect(matchers).toContain('apply_patch');
    expect(matchers).not.toContain('shell_command');
  });

  it('extracts an embedded apply_patch and preserves the affected file path', () => {
    const target = join(REPO_ROOT, '.codex/hooks/block-raw-checkbox.ps1');
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
    const target = join(REPO_ROOT, '.codex/hooks/block-raw-checkbox.ps1');
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

  it('extracts the native apply_patch command payload', () => {
    const target = join(REPO_ROOT, '.codex/hooks/block-raw-checkbox.ps1');
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
    const target = join(REPO_ROOT, '.codex/hooks/block-raw-checkbox.ps1');
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
    const target = join(REPO_ROOT, '.codex/hooks/block-raw-checkbox.ps1');
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
    const target = join(REPO_ROOT, '.codex/hooks/block-raw-checkbox.ps1');
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
