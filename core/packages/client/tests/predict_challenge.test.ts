import { describe, it, expect } from 'vitest';
import {
  generateChallenge, stickerFacelet, randomMoves, parseMoveInput, FACE_LETTERS, CUSTOM_MOVES_MAX,
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

describe('parseMoveInput — 自己输入的那条公式', () => {
  it('六个面转照收,写法归一到 X / X\' / X2', () => {
    expect(parseMoveInput("R U R' U'").moves).toEqual(['R', 'U', "R'", "U'"]);
    expect(parseMoveInput("R2' F3 D2").moves).toEqual(['R2', "F'", 'D2']);
    // 弯引号(从网页/中文输入法粘出来的)当撇号
    expect(parseMoveInput('R U R’ U’').moves).toEqual(['R', 'U', "R'", "U'"]);
    // 换行 / 多空格都只是分隔符
    expect(parseMoveInput('R\n\nU   F').moves).toEqual(['R', 'U', 'F']);
    // 转满一圈 = 没动过(tokenizer 照写不折 mod 4,这块板子只问落点)
    expect(parseMoveInput('R4 U').moves).toEqual(['U']);
  });

  it('文法白吃站内那份记号真源的红利:连写 / 分组重复 / 注释 / 换握记号', () => {
    expect(parseMoveInput("RUR'U'").moves).toEqual(['R', 'U', "R'", "U'"]);
    expect(parseMoveInput('(R U)2').moves).toEqual(['R', 'U', 'R', 'U']);
    expect(parseMoveInput("(R U R' U')' ").moves).toEqual(['U', 'R', "U'", "R'"]);
    expect(parseMoveInput('R U // 插入').moves).toEqual(['R', 'U']);
    expect(parseMoveInput("R·U'").moves).toEqual(['R', "U'"]);
  });

  it('追不了的记号一律当场拒,并把那个词原样退回来', () => {
    // 小写在魔方记号里是宽转,不是 R —— 悄悄按 R 解释,出的题答案就是错的
    for (const bad of ['r', 'Rw', '2R', 'M', 'S2', 'x', "y'", 'z2', '3', '?']) {
      const res = parseMoveInput(`R ${bad} U`);
      expect(res.moves).toBeNull();
      expect(res.error).toEqual({ kind: 'token', token: bad });
    }
  });

  it('换位子当场拒:`[…]` 在站内是注解块,不拦就会被整块剥成空公式', () => {
    expect(parseMoveInput('[R, U]').error).toEqual({ kind: 'token', token: '[R, U]' });
  });

  it('括号没配对当场拒 —— 宽容那档会把「(R U)2 F」悄悄变成「R U F」', () => {
    expect(parseMoveInput('(R U)2 F)').error).toEqual({ kind: 'parens' });
    expect(parseMoveInput('(R U2 F').error).toEqual({ kind: 'parens' });
  });

  it('空 / 超长各有各的说法', () => {
    expect(parseMoveInput('   ').error).toEqual({ kind: 'empty' });
    const n = CUSTOM_MOVES_MAX + 1;
    expect(parseMoveInput(Array(n).fill('R').join(' ')).error).toEqual({ kind: 'tooLong', count: n });
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

  // baseline 改过一次(2026-07-26):题板从「灰底 + 只有目标块有色」改成「整盘真实颜色,
  // 非目标格压暗」。于是 startColors 接管整盘颜色,startFacelets 退化成纯高亮清单,
  // 中心也不再恒亮 —— 颜色都在了,中心满色只会跟目标抢眼。
  it('起始盘面满色的只有目标块,中心不再特殊', () => {
    const c = generateChallenge(opts({ kind: 'corner' }));
    const colored = [...c.startFacelets].filter((ch) => ch !== '.').length;
    expect(colored).toBe(3); // 一个角块 3 枚,不含中心
    for (const face of [4, 13, 22, 31, 40, 49]) {
      if (c.targets.every((t) => t.startFacelet !== face)) expect(c.startFacelets[face]).toBe('.');
    }
    expect(c.startFacelets[c.targets[0].startFacelet]).toBe(FACE_LETTERS[c.targets[0].colorFace]);
  });

  it('startColors = 起点盘面的真实颜色,且与高亮清单逐格一致', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const c = generateChallenge(opts({ kind: 'pair', random: seeded(seed) }));
      // 与自己的 placement 独立重算一遍(题板就是照这份上色的)
      expect(c.startColors).toBe(toFacelets(applyAlg(solvedCube(), c.placement.join(' '))).toUpperCase());
      expect(c.startColors).toHaveLength(54);
      for (let i = 0; i < 54; i++) {
        if (c.startFacelets[i] !== '.') expect(c.startColors[i]).toBe(c.startFacelets[i]);
      }
    }
  });

  it('高亮的就是目标块整块 —— 题板靠「起点上色 + 真做那串公式」放动画,少一枚贴纸就断链', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const [kind, stickers] of [['edge', 2], ['corner', 3], ['pair', 5]] as [PieceKind, number][]) {
        const c = generateChallenge(opts({ kind, random: seeded(seed) }));
        expect([...c.startFacelets].filter((ch) => ch !== '.').length).toBe(stickers);
        for (const t of c.targets) {
          expect(c.startFacelets[t.startFacelet]).toBe(FACE_LETTERS[t.colorFace]);
        }
      }
    }
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

  it('自己输入档:题面就是你写的那条,答案由它算', () => {
    const c = generateChallenge(opts({ source: 'custom', customMoves: ['R', "U'", 'F2'], moveCount: 9 }));
    expect(c.moves).toEqual(['R', "U'", 'F2']);
    const start = applyAlg(solvedCube(), c.placement.join(' '));
    const end = applyAlg(start, "R U' F2");
    for (const t of c.targets) expect(t.answerFacelet).toBe(stickerFacelet(end, t.kind, t.piece, t.sticker));
  });

  it('自己输入档兜住上限,超出的截掉', () => {
    const long = Array.from({ length: CUSTOM_MOVES_MAX + 5 }, (_, i) => (i % 2 ? 'U' : 'R'));
    expect(generateChallenge(opts({ source: 'custom', customMoves: long })).moves).toHaveLength(CUSTOM_MOVES_MAX);
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
