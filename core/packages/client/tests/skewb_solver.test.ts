/**
 * 斜转「画状态求解器」的护栏。
 *
 * 这份求解器的所有表都是**运行时从 tnoodle 的贴纸置换推出来的**(块划分、两个坐标的可达集、乘积上的
 * 精确距离表),没有一个手抄常数。所以判据只能是外部锚点 + 独立复算:
 *   · 可达总数 == 3,149,280、表最大值 == 11(Jaap / WCA 公布值)—— 置换表读错一位这两个数立刻不对;
 *   · 乘积坐标恰好全可达 —— 否则「cornerIdx · nCenter + centerIdx」这个完美索引的前提就不成立;
 *   · 浅层(d ≤ 4)用**另一套代码**(Map 键 facelet 串的朴素 BFS)独立重算距离,逐态对表;
 *   · 解的正确性直接验:把解作用回去必须六面单色;打乱取逆必须逐格复现所画状态。
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_SKEWB_FACELET, SKEWB_CORNER_BLOCKS, SKEWB_FACES, SKEWB_GODS_NUMBER, SKEWB_MOVE_NAMES,
  SKEWB_STATE_COUNT, SKEWB_STICKERS, SKEWB_STICKER_SIBLINGS, SOLVED_SKEWB_FACELET,
  deriveSkewbScramble, randomLegalSkewbFacelet, skewbFaceletFromMoves,
  skewbFirstLayerExamplesByLength, skewbFirstLayerStats, skewbGraphStats,
  solvedSkewbFirstLayerColors, solveSkewbFacelet, solveSkewbFirstLayerFacelet, validateSkewbFacelet,
  type SkewbFace,
} from '@/lib/skewb-solver';
import { solveSkewb, solveSkewbFace } from '@/lib/skewb-face-solver';

const OPPOSITE: Record<string, string> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

/** 每面 5 格是否单色。 */
function isUniform(facelet: string): boolean {
  for (let f = 0; f < 6; f++) {
    const face = facelet.slice(f * 5, f * 5 + 5);
    if ([...face].some((c) => c !== face[0])) return false;
  }
  return true;
}

/**
 * 测试侧的底层判据：只读公开的角块三元组和最终 facelet，不调用求解器里的目标函数或几何缓存。
 * targetColors 是还原面字母(U/D/R/L/F/B)，目标层可落在任意物理面，但该面的中心也必须是目标色。
 */
function hasFirstLayer(facelet: string, targetColors: readonly string[]): boolean {
  for (let bottom = 0; bottom < SKEWB_FACES.length; bottom++) {
    const touching = SKEWB_CORNER_BLOCKS.filter((block) =>
      block.some((slot) => Math.floor(slot / 5) === bottom));
    const bottomSlots = touching.map((block) => block.find((slot) => Math.floor(slot / 5) === bottom));
    if (!bottomSlots.every((slot) => slot !== undefined && targetColors.includes(facelet[slot]))) continue;
    const bottomColor = facelet[bottomSlots[0]!];
    if (!bottomSlots.every((slot) => facelet[slot!] === bottomColor)) continue;
    if (facelet[bottom * 5] !== bottomColor) continue;

    let sidesPaired = true;
    for (let side = 0; side < SKEWB_FACES.length; side++) {
      if (side === bottom || SKEWB_FACES[side] === OPPOSITE[SKEWB_FACES[bottom]]) continue;
      const sideSlots = touching.flatMap((block) => {
        const slot = block.find((candidate) => Math.floor(candidate / 5) === side);
        return slot === undefined ? [] : [slot];
      });
      if (sideSlots.length !== 2 || facelet[sideSlots[0]] !== facelet[sideSlots[1]]) {
        sidesPaired = false;
        break;
      }
    }
    if (sidesPaired) return true;
  }
  return false;
}

/** 小深度独立 oracle：只用公开打乱解析器逐层展开，不读取生产距离表或目标缓存。 */
function independentFirstLayerDistance(scramble: string, targetColors: readonly string[], maxDepth: number): number | null {
  const start = skewbFaceletFromMoves(scramble);
  if (hasFirstLayer(start, targetColors)) return 0;
  let frontier: Array<{ alg: string; lastAxis: string }> = [{ alg: '', lastAxis: '' }];
  const seen = new Set<string>([start]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: typeof frontier = [];
    for (const current of frontier) {
      for (const move of SKEWB_MOVE_NAMES) {
        if (move[0] === current.lastAxis) continue;
        const alg = current.alg ? `${current.alg} ${move}` : move;
        const state = skewbFaceletFromMoves(`${scramble} ${alg}`);
        if (seen.has(state)) continue;
        if (hasFirstLayer(state, targetColors)) return depth;
        seen.add(state);
        next.push({ alg, lastAxis: move[0] });
      }
    }
    frontier = next;
  }
  return null;
}

describe('斜转:块划分', () => {
  it('自动推出 8 个角块,每块 3 格、跨 3 个不同面、无对面色', () => {
    expect(SKEWB_CORNER_BLOCKS.length).toBe(8);
    const seen = new Set<string>();
    for (const block of SKEWB_CORNER_BLOCKS) {
      expect(block.length).toBe(3);
      const faces = block.map((s) => SKEWB_FACES[Math.floor(s / 5)]);
      expect(new Set(faces).size).toBe(3);
      for (const a of faces) for (const b of faces) if (a !== b) expect(OPPOSITE[a]).not.toBe(b);
      // 8 个角的颜色组合互不相同(立方体恰好 8 个角)
      const key = [...faces].sort().join('');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    // 24 张角贴纸各属于恰好一个角块
    expect(SKEWB_CORNER_BLOCKS.flat().sort((a, b) => a - b).length).toBe(24);
  });

  it('同块伙伴:角格 2 个、中心格 0 个', () => {
    for (let i = 0; i < SKEWB_STICKERS; i++) {
      expect(SKEWB_STICKER_SIBLINGS[i].length).toBe(i % 5 === 0 ? 0 : 2);
    }
  });
});

describe('斜转:全空间精确表', () => {
  const stats = skewbGraphStats();

  it('两个坐标的可达集 × 乘起来 == 3,149,280(公布值)', () => {
    expect(stats.corners * stats.centers).toBe(SKEWB_STATE_COUNT);
    expect(stats.total).toBe(SKEWB_STATE_COUNT);
  });

  it('两个坐标各自的大小:角 4·3⁷、中心 6!/2(中心只能做偶置换)', () => {
    expect(stats.corners).toBe(4 * 3 ** 7);
    expect(stats.centers).toBe(720 / 2);
  });

  it('乘积坐标恰好全可达(完美索引的前提)', () => {
    const sum = stats.histogram.reduce((a, b) => a + b, 0);
    expect(sum).toBe(SKEWB_STATE_COUNT);
  });

  it('表最大值 == 上帝之数 11', () => {
    expect(stats.histogram.length - 1).toBe(SKEWB_GODS_NUMBER);
    expect(stats.histogram[SKEWB_GODS_NUMBER]).toBeGreaterThan(0);
  });

  it('分布单调增到峰值后单调减,且 d=0 档 = 还原态的个数', () => {
    const h = stats.histogram;
    expect(h[0]).toBeGreaterThan(0);
    const peak = h.indexOf(Math.max(...h));
    for (let i = 1; i <= peak; i++) expect(h[i]).toBeGreaterThan(h[i - 1]);
    for (let i = peak + 1; i < h.length; i++) expect(h[i]).toBeLessThan(h[i - 1]);
  });
});

describe('斜转:独立重算浅层距离(不同代码路径)', () => {
  it('d ≤ 4 的每个状态,朴素 BFS 与距离表逐个相等', () => {
    // 朴素 BFS:键就是 30 字符 facelet 串,招式走 skewbFaceletFromMoves 的公开接口(与求解器的
    // 局部坐标置换完全不同的一条路),所以两边一致才有意义。
    const dist = new Map<string, number>([[SOLVED_SKEWB_FACELET, 0]]);
    let frontier: Array<{ facelet: string; alg: string }> = [{ facelet: SOLVED_SKEWB_FACELET, alg: '' }];

    for (let d = 0; d < 4; d++) {
      const next: typeof frontier = [];
      for (const cur of frontier) {
        for (const mv of SKEWB_MOVE_NAMES) {
          const alg = cur.alg ? `${cur.alg} ${mv}` : mv;
          const facelet = skewbFaceletFromMoves(alg);
          if (dist.has(facelet)) continue;
          dist.set(facelet, d + 1);
          next.push({ facelet, alg });
        }
      }
      frontier = next;
    }

    expect(dist.size).toBeGreaterThan(1000);
    for (const [facelet, d] of dist) {
      expect(solveSkewbFacelet(facelet).length, facelet).toBe(d);
    }
  });
});

describe('斜转:解与打乱', () => {
  it('还原态:0 步', () => {
    expect(solveSkewbFacelet(SOLVED_SKEWB_FACELET).length).toBe(0);
  });

  it('随机状态:解作用回去必须六面单色,且步数 ≤ 11', () => {
    for (let i = 0; i < 60; i++) {
      const facelet = randomLegalSkewbFacelet();
      const { solution, length } = solveSkewbFacelet(facelet);
      expect(length).toBeLessThanOrEqual(SKEWB_GODS_NUMBER);
      // 从「所画状态」再走解法:等价于把「打乱 + 解法」一起作用到还原态
      const scramble = deriveSkewbScramble(facelet);
      expect(skewbFaceletFromMoves(scramble)).toBe(facelet);          // 打乱逐格复现所画状态
      expect(isUniform(skewbFaceletFromMoves(`${scramble} ${solution}`))).toBe(true);
    }
  });

  it('打乱串 → 画板 → 最优解 ≤ 打乱步数', () => {
    for (const n of [1, 2, 3, 5, 8]) {
      const tokens: string[] = [];
      let last = -1;
      for (let i = 0; i < n; i++) {
        let a: number;
        do { a = Math.floor(Math.random() * 4); } while (a === last);
        last = a;
        tokens.push('RULB'[a] + (Math.random() < 0.5 ? '' : "'"));
      }
      const facelet = skewbFaceletFromMoves(tokens.join(' '));
      expect(solveSkewbFacelet(facelet).length).toBeLessThanOrEqual(n);
    }
  });
});

describe('斜转:底层最优', () => {
  const single = [540, 4_320, 23_760, 136_080, 622_080, 1_603_260, 745_200, 14_040];
  const dual = [1_068, 8_544, 46_752, 261_648, 1_051_728, 1_582_428, 196_560, 552];
  const colorNeutral = [3_110, 24_880, 133_152, 666_904, 1_675_934, 640_870, 4_430];

  it('锁定单色、双色、六色的完整精确分布', () => {
    expect(skewbFirstLayerStats(['U']).histogram).toEqual(single);
    expect(skewbFirstLayerStats(['U', 'D']).histogram).toEqual(dual);
    expect(skewbFirstLayerStats(SKEWB_FACES).histogram).toEqual(colorNeutral);
    for (const histogram of [single, dual, colorNeutral]) {
      expect(histogram.reduce((sum, count) => sum + count, 0)).toBe(SKEWB_STATE_COUNT);
    }
  });

  it('生产距离与小深度独立 facelet BFS 一致', () => {
    const cases: Array<{ scramble: string; colors: readonly SkewbFace[] }> = [
      { scramble: '', colors: ['U'] },
      { scramble: "R U'", colors: ['U'] },
      { scramble: "R U' L", colors: ['U', 'D'] },
      { scramble: "B L' U R", colors: [...SKEWB_FACES] },
    ];
    for (const testCase of cases) {
      const facelet = skewbFaceletFromMoves(testCase.scramble);
      const actual = solveSkewbFirstLayerFacelet(facelet, testCase.colors).length;
      expect(actual).toBeLessThanOrEqual(4);
      expect(independentFirstLayerDistance(testCase.scramble, testCase.colors, actual)).toBe(actual);
    }
  });

  it('返回的解都真正完成所选底层，且底色越多最优步数不会增加', () => {
    const scrambles = [
      "R U' L B' R' U",
      "B L' U R B' U' L",
      "U R B' L U' R' B L'",
    ];
    for (const scramble of scrambles) {
      const facelet = skewbFaceletFromMoves(scramble);
      const one = solveSkewbFirstLayerFacelet(facelet, ['U']);
      const two = solveSkewbFirstLayerFacelet(facelet, ['U', 'D']);
      const six = solveSkewbFirstLayerFacelet(facelet, SKEWB_FACES);
      expect(six.length).toBeLessThanOrEqual(two.length);
      expect(two.length).toBeLessThanOrEqual(one.length);
      expect(hasFirstLayer(skewbFaceletFromMoves(`${scramble} ${one.solution}`), ['U'])).toBe(true);
      expect(hasFirstLayer(skewbFaceletFromMoves(`${scramble} ${two.solution}`), ['U', 'D'])).toBe(true);
      expect(hasFirstLayer(skewbFaceletFromMoves(`${scramble} ${six.solution}`), SKEWB_FACES)).toBe(true);
      expect(solvedSkewbFirstLayerColors(skewbFaceletFromMoves(`${scramble} ${one.solution}`))).toContain('U');
    }
  });

  it('计时器现有完整还原复用共享全空间表，六面候选都真正完成一个底层', () => {
    const scramble = "R U' L B' R' U";
    const full = solveSkewb(scramble);
    expect(solveSkewbFacelet(skewbFaceletFromMoves(`${scramble} ${full.moves.join(' ')}`)).length).toBe(0);
    const faces = solveSkewbFace(scramble);
    expect(faces).toHaveLength(6);
    for (const face of faces) {
      const solution = face.moves.map((move) => move.trim()).join(' ');
      expect(solvedSkewbFirstLayerColors(skewbFaceletFromMoves(`${scramble} ${solution}`)).length).toBeGreaterThan(0);
    }
  });

  it('每个非空分布档都有可回放代表状态，并深链所需的解长与档位一致', () => {
    const examples = skewbFirstLayerExamplesByLength(SKEWB_FACES, 12);
    const nonemptyBins = colorNeutral.flatMap((count, distance) => count > 0 ? [distance] : []);
    expect([...examples.keys()].sort((a, b) => a - b)).toEqual(nonemptyBins);
    for (const [distance, scrambles] of examples) {
      expect(scrambles.length).toBe(12);
      for (const scramble of scrambles) {
        const facelet = skewbFaceletFromMoves(scramble);
        const solution = solveSkewbFirstLayerFacelet(facelet, SKEWB_FACES);
        expect(solution.length).toBe(distance);
        expect(hasFirstLayer(skewbFaceletFromMoves(`${scramble} ${solution.solution}`), SKEWB_FACES)).toBe(true);
      }
    }
  });
});

describe('斜转:校验', () => {
  it('还原态与随机合法态都过', () => {
    expect(validateSkewbFacelet(SOLVED_SKEWB_FACELET)).toBeNull();
    for (let i = 0; i < 10; i++) expect(validateSkewbFacelet(randomLegalSkewbFacelet())).toBeNull();
  });

  it('颜色数不对 / 角块重复色 / 单个角块被扭都要拦住', () => {
    expect(validateSkewbFacelet(EMPTY_SKEWB_FACELET)).toBeTruthy();
    // 一格换色 → 颜色计数不对
    const wrongCount = `R${SOLVED_SKEWB_FACELET.slice(1)}`;
    expect(validateSkewbFacelet(wrongCount)).toContain('color counts');
    // 只扭一个角(把一个角块的 3 色循环一位)→ 计数没变、块合法,但不可达
    const arr = SOLVED_SKEWB_FACELET.split('');
    const [a, b, c] = SKEWB_CORNER_BLOCKS[0];
    const t = arr[a]; arr[a] = arr[b]; arr[b] = arr[c]; arr[c] = t;
    const twisted = arr.join('');
    expect(validateSkewbFacelet(twisted)).toContain('unreachable');
  });
});
