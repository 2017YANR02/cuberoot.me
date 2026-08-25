// Drift guards for the two hardcoded-snapshot /dev pages whose source of truth
// lives in apps/api. Both pages hand-mirror server state, so they silently
// rot as the backend grows. These pure read-only tests turn CI red the moment the
// snapshot falls behind — no codegen to maintain.
//
//   /dev/schema  — its MIGRATIONS ledger must list every apps/api/migrations
//                   file. Add migration 0062 without a ledger row → red.
//                   Fix: add a `{ n, slug, desc }` row to MIGRATIONS in
//                   app/[lang]/dev/schema/page.tsx.
//
//   /dev/api     — its `covers-routes` manifest must equal the route files actually
//                   mounted beneath /v1 via app.route() in server/src/index.ts. Mount a
//                   new route without documenting it → red.
//                   Fix: add the endpoints + the file stem to the manifest in
//                   app/[lang]/dev/api/page.tsx.
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { workspaceFixturePath } from './workspace-fixture-path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SERVER = workspaceFixturePath('@cuberoot/server');

const migDir = join(SERVER, 'migrations');
const indexTs = join(SERVER, 'src', 'index.ts');
const routesDir = join(SERVER, 'src', 'routes');
const schemaPage = join(ROOT, 'app', '[lang]', 'dev', 'schema', 'page.tsx');
const apiPage = join(ROOT, 'app', '[lang]', 'dev', 'api', 'page.tsx');
const migrationReadme = join(SERVER, 'migrations', 'README.md');

const LEAVE_MAKEUP_ENDPOINTS = [
  ['GET', '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/leave-requests'],
  ['POST', '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/leave-requests'],
  ['POST', '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/leave-requests/:leaveRequestId/decision'],
  ['POST', '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/leave-requests/:leaveRequestId/cancel'],
  ['GET', '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/makeups'],
  ['GET', '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/makeups/candidates'],
  ['POST', '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/:attendanceId/makeups'],
  ['POST', '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/cancel'],
  ['GET', '/v1/teaching/organizations/:orgSlug/me/students/:studentId/sessions'],
  ['GET', '/v1/teaching/organizations/:orgSlug/me/students/:studentId/sessions/:sessionId/leave-requests'],
  ['POST', '/v1/teaching/organizations/:orgSlug/me/students/:studentId/sessions/:sessionId/attendance/:attendanceId/leave-requests'],
  ['POST', '/v1/teaching/organizations/:orgSlug/me/students/:studentId/sessions/:sessionId/attendance/:attendanceId/leave-requests/:leaveRequestId/cancel'],
] as const;

describe('/dev/schema migration ledger drift', () => {
  it('MIGRATIONS lists exactly the migration files on disk', () => {
    const fileEntries = readdirSync(migDir)
      .map((f) => /^(\d{4})_(.+)\.sql$/.exec(f))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => ({ number: m[1], slug: m[2] }));
    expect(fileEntries.length).toBeGreaterThan(0);

    const src = readFileSync(schemaPage, 'utf8');
    const start = src.indexOf('const MIGRATIONS');
    expect(start, 'const MIGRATIONS array not found in schema page').toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf('\n];', start));
    const pageEntries = [...block.matchAll(/\bn:\s*(\d+),\s*slug:\s*'([^']+)'/g)]
      .map((m) => ({ number: m[1].padStart(4, '0'), slug: m[2] }));

    const entryKey = (entry: { number: string; slug: string }) => `${entry.number}_${entry.slug}`;
    expect(pageEntries.map(entryKey).sort()).toEqual(fileEntries.map(entryKey).sort());

    const legacyDuplicateNumbers = new Map<string, string[]>([
      ['0062', ['wca_persons_gender', 'wss_covering_and_rare']],
      ['0087', ['page_notice_icon', 'page_notice_icon_color']],
    ]);
    const slugsByNumber = new Map<string, string[]>();
    for (const entry of fileEntries) {
      slugsByNumber.set(entry.number, [...(slugsByNumber.get(entry.number) ?? []), entry.slug]);
    }
    const duplicateNumbers = [...slugsByNumber.entries()]
      .filter(([, slugs]) => slugs.length > 1)
      .map(([number, slugs]) => [number, slugs.sort()] as const);

    expect(duplicateNumbers.sort(([a], [b]) => a.localeCompare(b))).toEqual(
      [...legacyDuplicateNumbers.entries()]
        .map(([number, slugs]) => [number, slugs.sort()] as const)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  });

  it('0165 leave/makeup tables and migration documentation stay visible', () => {
    const schema = readFileSync(schemaPage, 'utf8');
    const readme = readFileSync(migrationReadme, 'utf8');
    for (const table of ['leave_requests', 'makeup_attempts']) {
      const start = schema.indexOf(`{ name: '${table}'`);
      expect(start, `${table} missing from /dev/schema`).toBeGreaterThan(-1);
      const entry = schema.slice(start, schema.indexOf('\n  { name:', start + 1));
      expect(entry).toContain("origin: '0165'");
      expect(entry).toContain('naturalKey: true');
    }
    expect(readme).toContain('0165_teaching_leave_makeups.sql');
  });
});

describe('/dev/api endpoint catalog drift', () => {
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
    for (const m of idx.matchAll(/app\.route\(\s*['"]\/v1(?:\/[^'"]*)?['"]\s*,\s*([A-Za-z0-9_]+)\s*\)/g)) {
      const file = idToFile.get(m[1]);
      if (file) mounted.add(file);
    }
    expect(mounted.size, 'no mounted routes parsed from index.ts').toBeGreaterThan(0);

    // Manifest: tokens between the markers, kept only if they name a real route file
    // (so the surrounding prose can't pollute the set).
    const api = readFileSync(apiPage, 'utf8');
    const s = api.indexOf('covers-routes-start');
    const e = api.indexOf('covers-routes-end');
    expect(s, 'covers-routes-start marker missing in /dev/api page').toBeGreaterThan(-1);
    expect(e, 'covers-routes-end marker missing in /dev/api page').toBeGreaterThan(s);
    const manifest = new Set(
      (api.slice(s, e).match(/[a-z0-9_]+/g) ?? []).filter((t) => onDisk.has(t)),
    );

    const undocumented = [...mounted].filter((f) => !manifest.has(f)).sort();
    const orphan = [...manifest].filter((f) => !mounted.has(f)).sort();

    expect(undocumented, `route(s) mounted in index.ts but missing from /dev/api manifest`).toEqual([]);
    expect(orphan, `manifest entr(ies) for route(s) no longer mounted`).toEqual([]);
  });

  it('lists every teaching SaaS route with the exact method and path', () => {
    const routeSource = readFileSync(join(routesDir, 'teaching_saas.ts'), 'utf8');
    const api = readFileSync(apiPage, 'utf8');
    const fromRoute = [...routeSource.matchAll(/routes\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)]
      .map((match) => `${match[1].toUpperCase()} /v1${match[2]}`)
      .filter((entry) => entry.includes(' /v1/teaching/'))
      .sort();
    const fromCatalog = [...api.matchAll(/\{ d: 'teaching-saas', m: '(GET|POST|PUT|PATCH|DELETE)', p: '([^']+)'/g)]
      .map((match) => `${match[1]} ${match[2]}`)
      .sort();

    expect(fromRoute.length).toBeGreaterThan(0);
    expect(fromCatalog).toEqual(fromRoute);
  });

  it('lists every Platform route with its mounted method and path', () => {
    const platformFiles = new Map([
      ['platform_catalog.ts', '/v1'],
      ['platform_content.ts', '/v1'],
      ['platform_learning.ts', '/v1/platform'],
      ['platform_commerce.ts', '/v1/platform'],
      ['platform_qr.ts', '/v1/platform'],
    ]);
    const fromRoutes = [...platformFiles]
      .flatMap(([file, mount]) => {
        const source = readFileSync(join(routesDir, file), 'utf8');
        return [...source.matchAll(/Routes\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)]
          .map((match) => `${match[1].toUpperCase()} ${mount}${match[2]}`);
      })
      .sort();
    const api = readFileSync(apiPage, 'utf8');
    const fromCatalog = [...api.matchAll(/\{ d: 'platform', m: '(GET|POST|PUT|PATCH|DELETE)', p: '([^']+)'/g)]
      .map((match) => `${match[1]} ${match[2]}`)
      .sort();

    expect(fromRoutes.length).toBeGreaterThan(0);
    expect(fromCatalog).toEqual(fromRoutes);
  });

  it('freezes leave/makeup endpoint docs and idempotency requirements', () => {
    const api = readFileSync(apiPage, 'utf8');
    const rows = api.split('\n');
    for (const [method, path] of LEAVE_MAKEUP_ENDPOINTS) {
      const row = rows.find((line) => line.includes(`m: '${method}'`) && line.includes(`p: '${path}'`));
      expect(row, `${method} ${path} missing from /dev/api`).toBeDefined();
      expect(row).toContain("g: 'login'");
      expect(row).toContain("c: 'no-store'");
      if (method !== 'GET') expect(row).toContain('idempotency key');
    }
  });
});
