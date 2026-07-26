/**
 * 金字塔「画状态求解器」的护栏。判据与斜转那份同构:外部锚点 + 另一套代码独立重算。
 *   · 核心可达总数 == 933,120、核心表最大值 == 11、含尖上限 15(WCA / 公布值);
 *   · 三个坐标(尖 / 轴 / 棱)的 slot 划分是从置换群轨道推的 —— 各 12 格、块内颜色互不相同;
 *   · 浅层(核心 d ≤ 4)用朴素 BFS(键是 36 字符 facelet 串)独立重算,逐态对表;
 *   · 尖块口径是**真最优**:随便造个「核心已解、尖歪着」的态,总步数必须等于歪着的尖数;
 *     再验一条更强的:任何状态的解都不比「先最优核心、后补尖」那种朴素做法长。
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_PYRA_FACELET, PYRA_AXIAL_BLOCKS, PYRA_AXIAL_SLOTS, PYRA_CORE_GODS_NUMBER,
  PYRA_CORE_MOVE_NAMES, PYRA_CORE_STATE_COUNT, PYRA_EDGE_BLOCKS, PYRA_EDGE_SLOTS, PYRA_FACES,
  PYRA_GODS_NUMBER, PYRA_STICKERS, PYRA_STICKER_SIBLINGS, PYRA_TIP_BLOCKS, PYRA_TIP_SLOTS,
  SOLVED_PYRA_FACELET, derivePyraScramble, invertPyraAlg, pyraFaceletFromMoves, pyraGraphStats,
  randomLegalPyraFacelet, solvePyraFacelet, validatePyraFacelet,
} from '@/lib/pyraminx-solver';

const faceOf = (slot: number) => Math.floor(slot / 9);

function isUniform(facelet: string): boolean {
  for (let f = 0; f < 4; f++) {
    const face = facelet.slice(f * 9, f * 9 + 9);
    if ([...face].some((c) => c !== face[0])) return false;
  }
  return true;
}

describe('金字塔:件的划分(全部从置换群轨道推)', () => {
  it('尖 / 轴 / 棱各 12 格,合起来正好 36 且互不重叠', () => {
    expect(PYRA_TIP_SLOTS.length).toBe(12);
    expect(PYRA_AXIAL_SLOTS.length).toBe(12);
    expect(PYRA_EDGE_SLOTS.length).toBe(12);
    const all = new Set([...PYRA_TIP_SLOTS, ...PYRA_AXIAL_SLOTS, ...PYRA_EDGE_SLOTS]);
    expect(all.size).toBe(PYRA_STICKERS);
  });

  it('4 个尖块 / 4 个轴块各 3 格跨 3 面,6 个棱块各 2 格跨 2 面', () => {
    for (const blocks of [PYRA_TIP_BLOCKS, PYRA_AXIAL_BLOCKS]) {
      expect(blocks.length).toBe(4);
      const seen = new Set<string>();
      for (const b of blocks) {
        expect(b.length).toBe(3);
        const faces = b.map(faceOf);
        expect(new Set(faces).size).toBe(3);
        seen.add([...faces].sort().join(''));
      }
      expect(seen.size).toBe(4);   // C(4,3) = 4 种三色组合,各出现一次
    }
    expect(PYRA_EDGE_BLOCKS.length).toBe(6);
    const seen = new Set<string>();
    for (const b of PYRA_EDGE_BLOCKS) {
      expect(b.length).toBe(2);
      const faces = b.map(faceOf);
      expect(new Set(faces).size).toBe(2);
      seen.add([...faces].sort().join(''));
    }
    expect(seen.size).toBe(6);     // C(4,2) = 6 种双色组合,各出现一次
  });

  it('同块伙伴:尖 / 轴 2 个,棱 1 个', () => {
    for (const s of PYRA_TIP_SLOTS) expect(PYRA_STICKER_SIBLINGS[s].length).toBe(2);
    for (const s of PYRA_AXIAL_SLOTS) expect(PYRA_STICKER_SIBLINGS[s].length).toBe(2);
    for (const s of PYRA_EDGE_SLOTS) expect(PYRA_STICKER_SIBLINGS[s].length).toBe(1);
  });
});

describe('金字塔:核心全空间精确表', () => {
  const stats = pyraGraphStats();

  it('轴 × 棱 == 933,120(公布值),且乘积全可达', () => {
    expect(stats.axials).toBe(81);
    expect(stats.edges).toBe(11_520);
    expect(stats.total).toBe(PYRA_CORE_STATE_COUNT);
    expect(stats.histogram.reduce((a, b) => a + b, 0)).toBe(PYRA_CORE_STATE_COUNT);
  });

  it('核心表最大值 == 11,加 4 个尖 == 上帝之数 15', () => {
    expect(stats.histogram.length - 1).toBe(PYRA_CORE_GODS_NUMBER);
    expect(PYRA_CORE_GODS_NUMBER + 4).toBe(PYRA_GODS_NUMBER);
  });

  it('分布单峰,d=0 只有还原态一个', () => {
    const h = stats.histogram;
    expect(h[0]).toBe(1);
    const peak = h.indexOf(Math.max(...h));
    for (let i = 1; i <= peak; i++) expect(h[i]).toBeGreaterThan(h[i - 1]);
    for (let i = peak + 1; i < h.length; i++) expect(h[i]).toBeLessThan(h[i - 1]);
  });
});

describe('金字塔:独立重算浅层核心距离', () => {
  it('核心 d ≤ 4 的每个状态,朴素 BFS 与求解器给的核心步数逐个相等', () => {
    const dist = new Map<string, number>([[SOLVED_PYRA_FACELET, 0]]);
    let frontier: Array<{ facelet: string; alg: string }> = [{ facelet: SOLVED_PYRA_FACELET, alg: '' }];
    for (let d = 0; d < 4; d++) {
      const next: typeof frontier = [];
      for (const cur of frontier) {
        for (const mv of PYRA_CORE_MOVE_NAMES) {
          const alg = cur.alg ? `${cur.alg} ${mv}` : mv;
          const facelet = pyraFaceletFromMoves(alg);
          if (dist.has(facelet)) continue;
          dist.set(facelet, d + 1);
          next.push({ facelet, alg });
        }
      }
      frontier = next;
    }
    expect(dist.size).toBeGreaterThan(1000);
    for (const [facelet, d] of dist) {
      // 层转会带动尖,所以这些态的尖大多歪着 —— 只比核心那一段。
      expect(solvePyraFacelet(facelet).coreLength, facelet).toBe(d);
    }
  });
});

describe('金字塔:尖块口径', () => {
  it('核心已解、只有尖歪着 → 总步数 = 歪着的尖数,且全是小写招', () => {
    for (const alg of ["u", "u'", "u l", "u' l' r b", "l r'"]) {
      const facelet = pyraFaceletFromMoves(alg);
      const sol = solvePyraFacelet(facelet);
      expect(sol.coreLength).toBe(0);
      expect(sol.length).toBe(alg.split(' ').length);
      expect(sol.solution.split(' ').every((tk) => tk[0] === tk[0].toLowerCase())).toBe(true);
      // 真把它解了(不只是步数对)
      expect(isUniform(pyraFaceletFromMoves(`${alg} ${sol.solution}`))).toBe(true);
    }
  });

  it('不比「先最优核心、再补尖」更长(尖是被层转带着走的,所以这条不平凡)', () => {
    for (let i = 0; i < 40; i++) {
      const facelet = randomLegalPyraFacelet();
      const sol = solvePyraFacelet(facelet);
      // 朴素上界:核心最优步数 + 最多 4 个尖
      expect(sol.length).toBeLessThanOrEqual(sol.coreLength + 4);
      expect(sol.length).toBeLessThanOrEqual(PYRA_GODS_NUMBER);
    }
  });
});

describe('金字塔:解与打乱', () => {
  it('还原态 0 步', () => {
    expect(solvePyraFacelet(SOLVED_PYRA_FACELET).length).toBe(0);
  });

  it('随机状态:打乱逐格复现所画状态,再走解法必六面单色', () => {
    for (let i = 0; i < 40; i++) {
      const facelet = randomLegalPyraFacelet();
      const scramble = derivePyraScramble(facelet);
      expect(pyraFaceletFromMoves(scramble)).toBe(facelet);
      expect(isUniform(pyraFaceletFromMoves(`${scramble} ${solvePyraFacelet(facelet).solution}`))).toBe(true);
    }
  });

  it('取逆两次 = 原串(记号级)', () => {
    for (const alg of ["U L' R b", "u' l r' B'", "U U' L"]) {
      expect(invertPyraAlg(invertPyraAlg(alg))).toBe(alg.split(/\s+/).join(' '));
    }
  });
});

describe('金字塔:校验', () => {
  it('还原态与随机合法态都过', () => {
    expect(validatePyraFacelet(SOLVED_PYRA_FACELET)).toBeNull();
    for (let i = 0; i < 10; i++) expect(validatePyraFacelet(randomLegalPyraFacelet())).toBeNull();
  });

  it('空缺 / 颜色数不对 / 单个棱翻转都要拦住', () => {
    expect(validatePyraFacelet(EMPTY_PYRA_FACELET)).toBeTruthy();
    expect(validatePyraFacelet(`${PYRA_FACES[1]}${SOLVED_PYRA_FACELET.slice(1)}`)).toContain('color counts');
    // 只翻一个棱块(两张贴纸对调)→ 计数没变、块内仍是两色,但不可达
    const arr = SOLVED_PYRA_FACELET.split('');
    const [a, b] = PYRA_EDGE_BLOCKS[0];
    const t = arr[a]; arr[a] = arr[b]; arr[b] = t;
    expect(validatePyraFacelet(arr.join(''))).toContain('unreachable');
  });
});
