// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = join(HERE, '..');
const REPO_ROOT = join(CLIENT_ROOT, '..', '..', '..');
const GATE = join(CLIENT_ROOT, 'scripts', 'recon-ground-truth-gate.mjs');

function isGuarded(path: string): boolean {
  return spawnSync(process.execPath, [GATE, 'is-guarded', path], {
    cwd: CLIENT_ROOT,
    encoding: 'utf8',
  }).status === 0;
}

describe('reconstruction ground-truth commit gate', () => {
  it('covers reconstruction sources and a growing fixture registry without a fixed count', () => {
    expect(isGuarded('core/packages/client/app/[lang]/timer/_lib/reconstruct/recon_text.ts')).toBe(true);
    expect(isGuarded('core/packages/client/app/[lang]/timer/_lib/bluetooth/gyro_track.ts')).toBe(true);
    expect(isGuarded('core/packages/client/tests/recon_ground_truth.test.ts')).toBe(true);
    expect(isGuarded('core/packages/client/tests/fixtures/recon-ground-truth.json')).toBe(true);
    expect(isGuarded('core/packages/client/tests/fixtures/recon-workbook/0050.json')).toBe(true);
    expect(isGuarded('core/packages/shared/src/recon_ground_truth.ts')).toBe(true);
    expect(isGuarded('core/packages/server/src/routes/recon_ground_truth.ts')).toBe(true);
    expect(isGuarded('core/packages/server/migrations/0106_recon_ground_truth_candidates.sql')).toBe(true);
    expect(isGuarded('core/packages/client/app/[lang]/timer/page.tsx')).toBe(false);
  });

  it('uses a package command that refreshes the content-fingerprint credential', () => {
    const pkg = JSON.parse(readFileSync(join(CLIENT_ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['test:recon-ground-truth']).toBe('node scripts/recon-ground-truth-gate.mjs run');
  });

  it('denies through the supported JSON decision and keeps CI as the fallback', () => {
    const hook = readFileSync(join(REPO_ROOT, '.codex', 'hooks', 'recon-ground-truth-gate.ps1'), 'utf8');
    expect(hook).toContain("permissionDecision = 'deny'");
    expect(hook).toContain('check-staged');
    expect(hook).not.toMatch(/exit\s+2\b/);

    const codexHooks = JSON.parse(readFileSync(join(REPO_ROOT, '.codex', 'hooks.json'), 'utf8'));
    const commandGroup = codexHooks.hooks.PreToolUse.find(
      (group: { matcher?: string }) => group.matcher === '^Bash$',
    );
    expect(commandGroup, '缺少 Codex Bash PreToolUse 守卫组').toBeDefined();
    expect(commandGroup.hooks.some(
      (entry: { commandWindows?: string }) => entry.commandWindows?.includes('recon-ground-truth-gate.ps1'),
    )).toBe(true);

    const gitHook = readFileSync(join(REPO_ROOT, '.githooks', 'pre-commit'), 'utf8');
    expect(gitHook).toContain('recon-ground-truth-gate.mjs check-staged');

    const groundTruth = readFileSync(join(HERE, 'recon_ground_truth.test.ts'), 'utf8');
    expect(groundTruth).toContain('for (const fixture of FIXTURES)');
    expect(groundTruth).toContain("sync-recon-ground-truth.mjs");
    expect(groundTruth).not.toMatch(/FIXTURES\.(?:slice|splice)\(\s*0\s*,\s*4\s*\)/);

    const syncScript = readFileSync(join(CLIENT_ROOT, 'scripts', 'sync-recon-ground-truth.mjs'), 'utf8');
    expect(syncScript).toContain('/v1/recon-ground-truth/export');
    expect(syncScript).toContain('for (const [index, fixture] of value.fixtures.entries())');
    expect(syncScript).not.toContain('xlsx');
  });
});
