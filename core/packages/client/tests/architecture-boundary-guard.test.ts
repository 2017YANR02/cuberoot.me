// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-ignore -- The repository guard is executable ESM and intentionally has no package declaration surface.
import {
  activePackages,
  collectFindings,
  compareFindings,
  parseWorkspacePackagePatterns,
  resolvePackageExport,
  runtimeNeutralSourceViolations,
  validateManifestSchema,
  validateManualContracts,
  validatePackageMetadata,
  validateRuntimeNeutralExports,
  violationsFromHookPayload,
} from '../../../scripts/check-architecture-boundaries.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = resolve(HERE, '../../..');
const REPO_ROOT = resolve(CORE_ROOT, '..');
const MANIFEST = JSON.parse(readFileSync(join(CORE_ROOT, 'architecture-boundaries.json'), 'utf8'));
const CURRENT = collectFindings();
const CLIENT_PROBE = ['core', 'packages', 'client/lib/probe.ts'].join('/');
const CLIENT_TEST_PROBE = ['core', 'packages', 'client/tests/probe.test.ts'].join('/');
const SERVER_PROBE = ['core', 'packages', 'server/src/probe.ts'].join('/');

function payload(file: string, content: string) {
  return {
    tool_input: {
      file_path: join(REPO_ROOT, file).replaceAll('\\', '/'),
      content,
    },
  };
}

function rules(file: string, content: string): string[] {
  return violationsFromHookPayload(payload(file, content)).map((finding: { rule: string }) => finding.rule);
}

describe('architecture boundary guard', () => {
  it('pins the complete current dependency baseline by exact finding identity', () => {
    expect(MANIFEST.legacyFindings).toHaveLength(307);
    expect(compareFindings(CURRENT, MANIFEST.legacyFindings)).toEqual({ additions: [], stale: [] });
    expect(CURRENT).toHaveLength(MANIFEST.legacyFindings.length);
    expect(MANIFEST.legacyFindings.filter((finding: { rule: string }) => finding.rule === 'shared-root-import')).toHaveLength(172);
    expect(MANIFEST.legacyFindings.filter((finding: { rule: string }) => finding.rule === 'cross-package-alias-import')).toHaveLength(0);
  });

  it('keeps every semantic edge contract tied to live repository evidence', () => {
    expect(MANIFEST.manualContracts).toHaveLength(13);
    expect(validateManifestSchema(MANIFEST)).toEqual([]);
    expect(validateManualContracts(MANIFEST.manualContracts)).toEqual([]);
    expect(new Set(MANIFEST.manualContracts.map((item: { phase: string }) => item.phase))).toEqual(new Set([
      'runtime-file', 'build-import', 'build-artifact', 'test-contract',
      'subprocess-native', 'generated-artifact', 'deploy-target',
    ]));
  });

  it('blocks new shared roots, private app imports, wildcard exports and subprocesses', () => {
    expect(rules(CLIENT_PROBE, "import type { Lang } from '@cuberoot/shared';"))
      .toContain('shared-root-import');
    expect(rules(SERVER_PROBE, "import World from '@/app/[lang]/sim/engine/world';"))
      .toContain('cross-package-alias-import');
    expect(rules(CLIENT_TEST_PROBE, "import x from '../../server/src/index';"))
      .toContain('cross-package-relative-module');
    expect(rules(CLIENT_PROBE, "import x from '@cuberoot/vendor-sr-puzzlegen/private';"))
      .toContain('workspace-wildcard-import');
    expect(rules(CLIENT_PROBE, "import x from '@cuberoot/visualcube/private';"))
      .toContain('workspace-unexported-import');
    expect(rules(CLIENT_PROBE, "import x from '@cuberoot/puzzle-render-core/engine/private';"))
      .toContain('workspace-unexported-import');
    expect(rules(CLIENT_PROBE, "import x from '@cuberoot/puzzle-solvers';"))
      .toContain('workspace-unexported-import');
    expect(rules(CLIENT_PROBE, "import x from '@cuberoot/puzzle-render-core';"))
      .toContain('workspace-unexported-import');
    expect(rules(CLIENT_PROBE, "import x from '@cuberoot/server';"))
      .toContain('workspace-app-root-import');
    expect(rules(CLIENT_PROBE, "import x from '@cuberoot/server/private';"))
      .toContain('workspace-app-root-import');
    expect(rules(CLIENT_PROBE, "import server = require('@cuberoot/server');"))
      .toContain('workspace-app-root-import');
    expect(rules(SERVER_PROBE, "import { spawn } from 'node:child_process'; spawn('probe');"))
      .toContain('subprocess-call');
    expect(rules(SERVER_PROBE, "import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; const run = promisify(execFile); run('probe');"))
      .toContain('subprocess-call');
    expect(rules(CLIENT_PROBE, "const source = join('..', '..', 'server', 'src');"))
      .toContain('cross-package-path');
    const absoluteServerPath = ['D:', 'cube', 'cuberoot.me', 'core', 'packages', 'server', 'src', 'index.ts'].join('/');
    expect(rules(CLIENT_PROBE, `readFileSync('${absoluteServerPath}');`))
      .toContain('cross-package-path');
  });

  it('allows explicit public subpaths and ignores comments or display text', () => {
    expect(rules(CLIENT_PROBE, "import { deletedOwnerKey } from '@cuberoot/shared/account';"))
      .toEqual([]);
    expect(rules(CLIENT_PROBE, "import { cubeSVG } from '@cuberoot/visualcube';"))
      .toEqual([]);
    expect(rules(CLIENT_PROBE, "import { solveClock } from '@cuberoot/puzzle-solvers/clock';"))
      .toEqual([]);
    expect(rules(CLIENT_PROBE, "import { solveSq2 } from '@cuberoot/puzzle-solvers/sq2';"))
      .toEqual([]);
    expect(rules(CLIENT_TEST_PROBE, "import x from '../../components/Probe';"))
      .toEqual([]);
    expect(rules(CLIENT_PROBE, "// docs: import from '@cuberoot/shared' or packages/server/src"))
      .toEqual([]);
  });

  it('allows debt removal but rejects a replacement edge', () => {
    const reduced = CURRENT.slice(1);
    expect(compareFindings(reduced, CURRENT)).toEqual({ additions: [], stale: [CURRENT[0]] });
    const replacement = { ...CURRENT[0], file: 'packages/client/lib/new-edge.ts' };
    expect(compareFindings([...reduced, replacement], CURRENT).additions).toEqual([replacement]);
  });

  it('treats repeated identical edges as counted debt', () => {
    const repeated = { ...CURRENT[0], occurrences: 2 };
    expect(compareFindings([repeated], [CURRENT[0]]).additions).toEqual([repeated]);
    expect(compareFindings([CURRENT[0]], [repeated])).toEqual({ additions: [], stale: [repeated] });
  });

  it('executes the JSON schema instead of treating it as documentation', () => {
    expect(validateManifestSchema({ ...MANIFEST, schemaVersion: 2 })).not.toEqual([]);
  });

  it('derives every active workspace role and library export runtime from package metadata', () => {
    const packages = activePackages();
    expect(packages).toHaveLength(14);
    expect(packages.reduce((counts: Record<string, number>, pkg: { cuberoot: { kind: string } }) => {
      counts[pkg.cuberoot.kind] = (counts[pkg.cuberoot.kind] ?? 0) + 1;
      return counts;
    }, {})).toEqual({ app: 4, job: 4, library: 6 });
    expect(validatePackageMetadata(packages)).toEqual([]);
    expect(validateRuntimeNeutralExports(packages)).toEqual([]);
  });

  it('discovers workspace packages from YAML scalar patterns and fails closed on unsupported shapes', () => {
    expect(parseWorkspacePackagePatterns(`
packages:
  - packages/{shared,puzzle-solvers}
  - '!packages/puzzle-solvers'
catalog:
  react: ^19
    `)).toEqual(['packages/{shared,puzzle-solvers}', '!packages/puzzle-solvers']);
    expect(activePackages({
      coreRoot: CORE_ROOT,
      workspaceSource: "packages:\n  - packages/{shared,puzzle-solvers}\n  - '!packages/puzzle-solvers'\n",
    }).map((pkg: { dir: string }) => pkg.dir)).toEqual(['shared']);
    expect(() => parseWorkspacePackagePatterns('packages: [packages/*]')).toThrow(/block sequence/);
    expect(() => parseWorkspacePackagePatterns('packages:\n  nested: packages/*')).toThrow(/scalar patterns/);
    expect(() => activePackages({ coreRoot: CORE_ROOT, workspaceSource: "packages:\n  - '../*'\n" }))
      .toThrow(/unsupported workspace package pattern/);
    expect(() => activePackages({ coreRoot: CORE_ROOT, workspaceSource: "packages:\n  - packages/__missing__\n" }))
      .toThrow(/include pattern matched no paths/);
    expect(() => activePackages({
      coreRoot: CORE_ROOT,
      workspaceSource: "packages:\n  - packages/shared\n  - '!packages/shared'\n",
    })).toThrow(/matched no active packages/);
  });

  it('models Node package exports exact, conditional, null, array and wildcard semantics', () => {
    expect(resolvePackageExport({ import: './src/index.mjs', require: './src/index.cjs' }, '.'))
      .toEqual(expect.objectContaining({
        status: 'resolved',
        key: '.',
        wildcard: false,
        targets: ['./src/index.mjs', './src/index.cjs'],
      }));
    expect(resolvePackageExport({ node: null, default: './src/browser.js' }, '.', { conditions: ['node', 'import'] }).status)
      .toBe('blocked');
    expect(resolvePackageExport({ node: null, default: './src/browser.js' }, '.', { conditions: ['browser', 'import'] }))
      .toEqual(expect.objectContaining({ status: 'resolved', targets: ['./src/browser.js'] }));
    expect(resolvePackageExport({ './*': './src/*.js', './exact': './src/exact.js' }, './exact'))
      .toEqual(expect.objectContaining({ status: 'resolved', key: './exact', wildcard: false, targets: ['./src/exact.js'] }));
    expect(resolvePackageExport({ './*': './src/*.js', './private': null }, './private'))
      .toEqual(expect.objectContaining({ status: 'blocked', key: './private', wildcard: false }));
    expect(resolvePackageExport({ './feature': ['../invalid.js', './src/feature.js'] }, './feature'))
      .toEqual(expect.objectContaining({ status: 'resolved', targets: ['./src/feature.js'] }));
    expect(resolvePackageExport({ './feature/*': './generic/*.js', './feature/deep/*': './deep/*.js' }, './feature/deep/a'))
      .toEqual(expect.objectContaining({ status: 'resolved', key: './feature/deep/*', targets: ['./deep/a.js'] }));
    expect(resolvePackageExport({ './clock': './src/clock.ts' }, '.').status).toBe('unresolved');
    expect(resolvePackageExport({}, '.').status).toBe('unresolved');
    expect(resolvePackageExport({ '.private': './src/private.ts' }, '.private').status).toBe('invalid');
    expect(validatePackageMetadata([{
      cuberoot: { kind: 'library', runtime: { '.': 'runtime-neutral' } },
      dir: 'conditional-probe',
      exports: { import: './src/index.mjs', default: './src/index.js' },
      json: { dependencies: {} },
      name: '@cuberoot/conditional-probe',
      root: CORE_ROOT,
    }])).toEqual([]);
    for (const exports of [[], { '.': null }, { browser: null, default: null }]) {
      expect(validatePackageMetadata([{
        cuberoot: { kind: 'library', runtime: { '.': 'runtime-neutral' } },
        dir: 'empty-export-probe',
        exports,
        json: { dependencies: {} },
        name: '@cuberoot/empty-export-probe',
        root: CORE_ROOT,
      }])).toContain('empty-export-probe: library must declare at least one usable public export');
    }
    expect(validatePackageMetadata([{
      cuberoot: { kind: 'library', runtime: { '.private': 'runtime-neutral' } },
      dir: 'invalid-export-key-probe',
      exports: { '.private': './src/private.ts' },
      json: { dependencies: {} },
      name: '@cuberoot/invalid-export-key-probe',
      root: CORE_ROOT,
    }])).not.toEqual([]);
  });

  it('rejects missing, unknown, incomplete and stale package metadata', () => {
    const missingKind = structuredClone(activePackages());
    delete missingKind[0].cuberoot;
    expect(validatePackageMetadata(missingKind)).toContain(`${missingKind[0].dir}: missing cuberoot metadata`);

    const unknownKind = structuredClone(activePackages());
    unknownKind[0].cuberoot.kind = 'service';
    expect(validatePackageMetadata(unknownKind)).toContain(`${unknownKind[0].dir}: unknown cuberoot.kind "service"`);

    const missingWildcard = structuredClone(activePackages());
    const vendor = missingWildcard.find((pkg: { dir: string }) => pkg.dir === 'vendor-sr-puzzlegen')!;
    delete vendor.cuberoot.runtime['./*'];
    expect(validatePackageMetadata(missingWildcard))
      .toContain('vendor-sr-puzzlegen: missing runtime class for export ./*');

    const staleRuntime = structuredClone(activePackages());
    const shared = staleRuntime.find((pkg: { dir: string }) => pkg.dir === 'shared')!;
    shared.cuberoot.runtime['./retired'] = 'runtime-neutral';
    expect(validatePackageMetadata(staleRuntime))
      .toContain('shared: stale runtime class for non-export ./retired');

    const unknownRuntime = structuredClone(activePackages());
    const solvers = unknownRuntime.find((pkg: { dir: string }) => pkg.dir === 'puzzle-solvers')!;
    solvers.cuberoot.runtime['./clock'] = 'universal';
    expect(validatePackageMetadata(unknownRuntime))
      .toContain('puzzle-solvers: unknown runtime class "universal" for export ./clock');

    const missingExternalRuntime = structuredClone(activePackages());
    const sharedWithMissingExternal = missingExternalRuntime.find((pkg: { dir: string }) => pkg.dir === 'shared')!;
    delete sharedWithMissingExternal.cuberoot.externalRuntime.axios;
    expect(validatePackageMetadata(missingExternalRuntime))
      .toContain('shared: missing external runtime class for dependency axios');

    const dependencyOnApp = structuredClone(activePackages());
    const client = dependencyOnApp.find((pkg: { dir: string }) => pkg.dir === 'client')!;
    client.json.dependencies = { ...client.json.dependencies, '@cuberoot/server': 'workspace:*' };
    expect(validatePackageMetadata(dependencyOnApp))
      .toContain('client: production dependency @cuberoot/server targets app workspace server');

    for (const [dependency, specifier] of [
      ['server-file-alias', 'file:../server'],
      ['server-link-alias', 'link:../server'],
      ['server-workspace-alias', 'workspace:@cuberoot/server@*'],
      ['server-workspace-path-alias', 'workspace:../server'],
    ]) {
      const dependencyAlias = structuredClone(activePackages());
      const aliasClient = dependencyAlias.find((pkg: { dir: string }) => pkg.dir === 'client')!;
      aliasClient.json.dependencies = { ...aliasClient.json.dependencies, [dependency]: specifier };
      expect(validatePackageMetadata(dependencyAlias))
        .toContain(`client: production dependency ${dependency} targets app workspace server`);
    }
  });

  it('rejects non-neutral APIs and dependencies from a runtime-neutral entry', () => {
    const findings = runtimeNeutralSourceViolations(`
      import React from 'react';
      import 'next/navigation';
      import '@capacitor/core';
      import 'node:fs';
      import '@cuberoot/client';
      import '@cuberoot/visualcube';
      import '@cuberoot/__SHARED__';
      console.log(React, globalThis.document, globalThis['wx'], process.cwd());
    `.replace('__SHARED__', 'shared'));
    expect(new Set(findings.map((finding: { rule: string }) => finding.rule))).toEqual(new Set([
      'runtime-neutral-react-dom',
      'runtime-neutral-next',
      'runtime-neutral-capacitor',
      'runtime-neutral-node-module',
      'runtime-neutral-app-source',
      'runtime-neutral-non-neutral-dependency',
      'runtime-neutral-browser-api',
      'runtime-neutral-wechat-api',
    ]));
    expect(findings).toContainEqual(expect.objectContaining({
      rule: 'runtime-neutral-non-neutral-dependency',
      detail: '@cuberoot/shared (react-dom)',
    }));
    expect(findings).toContainEqual(expect.objectContaining({
      rule: 'runtime-neutral-browser-api',
      detail: 'document',
    }));
    expect(findings).toContainEqual(expect.objectContaining({
      rule: 'runtime-neutral-wechat-api',
      detail: 'wx',
    }));
    expect(findings).toContainEqual(expect.objectContaining({
      rule: 'runtime-neutral-node-module',
      detail: 'process',
    }));
  });

  it('allows type-only dependencies but rejects external, dynamic and package-escaping runtime edges', () => {
    expect(runtimeNeutralSourceViolations(`
      import type { Stats } from 'node:fs';
      import type { AxiosRequestConfig } from 'axios';
      export { type Dirent } from 'node:fs';
      export type Probe = Stats | AxiosRequestConfig | Dirent;
    `)).toEqual([]);
    expect(violationsFromHookPayload(payload(
      CLIENT_PROBE,
      "export type { Lang } from '@cuberoot/shared';",
    ))).toContainEqual(expect.objectContaining({
      importKind: 'type-only',
      mechanism: 'static-export',
      rule: 'shared-root-import',
    }));

    expect(runtimeNeutralSourceViolations("import axios from 'axios';"))
      .toContainEqual(expect.objectContaining({
        rule: 'runtime-neutral-non-neutral-dependency',
        detail: 'axios (mixed)',
      }));
    expect(runtimeNeutralSourceViolations("const name = 'fs'; import(`node:${name}`);"))
      .toContainEqual(expect.objectContaining({ rule: 'runtime-neutral-dynamic-import' }));
    const outsideSpecifier = '../../../../outside';
    expect(runtimeNeutralSourceViolations(`import '${outsideSpecifier}';`))
      .toContainEqual(expect.objectContaining({
        rule: 'runtime-neutral-package-outside-relative',
        detail: outsideSpecifier,
      }));
  });

  it('detects host globals using lexical scope instead of file-level declarations', () => {
    const findings = runtimeNeutralSourceViolations(`
      declare const document: { title: string };
      function harmless(document: { title: string }) { return document.title; }
      document.title;
      getApp();
      Bun.file('probe');
    `);
    expect(findings.filter((finding: { detail: string }) => finding.detail === 'document')).toHaveLength(1);
    expect(findings).toContainEqual(expect.objectContaining({ rule: 'runtime-neutral-wechat-api', detail: 'getApp' }));
    expect(findings).toContainEqual(expect.objectContaining({ rule: 'runtime-neutral-host-api', detail: 'Bun' }));

    const destructured = runtimeNeutralSourceViolations(`
      const { document: browserDocument, getApp: app, Bun: runtime } = globalThis;
      console.log(browserDocument, app, runtime, global.process);
    `);
    expect(destructured).toContainEqual(expect.objectContaining({ rule: 'runtime-neutral-browser-api', detail: 'document' }));
    expect(destructured).toContainEqual(expect.objectContaining({ rule: 'runtime-neutral-wechat-api', detail: 'getApp' }));
    expect(destructured).toContainEqual(expect.objectContaining({ rule: 'runtime-neutral-host-api', detail: 'Bun' }));
    expect(destructured).toContainEqual(expect.objectContaining({ rule: 'runtime-neutral-node-module', detail: 'process' }));

    const aliasedAndWrapped = runtimeNeutralSourceViolations(`
      const universal = globalThis;
      const universalAlias = (universal as typeof globalThis)!;
      universalAlias.XMLHttpRequest;
      const nodeHost = global;
      nodeHost.process;
      const browserHost = window;
      const { DOMParser: Parser } = (((browserHost satisfies typeof window)));
      const workerHost = self;
      const { alert: notify } = (workerHost as typeof self);
      console.log(Parser, notify);
    `);
    for (const detail of ['XMLHttpRequest', 'DOMParser', 'alert']) {
      expect(aliasedAndWrapped).toContainEqual(expect.objectContaining({
        rule: 'runtime-neutral-browser-api',
        detail,
      }));
    }
    expect(aliasedAndWrapped).toContainEqual(expect.objectContaining({
      rule: 'runtime-neutral-node-module',
      detail: 'process',
    }));
    expect(runtimeNeutralSourceViolations(`
      function local(globalThis: { DOMParser: unknown }) {
        const alias = globalThis;
        return alias.DOMParser;
      }
    `)).not.toContainEqual(expect.objectContaining({ detail: 'DOMParser' }));
  });

  it('walks conservative package imports aliases without parsing third-party source', () => {
    const tempParent = join(CORE_ROOT, '.tmp');
    mkdirSync(tempParent, { recursive: true });
    const root = mkdtempSync(join(tempParent, 'architecture-imports-'));
    try {
      const sourceRoot = join(root, 'src');
      mkdirSync(sourceRoot, { recursive: true });
      writeFileSync(join(sourceRoot, 'entry.ts'), `
        import '#dom/exact';
        import '#dom/parser';
        import '#react';
      `, 'utf8');
      writeFileSync(join(sourceRoot, 'exact.ts'), 'export const Parser = DOMParser;\n', 'utf8');
      writeFileSync(join(sourceRoot, 'parser.ts'), 'export const request = new XMLHttpRequest();\n', 'utf8');
      writeFileSync(join(sourceRoot, 'fallback.ts'), "alert('array fallback after null');\n", 'utf8');

      const packages = [...structuredClone(activePackages()), {
        cuberoot: {
          externalRuntime: { react: 'react-dom' },
          kind: 'library',
          runtime: { '.': 'runtime-neutral' },
        },
        dir: 'architecture-imports-probe',
        exports: { '.': './src/entry.ts' },
        json: {
          dependencies: { react: '^19.0.0' },
          imports: {
            '#dom/exact': [
              '../invalid.ts',
              { browser: './src/exact.ts', default: null },
              './src/fallback.ts',
            ],
            '#dom/*': { node: './src/*.ts', default: null },
            '#react': [null, 'react'],
          },
        },
        name: '@cuberoot/architecture-imports-probe',
        root,
      }];
      const findings = validateRuntimeNeutralExports(packages);
      expect(findings).toContainEqual(expect.objectContaining({
        package: '@cuberoot/architecture-imports-probe',
        rule: 'runtime-neutral-browser-api',
        detail: 'DOMParser',
      }));
      expect(findings).toContainEqual(expect.objectContaining({
        package: '@cuberoot/architecture-imports-probe',
        rule: 'runtime-neutral-browser-api',
        detail: 'XMLHttpRequest',
      }));
      expect(findings).toContainEqual(expect.objectContaining({
        package: '@cuberoot/architecture-imports-probe',
        rule: 'runtime-neutral-react-dom',
        detail: 'react',
      }));
      expect(findings).toContainEqual(expect.objectContaining({
        package: '@cuberoot/architecture-imports-probe',
        rule: 'runtime-neutral-browser-api',
        detail: 'alert',
      }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('walks the runtime-neutral source closure instead of checking only the export file', () => {
    const packages = structuredClone(activePackages());
    const renderCore = packages.find((pkg: { dir: string }) => pkg.dir === 'puzzle-render-core')!;
    renderCore.cuberoot.runtime['./engine/mega/MegaminxCube'] = 'runtime-neutral';
    expect(validateRuntimeNeutralExports(packages)).toContainEqual(expect.objectContaining({
      package: '@cuberoot/puzzle-render-core',
      export: './engine/mega/MegaminxCube',
      file: ['packages', 'puzzle-render-core', 'src', 'engine', 'tweener.ts'].join('/'),
      rule: 'runtime-neutral-browser-api',
      detail: 'requestAnimationFrame',
    }));

    const conditionalPackages = structuredClone(activePackages());
    const shared = conditionalPackages.find((pkg: { dir: string }) => pkg.dir === 'shared')!;
    shared.exports['./conditional-array-probe'] = [{ browser: './src/forum.ts' }, './src/index.ts'];
    shared.cuberoot.runtime['./conditional-array-probe'] = 'runtime-neutral';
    expect(validateRuntimeNeutralExports(conditionalPackages)).toContainEqual(expect.objectContaining({
      package: '@cuberoot/shared',
      export: './conditional-array-probe',
      file: ['packages', 'shared', 'src', 'hooks', 'useWcaAuth.ts'].join('/'),
      rule: 'runtime-neutral-react-dom',
      detail: 'react',
    }));
  });

  it('registers the write-time hook alongside the CI scanner', () => {
    const config = readFileSync(join(REPO_ROOT, '.codex/hooks.json'), 'utf8');
    expect(config).toContain('block-architecture-boundaries.ps1');
  });
});
