import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each([
  ['production', '1', true],
  ['production', '0', false],
  ['development', '0', false],
] as const)('only Vercel production falls back to the standalone-only asset host (%s, %s)', async (mode, vercel, enabled) => {
  vi.stubEnv('NODE_ENV', mode);
  vi.stubEnv('VERCEL', vercel);
  vi.resetModules();
  const { default: config } = await import('../next.config');
  const rewrites = await config.rewrites!();
  expect(Array.isArray(rewrites)).toBe(false);
  if (Array.isArray(rewrites)) throw new Error('Expected phased rewrites');
  expect(rewrites.fallback).toEqual(enabled ? [{
    source: '/_next/static/:path*',
    destination: 'https://next.cuberoot.me/_next/static/:path*',
  }] : []);
});
