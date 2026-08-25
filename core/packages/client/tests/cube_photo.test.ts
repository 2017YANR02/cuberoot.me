// lib/cube-photo —— 拍照识别的纯逻辑层:取样 / 网格旋转 / 带容量指派 / 六面配色判定。
//
// 判据是外部的,不自证:
//   · 真值 facelet 由**独立**的模型生成(三阶共享 kociemba/cube 的 applySequence,二阶
//     lib/pocket-facelet 的 pocketFaceletFromMoves),照着 SCAN_STEPS 逆着摆成「拍到的样子」
//     再喂进去 —— 于是 SCAN_STEPS 的 face/rot 表只要错一处,整个面就还原不回来。
//   · 颜色由一套**不同于** CANONICAL_RGB 的贴纸色板渲染,再叠上每张照片各自的曝光 + 色温 +
//     逐格噪声 + 偶发高光;识别器不许依赖内置色卡的绝对值。
//   · 匈牙利算法与暴力全排列最小代价逐例相等。
import { describe, it, expect } from 'vitest';
import {
  PHOTO_FACES, SCAN_STEPS, classifyScan, hungarian, rotateGrid, sampleGridColors, srgbToLab,
  type PhotoFace, type RGB,
} from '@/lib/cube-photo';
import { applySequence, solvedCubie, MOVE_NAMES, parseMoves } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { cubieToFacelet, validateFacelet } from '@/lib/cube-facelet';
import { pocketFaceletFromMoves, validatePocketFacelet } from '@/lib/pocket-facelet';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 一块**不是** CANONICAL_RGB 的贴纸色板(偏暗、偏灰的哑光贴纸)。 */
const STICKER: Record<PhotoFace, RGB> = {
  U: [222, 220, 210],
  R: [172, 40, 44],
  F: [40, 140, 84],
  D: [228, 196, 62],
  L: [226, 112, 40],
  B: [36, 74, 158],
};

/** 每张照片各自的曝光 + 色温 + 逐格噪声 + 5% 概率的高光。 */
function photograph(colors: readonly PhotoFace[], rand: () => number): RGB[] {
  const gain = 0.75 + rand() * 0.45;          // 0.75 ~ 1.20
  const warm = (rand() - 0.5) * 0.18;         // ±9% 的红蓝失衡
  return colors.map((f) => {
    const glare = rand() < 0.05 ? 38 : 0;
    const base = STICKER[f];
    const mul = [gain * (1 + warm), gain, gain * (1 - warm)];
    return base.map((c, k) =>
      Math.max(0, Math.min(255, Math.round(c * mul[k] + glare + (rand() - 0.5) * 20)))) as unknown as RGB;
  });
}

/** 真值 facelet → 6 张「拍到的」取样色(逆着 SCAN_STEPS 的 rot 摆回镜头里的朝向)。 */
function shotsOf(facelet: string, n: number, rand: () => number): RGB[][] {
  const per = n * n;
  return SCAN_STEPS.map((step) => {
    const base = PHOTO_FACES.indexOf(step.face) * per;
    const canonical = facelet.slice(base, base + per).split('') as PhotoFace[];
    return photograph(rotateGrid(canonical, n, 4 - step.rot), rand);
  });
}

function randomFacelet3(rand: () => number): string {
  const idxs: number[] = [];
  while (idxs.length < 25) {
    const m = Math.floor(rand() * 18);
    if (idxs.length && Math.floor(m / 3) === Math.floor(idxs[idxs.length - 1] / 3)) continue;
    idxs.push(m);
  }
  return cubieToFacelet(applySequence(solvedCubie(), idxs));
}

function randomFacelet2(rand: () => number): string {
  const toks: string[] = [];
  while (toks.length < 20) {
    const face = 'URF'[Math.floor(rand() * 3)];
    if (toks.length && toks[toks.length - 1][0] === face) continue;
    toks.push(face + ['', "'", '2'][Math.floor(rand() * 3)]);
  }
  return pocketFaceletFromMoves(toks.join(' '));
}

describe('rotateGrid', () => {
  it('顺时针 90°:左下角转到左上角', () => {
    const g = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    expect(rotateGrid(g, 3, 1)).toEqual(['g', 'd', 'a', 'h', 'e', 'b', 'i', 'f', 'c']);
    expect(rotateGrid(g, 3, 2)).toEqual([...g].reverse());
    expect(rotateGrid(g, 3, 4)).toEqual(g);
    expect(rotateGrid(rotateGrid(g, 3, 1), 3, 3)).toEqual(g);
  });
});

describe('SCAN_STEPS', () => {
  it('六个面各拍一次', () => {
    expect([...SCAN_STEPS].map((s) => s.face).sort()).toEqual([...PHOTO_FACES].sort());
  });

  it('声明的朝向与「向后翻 / 向左转」的实际结果一致', () => {
    // 画面前/上/左各是哪个面。roll:FRONT←DOWN, UP←FRONT;turnLeft:FRONT←RIGHT, LEFT←FRONT。
    const OPP: Record<PhotoFace, PhotoFace> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
    let pose = { front: 'U' as PhotoFace, up: 'B' as PhotoFace, left: 'L' as PhotoFace };
    const roll = (p: typeof pose) => ({ front: OPP[p.up], up: p.front, left: p.left });
    const turn = (p: typeof pose) => ({ front: OPP[p.left], up: p.up, left: p.front });
    for (const step of SCAN_STEPS) {
      if (step.motion === 'roll') pose = roll(pose);
      if (step.motion === 'turnLeft') pose = turn(pose);
      if (step.motion === 'turnLeft2') pose = turn(turn(pose));
      expect([step.face, step.top, step.left]).toEqual([pose.front, pose.up, pose.left]);
    }
  });
});

describe('hungarian', () => {
  it('与暴力全排列的最小代价一致', () => {
    const rand = rng(7);
    for (let trial = 0; trial < 40; trial++) {
      const n = 2 + Math.floor(rand() * 5);
      const cost = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(rand() * 100)));
      const got = hungarian(cost).reduce((a, col, row) => a + cost[row][col], 0);
      let best = Infinity;
      const perm = (rest: number[], acc: number[]) => {
        if (!rest.length) { best = Math.min(best, acc.reduce((a, col, row) => a + cost[row][col], 0)); return; }
        rest.forEach((x, i) => perm([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, x]));
      };
      perm([...Array(n).keys()], []);
      expect(got).toBe(best);
    }
  });
});

describe('sampleGridColors', () => {
  it('取每格中央的中位色,免疫格线与少量高光', () => {
    const size = 120, n = 3;
    const cells: RGB[] = [
      [255, 0, 0], [0, 255, 0], [0, 0, 255],
      [255, 255, 0], [255, 255, 255], [255, 128, 0],
      [0, 0, 0], [128, 128, 128], [10, 20, 30],
    ];
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = (y * size + x) * 4;
        const cell = Math.floor(y / (size / n)) * n + Math.floor(x / (size / n));
        // 格线(黑边)+ 稀疏高光:两者都是少数派,中位数应当直接无视。
        const edge = x % 40 < 3 || y % 40 < 3;
        const glare = (x * 7 + y * 13) % 101 === 0;
        const c = edge ? [0, 0, 0] : glare ? [255, 255, 255] : cells[cell];
        data[p] = c[0]; data[p + 1] = c[1]; data[p + 2] = c[2]; data[p + 3] = 255;
      }
    }
    expect(sampleGridColors(data, size, n)).toEqual(cells);
  });
});

describe('classifyScan — 三阶', () => {
  it('120 个随机状态在曝光/色温/噪声下逐格还原', () => {
    const rand = rng(20260802);
    for (let trial = 0; trial < 120; trial++) {
      const truth = randomFacelet3(rand);
      expect(validateFacelet(truth)).toBeNull();
      const res = classifyScan(shotsOf(truth, 3, rand), 3);
      expect(res.facelet).toBe(truth);
      expect(validateFacelet(res.facelet)).toBeNull();
    }
  });

  it('还原态也能认(每面纯色,聚类没有对比可依,靠中心块锚定)', () => {
    const rand = rng(11);
    const truth = cubieToFacelet(solvedCubie());
    expect(classifyScan(shotsOf(truth, 3, rand), 3).facelet).toBe(truth);
  });

  it('取样色与判定色同序返回,且六色各 9 格', () => {
    const rand = rng(5);
    const truth = randomFacelet3(rand);
    const res = classifyScan(shotsOf(truth, 3, rand), 3);
    expect(res.samples).toHaveLength(54);
    expect(res.margin).toHaveLength(54);
    for (const f of PHOTO_FACES) {
      expect([...res.facelet].filter((c) => c === f)).toHaveLength(9);
    }
  });

  it('把某一面拍反(转了 180°)会得到物理非法的状态 —— 交给画板报错,不静默', () => {
    const rand = rng(3);
    const truth = randomFacelet3(rand);
    const shots = shotsOf(truth, 3, rand);
    shots[1] = rotateGrid(shots[1], 3, 2);
    const res = classifyScan(shots, 3);
    expect(res.facelet).not.toBe(truth);
    expect(validateFacelet(res.facelet)).not.toBeNull();
  });

  it('张数 / 格数不对直接抛错', () => {
    const rand = rng(9);
    const shots = shotsOf(randomFacelet3(rand), 3, rand);
    expect(() => classifyScan(shots.slice(0, 5), 3)).toThrow(/expected 6 shots/);
    expect(() => classifyScan([shots[0].slice(0, 8), ...shots.slice(1)], 3)).toThrow(/expected 9 samples/);
    expect(() => classifyScan(shots, 4)).toThrow(/unsupported cube order/);
  });
});

describe('classifyScan — 二阶', () => {
  it('120 个随机状态逐格还原(没有中心块,靠聚类 + 整体配色匹配)', () => {
    const rand = rng(424242);
    for (let trial = 0; trial < 120; trial++) {
      const truth = randomFacelet2(rand);
      expect(validatePocketFacelet(truth)).toBeNull();
      const res = classifyScan(shotsOf(truth, 2, rand), 2);
      expect(res.facelet).toBe(truth);
      expect(validatePocketFacelet(res.facelet)).toBeNull();
    }
  });

  it('取样与判定同序,六色各 4 格', () => {
    const rand = rng(64);
    const truth = randomFacelet2(rand);
    const res = classifyScan(shotsOf(truth, 2, rand), 2);
    expect(res.samples).toHaveLength(24);
    for (const f of PHOTO_FACES) {
      expect([...res.facelet].filter((c) => c === f)).toHaveLength(4);
    }
  });
});

describe('srgbToLab', () => {
  it('参考值:白 / 黑 / 中灰', () => {
    const [lw, aw, bw] = srgbToLab([255, 255, 255]);
    expect(lw).toBeCloseTo(100, 3);
    expect(aw).toBeCloseTo(0, 3);
    expect(bw).toBeCloseTo(0, 3);
    expect(srgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 6);
    expect(srgbToLab([119, 119, 119])[0]).toBeCloseTo(50.03, 1);
  });
});

describe('MOVE_NAMES 自检', () => {
  it('测试里造状态用的是同一套记号', () => {
    expect(MOVE_NAMES.slice(0, 3)).toEqual(['U', 'U2', "U'"]);
    expect(parseMoves('U R2').length).toBe(2);
  });
});
