/**
 * 每张 case 都要有打乱,而且那条打乱**必须真的打出这张 case**。
 *
 * 背景:`meta.scramble`(= 逆 case 的公式)不是每张都有 —— 导入时过不了轨道判据的不入库
 * (`alg-build/import_1lll.mjs`),线上 3915 张有 meta 的 case 里 17 张是空的,详情页那一栏
 * 整块消失(`/alg/3x3/pll/u-` 就是其中之一)。`caseScramble` 补上这个洞。
 *
 * 补法不能盲信 `meta.inv` —— 这个指针**真的错过**:2026-08-04 查出 8 张 1lll case 的整块 meta
 * 挂到了别人的行上,连带 12 张的 `inv` 指向不是自己的逆态(migration `0102` 已修,始末见
 * `docs/1lll-sheet-issues.md` §元数据层)。所以本测试两侧都钉:
 *   ① 印证得上(Ua / 1LLL 4 44)→ 必须取到逆 case 的公式;
 *   ② 印证不上(下面那对取自 0102 之前的真实库数据)→ 必须**退回 setup**,绝不能把逆 case
 *      那条端上来。这条同时是 0102 那类事故的回归样本。
 * 判据用站上自己那份 `validateAlgCase`(cubing.js),不是眼看。
 */
import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import { caseScramble } from '@/lib/alg_scramble';
import { validateAlgCase } from '@/lib/alg_validation';

/** 取自线上 `/v1/alg/sets/3x3/{pll,1lll}`,只留本测试要用的字段。 */
const F: Record<string, AlgCase> = {
  // 洞①:pll Ua 没有 scramble,逆 case 指针(→ Ub)可信
  Ua: {
    name: 'Ua', subgroup: 'U', setup: "R2' U S' U2 S U R2'",
    sticker: { kind: 'face', us: 'yyyyyyyyy', ub: 'brbbbbbbb', uf: 'ggggggggg', ul: 'rorrrrrrr', ur: 'obooooooo' },
    algs: [[{ alg: "R2 U' S' U2' S U' R2" }]],
    meta: { no: 2, inv: 1 } as AlgCase['meta'],
  },
  Ub: {
    name: 'Ub', subgroup: 'U', setup: "M2' U M U2' M' U M2' U",
    sticker: { kind: 'face', us: 'yyyyyyyyy', ub: 'bobbbbbbb', uf: 'ggggggggg', ul: 'rbrrrrrrr', ur: 'orooooooo' },
    algs: [[{ alg: "U' M2 U' M U2 M' U' M2" }]],
    meta: { no: 1, inv: 2, scramble: "R2 U' S' U2' S U' R2" } as AlgCase['meta'],
  },
  // 已有 scramble:原样端出来,不重算
  Aa: {
    name: 'Aa', subgroup: 'A', setup: "x R2' D2' R U R' D2' R U' R x'",
    sticker: { kind: 'face', us: 'yyyyyyyyy', ub: 'obobbbbbb', uf: 'ggbgggggg', ul: 'brrrrrrrr', ur: 'rogoooooo' },
    algs: [[{ alg: "x· (R' U R' D2) (R U' R' D2) R2 x'" }]],
    meta: { no: 11, inv: 12, scramble: "x· R2' D2 (R U R' D2) R U' R x'" } as AlgCase['meta'],
  },
  // 洞②:0102 之前的真实数据 —— 6 7 说自己的逆是 7 12,而 7 12 的公式打出来是**另一张**
  // (真凶是 7 7 / 7 12 两张的 meta 装反了)。留作「印证不上就别用」的回归样本。
  '1LLL 6 7': {
    name: '1LLL 6 7', subgroup: '6', setup: "F R U R' U' F' U F U R U' R' F' y",
    sticker: { kind: 'face', us: 'bbooyyryy', ub: 'yyrrrrrrr', uf: 'yrgoooooo', ul: 'yyggggggg', ur: 'ogbbbbbbb' },
    algs: [[{ alg: "U' F R U R' U' F' U' F U R U' R' F' U" }]],
    meta: { no: 3419, inv: 3491 } as AlgCase['meta'],
  },
  '1LLL 7 12': {
    name: '1LLL 7 12', subgroup: '7', setup: "R B U B' U' R' f U R U' R' f' U",
    sticker: { kind: 'face', us: 'rbyryygyo', ub: 'byyrrrrrr', uf: 'rgyoooooo', ul: 'byygggggg', ur: 'goobbbbbb' },
    algs: [[{ alg: "U' (f R U R' U' f') (R U B U' B' R')" }]],
    meta: { no: 3491, inv: 3419, scramble: "(R B U B' U' R') (f U R U' R' f')" } as AlgCase['meta'],
  },
  // 洞③:指针可信的 1lll 例子
  '1LLL 4 44': {
    name: '1LLL 4 44', subgroup: '4', setup: "F' U2' F2' U R U' R' F' R U' R' F R' F' R2 U' R'",
    sticker: { kind: 'face', us: 'oogbyrrgy', ub: 'yybrrrrrr', uf: 'yyboooooo', ul: 'yyggggggg', ur: 'ryobbbbbb' },
    algs: [[{ alg: "(R U R2' F R F') (R U R' F) (R U R' U') F2 U2 F" }]],
    meta: { no: 984, inv: 911 } as AlgCase['meta'],
  },
  '1LLL 3 44': {
    name: '1LLL 3 44', subgroup: '3', setup: "R U R' F' U' F U R U2' R' U r U2' R' U' R U' r' y'",
    sticker: { kind: 'face', us: 'goygyrbbr', ub: 'oyyoooooo', uf: 'oyyrrrrrr', ul: 'ryybbbbbb', ur: 'byggggggg' },
    algs: [[{ alg: "U r U R' U R U2 r' U' R U2 R' U' F' U F R U' R' U'" }]],
    meta: { no: 911, inv: 984, scramble: "(R U R2' F R F') (R U R' F) (R U R' U') F2 U2 F" } as AlgCase['meta'],
  },
};

const byNo = new Map(Object.values(F).map((c) => [c.meta!.no, c]));

const AUF = ['', 'U', 'U2', "U'"];

/**
 * 这条打乱是不是真打出了这张 case:摆完再用它自己的首条公式解,应当还原。
 *
 * case 的身份定义在 (前 AUF × 后 AUF) 的 16 折轨道上(见 `alg-build/ll_ident.mjs`),所以
 * 打乱前面和「打乱与公式之间」各试四个 U —— 判的是「同一张 case」,不是「同一个相位」。
 * 公式末尾那个 AUF 由 `validateAlgCase` 自己试。
 */
async function scrambleShowsCase(scramble: string, c: AlgCase, set: string): Promise<boolean> {
  for (const pre of AUF) {
    for (const mid of AUF) {
      const r = await validateAlgCase(`${pre} ${scramble} ${mid}`.trim(), c.algs[0][0].alg, c.sticker, '3x3', set);
      if (r.ok) return true;
    }
  }
  return false;
}

describe('caseScramble — 每张 case 的打乱', () => {
  it('已有 meta.scramble 就原样用,不重算', () => {
    expect(caseScramble(F.Aa, byNo)).toEqual({ text: "x· R2' D2 (R U R' D2) R U' R x'", fromInvCase: true });
  });

  it('缺 scramble + 指针可信 → 取逆 case 的首条公式(剥掉起手 AUF)', () => {
    expect(caseScramble(F.Ua, byNo)).toEqual({ text: "M2 U' M U2 M' U' M2", fromInvCase: true });
    expect(caseScramble(F['1LLL 4 44'], byNo)).toEqual({
      text: "r U R' U R U2 r' U' R U2 R' U' F' U F R U' R' U'",
      fromInvCase: true,
    });
  });

  it('缺 scramble + 逆 case 那条印证不上 → 退回 setup,不端出逆 case 的公式', () => {
    const got = caseScramble(F['1LLL 6 7'], byNo)!;
    expect(got).toEqual({ text: "F R U R' U' F' U F U R U' R' F' y", fromInvCase: false });
    // 钉住反面:指针指的那条**确实**是错的,退回不是白退
    expect(got.text).not.toContain('f R U');
  });

  it('既没 meta 也没 setup(sq1 那张已还原的 case)→ null,不编一条空打乱', () => {
    const solved = { name: 'Square / Square', subgroup: 'Solved', setup: '', sticker: F.Ua.sticker, algs: [[]] } as AlgCase;
    expect(caseScramble(solved, new Map())).toBe(null);
  });

  it('每条打乱都真打出它自己那张 case(cubing.js 判)', async () => {
    for (const [key, set] of [['Ua', 'pll'], ['Aa', 'pll'], ['1LLL 6 7', '1lll'], ['1LLL 4 44', '1lll']] as const) {
      const c = F[key];
      const s = caseScramble(c, byNo)!;
      expect(await scrambleShowsCase(s.text, c, set), `${key}: 打乱 "${s.text}" 应打出这张 case`).toBe(true);
    }
  }, 60_000);

  it('坏指针那条若照单全收会打出别的 case —— 钉住判据不白设', async () => {
    const wrong = F['1LLL 7 12'].algs[0][0].alg;
    expect(await scrambleShowsCase(wrong, F['1LLL 6 7'], '1lll')).toBe(false);
  }, 60_000);
});
