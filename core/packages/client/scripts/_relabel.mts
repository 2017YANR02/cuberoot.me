/*
 * 面标重贴 + 左右镜像 —— `normalize-slot-to-fr.mts`(T4)与 `mirror-link-plan.mts`(T5)共用。
 *
 * 两张表放一起是有原因的:**它们的差别正是「镜像 ≠ 旋转」那句话的全部内容**。
 *
 *   R_k(y 重贴)   纯旋转,不翻手性:R→F→L→B 顺着转,模数一个不改(M/S/x/z 除外,
 *                  它们跟随的面被换成了反向的那一根轴,所以要补一个负号)。
 *   MIRROR_LR(镜) 翻手性:**每一招都反向**,唯独 `M` 不反 —— 镜面法向与 M 轴平行,
 *                  轴自己被翻了一次,和手性那次抵消。`S`/`E` 的轴与镜面平行,只翻手性,
 *                  所以照翻。x/y/z 三个转体一律反向。
 *
 * `R_k(A)` 定义成 `pattern(R_k(A)) == pattern(y^-k A y^k)`;镜像没有这种「拿转体表达」的
 * 写法(反射不在魔方群里),它的判据是 `mirrorPattern` —— 直接在贴纸槽位上做反射,
 * 与公式重写两路独立算出来必须逐块相等。`selfTestRelabel()` 启动时把两件事都验一遍。
 */
import { Alg, Move, QuantumMove } from 'cubing/alg';
import { KPattern, type KPuzzle } from 'cubing/kpuzzle';

/** `[family, 是否反向]`;缺项 = 该 family 不认识(直接抛)。 */
export type Mapped = readonly [string, boolean];
export type FaceMap = Record<string, Mapped>;

/**
 * `R_1` = `y' X y`:面按 **R→F→L→B→R** 走(即 y 的转动方向)。
 * 中层/转体跟着它们「跟随的面」走:M 跟 L、S 跟 F、E 跟 D;x 跟 R、y 跟 U、z 跟 F。
 *   M(跟 L) → 跟 B 的中层 = S'    S(跟 F) → 跟 L 的中层 = M
 *   x(跟 R) → 跟 F 的转体 = z     z(跟 F) → 跟 L 的转体 = x'
 */
export const MAP_Y1: FaceMap = {
  R: ['F', false], F: ['L', false], L: ['B', false], B: ['R', false],
  r: ['f', false], f: ['l', false], l: ['b', false], b: ['r', false],
  Rw: ['Fw', false], Fw: ['Lw', false], Lw: ['Bw', false], Bw: ['Rw', false],
  M: ['S', true], S: ['M', false], E: ['E', false],
  x: ['z', false], z: ['x', true], y: ['y', false],
  U: ['U', false], D: ['D', false], u: ['u', false], d: ['d', false],
  Uw: ['Uw', false], Dw: ['Dw', false],
};

/** `R_2` = `y2 X y2`:对面互换。 */
export const MAP_Y2: FaceMap = {
  R: ['L', false], L: ['R', false], F: ['B', false], B: ['F', false],
  r: ['l', false], l: ['r', false], f: ['b', false], b: ['f', false],
  Rw: ['Lw', false], Lw: ['Rw', false], Fw: ['Bw', false], Bw: ['Fw', false],
  M: ['M', true], S: ['S', true], E: ['E', false],
  x: ['x', true], z: ['z', true], y: ['y', false],
  U: ['U', false], D: ['D', false], u: ['u', false], d: ['d', false],
  Uw: ['Uw', false], Dw: ['Dw', false],
};

/** `R_3` = `y X y'`:面按 R→B→L→F→R 走。 */
export const MAP_Y3: FaceMap = {
  R: ['B', false], B: ['L', false], L: ['F', false], F: ['R', false],
  r: ['b', false], b: ['l', false], l: ['f', false], f: ['r', false],
  Rw: ['Bw', false], Bw: ['Lw', false], Lw: ['Fw', false], Fw: ['Rw', false],
  M: ['S', false], S: ['M', true], E: ['E', false],
  x: ['z', true], z: ['x', false], y: ['y', false],
  U: ['U', false], D: ['D', false], u: ['u', false], d: ['d', false],
  Uw: ['Uw', false], Dw: ['Dw', false],
};

export const FACE_MAP: FaceMap[] = [{}, MAP_Y1, MAP_Y2, MAP_Y3];

/**
 * 左右镜(M 平面,R↔L)。**除 `M` 和 `x` 外全部反向**。
 *
 * 判据是一句话:**绕镜面法向那根轴转的不反向,别的都反向**。法向 = x 轴,所以 `M`(绕 x 的中层)
 * 和 `x`(绕 x 的转体)保持原向 —— 轴本身被镜像翻了一次,和手性那次抵消。逐招验算:
 *   `x = R M' L'` → 镜像 `L' M' R` = `R M' L'` = **x**(同轴可交换)
 *   `y = U E' D'` → 镜像 `U' E D` = **y'**;`z = F S B'` → 镜像 `F' S' B` = **z'**
 * (这三条 `selfTestRelabel` 会逐招对撞,推错了当场抛 —— `x` 就是这么抓出来的。)
 */
export const MIRROR_LR: FaceMap = {
  R: ['L', true], L: ['R', true], F: ['F', true], B: ['B', true], U: ['U', true], D: ['D', true],
  r: ['l', true], l: ['r', true], f: ['f', true], b: ['b', true], u: ['u', true], d: ['d', true],
  Rw: ['Lw', true], Lw: ['Rw', true], Fw: ['Fw', true], Bw: ['Bw', true], Uw: ['Uw', true], Dw: ['Dw', true],
  M: ['M', false], S: ['S', true], E: ['E', true],
  x: ['x', false], y: ['y', true], z: ['z', true],
};

export const YPOW = ['', 'y', 'y2', "y'"];
export const YPOW_INV = ['', "y'", 'y2', 'y'];

/** 单个转动按某张表重写。不认识的 family 抛错(数据里出现了就必须先看清楚)。 */
export function mapMove(m: Move, map: FaceMap): Move {
  const hit = map[m.family];
  if (!hit) throw new Error(`unknown move family: ${m.family}`);
  const [fam, flip] = hit;
  const q = m.quantum as unknown as { innerLayer: number | null; outerLayer: number | null };
  return new Move(
    new QuantumMove(fam, q.innerLayer ?? undefined, q.outerLayer ?? undefined),
    flip ? -m.amount : m.amount,
  );
}

export const relabelMove = (m: Move, k: number): Move => (k % 4 === 0 ? m : mapMove(m, FACE_MAP[k % 4]));
export const mirrorMove = (m: Move): Move => mapMove(m, MIRROR_LR);

/** 整条公式重写。**输入必须是干净公式串**(先过 toMoveString)。 */
function mapAlg(algStr: string, map: FaceMap | null): string {
  if (!map) return algStr;
  return [...new Alg(algStr).experimentalLeafMoves()].map(m => mapMove(m, map).toString()).join(' ');
}

export const relabel = (algStr: string, k: number): string => mapAlg(algStr, k % 4 === 0 ? null : FACE_MAP[k % 4]);
export const mirrorAlg = (algStr: string): string => mapAlg(algStr, MIRROR_LR);

/**
 * 保留上游记号的重写 —— **只把面字母换掉**,`=`、`*`、`(…)2'` 分组、`↑↓·` 换握标
 * 原样留在原位。zbls 438 条公式里 353 条带这些记号,拿 leaf move 走一遍会全部抹平
 * (手指分组没了,魔友看到的就是另一条公式)。
 *
 * 只有换标要反向的那几个才重新序列化模数;其余连模数文本都不碰(`U2'` 不会被悄悄改成 `U2`)。
 * 正确性不靠这段自己保证 —— 调用方逐条断言 `toMoveString(保留版) === mapAlg(toMoveString(原文))`。
 */
export const MOVE_TOKEN = /(\d+(?:-\d+)?)?([UDRLFBMESudrlfbxyz])(w?)((?:\d+)?'*(?:\d+)?'*)/g;

export function amountOf(mod: string): number {
  const n = Number(mod.replace(/[^\d]/g, '') || '1');
  return (mod.match(/'/g)?.length ?? 0) % 2 ? -n : n;
}

function rewritePreserving(raw: string, map: FaceMap): string {
  return raw.replace(MOVE_TOKEN, (_full, layers: string | undefined, letter: string, w: string, mod: string) => {
    const fam = letter + w;
    const hit = map[fam];
    if (!hit) throw new Error(`unknown family in raw rewrite: ${fam} (${raw})`);
    const [nf, flip] = hit;
    if (!flip) return `${layers ?? ''}${nf}${mod}`;
    return `${layers ?? ''}${new Move(nf, -amountOf(mod)).toString()}`;
  });
}

export const relabelPreserving = (raw: string, k: number): string =>
  (k % 4 === 0 ? raw : rewritePreserving(raw, FACE_MAP[k % 4]));
export const mirrorPreserving = (raw: string): string => rewritePreserving(raw, MIRROR_LR);

// ─────────────────────────────────────────────────────────────────────────────
// 镜像的独立判据:直接在贴纸槽位上做反射
// ─────────────────────────────────────────────────────────────────────────────

/** 角块槽位对合(cubing.js 序 0=UFR 1=UBR 2=UBL 3=UFL 4=DFR 5=DFL 6=DBL 7=DBR)。 */
const MIRROR_CORNER_SLOT = [3, 2, 1, 0, 5, 4, 7, 6];
/** 棱块槽位对合(0=UF 1=UR 2=UB 3=UL 4=DF 5=DR 6=DB 7=DL 8=FR 9=FL 10=BR 11=BL)。 */
const MIRROR_EDGE_SLOT = [0, 3, 2, 1, 4, 7, 6, 5, 9, 8, 11, 10];
/** 中心槽位对合(实测序 [U, L, F, R, B, D]):只有 L↔R 动。 */
const MIRROR_CENTER_SLOT = [0, 3, 2, 1, 4, 5];

/**
 * 反射作用在 pattern 上 —— 与公式重写完全独立的一条算路。
 *
 * 角的扭向取负(反射把三枚贴纸的循环序反过来)。**棱的翻向原样不动**:cubing.js 的 EO
 * 记法在左右镜下对称(`R`/`L` 都不翻棱,`F`/`B` 翻的是互为镜像的那四枚)。
 * 这跟 LSLL 那个**对角**镜面不一样 —— 那边 F↔R,记法就不对称了,得补两项(见 lib/lsll/mirror.ts)。
 */
export function mirrorPattern(p: KPattern, kpuzzle: KPuzzle): KPattern {
  /** 槽位对合 + 朝向怎么变,按 orbit 分。 */
  const RULES: Record<string, { slot: number[]; ori: (v: number) => number }> = {
    CORNERS: { slot: MIRROR_CORNER_SLOT, ori: v => (3 - v) % 3 },
    EDGES: { slot: MIRROR_EDGE_SLOT, ori: v => v },
    CENTERS: { slot: MIRROR_CENTER_SLOT, ori: v => v },
  };
  const perm = (src: readonly number[], slot: number[], f: (v: number) => number) => {
    const out = new Array<number>(src.length);
    for (let i = 0; i < src.length; i++) out[slot[i]] = f(src[i]);
    return out;
  };
  const out: Record<string, unknown> = {};
  // **照源的键序**逐个 orbit 造 —— cubing.js 的 patternData 是 `EDGES, CORNERS, CENTERS`,
  // 换个顺序整对象 JSON.stringify 就不相等了(数据一模一样也报不一致,踩过)。
  // `...orbit` 顺带带上 `orientationMod`(中心块是 [1,1,1,1,1,1],即朝向恒 0),同理漏了会假报。
  for (const [name, orbit] of Object.entries(p.patternData)) {
    const rule = RULES[name];
    if (!rule) throw new Error(`mirrorPattern: 不认识的 orbit ${name}`);
    out[name] = {
      ...orbit,
      pieces: perm(orbit.pieces as number[], rule.slot, v => rule.slot[v]),
      orientation: perm(orbit.orientation as number[], rule.slot, rule.ori),
    };
  }
  return new KPattern(kpuzzle, out as never);
}

// ─────────────────────────────────────────────────────────────────────────────
// 启动自检
// ─────────────────────────────────────────────────────────────────────────────

/** 伪随机(定死种子,回归可复现)。 */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x1_0000_0000);
}

/**
 * 两张表各自拿 KPuzzle 验一遍,不过就抛。
 *  - `R_k`:逐招与 `y^-k X y^k` 比 pattern。
 *  - 镜像:公式重写路 vs 贴纸反射路,拿随机公式逐块对撞(两条算路互为判据)。
 */
export function selfTestRelabel(kpuzzle: KPuzzle): void {
  const SOLVED = kpuzzle.defaultPattern();
  const apply = (s: string) => SOLVED.applyAlg(new Alg(s || ''));
  const eq = (a: KPattern, b: KPattern) => JSON.stringify(a.patternData) === JSON.stringify(b.patternData);

  const families = Object.keys(MAP_Y1);
  let n = 0;
  for (let k = 1; k <= 3; k++) {
    for (const fam of families) {
      for (const amt of [1, -1, 2]) {
        const m = new Move(fam, amt);
        if (!eq(apply(relabelMove(m, k).toString()), apply(`${YPOW_INV[k]} ${m.toString()} ${YPOW[k]}`))) {
          throw new Error(`FACE_MAP 错:R_${k}(${m}) = ${relabelMove(m, k)},与 y^-${k} ${m} y^${k} 不等`);
        }
        n++;
      }
    }
  }
  console.log(`[selfTest] y 重贴表 OK —— ${n} 个 (转动 × y 次数) 组合与 KPuzzle 共轭逐一相等`);

  // 锚点:课本上的 F2L 左右镜
  const anchor = mirrorAlg("R U R' U'");
  if (anchor !== "L' U' L U") throw new Error(`镜像锚点错:mirrorAlg("R U R' U'") = "${anchor}"`);

  const pool = Object.keys(MIRROR_LR);
  const rand = rng(20260726);
  let m2 = 0;
  for (let t = 0; t < 400; t++) {
    const len = 1 + Math.floor(rand() * 12);
    const moves: string[] = [];
    for (let i = 0; i < len; i++) {
      const fam = pool[Math.floor(rand() * pool.length)];
      moves.push(new Move(fam, [1, -1, 2][Math.floor(rand() * 3)]).toString());
    }
    const a = moves.join(' ');
    if (!eq(mirrorPattern(apply(a), kpuzzle), apply(mirrorAlg(a)))) {
      throw new Error(`MIRROR_LR 与贴纸反射不一致:"${a}" → "${mirrorAlg(a)}"`);
    }
    m2++;
  }
  console.log(`[selfTest] 左右镜 OK —— ${m2} 条随机公式,公式重写路与贴纸反射路逐块相等(含 M/S/E、宽招、x/y/z)`);
}
