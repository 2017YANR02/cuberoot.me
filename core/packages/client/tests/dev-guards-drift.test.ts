// /dev/guards drift guard. The guards page (app/[lang]/dev/guards/_guards.ts) is a
// hand-maintained index of every PreToolUse hook + CI ratchet test pair in this repo.
// Like the other /dev reference pages, it can silently rot — someone adds a new
// convention-guard test and forgets to register it here, or a registered test gets
// renamed/deleted and the page keeps claiming it exists.
//
// Contract (bidirectional, enforced by file content, not by guessing from prose):
//   1. Every test file that opens with the literal marker comment
//        // guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
//      must have its filename listed somewhere in _guards.ts (PAIRED_GUARDS.test or
//      CI_GUARDS_*.test — compound entries like "a.test.ts + b.test.ts" are split).
//   2. Every test filename listed in _guards.ts must exist in tests/ AND carry that
//      marker — a typo'd or stale filename goes red immediately.
//
// Fix when red:
//   - new convention-guard test, not yet listed → add a `// guard-registry: ...`
//     marker line (right before its `import { describe, it, expect } from 'vitest';`)
//     AND add a row to _guards.ts (PAIRED_GUARDS if it has a paired write-time hook,
//     otherwise CI_GUARDS_UI / CI_GUARDS_DRIFT / CI_GUARDS_API).
//   - _guards.ts references a renamed/deleted test → fix the `test` field.
//
// Scope limit: CI verifies project-scoped hooks checked into this repo. User-scoped
// hooks live under ~/.codex and are documented here but validated on the workstation.
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { PAIRED_GUARDS, PROCESS_GUARDS, CI_GUARDS_UI, CI_GUARDS_DRIFT, CI_GUARDS_API } from '@/app/[lang]/dev/guards/_guards';

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/client/tests
const ROOT = join(HERE, '..'); // packages/client
const REPO_ROOT = join(ROOT, '..', '..', '..'); // packages/client -> packages -> core -> repo root
const HOOKS_DIR = join(REPO_ROOT, '.codex', 'hooks');
const CODEX_HOOKS = join(REPO_ROOT, '.codex', 'hooks.json');
const GIT_PRE_COMMIT = join(REPO_ROOT, '.githooks', 'pre-commit');

const MARKER = '// guard-registry: tracked at /dev/guards';

// _guards.ts `test` fields can be compound ("a.test.ts + b.test.ts" for one hook
// guarding two conventions at once) — split on the separator.
function splitTestField(field: string): string[] {
  return field.split('+').map((s) => s.trim());
}

const REGISTERED = new Set<string>([
  ...PAIRED_GUARDS.flatMap((g) => splitTestField(g.test)),
  ...CI_GUARDS_UI.map((g) => g.test),
  ...CI_GUARDS_DRIFT.map((g) => g.test),
  ...CI_GUARDS_API.map((g) => g.test),
]);

function markedTestFiles(): Set<string> {
  const out = new Set<string>();
  for (const name of readdirSync(HERE)) {
    if (!/\.test\.ts$/.test(name)) continue;
    if (readFileSync(join(HERE, name), 'utf8').includes(MARKER)) out.add(name);
  }
  return out;
}

describe('/dev/guards stays in sync with guard-registry-marked tests', () => {
  it('found a meaningful number of registered guards', () => {
    expect(REGISTERED.size).toBeGreaterThanOrEqual(10);
  });

  it('every guard-registry-marked test is listed in _guards.ts', () => {
    const marked = markedTestFiles();
    const unlisted = [...marked].filter((f) => !REGISTERED.has(f));
    expect(
      unlisted,
      `Test file(s) carry the guard-registry marker but aren't listed in _guards.ts:\n${unlisted.join('\n')}\n` +
        'Add a row to PAIRED_GUARDS / CI_GUARDS_UI / CI_GUARDS_DRIFT / CI_GUARDS_API in app/[lang]/dev/guards/_guards.ts.',
    ).toEqual([]);
  });

  it('every test listed in _guards.ts exists and carries the guard-registry marker', () => {
    const marked = markedTestFiles();
    const missing: string[] = [];
    for (const f of REGISTERED) {
      const p = join(HERE, f);
      if (!existsSync(p)) { missing.push(`${f} (file does not exist)`); continue; }
      if (!marked.has(f)) missing.push(`${f} (exists but missing the guard-registry marker comment)`);
    }
    expect(
      missing,
      `_guards.ts references test(s) that don't resolve cleanly:\n${missing.join('\n')}\n` +
        'Fix the stale `test` field in app/[lang]/dev/guards/_guards.ts, or add the marker comment to the file.',
    ).toEqual([]);
  });

  it('the project-scoped guard hooks still exist on disk', () => {
    const projectHooks = new Set([
      ...PAIRED_GUARDS.filter(({ scope }) => scope === 'project').map(({ hook }) => hook.split('→')[0].trim()),
      ...PROCESS_GUARDS.filter(({ scope }) => scope === 'project').map(({ hook }) => hook),
    ]);
    const missing = [...projectHooks].filter((hook) => !existsSync(join(HOOKS_DIR, hook)));
    expect(missing, `Missing project-scoped hook file(s) in .codex/hooks/:\n${missing.join('\n')}`).toEqual([]);
    expect(existsSync(CODEX_HOOKS), 'Missing project-scoped Codex hooks.json').toBe(true);
    expect(existsSync(GIT_PRE_COMMIT), 'Missing repository pre-commit hook').toBe(true);
  });

  it('every documented write/process hook is registered for Codex', () => {
    const config = JSON.parse(readFileSync(CODEX_HOOKS, 'utf8'));
    const registeredFor = (field: 'command' | 'commandWindows') => {
      const registered = new Set<string>();
      for (const group of config.hooks.PreToolUse) {
        for (const hook of group.hooks) {
          for (const match of String(hook[field] ?? '').matchAll(/[\w-]+\.(?:ps1|mjs|cjs)/g)) {
            if (!match[0].startsWith('adapt-codex-')) registered.add(match[0]);
          }
        }
      }
      return registered;
    };
    const registered = registeredFor('command');
    const registeredWindows = registeredFor('commandWindows');
    expect([...registeredWindows].sort(), 'commandWindows hook targets drifted from command').toEqual([...registered].sort());
    const documented = new Set([
      ...PAIRED_GUARDS.filter(({ scope }) => scope === 'project').map((guard) => guard.hook.split('→')[0].trim()),
      ...PROCESS_GUARDS.filter(({ scope }) => scope === 'project').map((guard) => guard.hook),
    ]);
    expect(
      [...documented].filter((name) => !registered.has(name)),
      'Documented hooks missing from .codex/hooks.json',
    ).toEqual([]);
    expect(
      [...registered].filter((name) => !documented.has(name)),
      'Codex hooks missing from /dev/guards',
    ).toEqual([]);
  });
});
