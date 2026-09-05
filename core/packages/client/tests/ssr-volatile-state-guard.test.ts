// Volatile values in a useState initializer make SSR and the first client render diverge.
// Paired hook: core/packages/client/scripts/hook-detect-ssr-volatile-state.mjs.
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXEMPTION,
  scanVolatileStateInitializers,
  violationsFromHookPayload,
} from '../scripts/hook-detect-ssr-volatile-state.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(ROOT, '..', '..', '..');

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out = out.concat(walk(join(dir, entry.name)));
    else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) out.push(join(dir, entry.name));
  }
  return out;
}

describe('SSR volatile state guard', () => {
  it('blocks random, clock, and browser storage reads in useState initializers', () => {
    expect(scanVolatileStateInitializers('const [x] = useState(() => Math.random())'))
      .toEqual([expect.objectContaining({ name: 'Math.random' })]);
    expect(scanVolatileStateInitializers('const [x] = useState(() => ({ at: Date.now() }))'))
      .toEqual([expect.objectContaining({ name: 'Date.now' })]);
    expect(scanVolatileStateInitializers('const [x] = React.useState(Date.now())'))
      .toEqual([expect.objectContaining({ name: 'Date.now' })]);
    expect(scanVolatileStateInitializers("const [x] = useState(() => localStorage.getItem('x'))"))
      .toEqual([expect.objectContaining({ name: 'localStorage.getItem' })]);
  });

  it('allows event-time calls, deterministic initializers, and reasoned client-only exceptions', () => {
    expect(scanVolatileStateInitializers('const [x] = useState(0); const reroll = () => Math.random();')).toEqual([]);
    expect(scanVolatileStateInitializers(
      `// ${EXEMPTION}: parent mounts this subtree only after a client fetch\nconst [x] = useState(() => Date.now());`,
    )).toEqual([]);
    expect(scanVolatileStateInitializers(
      `'use client';\n// ${EXEMPTION}: route wrapper imports this module with ssr:false\nconst [x] = useState(() => localStorage.getItem('x'));`,
    )).toEqual([]);
  });

  it('understands the normalized Codex hook payload', () => {
    const hits = violationsFromHookPayload({
      tool_input: {
        file_path: join(REPO_ROOT, 'core/packages/client/app/probe/page.tsx'),
        content: 'const [x] = useState(() => Math.random());',
      },
    });
    expect(hits).toHaveLength(1);
  });

  it('finds no volatile state initializers in SSR source', () => {
    const violations: string[] = [];
    for (const base of ['app', 'components']) {
      for (const file of walk(join(ROOT, base))) {
        for (const hit of scanVolatileStateInitializers(readFileSync(file, 'utf8'), file)) {
          violations.push(`${relative(ROOT, file)}:${hit.line}:${hit.column} ${hit.name}`);
        }
      }
    }
    expect(violations, `useState 首屏初值必须可复现:\n${violations.join('\n')}`).toEqual([]);
  });

  it('keeps the shared 3x3 mode store on the SSR-safe external-store contract', () => {
    const source = readFileSync(join(ROOT, 'lib', 'scramble-333-mode.ts'), 'utf8');
    expect(source).toContain('useSyncExternalStore(on333ModeChange, get333Mode, () => DEFAULT)');
    expect(source).not.toContain('useState(() => get333Mode())');
  });

  it('is wired into the repository Codex hook configuration', () => {
    const detector = 'hook-detect-ssr-volatile-state.mjs';
    const config = JSON.parse(readFileSync(join(REPO_ROOT, '.codex', 'hooks.json'), 'utf8'));
    const writeHook = config.hooks.PreToolUse.find(({ matcher }: { matcher: string }) => matcher === 'apply_patch');
    expect(writeHook.hooks.some(({ command }: { command: string }) => command.includes(detector))).toBe(true);
    expect(existsSync(join(ROOT, 'scripts', detector))).toBe(true);
  });
});
