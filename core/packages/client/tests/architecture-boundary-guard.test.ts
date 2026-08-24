// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-ignore -- The repository guard is executable ESM and intentionally has no package declaration surface.
import {
  collectFindings,
  compareFindings,
  validateManifestSchema,
  validateManualContracts,
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
    expect(MANIFEST.legacyFindings).toHaveLength(317);
    expect(compareFindings(CURRENT, MANIFEST.legacyFindings)).toEqual({ additions: [], stale: [] });
    expect(CURRENT).toHaveLength(MANIFEST.legacyFindings.length);
    expect(MANIFEST.legacyFindings.filter((finding: { rule: string }) => finding.rule === 'shared-root-import')).toHaveLength(175);
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
    expect(rules(CLIENT_PROBE, "import x from '@cuberoot/server';"))
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

  it('registers the write-time hook alongside the CI scanner', () => {
    const config = readFileSync(join(REPO_ROOT, '.codex/hooks.json'), 'utf8');
    expect(config).toContain('block-architecture-boundaries.ps1');
  });
});
