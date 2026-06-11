// /code/components + /code/utils registry guards. These two reference pages are
// hand-maintained mirrors of the real components / hooks / utils. This test keeps
// them honest:
//   1. every hook exported from hooks/ is registered in the utils catalog
//      (closed dir, every hook belongs there →漏登记 = CI red);
//   2. every import path the catalogs point at actually resolves on disk
//      (catches a component/util that was deleted or renamed but left in the
//      catalog → stale entry = CI red).
// New entries themselves still rely on the CLAUDE.md convention — "is this new
// component reusable enough to list" is a judgement call a test can't make.
//
// Fix when red: register the missing hook in app/[lang]/code/utils/_catalog.tsx,
// or update the stale import path in the relevant _catalog.tsx.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { CATALOG as UTILS } from '@/app/[lang]/code/utils/_catalog';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client-next

// `@/foo/bar` → does a real module file exist?
function resolves(spec: string): boolean {
  const base = join(ROOT, spec.replace(/^@\//, ''));
  return ['.ts', '.tsx', '/index.ts', '/index.tsx'].some((s) => existsSync(base + s));
}

function specifiersOf(importLine: string): string[] {
  return [...importLine.matchAll(/from\s+['"](@\/[^'"]+)['"]/g)].map((m) => m[1]);
}

describe('hooks/ are all registered in /code/utils', () => {
  const hookFiles = readdirSync(join(ROOT, 'hooks')).filter(
    (f) => /\.tsx?$/.test(f) && !/\.test\./.test(f),
  );
  const exported = new Set<string>();
  for (const f of hookFiles) {
    const src = readFileSync(join(ROOT, 'hooks', f), 'utf8');
    for (const m of src.matchAll(/export\s+(?:function|const)\s+(use[A-Z]\w*)/g)) exported.add(m[1]);
  }
  const registered = new Set(UTILS.filter((e) => e.category === 'hook').map((e) => e.name));

  it('found a meaningful number of hooks', () => {
    expect(exported.size).toBeGreaterThanOrEqual(6);
  });

  it('every exported hook is in the utils catalog', () => {
    const missing = [...exported].filter((h) => !registered.has(h));
    expect(missing, `unregistered hooks — add to app/[lang]/code/utils/_catalog.tsx:\n${missing.join('\n')}`).toEqual([]);
  });

  it('every catalog hook entry refers to a real exported hook', () => {
    const ghosts = [...registered].filter((h) => !exported.has(h));
    expect(ghosts, `catalog lists hooks that no longer exist:\n${ghosts.join('\n')}`).toEqual([]);
  });
});

describe('catalog import paths resolve on disk', () => {
  it('utils catalog imports all resolve', () => {
    const broken: string[] = [];
    for (const e of UTILS) {
      for (const spec of specifiersOf(e.imp)) {
        if (!resolves(spec)) broken.push(`${e.name} → ${spec}`);
      }
    }
    expect(broken, `stale utils catalog imports:\n${broken.join('\n')}`).toEqual([]);
  });

  it('components catalog imports all resolve', () => {
    const src = readFileSync(join(ROOT, 'app', '[lang]', 'code', 'components', '_catalog.tsx'), 'utf8');
    // every `import: '...'` field value in the catalog
    const importFields = [...src.matchAll(/\bimport:\s*(['"])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
    expect(importFields.length, 'no import: fields found in components/_catalog.tsx').toBeGreaterThan(5);
    const broken: string[] = [];
    for (const line of importFields) {
      for (const spec of specifiersOf(line)) {
        if (!resolves(spec)) broken.push(spec);
      }
    }
    expect(broken, `stale components catalog imports:\n${broken.join('\n')}`).toEqual([]);
  });
});
