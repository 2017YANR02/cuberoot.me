/**
 * 多朝向 case 的 setup 必须跟着朝向走。issue #40。
 *
 * 曾经的 bug:`oriAdjustSetup` 是 AlgCategoryView 的模块私有函数,case 详情页
 * (`app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView.tsx`)把四个朝向的公式全渲染
 * 出来,却一律传原始 `caseObj.setup` —— FL / BL / BR 三组的缩略图与动画演的都是**别的**
 * case。拿未调整的 setup 校 f2l 全部 622 条只过 164 条(26.4%,正好只有 FR 那一组);
 * 调整后 622/622。
 *
 * 这里用真实 f2l 数据的两个 case 当 fixture 把两侧都钉住:调整后必须全过,
 * 不调整必须**过不了**(否则说明判据太松,这个测试就白写了)。
 */
import { describe, expect, it } from 'vitest';
import { oriAdjustSetup } from '@/lib/alg_display';
import { normalizeAlg } from '@/lib/alg_normalize';

/** 取自线上 3x3/f2l:四个朝向各一条主推公式。 */
const FIXTURE = [
  { name: 'A+', setup: "F R' F' R", algs: ["U R U' R'", "F' r U r'", "U L U' L'", "U f R' f'"] },
  { name: 'B-', setup: "F' U F", algs: ["F' U' F", "L' U' L", "y R' U' R", "R' U' R"] },
];

const D_CORNERS = [4, 5, 6, 7];
const F2L_EDGES = [4, 5, 6, 7, 8, 9, 10, 11];
const ORIENTATIONS = ['', 'x', 'x2', "x'", 'z', "z'"]
  .flatMap((a) => ['', 'y', 'y2', "y'"].map((b) => [a, b].filter(Boolean).join(' ')));

describe('oriAdjustSetup — 多朝向 case 的 setup', () => {
  it('ori 0 原样返回,其余追加对应的 y 转体', () => {
    expect(oriAdjustSetup("F R' F' R", 0)).toBe("F R' F' R");
    expect(oriAdjustSetup("F R' F' R", 1)).toBe("F R' F' R y");
    expect(oriAdjustSetup("F R' F' R", 2)).toBe("F R' F' R y2");
    expect(oriAdjustSetup("F R' F' R", 3)).toBe("F R' F' R y'");
  });

  it('空 setup 不加尾巴(否则会凭空造出一个纯转体的打乱)', () => {
    expect(oriAdjustSetup('', 2)).toBe('');
  });

  it('调整后四个朝向的公式都真能做完 F2L;不调整则只有 FR 那组过', async () => {
    const { cube3x3x3 } = await import('cubing/puzzles');
    const kpuzzle = await cube3x3x3.kpuzzle();

    const f2lDone = (alg: string): boolean => {
      const base = kpuzzle.defaultPattern().applyAlg(normalizeAlg('3x3', alg));
      return ORIENTATIONS.some((rot) => {
        const p = rot ? base.applyAlg(rot) : base;
        const c = p.patternData.CORNERS as unknown as { pieces: number[]; orientation: number[] };
        const e = p.patternData.EDGES as unknown as { pieces: number[]; orientation: number[] };
        return D_CORNERS.every((i) => c.pieces[i] === i && c.orientation[i] === 0)
          && F2L_EDGES.every((i) => e.pieces[i] === i && e.orientation[i] === 0);
      });
    };

    for (const c of FIXTURE) {
      c.algs.forEach((alg, ori) => {
        expect(f2lDone(`${oriAdjustSetup(c.setup, ori)} ${alg}`), `${c.name} ori=${ori} 调整后应做完 F2L`).toBe(true);
      });
      // 非 0 朝向若不调整,必然演的是别的 case —— 钉住这一侧,防判据被放松
      const unadjusted = c.algs.slice(1).filter((alg) => f2lDone(`${c.setup} ${alg}`));
      expect(unadjusted, `${c.name}:不调整 setup 时 FL/BL/BR 不该通过`).toEqual([]);
    }
  }, 30_000);
});
