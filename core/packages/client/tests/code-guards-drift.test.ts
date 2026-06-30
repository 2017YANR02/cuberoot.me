// /code/guards drift guard. The guards page (app/[lang]/code/guards/_guards.ts) is a
// hand-maintained index of every PreToolUse hook + CI ratchet test pair in this repo.
// Like the other /code reference pages, it can silently rot — someone adds a new
// convention-guard test and forgets to register it here, or a registered test gets
// renamed/deleted and the page keeps claiming it exists.
//
// Contract (bidirectional, enforced by file content, not by guessing from prose):
//   1. Every test file that opens with the literal marker comment
//        // guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
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
// Scope limit (documented, not enforced here): only checks what's actually IN this
// repo. The global PreToolUse hooks registered in ~/.claude/settings.json (most of
// section 02 "process-level guards" on the page, plus the non-project-scoped half of
// PAIRED_GUARDS — block-static-onclick-button.ps1, block-button-navigation.ps1,
// block-raw-history-url-state.ps1, block-nuqs-ime-input.mjs) live on the developer's
// machine, not in this repo, so CI has no way to verify those filenames exist. Only
// the two project-scoped hooks (.claude/hooks/ at the repo root) are checked below.
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { PAIRED_GUARDS, CI_GUARDS_UI, CI_GUARDS_DRIFT, CI_GUARDS_API } from '@/app/[lang]/code/guards/_guards';

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/client/tests
const ROOT = join(HERE, '..'); // packages/client
const REPO_ROOT = join(ROOT, '..', '..', '..'); // packages/client -> packages -> core -> repo root
const HOOKS_DIR = join(REPO_ROOT, '.claude', 'hooks');

const MARKER = '// guard-registry: tracked at /code/guards';

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

describe('/code/guards stays in sync with guard-registry-marked tests', () => {
  it('found a meaningful number of registered guards', () => {
    expect(REGISTERED.size).toBeGreaterThanOrEqual(10);
  });

  it('every guard-registry-marked test is listed in _guards.ts', () => {
    const marked = markedTestFiles();
    const unlisted = [...marked].filter((f) => !REGISTERED.has(f));
    expect(
      unlisted,
      `Test file(s) carry the guard-registry marker but aren't listed in _guards.ts:\n${unlisted.join('\n')}\n` +
        'Add a row to PAIRED_GUARDS / CI_GUARDS_UI / CI_GUARDS_DRIFT / CI_GUARDS_API in app/[lang]/code/guards/_guards.ts.',
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
        'Fix the stale `test` field in app/[lang]/code/guards/_guards.ts, or add the marker comment to the file.',
    ).toEqual([]);
  });

  it('the two project-scoped guard hooks still exist on disk', () => {
    // Only project-scoped hooks (checked into this repo's .claude/hooks/) are
    // verifiable from CI — the global ones live in ~/.claude on the developer's
    // machine and aren't part of this repo. See file header for the full list.
    const projectHooks = ['block-raw-checkbox.ps1', 'block-handwritten-trad.ps1'];
    const missing = projectHooks.filter((h) => !existsSync(join(HOOKS_DIR, h)));
    expect(missing, `Missing project-scoped hook file(s) in .claude/hooks/:\n${missing.join('\n')}`).toEqual([]);
  });
});
