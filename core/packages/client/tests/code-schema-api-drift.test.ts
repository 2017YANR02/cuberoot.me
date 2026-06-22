// Drift guards for the two hardcoded-snapshot /code pages whose source of truth
// lives in packages/server. Both pages hand-mirror server state, so they silently
// rot as the backend grows. These pure read-only tests turn CI red the moment the
// snapshot falls behind — no codegen to maintain.
//
//   /code/schema  — its MIGRATIONS ledger must list every packages/server/migrations
//                   file. Add migration 0062 without a ledger row → red.
//                   Fix: add a `{ n, slug, desc }` row to MIGRATIONS in
//                   app/[lang]/code/schema/page.tsx.
//
//   /code/api     — its `covers-routes` manifest must equal the route files actually
//                   mounted via app.route('/v1', …) in server/src/index.ts. Mount a
//                   new route without documenting it → red.
//                   Fix: add the endpoints + the file stem to the manifest in
//                   app/[lang]/code/api/page.tsx.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SERVER = join(ROOT, '..', 'server');

const migDir = join(SERVER, 'migrations');
const indexTs = join(SERVER, 'src', 'index.ts');
const routesDir = join(SERVER, 'src', 'routes');
const schemaPage = join(ROOT, 'app', '[lang]', 'code', 'schema', 'page.tsx');
const apiPage = join(ROOT, 'app', '[lang]', 'code', 'api', 'page.tsx');

describe('/code/schema migration ledger drift', () => {
  it('MIGRATIONS lists exactly the migration files on disk', () => {
    const fileNums = readdirSync(migDir)
      .map((f) => /^(\d{4})_.+\.sql$/.exec(f))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => parseInt(m[1], 10));
    expect(fileNums.length).toBeGreaterThan(0);

    const src = readFileSync(schemaPage, 'utf8');
    const start = src.indexOf('const MIGRATIONS');
    expect(start, 'const MIGRATIONS array not found in schema page').toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf('\n];', start));
    const pageNums = [...block.matchAll(/\bn:\s*(\d+)/g)].map((m) => parseInt(m[1], 10));

    const fileSet = new Set(fileNums);
    const pageSet = new Set(pageNums);
    const missing = [...fileSet].filter((n) => !pageSet.has(n)).sort((a, b) => a - b);
    const stale = [...pageSet].filter((n) => !fileSet.has(n)).sort((a, b) => a - b);

    expect(missing, `migration(s) on disk but absent from the /code/schema ledger`).toEqual([]);
    expect(stale, `ledger row(s) for migration(s) that no longer exist`).toEqual([]);
  });
});

describe('/code/api endpoint catalog drift', () => {
  it('covers-routes manifest equals the routes mounted in index.ts', () => {
    const onDisk = new Set(
      readdirSync(routesDir)
        .filter((f) => f.endsWith('.ts'))
        .map((f) => f.slice(0, -3)),
    );
    expect(onDisk.size).toBeGreaterThan(0);

    // identifier -> route-file map from the imports, then which identifiers are mounted.
    const idx = readFileSync(indexTs, 'utf8');
    const idToFile = new Map<string, string>();
    for (const m of idx.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/routes\/([a-z0-9_]+)\.js['"]/g)) {
      for (const id of m[1].split(',').map((s) => s.trim()).filter(Boolean)) idToFile.set(id, m[2]);
    }
    const mounted = new Set<string>();
    for (const m of idx.matchAll(/app\.route\(\s*['"]\/v1['"]\s*,\s*([A-Za-z0-9_]+)\s*\)/g)) {
      const file = idToFile.get(m[1]);
      if (file) mounted.add(file);
    }
    expect(mounted.size, 'no mounted routes parsed from index.ts').toBeGreaterThan(0);

    // Manifest: tokens between the markers, kept only if they name a real route file
    // (so the surrounding prose can't pollute the set).
    const api = readFileSync(apiPage, 'utf8');
    const s = api.indexOf('covers-routes-start');
    const e = api.indexOf('covers-routes-end');
    expect(s, 'covers-routes-start marker missing in /code/api page').toBeGreaterThan(-1);
    expect(e, 'covers-routes-end marker missing in /code/api page').toBeGreaterThan(s);
    const manifest = new Set(
      (api.slice(s, e).match(/[a-z0-9_]+/g) ?? []).filter((t) => onDisk.has(t)),
    );

    const undocumented = [...mounted].filter((f) => !manifest.has(f)).sort();
    const orphan = [...manifest].filter((f) => !mounted.has(f)).sort();

    expect(undocumented, `route(s) mounted in index.ts but missing from /code/api manifest`).toEqual([]);
    expect(orphan, `manifest entr(ies) for route(s) no longer mounted`).toEqual([]);
  });
});
