// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT = resolve(HERE, '..');
const REPO_ROOT = resolve(HERE, '../../../..');
const PLATFORM = join(REPO_ROOT, 'core/packages/platform');
const WRITE_ADAPTER = join(REPO_ROOT, '.codex/hooks/adapt-codex-write-payload.mjs');
const HOOK = join(REPO_ROOT, '.codex/hooks/block-browser-regexp-lookbehind.ps1');
const HOOK_CONFIG = join(REPO_ROOT, '.codex/hooks.json');
const FORBIDDEN = ['(?<' + '=', '(?<' + '!'];
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']);
const BROWSER_SOURCE_ROOTS = [
  join(CLIENT, 'app'),
  join(CLIENT, 'components'),
  join(CLIENT, 'data'),
  join(CLIENT, 'hooks'),
  join(CLIENT, 'i18n'),
  join(CLIENT, 'lib'),
  join(CLIENT, 'types'),
  join(CLIENT, 'wasm'),
  join(PLATFORM, 'app'),
  join(PLATFORM, 'components'),
  join(PLATFORM, 'data'),
  join(PLATFORM, 'lib'),
  join(REPO_ROOT, 'core/packages/shared/src'),
  join(REPO_ROOT, 'core/packages/visualcube/src'),
];

function collectSourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...collectSourceFiles(path));
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function runHook(filePath: string, content: string) {
  return spawnSync(process.execPath, [WRITE_ADAPTER, HOOK], {
    cwd: REPO_ROOT,
    input: JSON.stringify({
      tool_name: 'apply_patch',
      cwd: REPO_ROOT,
      tool_input: {
        command: [
          '*** Begin Patch',
          '*** Add File: ' + filePath,
          '+' + content,
          '*** End Patch',
        ].join('\n'),
      },
    }),
    encoding: 'utf8',
    windowsHide: true,
  });
}

describe('browser regexp compatibility guard', () => {
  it('keeps browser-shipped source free of regular-expression lookbehind', () => {
    const offenders = BROWSER_SOURCE_ROOTS
      .flatMap(collectSourceFiles)
      .flatMap(path => {
        const source = readFileSync(path, 'utf8');
        return FORBIDDEN.some(token => source.includes(token))
          ? [path.slice(REPO_ROOT.length + 1).replace(/\\/g, '/')]
          : [];
      });

    expect(offenders).toEqual([]);
  });

  it('registers the write-time hook beside the CI guard', () => {
    expect(readFileSync(HOOK_CONFIG, 'utf8')).toContain('block-browser-regexp-lookbehind.ps1');
  });

  it('denies the syntax in browser source and ignores test fixtures', () => {
    const regexp = 'const token = /' + FORBIDDEN[0] + 'x)y/;';
    const denied = runHook('core/packages/client/lib/browser-probe.ts', regexp);
    const allowed = runHook('core/packages/client/tests/browser-probe.test.ts', regexp);

    expect(denied.status).toBe(0);
    expect(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
    expect(allowed.status).toBe(0);
    expect(allowed.stdout).toBe('');
  });
});
