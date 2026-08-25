/**
 * 2x2 WCA 真题专项契约:
 * - 全时段优先从 puzzle_examples.json 的预计算状态桶即时播种；
 * - 日期范围不能借用全时段桶，必须对接口返回的真题逐条做最终状态精确过滤；
 * - 被端出的打乱保留原比赛元数据。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CUBE222_STATE_TYPES, cube222StateTypeMatchesScramble } from '@cuberoot/puzzle-solvers/cube222';
import type { WcaSourceSpec } from '@/app/[lang]/timer/_lib/scramble/wca_pool';

const NO_BAR = "R' U' F U F R' U2 F U2";
const HAS_BAR = "R R'";
const EXAMPLES_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../stats/scramble/puzzle_examples.json',
);

vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => `http://test${path}` }));
vi.mock('@/lib/puzzle-examples', () => ({
  fetchPuzzleExamples: vi.fn(async () => ({
    meta: { generated_at: '2026-08-21T00:00:00.000Z' },
    puzzles: {
      '222': {
        types: { nobar: [['sample-1', NO_BAR]] },
        comps: { Test2026: ['Test Competition 2026', '2026-01-01'] },
        idMeta: { 'sample-1': ['Test2026', '222', 1, '1', 'A', 0] },
      },
    },
  })),
}));

const baseSpec: WcaSourceSpec = {
  event: '222', mode: 'date', comp: '', compName: '', round: '', group: '',
  from: '', to: '', optimal: false, typeFilter: 'nobar',
};

async function freshPool() {
  vi.resetModules();
  return import('@/app/[lang]/timer/_lib/scramble/wca_pool');
}

function randomItem(scramble: string, n: number) {
  return { scramble, ci: 'Live2026', cn: 'Live Competition 2026', e: '222', r: '1', g: 'A', n, x: 0 as const };
}

beforeEach(() => { vi.unstubAllGlobals(); });

describe('wca_pool 2x2 state families', () => {
  it('seeds an all-time state filter from the precomputed WCA bucket', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchFn);
    const { nextWca, wcaMetaFor } = await freshPool();

    const scramble = await nextWca(baseSpec);
    expect(scramble).toBe(NO_BAR);
    expect(cube222StateTypeMatchesScramble(scramble!, 'nobar')).toBe(true);
    expect(wcaMetaFor(scramble!)).toMatchObject({ ci: 'Test2026', e: '222', n: 1 });
  });

  it('filters date-bounded live WCA rows by exact final state', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ scrambles: [randomItem(HAS_BAR, 1), randomItem(NO_BAR, 2)] }),
    }));
    vi.stubGlobal('fetch', fetchFn);
    const { nextWca, wcaMetaFor } = await freshPool();

    const scramble = await nextWca({ ...baseSpec, from: '2026-01-01', to: '2026-12-31' });
    expect(scramble).toBe(NO_BAR);
    expect(cube222StateTypeMatchesScramble(scramble!, 'nobar')).toBe(true);
    expect(wcaMetaFor(scramble!)).toMatchObject({ ci: 'Live2026', e: '222', n: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('shipped WCA 2x2 state buckets', () => {
  it.skipIf(!existsSync(EXAMPLES_PATH))('contains only exact matches with intact metadata', () => {
    const data = JSON.parse(readFileSync(EXAMPLES_PATH, 'utf8')) as {
      puzzles: {
        '222': {
          types: Record<string, Array<[string, string]>>;
          idMeta: Record<string, unknown>;
        };
      };
    };
    const puzzle = data.puzzles['222'];

    expect(Object.keys(puzzle.types).sort()).toEqual([...CUBE222_STATE_TYPES].sort());
    for (const type of CUBE222_STATE_TYPES) {
      const samples = puzzle.types[type];
      expect(samples.length, `${type} bucket is empty`).toBeGreaterThan(0);
      expect(samples.length, `${type} bucket exceeded the timer cap`).toBeLessThanOrEqual(300);
      for (const [id, scramble] of samples) {
        expect(puzzle.idMeta[id], `${type} sample ${id} lost WCA metadata`).toBeTruthy();
        expect(
          cube222StateTypeMatchesScramble(scramble, type),
          `${type} bucket contains ${scramble}`,
        ).toBe(true);
      }
    }
  });
});
