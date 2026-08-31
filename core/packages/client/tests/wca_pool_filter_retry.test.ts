import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WcaSourceSpec } from '@/app/[lang]/timer/_lib/scramble/wca_pool';

vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => `http://test${path}` }));

const spec: WcaSourceSpec = {
  event: '222',
  mode: 'date',
  comp: '',
  compName: '',
  round: '',
  group: '',
  from: '2020-01-01',
  to: '2026-01-01',
  optimal: false,
  stepFilter: { metric: 'htm', lo: 1, hi: 1 },
};

function items(scramble: string) {
  return Array.from({ length: 50 }, (_, index) => ({
    scramble,
    ci: 'Retry2026',
    cn: 'Retry 2026',
    e: '222',
    r: '1',
    g: 'A',
    n: index + 1,
    x: 0 as const,
  }));
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('WCA date step-filter retry', () => {
  it('treats 30 sampled misses as transient and lets the next fill match', async () => {
    let randomCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('puzzle_examples.json')) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      randomCalls++;
      const scramble = randomCalls <= 30 ? 'U R' : 'U';
      return {
        ok: true,
        status: 200,
        json: async () => ({ scrambles: items(scramble) }),
      };
    }));
    const { isWcaSourceEmpty, nextWca } = await import(
      '@/app/[lang]/timer/_lib/scramble/wca_pool'
    );

    expect(await nextWca(spec)).toBeNull();
    expect(randomCalls).toBe(30);
    expect(isWcaSourceEmpty(spec)).toBe(false);
    expect(await nextWca(spec)).toBe('U');
    expect(randomCalls).toBe(31);
    expect(isWcaSourceEmpty(spec)).toBe(false);
  });

  it('does not permanently empty a dated nobar source after 30 has-bar batches', async () => {
    const noBar = "R' U' F U F R' U2 F U2";
    let randomCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      randomCalls++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          scrambles: items(randomCalls <= 30 ? "R R'" : noBar),
        }),
      };
    }));
    const { isWcaSourceEmpty, nextWca } = await import(
      '@/app/[lang]/timer/_lib/scramble/wca_pool'
    );
    const noBarSpec: WcaSourceSpec = {
      ...spec,
      stepFilter: undefined,
      typeFilter: 'nobar',
    };

    expect(await nextWca(noBarSpec)).toBeNull();
    expect(randomCalls).toBe(30);
    expect(isWcaSourceEmpty(noBarSpec)).toBe(false);
    expect(await nextWca(noBarSpec)).toBe(noBar);
    expect(randomCalls).toBe(31);
  });
});
