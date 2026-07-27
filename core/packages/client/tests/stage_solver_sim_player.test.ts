/**
 * StageSolver 的解法动画改跑站内 `/sim` 引擎(components/AlgPlayer/AlgSimPlayer)之后,
 * 播放器必须仍然走到「十字解在 D 面」那个态。
 *
 * 换引擎唯一真会出事的是**解法前导的整体转体**:StageSolver 把 `z2 y` 这样的前缀切出来
 * 折进 setup(splitLeadRot),播放器只动画剩下的面转。两套引擎对 `x/y/z` 的手性哪怕差
 * 一个正负号,十字就落到别的面上 —— 画面照样转得有模有样,只是解错了,肉眼极难发现。
 *
 * 判据完全来自引擎自己的 `serialize()`(标准 URFDLB 行主序 54 格,含中心块,见
 * components/sim-embed/faceletMap.ts):十字解在 D = D 面 4 枚棱的 D 格与 D 中心同色,
 * 且各自的侧格与该侧中心同色。中心块也在串里,所以这个判定是**自描述的**,不依赖外部真值。
 *
 * 为了让上面这句不至于沦为自说自话,第一组用例把引擎的 x/y/z/面转约定逐个钉死在 WCA
 * 定义上(`z`: U→R→D→L→U;`y`: R→F→L→B→R;`x`: F→U→B→D→F)—— 记号解析一歪,这里先炸。
 *
 * 注:没拿 cubing.js 当真值。`lib/stage_detect` 的 crossSolved 是给 recon 的**已归位到
 * 标准朝向**的 pattern 用的,直接喂带整体转体的串会答非所问(实测它把本文件的 fixture
 * 判成「十字在 U」)。要引 cubing.js 当真值得先补一份 KPattern→facelet 的换算,那是另一件事。
 */
import { describe, it, expect } from 'vitest';
import World from '@/app/[lang]/sim/engine/world';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { normalizeAlgForTwisty } from '@/lib/alg_normalize';

/** 跑一条串,返回 54 格贴纸(URFDLB 行主序)。 */
function facelets(alg: string): string {
  const world = new World();
  const cube = world.cube as Cube;
  if (alg.trim()) cube.twister.setup(alg);
  const f = cube.serialize();
  expect(f.length).toBe(54);
  return f;
}

const face = (f: string, i: number) => f.slice(i * 9, i * 9 + 9);
const FACES = (f: string) => ({
  U: face(f, 0), R: face(f, 1), F: face(f, 2), D: face(f, 3), L: face(f, 4), B: face(f, 5),
});

/** D 面十字的 4 组 (D 面格, 侧面格);侧格 → 该侧中心格。与 lib/lsll/cube333.ts 的 EF 表一致。 */
const D_CROSS: readonly (readonly [number, number, number])[] = [
  [28, 25, 22], // DF ↔ F
  [30, 43, 40], // DL ↔ L
  [32, 16, 13], // DR ↔ R
  [34, 52, 49], // DB ↔ B
];

function crossOnD(alg: string): boolean {
  const f = facelets(alg);
  return D_CROSS.every(([d, side, sideCenter]) => f[d] === f[31] && f[side] === f[sideCenter]);
}

/** StageSolver 的 splitLeadRot —— 播放器把 lead 折进 setup,只动画 body。 */
function splitLeadRot(a: string): { lead: string; body: string } {
  const toks = a.trim().split(/\s+/).filter(Boolean);
  let p = 0;
  while (p < toks.length && /^[xyz][2']?$/.test(toks[p])) p++;
  return { lead: toks.slice(0, p).join(' '), body: toks.slice(p).join(' ') };
}

/** 从跑着的 StageSolver 上抄下来的真解(打乱取自 WCA 真题池),都带前导整体转体。 */
const FIXTURES: { scramble: string; solutions: string[] }[] = [
  {
    scramble: "F' B' R' L' F' L F2 R2 B' D B2 F2 U L2 F' D L2 B",
    solutions: [
      "z y F L2 F' D' R'",
      "z y2 U D2 R D R F'",
      "z y2 U D2 R D F' R",
      "z y D' L2 F' D' F R'",
    ],
  },
];

describe('/sim 引擎的记号约定(WCA)', () => {
  it('还原态每面一色', () => {
    expect(FACES(facelets(''))).toEqual({
      U: 'UUUUUUUUU', R: 'RRRRRRRRR', F: 'FFFFFFFFF',
      D: 'DDDDDDDDD', L: 'LLLLLLLLL', B: 'BBBBBBBBB',
    });
  });

  it('z = 从 F 看顺时针:U→R→D→L→U', () => {
    const b = FACES(facelets('z'));
    expect(b.R).toBe('UUUUUUUUU');
    expect(b.D).toBe('RRRRRRRRR');
    expect(b.L).toBe('DDDDDDDDD');
    expect(b.U).toBe('LLLLLLLLL');
    expect(b.F).toBe('FFFFFFFFF'); // 转轴两端不动
    expect(b.B).toBe('BBBBBBBBB');
  });

  it('y = 从 U 看顺时针:R→F→L→B→R', () => {
    const b = FACES(facelets('y'));
    expect(b.F).toBe('RRRRRRRRR');
    expect(b.L).toBe('FFFFFFFFF');
    expect(b.B).toBe('LLLLLLLLL');
    expect(b.R).toBe('BBBBBBBBB');
    expect(b.U).toBe('UUUUUUUUU');
    expect(b.D).toBe('DDDDDDDDD');
  });

  it('x = 从 R 看顺时针:F→U→B→D→F', () => {
    const b = FACES(facelets('x'));
    expect(b.U).toBe('FFFFFFFFF');
    expect(b.B).toBe('UUUUUUUUU');
    expect(b.D).toBe('BBBBBBBBB');
    expect(b.F).toBe('DDDDDDDDD');
    expect(b.R).toBe('RRRRRRRRR');
    expect(b.L).toBe('LLLLLLLLL');
  });

  it('判据不恒真:还原态有十字,一打乱就没有', () => {
    expect(crossOnD('')).toBe(true);
    expect(crossOnD(FIXTURES[0].scramble)).toBe(false);
  });
});

describe('StageSolver 解法动画 — 播放器喂进 /sim 引擎的两段', () => {
  for (const { scramble, solutions } of FIXTURES) {
    for (const sol of solutions) {
      it(`「${sol}」跑完十字解在 D 面`, () => {
        // AlgSimPlayer 实际吃的两段:setup = 打乱 + 前导转体,moves = 动画的面转。
        const { lead, body } = splitLeadRot(sol);
        // 这批 fixture 就是为了覆盖前导转体;lead 空了说明抄错了,测试也就白设。
        expect(lead).not.toBe('');

        const setupAlg = normalizeAlgForTwisty('3x3', `${scramble} ${lead}`);
        const moves = normalizeAlgForTwisty('3x3', body);

        expect(crossOnD(setupAlg)).toBe(false);              // 动画还没开始
        expect(crossOnD(`${setupAlg} ${moves}`)).toBe(true);  // 走到最后一步
      });
    }
  }
});
