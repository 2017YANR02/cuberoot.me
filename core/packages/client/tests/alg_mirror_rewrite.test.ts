/**
 * 镜像重写(issue #40 T5)—— 三条独立的路互相对撞。
 *
 *   1. **贴纸反射**:把末态的块按镜面对调槽位、角朝向取负,与「重写公式再跑」逐块比。
 *      这一路完全不看重写表,是真正的 oracle —— `M` / `x` 该不该取反,只有它说了算。
 *   2. **shared 的纯文本重写**(`@cuberoot/shared/alg-mirror`,server 用的那份);
 *   3. **client 的 cubing.js 重写**(`lib/cube3.ts`,/sim 用的那份)。
 *
 * 2 和 3 是两个解析器套同一张规则表,一致性必须钉住 —— 否则同一条公式在 case 页看到一个样、
 * 落库落成另一个样。1 则是防那张表本身写错:「面层一律取反,slice 也取反」这个错在这个项目里
 * **已经犯过两次**,`MIRROR_EXEMPT` 的注释里写着。
 *
 * 顺带钉住生成规则(哪几份该生成)与成对重算的行为(去重 / 不自我繁殖 / 断链清孤儿)。
 */
import { describe, it, expect } from 'vitest';
import { cube3x3x3 } from 'cubing/puzzles';
import type { KPattern } from 'cubing/kpuzzle';
import {
  MIRROR_VIEW,
  applyMirrorGen,
  canonicalNnnAlg,
  mirrorGensFor,
  mirrorMoveString,
  regenerateMirrorAlgs,
  relabelYMoveString,
  type MirrorGen,
} from '@cuberoot/shared/alg-mirror';
import type { AlgEntry } from '@cuberoot/shared';
import { mirrorAlg } from '@/lib/cube3';

const kp = await cube3x3x3.kpuzzle();
const run = (alg: string): KPattern => kp.defaultPattern().applyAlg(alg);

// ─────────────────────────────────────────────────── 贴纸反射 oracle(独立于重写表)

/**
 * 左右镜(M 平面)把每个槽送到它的镜像槽。编号是 cubing.js 的(实测,见 lib/alg_goals 头注):
 *   CORNERS 0=UFR 1=UBR 2=UBL 3=UFL 4=DFR 5=DFL 6=DBL 7=DBR
 *   EDGES   0=UF 1=UR 2=UB 3=UL 4=DF 5=DR 6=DB 7=DL 8=FR 9=FL 10=BR 11=BL
 *   CENTERS [U, L, F, R, B, D]
 */
const LR_CORNER = [3, 2, 1, 0, 5, 4, 7, 6];
const LR_EDGE = [0, 3, 2, 1, 4, 7, 6, 5, 9, 8, 11, 10];
const LR_CENTER = [0, 3, 2, 1, 4, 5];

/** 角朝向在镜像下取负(顺逆互换);**棱朝向不变** —— cubing.js 的 EO 约定本身左右对称。 */
const LR_RULE: Record<string, { slot: number[]; ori: (v: number) => number }> = {
  CORNERS: { slot: LR_CORNER, ori: v => (3 - v) % 3 },
  EDGES: { slot: LR_EDGE, ori: v => v },
  CENTERS: { slot: LR_CENTER, ori: v => v },
};

type Orbit = { pieces: number[]; orientation: number[] };

/** 把一个末态整体照镜子。**按源的 key 顺序**造 —— cubing.js 是 EDGES/CORNERS/CENTERS,顺序不同会假报不等。 */
function mirrorPattern(p: KPattern): Record<string, Orbit> {
  const out: Record<string, Orbit> = {};
  for (const [name, orbitRaw] of Object.entries(p.patternData)) {
    const orbit = orbitRaw as unknown as Orbit;
    const rule = LR_RULE[name];
    if (!rule) throw new Error(`没见过的 orbit ${name}`);
    const { slot, ori } = rule;
    const pieces: number[] = [];
    const orientation: number[] = [];
    for (let i = 0; i < slot.length; i++) {
      pieces[slot[i]] = slot[orbit.pieces[i]];
      orientation[slot[i]] = ori(orbit.orientation[i] ?? 0);
    }
    out[name] = { pieces, orientation };
  }
  return out;
}

const plain = (p: KPattern): Record<string, Orbit> => {
  const out: Record<string, Orbit> = {};
  for (const [name, orbitRaw] of Object.entries(p.patternData)) {
    const o = orbitRaw as unknown as Orbit;
    out[name] = { pieces: [...o.pieces], orientation: [...o.orientation] };
  }
  return out;
};

// ─────────────────────────────────────────────────── 语料

/** 从站上 f2l / zbls / cls 抄来的真公式,覆盖 slice、宽招、转体、括号组、连写。 */
const CORPUS = [
  "U R U' R'", "R' F R F'", "y' r' U' R U M'", "y U F' L F L2 U L",
  "F' r U r'", "d R U' R'", "F' L F L'", "U2 L U2 L'", "L' f U f'",
  "U r' U' F U F' r", "l U L' U' M'", "d' R' U R", "U' f' L f",
  "R U R' U' R U R' U' R U R'", "M' U' M U2 M' U' M",
  "F (R U R' U')2 F'", "r U R' U R U2 r'", "x' R U' R' D R U R' D'",
  "R U R' U' M' U R U' r'", "U2 R2 F R F' R", "S R U R' S'",
  "z U R' D R U' R' D' R z'", "E R U R' E'", "3Rw U 2R'",
];

/** 伪随机语料 —— 固定种子,炸了能复现。 */
function randomAlgs(n: number): string[] {
  const FAMILIES = ['R', 'L', 'U', 'D', 'F', 'B', 'M', 'S', 'E', 'r', 'l', 'u', 'd', 'f', 'b', 'x', 'y', 'z'];
  const AMOUNTS = ['', '2', "'"];
  let seed = 20260726;
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const len = 4 + (next() % 9);
    const moves: string[] = [];
    for (let j = 0; j < len; j++) {
      moves.push(FAMILIES[next() % FAMILIES.length] + AMOUNTS[next() % AMOUNTS.length]);
    }
    out.push(moves.join(' '));
  }
  return out;
}

/** cubing.js 的 3x3 引擎不收小写内层切,喂进去会抛 —— 这类样本只用在纯文本比对上。 */
const playable = (alg: string): boolean => {
  try { run(alg); return true; } catch { return false; }
};

const RANDOM = randomAlgs(200);
const ALL = [...CORPUS, ...RANDOM];

// ─────────────────────────────────────────────────── 1. 锚点

describe('§5.1 的锚点:一条公式的三份重写', () => {
  const A = "U R U' R'";
  it("左右镜 = U' L' U L —— 标准 F2L 镜像", () => {
    expect(mirrorMoveString(A, 'M')).toBe("U' L' U L");
  });
  it("前后镜 = U' R' U R —— F↔B,这条没有 F 所以看不出来,R 换了向", () => {
    expect(mirrorMoveString(A, 'S')).toBe("U' R' U R");
  });
  it("y² = U L U' L' —— 不是镜像,手性没变", () => {
    expect(relabelYMoveString(A, 2)).toBe("U L U' L'");
  });
  it('库里的 A- 就长这样 —— 这三条不是推的,是数据本来的样子', () => {
    // A+ 第 0 视角首条 → A- 的 FL 首条 / A- 的 BR 首条 / A+ 自己的 BL 首条
    expect([applyMirrorGen(A, 'lr'), applyMirrorGen(A, 'fb'), applyMirrorGen(A, 'y2')])
      .toEqual(["U' L' U L", "U' R' U R", "U L U' L'"]);
  });
});

describe('落在镜面法线轴上的不取反 —— 这个错犯过两次', () => {
  it.each([['M', 'M'], ['m', 'm'], ['x', 'x'], ["M'", "M'"], ['M2', 'M2']])(
    '左右镜下 %s → %s(不动)', (from, to) => expect(mirrorMoveString(from, 'M')).toBe(to));
  it.each([['R', "L'"], ['U', "U'"], ['S', "S'"], ['E', "E'"], ['r', "l'"]])(
    '左右镜下 %s → %s(取反)', (from, to) => expect(mirrorMoveString(from, 'M')).toBe(to));
  it.each([['L2', 'R2'], ['Rw2', 'Lw2'], ["U2'", 'U2']])(
    '半圈没有方向:%s → %s,不写成 `X2\'`', (from, to) => expect(mirrorMoveString(from, 'M')).toBe(to));
  it("宽招关系 l = L M 逼出来的:mirror(l) 必须等于 r'", () => {
    expect(run(mirrorMoveString('Lw', 'M')).isIdentical(run("Rw'"))).toBe(true);
  });
  it('前后镜豁免 S / z,上下镜豁免 E / y', () => {
    expect(mirrorMoveString('S', 'S')).toBe('S');
    expect(mirrorMoveString('z', 'S')).toBe('z');
    expect(mirrorMoveString('E', 'E')).toBe('E');
    expect(mirrorMoveString('y', 'E')).toBe('y');
  });
});

// ─────────────────────────────────────────────────── 2. 贴纸反射 oracle

describe('贴纸反射 oracle:重写公式再跑 == 跑完再照镜子', () => {
  it(`${ALL.length} 条公式逐块相等(含 M/S/E、宽招、x/y/z)`, () => {
    let checked = 0;
    for (const alg of ALL) {
      if (!playable(alg)) continue;
      const viaRewrite = mirrorMoveString(alg, 'M');
      if (!playable(viaRewrite)) continue;
      expect(plain(run(viaRewrite))).toEqual(mirrorPattern(run(alg)));
      checked++;
    }
    // 别让「全被 skip 掉」冒充通过
    expect(checked).toBeGreaterThan(150);
  });

  it('前后镜 = 左右镜 ∘ y²(S = M∘y²,§5.0 的 41/41)', () => {
    for (const alg of ALL) {
      if (!playable(alg)) continue;
      const fb = mirrorMoveString(alg, 'S');
      const viaLrY2 = relabelYMoveString(mirrorMoveString(alg, 'M'), 2);
      expect(canonicalNnnAlg(fb)).toBe(canonicalNnnAlg(viaLrY2));
    }
  });

  it('y² 是重贴面标,不是加前缀:pattern(relabelY(A,2)) == pattern(y2 A y2)', () => {
    for (const alg of ALL) {
      if (!playable(alg)) continue;
      const relabelled = relabelYMoveString(alg, 2);
      if (!playable(relabelled)) continue;
      expect(run(relabelled).isIdentical(run(`y2 ${alg} y2`))).toBe(true);
    }
  });

  it('三种重写都是对合 —— 做两遍回到原地', () => {
    for (const alg of ALL) {
      for (const gen of ['lr', 'fb', 'y2'] as MirrorGen[]) {
        expect(canonicalNnnAlg(applyMirrorGen(applyMirrorGen(alg, gen), gen)))
          .toBe(canonicalNnnAlg(alg));
      }
    }
  });
});

// ─────────────────────────────────────────────────── 3. 两个解析器对撞

describe('shared 的纯文本重写 == client 的 cubing.js 重写', () => {
  // cube3 的那份是 /sim 的镜像按钮在用(4x4/5x5 的 `2R` / `3Rw` 都走它),这边是 server 入库
  // 同步在用。两个解析器套同一张表,谁改歪了这里当场炸。
  it(`${ALL.length} 条公式,左右镜 / 前后镜 逐条相等`, () => {
    for (const alg of ALL) {
      expect(canonicalNnnAlg(mirrorMoveString(alg, 'M'))).toBe(canonicalNnnAlg(mirrorAlg(alg, 'M')));
      expect(canonicalNnnAlg(mirrorMoveString(alg, 'S'))).toBe(canonicalNnnAlg(mirrorAlg(alg, 'S')));
    }
  });
});

// ─────────────────────────────────────────────────── 4. 视角表 / 生成规则

describe('视角置换表是克莱因四元群', () => {
  const compose = (a: readonly number[], b: readonly number[]) => a.map(v => b[v]);
  it('三张都是对合', () => {
    for (const gen of ['lr', 'fb', 'y2'] as MirrorGen[]) {
      expect(compose(MIRROR_VIEW[gen], MIRROR_VIEW[gen])).toEqual([0, 1, 2, 3]);
    }
  });
  it('两两复合得第三张', () => {
    expect(compose(MIRROR_VIEW.lr, MIRROR_VIEW.fb)).toEqual([...MIRROR_VIEW.y2]);
    expect(compose(MIRROR_VIEW.lr, MIRROR_VIEW.y2)).toEqual([...MIRROR_VIEW.fb]);
    expect(compose(MIRROR_VIEW.fb, MIRROR_VIEW.y2)).toEqual([...MIRROR_VIEW.lr]);
  });
});

describe('§5.2:生成的公式里不许有 B 族', () => {
  it('不含 F 也不含 B → 三份都不会冒出 B', () => expect(mirrorGensFor("U R U' R'")).toEqual(['lr', 'fb', 'y2']));
  it('含 F 不含 B → 只有左右镜(前后镜和 y² 都把 F 变成 B)', () => expect(mirrorGensFor("R' F R F'")).toEqual(['lr']));
  it('小写 f 同理(f = F + S,前后镜会变 b)', () => expect(mirrorGensFor("L' f U f'")).toEqual(['lr']));
  it('Fw 与 f 同一件事', () => expect(mirrorGensFor('Fw U Fw2')).toEqual(['lr']));
  it('含 B 不含 F → 反过来,左右镜保 B 出局,另两份把 B 变回 F', () => {
    expect(mirrorGensFor("U' r U B' U' B r'")).toEqual(['fb', 'y2']);
  });
  it('F 和 B 都有 → 一份都生成不出来', () => {
    expect(mirrorGensFor("F R B' R' F' R B R'")).toEqual([]);
  });
  it('S / z 的轴与镜面法向平行,冒不出 B', () => {
    expect(mirrorGensFor("S R U R' S'")).toEqual(['lr', 'fb', 'y2']);
    expect(mirrorMoveString("S R U R' S'", 'S')).not.toMatch(/\bB/);
  });

  /** 上面逐条钉的是判据,这条钉的是**意图**:凡是生成出来的,一律不含 B 族。 */
  it('线上那批真公式,生成出来的一条都不带 B', () => {
    for (const alg of CORPUS) {
      for (const gen of mirrorGensFor(alg)) {
        expect(applyMirrorGen(alg, gen)).not.toMatch(/(?:^|\s)(?:B|b|Bw)(?:[2']|w)*(?=\s|$)/);
      }
    }
  });
});

// ─────────────────────────────────────────────────── 5. 成对重算

const entry = (alg: string, extra: Partial<AlgEntry> = {}): AlgEntry => ({ alg, ...extra });
const views = (fr: string[], fl: string[] = [], bl: string[] = [], br: string[] = []): AlgEntry[][] =>
  [fr, fl, bl, br].map(v => v.map(a => entry(a)));
const texts = (algs: AlgEntry[][]) => algs.map(v => v.map(e => e.alg));

describe('regenerateMirrorAlgs', () => {
  it('一对 case:左右镜进伙伴 FL、前后镜进伙伴 BR、y² 落自己 BL', () => {
    const a = { id: 1, algs: views(["U R U' R'"]) };
    const b = { id: 2, algs: views([]) };
    const { algsById, notes } = regenerateMirrorAlgs(a, b);
    expect(notes).toEqual([]);
    expect(texts(algsById.get(2)!)).toEqual([[], ["U' L' U L"], [], ["U' R' U R"]]);
    expect(texts(algsById.get(1)!)).toEqual([["U R U' R'"], [], ["U L U' L'"], []]);
  });

  it('生成条带 gen + src,原创条一个字段都不多', () => {
    const a = { id: 1, algs: views(["U R U' R'"]) };
    const made = regenerateMirrorAlgs(a, { id: 2, algs: views([]) }).algsById.get(2)![1][0];
    expect(made).toEqual({ alg: "U' L' U L", gen: 'lr', src: { id: 1, ori: 0, i: 0 } });
  });

  it('字面重合就跳过 —— 库里人工收过的镜像份不会长出第二条', () => {
    const a = { id: 1, algs: views(["U R U' R'"]) };
    const b = { id: 2, algs: views([], ["U' L' U L"]) };
    expect(texts(regenerateMirrorAlgs(a, b).algsById.get(2)!)[1]).toEqual(["U' L' U L"]);
  });

  it('幂等:把结果再喂一遍,一个字都不变', () => {
    const a = { id: 1, algs: views(["U R U' R'", "R' F R F'"]) };
    const b = { id: 2, algs: views(["F R' F' R"]) };
    const once = regenerateMirrorAlgs(a, b).algsById;
    const twice = regenerateMirrorAlgs(
      { id: 1, algs: once.get(1)! }, { id: 2, algs: once.get(2)! },
    ).algsById;
    expect(twice.get(1)).toEqual(once.get(1));
    expect(twice.get(2)).toEqual(once.get(2));
  });

  it('生成条不当源头 —— 不会一轮轮繁殖', () => {
    const a = { id: 1, algs: views(["U R U' R'"]) };
    const b = { id: 2, algs: views([]) };
    const once = regenerateMirrorAlgs(a, b).algsById;
    const twice = regenerateMirrorAlgs(
      { id: 1, algs: once.get(1)! }, { id: 2, algs: once.get(2)! },
    ).algsById;
    // 第 1 视角只能有那一条左右镜,不会冒出「镜像的 y²」之类
    expect(twice.get(2)![1]).toHaveLength(1);
    expect(twice.get(1)![2]).toHaveLength(1);
  });

  it('自镜像 case:三份都落回自己', () => {
    const a = { id: 7, algs: views(["U R U' R'"]) };
    const { algsById } = regenerateMirrorAlgs(a, a);
    expect(texts(algsById.get(7)!)).toEqual([["U R U' R'"], ["U' L' U L"], ["U L U' L'"], ["U' R' U R"]]);
  });

  it('断链(伙伴传 null):只剥掉生成条,一条新的都不生成', () => {
    const withGen = views(["U R U' R'"]);
    withGen[1].push({ alg: "U' L' U L", gen: 'lr', src: { id: 9, ori: 0, i: 0 } });
    const { algsById } = regenerateMirrorAlgs({ id: 1, algs: withGen }, null);
    expect(texts(algsById.get(1)!)).toEqual([["U R U' R'"], [], [], []]);
  });

  it('视角数不是 4(比如 cls 只存 FR)→ 整对跳过,不写半截数据', () => {
    const a = { id: 1, algs: [[entry("U R U' R'")]] };
    const { algsById, notes } = regenerateMirrorAlgs(a, { id: 2, algs: [[]] });
    expect(algsById.size).toBe(0);
    expect(notes[0]).toContain('视角');
  });

  it('源那边换顺序,生成的左右镜份跟着换 —— §5.5 的排序传播', () => {
    const first = regenerateMirrorAlgs(
      { id: 1, algs: views(["U R U' R'", "U2 R U2 R'"]) }, { id: 2, algs: views([]) },
    ).algsById.get(2)![1];
    const flipped = regenerateMirrorAlgs(
      { id: 1, algs: views(["U2 R U2 R'", "U R U' R'"]) }, { id: 2, algs: views([]) },
    ).algsById.get(2)![1];
    expect(first.map(e => e.alg)).toEqual(["U' L' U L", "U2 L' U2 L"]);
    expect(flipped.map(e => e.alg)).toEqual(["U2 L' U2 L", "U' L' U L"]);
  });
});
