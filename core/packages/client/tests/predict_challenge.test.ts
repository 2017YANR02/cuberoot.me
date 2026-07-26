import { describe, it, expect } from 'vitest';
import {
  generateChallenge, stickerFacelet, randomMoves, FACE_LETTERS,
  type PredictOptions, type PredictMode, type PieceKind,
} from '@/app/[lang]/predict/_lib/challenge';
import { solvedCube, applyAlg, toFacelets, CORNER_COLORS, EDGE_COLORS } from '@/lib/lsll/cube333';
import { invertAlg } from '@/lib/cube3';
import { orientedFaceColors, faceShowingColor, CUBE_ORIENTATIONS } from '@/lib/cube-orientation';

/** mulberry32 — 确定性 RNG,让每条断言可复现。 */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const opts = (over: Partial<PredictOptions> = {}): PredictOptions => ({
  mode: 'normal', kind: 'pair', moveCount: 6, source: 'random',
  crossEdges: 1, orientation: '', random: seeded(1), ...over,
});

describe('stickerFacelet — 手推的落点', () => {
  // 这几条是脱离 cube333 的 CF/CCOL 表、按 facelet 环手推出来的,拿来卡表和反查逻辑。
  it('UF 棱的 U 贴纸: U 之后到 UL 的 U 位 (7 → 3)', () => {
    const s = applyAlg(solvedCube(), 'U');
    expect(stickerFacelet(solvedCube(), 'edge', 1, 0)).toBe(7);
    expect(stickerFacelet(s, 'edge', 1, 0)).toBe(3);
  });

  it('UF 棱的 U 贴纸: F 之后到 FR 的 R 位 (7 → 12)', () => {
    expect(stickerFacelet(applyAlg(solvedCube(), 'F'), 'edge', 1, 0)).toBe(12);
  });

  it('URF 角的 U 贴纸: R 之后到 UBR 的 B 位 (8 → 45)', () => {
    expect(stickerFacelet(solvedCube(), 'corner', 0, 0)).toBe(8);
    expect(stickerFacelet(applyAlg(solvedCube(), 'R'), 'corner', 0, 0)).toBe(45);
  });

  it('URF 角的 F 贴纸: R 之后到 UBR 的 U 位 (20 → 2)', () => {
    expect(stickerFacelet(solvedCube(), 'corner', 0, 2)).toBe(20);
    expect(stickerFacelet(applyAlg(solvedCube(), 'R'), 'corner', 0, 2)).toBe(2);
  });

  it('与 toFacelets 互证:每枚贴纸的落点上,颜色必须对得上', () => {
    const rnd = seeded(7);
    for (let trial = 0; trial < 40; trial++) {
      const s = applyAlg(solvedCube(), randomMoves(12, rnd).join(' '));
      const f = toFacelets(s);
      for (let p = 0; p < 8; p++) {
        for (let k = 0; k < 3; k++) {
          expect(f[stickerFacelet(s, 'corner', p, k)]).toBe(FACE_LETTERS[CORNER_COLORS[p][k]].toLowerCase());
        }
      }
      for (let p = 0; p < 12; p++) {
        for (let k = 0; k < 2; k++) {
          expect(f[stickerFacelet(s, 'edge', p, k)]).toBe(FACE_LETTERS[EDGE_COLORS[p][k]].toLowerCase());
        }
      }
    }
  });
});

describe('generateChallenge', () => {
  it('起点/答案由 placement 与题面招式独立重建后必须一致,且逆招式回到起点', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const c = generateChallenge(opts({ random: seeded(seed), moveCount: 1 + (seed % 20) }));
      const start = applyAlg(solvedCube(), c.placement.join(' '));
      const end = applyAlg(start, c.moves.join(' '));
      const back = applyAlg(end, invertAlg(c.moves.join(' ')));
      for (const t of c.targets) {
        expect(stickerFacelet(start, t.kind, t.piece, t.sticker)).toBe(t.startFacelet);
        expect(stickerFacelet(end, t.kind, t.piece, t.sticker)).toBe(t.answerFacelet);
        expect(stickerFacelet(back, t.kind, t.piece, t.sticker)).toBe(t.startFacelet);
      }
    }
  });

  it('步数被夹在 1..20', () => {
    expect(generateChallenge(opts({ moveCount: 0 })).moves).toHaveLength(1);
    expect(generateChallenge(opts({ moveCount: 99 })).moves).toHaveLength(20);
    expect(generateChallenge(opts({ moveCount: 7 })).moves).toHaveLength(7);
  });

  it('起始盘面:6 个中心恒亮,其余只有目标块的贴纸有色', () => {
    const c = generateChallenge(opts({ kind: 'corner' }));
    for (const [i, face] of [4, 13, 22, 31, 40, 49].entries()) {
      expect(c.startFacelets[face]).toBe(FACE_LETTERS[i]);
    }
    const colored = [...c.startFacelets].filter((ch) => ch !== '.').length;
    expect(colored).toBe(6 + 3); // 中心 6 + 一个角块 3
    expect(c.startFacelets[c.targets[0].startFacelet]).toBe(FACE_LETTERS[c.targets[0].colorFace]);
  });

  it('一对:一角一棱,追踪色不重复', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = generateChallenge(opts({ random: seeded(seed), kind: 'pair' }));
      expect(c.targets.map((t) => t.kind)).toEqual(['corner', 'edge']);
      expect(c.targets[0].colorFace).not.toBe(c.targets[1].colorFace);
    }
  });

  it('十字模式:要几条给几条,且追踪的一律是白色贴纸', () => {
    for (const n of [1, 2, 3, 4]) {
      const c = generateChallenge(opts({ mode: 'cross', kind: 'corner', crossEdges: n, random: seeded(n) }));
      expect(c.targets).toHaveLength(n);
      expect(new Set(c.targets.map((t) => t.piece)).size).toBe(n);
      for (const t of c.targets) {
        expect(t.kind).toBe('edge');
        expect(FACE_LETTERS[t.colorFace]).toBe('U'); // (UF) 下白色本位在 U
      }
    }
  });

  it('十字模式跟着朝向走:z2 下白色贴在 D 面,就该挑 D 层的棱', () => {
    const c = generateChallenge(opts({ mode: 'cross', crossEdges: 4, orientation: 'z2', random: seeded(9) }));
    const shown = orientedFaceColors('z2');
    expect(faceShowingColor(shown, 'U')).toBe('D');
    for (const t of c.targets) expect(FACE_LETTERS[t.colorFace]).toBe('D');
  });

  it('前两层模式:永不挑含顶层色的块', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const c = generateChallenge(opts({ mode: 'twoLayers', kind: 'pair', random: seeded(seed) }));
      for (const t of c.targets) {
        const colors = t.kind === 'corner' ? CORNER_COLORS[t.piece] : EDGE_COLORS[t.piece];
        expect(colors).not.toContain(3); // (UF) 下顶层色(黄)本位在 D
      }
    }
  });

  it('F2L 模式的一对必须同槽:角的两个侧色 = 棱的两个色', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = generateChallenge(opts({ mode: 'f2l', kind: 'pair', random: seeded(seed) }));
      const [corner, edge] = c.targets;
      const sides = [...CORNER_COLORS[corner.piece]].filter((f) => f !== 0).sort();
      expect([...EDGE_COLORS[edge.piece]].sort()).toEqual(sides);
    }
  });

  it('随机招式:相邻两步不同面', () => {
    const rnd = seeded(11);
    for (let trial = 0; trial < 50; trial++) {
      const moves = randomMoves(20, rnd);
      for (let i = 1; i < moves.length; i++) expect(moves[i][0]).not.toBe(moves[i - 1][0]);
    }
  });

  it('F2L 公式档忽略步数,直接给一条公式', () => {
    const c = generateChallenge(opts({ source: 'f2lAlg', moveCount: 20, random: seeded(5) }));
    expect(c.moves.length).toBeGreaterThanOrEqual(3);
    expect(c.moves.length).toBeLessThanOrEqual(12);
    expect(c.moves.every((m) => /^[RLUDFB][2']?$/.test(m))).toBe(true);
  });

  it('24 个朝向都能出题,答案永远落在 0..53', () => {
    for (const o of CUBE_ORIENTATIONS) {
      for (const mode of ['normal', 'cross', 'twoLayers', 'f2l'] as PredictMode[]) {
        for (const kind of ['edge', 'corner', 'pair'] as PieceKind[]) {
          const c = generateChallenge(opts({ mode, kind, orientation: o.value, crossEdges: 3, random: seeded(42) }));
          expect(c.targets.length).toBeGreaterThan(0);
          for (const t of c.targets) {
            expect(t.answerFacelet).toBeGreaterThanOrEqual(0);
            expect(t.answerFacelet).toBeLessThan(54);
            expect(c.startFacelets[t.startFacelet]).toBe(FACE_LETTERS[t.colorFace]);
          }
        }
      }
    }
  });
});
