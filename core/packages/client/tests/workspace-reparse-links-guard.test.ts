// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const ADAPTER = join(REPO_ROOT, '.codex/hooks/adapt-codex-command-payload.mjs');
const GUARD = join(REPO_ROOT, '.codex/hooks/block-workspace-reparse-links.mjs');

function runGuard(command: string) {
  return spawnSync(process.execPath, [ADAPTER, GUARD], {
    cwd: REPO_ROOT,
    input: JSON.stringify({
      tool_name: 'Bash',
      cwd: REPO_ROOT,
      tool_input: { command, workdir: REPO_ROOT },
    }),
    encoding: 'utf8',
    windowsHide: true,
  });
}

describe('workspace reparse-link guard', () => {
  it.each([
    "New-Item -ItemType Junction -Path '.tmp/verify/node_modules' -Target 'core/node_modules'",
    'cmd /c mklink /J .tmp\\verify\\node_modules core\\node_modules',
    "node -e \"require('node:fs').symlinkSync('core/node_modules','.tmp/verify/node_modules','junction')\"",
    "[System.IO.Directory]::CreateSymbolicLink('.tmp/verify/packages','core/packages')",
  ])('denies manual workspace link creation: %s', (command) => {
    const result = runGuard(command);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it.each([
    'pnpm install --offline --frozen-lockfile',
    "rg -n 'New-Item -ItemType Junction' .codex",
    "rg -n 'trash\\.ps1|block-rm-use-trash|Remove-Item|fs\\.rm|git clean|reparse|Junction' C:/Users/CubeRoot/.codex/memories/MEMORY.md",
  ])('allows safe independent verification commands: %s', (command) => {
    const result = runGuard(command);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});
