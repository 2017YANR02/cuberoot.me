import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MANIFEST_PATH = join(REPO, 'docs', 'platform-capability-manifest.json');
const CLIENT_TESTS = join(REPO, 'core', 'packages', 'client', 'tests');
const SERVER_TESTS = join(REPO, 'core', 'packages', 'server', 'tests');
const PLATFORM_ROUTE_FILES = new Map([
  ['platform_catalog.ts', '/v1'],
  ['platform_content.ts', '/v1'],
  ['platform_learning.ts', '/v1/platform'],
  ['platform_commerce.ts', '/v1/platform'],
  ['platform_qr.ts', '/v1/platform'],
]);

interface PlatformCapability {
  id: string;
  kind: 'page' | 'handler' | 'action' | 'metadata';
  mappings: [string, string][];
  strategy: string;
  canonicalOwner: string;
  readApi: string[];
  writeApi: string[];
  permission: string;
  sideEffects: string;
  metadata: string;
  emptyState: string;
  tests: string[];
  implementationStatus: string;
  reviewStatus: string;
}

interface PlatformManifest {
  expectedCounts: Record<PlatformCapability['kind'], number>;
  requiredCapabilityFields: (keyof PlatformCapability)[];
  capabilities: PlatformCapability[];
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as PlatformManifest;

const platformApiPaths = [...PLATFORM_ROUTE_FILES]
  .flatMap(([file, mount]) => {
    const source = readFileSync(join(REPO, 'core', 'packages', 'server', 'src', 'routes', file), 'utf8');
    return [...source.matchAll(/Routes\.(?:get|post|put|patch|delete)\(\s*'([^']+)'/g)]
      .map((match) => `${mount}${match[1]}`);
  });

function normalizedApiPath(path: string): string {
  return path.replace(/:[^/]+/g, ':param');
}

describe('Platform capability conservation manifest', () => {
  it('accounts for the complete 95 / 13 / 34 / 4 source union', () => {
    for (const kind of ['page', 'handler', 'action', 'metadata'] as const) {
      const mappings = manifest.capabilities
        .filter((capability) => capability.kind === kind)
        .flatMap((capability) => capability.mappings);
      expect(mappings, kind).toHaveLength(manifest.expectedCounts[kind]);
      expect(new Set(mappings.map(([source]) => source)).size, `${kind} source`).toBe(mappings.length);
    }
  });

  it('keeps every source mapped to a concrete main-site target', () => {
    const mappings = manifest.capabilities.flatMap((capability) => capability.mappings);
    for (const [source, target] of mappings) {
      expect(source).toMatch(/^(retired|archive):\//);
      expect(target).toMatch(/^\//);
      expect(target).not.toContain('platform.cuberoot.me');
      expect(target).not.toContain('packages/platform');
    }
  });

  it('requires an explicit owner, API, permission, side effect, empty state and test contract', () => {
    for (const capability of manifest.capabilities) {
      for (const field of manifest.requiredCapabilityFields) {
        expect(capability, `${capability.id} missing ${field}`).toHaveProperty(field);
      }
      expect(capability.id).not.toBe('');
      expect(capability.mappings.length).toBeGreaterThan(0);
      expect(capability.strategy).not.toBe('');
      expect(capability.canonicalOwner).not.toBe('');
      expect(capability.permission).not.toBe('');
      expect(capability.sideEffects).not.toBe('');
      expect(capability.metadata).not.toBe('');
      expect(capability.emptyState).not.toBe('');
      expect(capability.tests.length).toBeGreaterThan(0);
      expect(capability.implementationStatus, `${capability.id} is not implemented`).toBe('implemented');
      expect(capability.reviewStatus, `${capability.id} is not reviewed`).toBe('reviewed');
      for (const test of capability.tests) {
        expect(
          existsSync(join(CLIENT_TESTS, test)) || existsSync(join(SERVER_TESTS, test)),
          `${capability.id} references missing test ${test}`,
        ).toBe(true);
      }
    }
  });

  it('records the explicit non-migration boundaries', () => {
    const serialized = JSON.stringify(manifest);
    expect(serialized).toContain('old history is not imported');
    expect(serialized).toContain('old OTP and session data not imported');
    expect(serialized).toContain('privacy-minimized');
    expect(serialized).not.toContain('mockPay');
  });

  it('references real Platform API contracts instead of retired endpoint names', () => {
    for (const capability of manifest.capabilities) {
      for (const api of [...capability.readApi, ...capability.writeApi]) {
        if (!api.startsWith('/v1/platform/')) continue;
        const wildcardPrefix = api.endsWith('/*') ? api.slice(0, -1) : null;
        const matched = wildcardPrefix
          ? platformApiPaths.some((route) => route.startsWith(wildcardPrefix))
          : platformApiPaths.some((route) => normalizedApiPath(route) === normalizedApiPath(api));
        expect(matched, `${capability.id} references missing Platform API ${api}`).toBe(true);
      }
    }
  });
});
