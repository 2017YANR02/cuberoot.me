import { describe, expect, it } from 'vitest';
import type { AlgCase, AlgEntry } from '@cuberoot/shared';
import { hasOhAlgsForHand, ohAlgsForCase } from '@/lib/alg_oh_hand';

function mkCase(no: number, mirror: number | undefined, algs: AlgEntry[][]): AlgCase {
  return {
    name: `case-${no}`,
    subgroup: '',
    setup: '',
    sticker: { kind: 'raw', tag: 'OLL', attrs: {} },
    algs,
    meta: {
      no,
      mirror,
      ollcp: '',
      subset: 'PLL',
      oll: '',
      cp: '',
    },
  };
}

describe('PLL one-handed formulas', () => {
  it('左手保留当前 case 的 OH 原文，右手取镜像 partner 后复用 /sim 的 M 镜像', () => {
    const left = mkCase(11, 12, [[
      { alg: "R U R'", tags: ['oh'] },
      { alg: 'M2 U M2', tags: ['ft'] },
    ]]);
    const partner = mkCase(12, 11, [[{
      alg: "L↑ U' (L' U)2",
      setup: "L U L'",
      algHtml: '<u>L</u>',
      altId: 'partner-oh',
      ytId: 'video',
      tags: ['oh'],
      source: 'cuberoot',
      note: { zh: '保留说明', en: 'Keep note' },
      stm: 6,
      gen: 'lr',
      src: { id: 7, ori: 0, i: 0 },
    }]]);

    const cases = [left, partner];
    expect(ohAlgsForCase(left, cases, 0, 'left')).toEqual([{ alg: "R U R'", tags: ['oh'] }]);

    const right = ohAlgsForCase(left, cases, 0, 'right');
    expect(right).toEqual([{
      alg: "R' U R U' R U'",
      setup: "R' U' R",
      tags: ['oh'],
      source: 'cuberoot',
      note: { zh: '保留说明', en: 'Keep note' },
      stm: 6,
    }]);
  });

  it('按视角读取 partner，缺少镜像关系或 partner 时不伪造右手公式', () => {
    const target = mkCase(21, 22, [[{ alg: 'R', tags: ['oh'] }]]);
    const partner = mkCase(22, 21, [
      [{ alg: 'L', tags: ['ft'] }],
      [{ alg: "L'", tags: ['oh'] }],
    ]);
    const noMirror = mkCase(23, undefined, [[{ alg: 'R', tags: ['oh'] }]]);

    expect(ohAlgsForCase(target, [target, partner], 1, 'right')).toEqual([
      { alg: 'R', tags: ['oh'] },
    ]);
    expect(hasOhAlgsForHand(target, [target, partner], 'right')).toBe(true);
    expect(ohAlgsForCase(noMirror, [noMirror], 0, 'right')).toEqual([]);
    expect(ohAlgsForCase(target, [target], 0, 'right')).toEqual([]);
    expect(hasOhAlgsForHand(target, [target], 'right')).toBe(false);
  });

  it('非法源公式直接跳过，不把未镜像的原文冒充右手公式', () => {
    const target = mkCase(31, 32, [[{ alg: 'R', tags: ['oh'] }]]);
    const partner = mkCase(32, 31, [[{ alg: 'not-a-cube-move', tags: ['oh'] }]]);
    expect(ohAlgsForCase(target, [target, partner], 0, 'right')).toEqual([]);
  });
});
