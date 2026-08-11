// 顶层朝向掩码。核心是一条「省算」的等式:掩码转一格 === 打乱尾巴多补一个 U。
// 分组、朝向计数、AUF 筛选全建在它上面,所以这里拿模拟器逐条把它验死;算错一位,
// 训练器就会在用户选了「黄条朝上」时端上朝右的题面。
import { describe, it, expect } from 'vitest';
import { CubeData, parseAlgorithm, Face } from '@cuberoot/visualcube';
import type { AlgCase } from '@cuberoot/shared';
import { generateScramble } from '@/lib/trainer-scramble';
import {
  ORI_AUF, rotateMask, orientationCycle, allowedPostAuf, oriSupportedSize,
  oriCornersOnly, canonicalLlSetup,
} from '@/lib/alg_ll_orientation';

/** 参照实现:直接模拟,不走 rotateMask。与 lib 里的读法逐字一致。 */
function simMask(alg: string, size: number): number {
  const cd = new CubeData(size);
  for (const t of parseAlgorithm(alg)) cd.turn(t);
  const n2 = size * size;
  const faceOf = (id: number) => Math.floor((id - 1) / n2);
  const top = size % 2 === 1
    ? faceOf(cd.faces[Face.U][(n2 - 1) / 2])
    : (() => {
        const tally = new Map<number, number>();
        for (const id of cd.faces[Face.D]) tally.set(faceOf(id), (tally.get(faceOf(id)) ?? 0) + 1);
        return ([...tally].sort((a, b) => b[1] - a[1])[0][0] + 3) % 6;
      })();
  let mask = 0;
  let bit = 0;
  for (let i = 0; i < n2; i++, bit++) if (faceOf(cd.faces[Face.U][i]) === top) mask |= 1 << bit;
  for (const f of [Face.B, Face.L, Face.F, Face.R]) {
    for (let i = 0; i < size; i++, bit++) if (faceOf(cd.faces[f][i]) === top) mask |= 1 << bit;
  }
  return mask;
}

// 覆盖 3 阶七大 OLL 形状 + 带整体旋转的 setup + 2 阶。都取自库里的真 setup。
const SETUPS_3 = [
  "L' U R U' L U R2' U2 R U R' U R",   // ZBLL U 1
  "R U R' U R U2 R'",                   // Sune
  "R U2 R' U' R U' R'",                 // Anti-sune
  "R U R' U R U' R' U R U2 R'",         // H
  "F R U R' U' F'",                     // 小 T
  "y R U R' U' R' F R F'",              // 带整体旋转
  "M' U M U2 M' U M",                   // 中层记号
  "R U R' F' R U R' U' R' F R2 U' R'",  // Jb(顶层全黄 → 无朝向)
  "F R U' R' U' R U R' F' R U R' U' R' F R F'",
];
const SETUPS_2 = [
  "R U R' U R U2 R'",
  "R U2 R' U' R U' R'",
  "F R U R' U' F'",
  "y R U R' F' R U R' U' R' F R2 U' R'",
];

describe('rotateMask ≡ 尾巴补一个 U', () => {
  for (const [size, setups] of [[3, SETUPS_3], [2, SETUPS_2]] as const) {
    it(`${size} 阶:四个相位逐个对上模拟器`, () => {
      for (const s of setups) {
        for (let k = 0; k < 4; k++) {
          const viaSim = simMask(`${s} ${ORI_AUF[k]}`.trim(), size);
          let viaRot = simMask(s, size);
          for (let i = 0; i < k; i++) viaRot = rotateMask(viaRot, size);
          expect(viaRot, `${s} + U^${k} (${size}x${size})`).toBe(viaSim);
        }
      }
    });
  }
  it('转四次回到原样', () => {
    for (const s of SETUPS_3) {
      let m = simMask(s, 3);
      for (let i = 0; i < 4; i++) m = rotateMask(m, 3);
      expect(m).toBe(simMask(s, 3));
    }
  });
});

describe('orientationCycle', () => {
  it('七大 OLL 形状:H 是 2 重对称,其余 4 种朝向', () => {
    expect(orientationCycle("R U R' U R U2 R'", 3)!.distinct).toBe(4);          // Sune
    expect(orientationCycle("R U2 R' U' R U' R'", 3)!.distinct).toBe(4);        // Anti-sune
    expect(orientationCycle("R U R' U R U' R' U R U2 R'", 3)!.distinct).toBe(2); // H
    expect(orientationCycle("F R U R' U' F'", 3)!.distinct).toBe(4);            // T
  });
  it('顶层全黄(PLL)没有朝向可言', () => {
    const cyc = orientationCycle("R U R' F' R U R' U' R' F R2 U' R'", 3)!;
    expect(cyc.distinct).toBe(1);
    expect(new Set(cyc.masks).size).toBe(1);
  });
  it('组键与相位无关:同一形状的四个相位算出同一个键', () => {
    const base = "R U R' U R U2 R'";
    const keys = ORI_AUF.map(a => orientationCycle(`${base} ${a}`.trim(), 3)!.key);
    expect(new Set(keys).size).toBe(1);
  });
  it('组键跨 set 通用:同一形状的 ZBLL / COLL / OLL setup 落到同一组', () => {
    // 都是库里的真 setup。U 形状:ZBLL U 1 / COLL U 1 / OLL 23;S+ 形状:ZBLL S 1 / OLL 27。
    const key = (s: string) => orientationCycle(s, 3)!.key;
    const u = [
      "L' U R U' L U R2' U2 R U R' U R",
      "R U2' R' U' R U' R2' U2' R U R' U R",
      "R U2' R D R' U2' R D' R2'",
    ].map(key);
    expect(new Set(u).size, u.join()).toBe(1);
    const s = ["M F' L F l' U2 L' U2' L", "R U2' R' U' R U' R'"].map(key);
    expect(new Set(s).size, s.join()).toBe(1);
    expect(u[0]).not.toBe(s[0]);
  });
  it('offs 是相对规范掩码的转数;2 重对称只出 0/1', () => {
    const sune = orientationCycle("R U R' U R U2 R'", 3)!;
    expect(new Set(sune.offs)).toEqual(new Set([0, 1, 2, 3]));
    const h = orientationCycle("R U R' U R U' R' U R U2 R'", 3)!;
    expect(new Set(h.offs)).toEqual(new Set([0, 1]));
    // 规范掩码那一相位的偏移恒为 0
    expect(sune.masks[sune.offs.indexOf(0)]).toBe(Math.min(...sune.masks));
  });
  it('识别图 setup 会补最短 AUF，统一到规范朝向', () => {
    for (const setup of SETUPS_3) {
      const cycle = orientationCycle(setup, 3)!;
      const canonical = canonicalLlSetup(setup, 3);
      expect(simMask(canonical, 3)).toBe(Math.min(...cycle.masks));
    }
  });
  it('阶数不支持 → null(位宽不够,也没有 LL 训练场景)', () => {
    expect(orientationCycle("R U R'", 4)).toBeNull();
    expect(orientationCycle("R U R'", 5)).toBeNull();
    expect(oriSupportedSize(2) && oriSupportedSize(3)).toBe(true);
    expect(oriSupportedSize(5)).toBe(false);
  });
  it('注解字符不算转动(库里的 setup 混着 ↑↓· 一类标注)', () => {
    expect(orientationCycle("R U R' · U↑ R U2 R'", 3)!.key)
      .toBe(orientationCycle("R U R' U R U2 R'", 3)!.key);
  });
});

describe('CMLL 只看角块', () => {
  // Roux 的 M 层没解开,顶层棱是随机的。整层判据会把同一个 Pi 形状按棱裂成好几组
  // (库里 42 条 CMLL 裂成 23 组);压掉棱回到「Solved + 七形状」8 组。
  const PI = [
    "F U R U' R' U R U' R' F'",       // Pi Right Bar
    "R U2 R' U' R U R' U2' R' F R F' U'", // Pi Down Slash
    "F U R U' R' U F' U' R' F' R U",  // Pi X
    "F R' F' R U2 R U' R' U R U2' R'", // Pi Up Slash
  ];
  it('压掉棱之后同一形状归一组,不压就裂开', () => {
    const withEdges = new Set(PI.map(s => orientationCycle(s, 3, false)!.key));
    const cornersOnly = new Set(PI.map(s => orientationCycle(s, 3, true)!.key));
    expect(withEdges.size).toBeGreaterThan(1);
    expect(cornersOnly.size).toBe(1);
  });
  it('判据只对 CMLL 生效 —— COLL 跟 ZBLL / OLL 共用整层键', () => {
    expect(oriCornersOnly('3x3', 'cmll')).toBe(true);
    expect(oriCornersOnly('3x3', '2-look-cmll')).toBe(true);
    expect(oriCornersOnly('3x3', 'oh-cmll')).toBe(true);
    expect(oriCornersOnly('3x3', 'coll')).toBe(false);
    expect(oriCornersOnly('3x3', 'zbll')).toBe(false);
    expect(oriCornersOnly('2x2', 'cll')).toBe(false);
    expect(oriCornersOnly('3x3', null)).toBe(false);
  });
  it('两套判据的键不会串组(前缀区分)', () => {
    const s = "F U R U' R' U R U' R' F'";
    expect(orientationCycle(s, 3, true)!.key).not.toBe(orientationCycle(s, 3, false)!.key);
  });
});

describe('allowedPostAuf', () => {
  const sune = "R U R' U R U2 R'";
  const cyc = orientationCycle(sune, 3)!;

  it('没设偏好 = 不限制', () => {
    expect(allowedPostAuf(sune, 3, undefined)).toBeNull();
    expect(allowedPostAuf(sune, 3, {})).toBeNull();
    expect(allowedPostAuf(sune, 3, { [cyc.key]: [] })).toBeNull();
  });
  it('选一个朝向 → 只剩那一个 AUF,且它确实摆出那个掩码', () => {
    const out = allowedPostAuf(sune, 3, { [cyc.key]: [2] })!;
    expect(out).toHaveLength(1);
    const k = ORI_AUF.indexOf(out[0] as (typeof ORI_AUF)[number]);
    expect(cyc.offs[k]).toBe(2);
    expect(simMask(`${sune} ${out[0]}`.trim(), 3)).toBe(cyc.masks[k]);
  });
  it('2 重对称的组:选一个朝向仍留两个 AUF(排列变化不该跟着被砍一半)', () => {
    const h = "R U R' U R U' R' U R U2 R'";
    const hc = orientationCycle(h, 3)!;
    const out = allowedPostAuf(h, 3, { [hc.key]: [1] })!;
    expect(out).toHaveLength(2);
    for (const a of out) expect(simMask(`${h} ${a}`.trim(), 3)).toBe(hc.masks[hc.offs.indexOf(1)]);
  });
  it('全选 / 别的组的偏好 / 顶层全黄 → 不限制', () => {
    expect(allowedPostAuf(sune, 3, { [cyc.key]: [0, 1, 2, 3] })).toBeNull();
    expect(allowedPostAuf(sune, 3, { zzz: [0] })).toBeNull();
    const pll = "R U R' F' R U R' U' R' F R2 U' R'";
    expect(allowedPostAuf(pll, 3, { [orientationCycle(pll, 3)!.key]: [0] })).toBeNull();
  });
  it('偏好里是这组没有的相位 → 退回不限制,而不是出不了题', () => {
    const h = "R U R' U R U' R' U R U2 R'";
    expect(allowedPostAuf(h, 3, { [orientationCycle(h, 3)!.key]: [3] })).toBeNull();
  });
});

// 端到端:出题这条路(`generateScramble`)真的照朝向偏好来。掩码判据本身上面验过了,
// 这里管的是「偏好 → 实际打乱」这一段没在 pre-AUF / 换打乱类型的时候漏掉。
describe('generateScramble 照朝向出题', () => {
  const mk = (name: string, subgroup: string, setup: string, htm?: string): AlgCase => ({
    name, subgroup, setup,
    sticker: { kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '' },
    algs: [[{ alg: '' }]],
    ...(htm ? { meta: { no: 0, ollcp: '', subset: '', oll: '', cp: '', optimal: { htm: { len: 0, scramble: htm } } } } : {}),
  });
  const CASES = [
    mk('ZBLL U 1', 'U/UR', "L' U R U' L U R2' U2 R U R' U R", "(L' U R U' L U R2') (U2' R U R' U R)"),
    mk('ZBLL U 30', 'U/UB', "r U R' U' r' F R2 B R' F' R B' R' U2'", "L F R' F' L' F R2 B R' F' R B' R'"),
    // stm/htm 打乱带整体旋转(x M …),朝向判据不能写死「黄在顶上」
    mk('ZBLL U 60', 'U/UD', "x M U' L U' L' U' L U2 R' L' U L", 'L F2 D R2 D R2 D2 F2 L2 U2 L'),
    mk('ZBLL H 1', 'H/HB', "F' L' U L U L' U' L S' U' L' U L f U2'", "R' U2 R U R' F U F' R U F U2 F'"),
    mk('ZBLL Pi 5', 'Pi/PiF', "r U2 R D R' U' R D' U' r' F R' F' U'", "L' B L B' U2 L2 F R' F R F2 L2"),
  ];

  for (const c of CASES) {
    for (const kind of ['inv', 'htm'] as const) {
      it(`${c.name} · ${kind}:每个朝向钉住后,60 次出题一次没跑偏`, () => {
        const cyc = orientationCycle(c.setup, 3)!;
        const wanted = [...new Set(cyc.offs)];
        for (const off of wanted) {
          const want = cyc.masks[cyc.offs.indexOf(off)];
          for (let i = 0; i < 60; i++) {
            const scr = generateScramble(c, '3x3', kind, {
              preAuf: true, postAuf: true, orientation: { [cyc.key]: [off] },
            });
            expect(simMask(scr, 3), `${c.name} ${kind} off=${off}: ${scr}`).toBe(want);
          }
        }
      });
    }
  }

  it('不设偏好时四个朝向都出得来(默认随机没被钉死)', () => {
    const c = CASES[0];
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      seen.add(simMask(generateScramble(c, '3x3', 'inv', { preAuf: true, postAuf: true }), 3));
    }
    expect(seen.size).toBe(4);
  });

  it('多选两个朝向 = 只在这两个里随机', () => {
    const c = CASES[0];
    const cyc = orientationCycle(c.setup, 3)!;
    const want = new Set([0, 2].map(off => cyc.masks[cyc.offs.indexOf(off)]));
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      seen.add(simMask(generateScramble(c, '3x3', 'inv', {
        preAuf: true, postAuf: true, orientation: { [cyc.key]: [0, 2] },
      }), 3));
    }
    expect(seen).toEqual(want);
  });

  it('关掉 post-AUF 又没钉朝向:打乱原样呈现', () => {
    const c = CASES[0];
    const cyc = orientationCycle(c.setup, 3)!;
    const scr = generateScramble(c, '3x3', 'inv', { preAuf: false, postAuf: false });
    expect(simMask(scr, 3)).toBe(cyc.masks[0]);
  });

  // 关 post-AUF 是「别随机换朝向」,钉一个朝向是同一诉求的更强版 —— 后者说了算,
  // 否则点了图没反应(post-AUF 默认就是关着的,那等于整个功能不存在)。
  it('关掉 post-AUF 时钉的朝向仍然生效', () => {
    const c = CASES[0];
    const cyc = orientationCycle(c.setup, 3)!;
    const off = cyc.offs[1];
    for (let i = 0; i < 20; i++) {
      const scr = generateScramble(c, '3x3', 'inv', {
        preAuf: false, postAuf: false, orientation: { [cyc.key]: [off] },
      });
      expect(simMask(scr, 3), scr).toBe(cyc.masks[1]);
    }
  });
});
