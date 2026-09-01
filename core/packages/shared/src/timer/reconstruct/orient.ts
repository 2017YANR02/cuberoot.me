/**
 * 把一把解法转进「十字朝下」的标准视角。
 *
 * ## 为什么需要这一层
 *
 * 智能魔方**按自己的配色报手法**:白面在协议里恒等于 U,绿面恒等于 F,不管你
 * 手里怎么拿。而绝大多数人做白十字时白面朝下 —— 于是记录下来的那条流是手上动作
 * 的 x2 共轭:顶层公式全写成了 D 层,十字落在 U 面。
 *
 * 而整个分段层(`cfop_detect.ts` 的 `isCross` / `isF2l`、`f2l_slots.ts` 的四个槽)
 * **只认 D 面的十字**。两边一对上,结果不是「差一点」而是全盘皆输:
 *
 *   - 走完整把,`detectCfopStage` 一次都不跃迁,直到最后一手魔方全复原 —— 那一刻
 *     D 面自然也成了十字,四个阶段的 `endIdx` 一起落在最后一手;
 *   - 切分器把重复的三段滤掉,只剩「十字」一行吞掉整把,时间就是整把时间。
 *
 * 这不是假想:实测一把 13.41s / 65 手的真机记录,六个面各自第一次成十字的下标是
 * `{U:6, R:7, L:48, F:50, D:64, B:64}` —— 十字第 7 手就做完了,在 U 面。
 *
 * ## 做法:换视角,不换数据
 *
 * 选一个旋转 ρ 把十字面转到 D,然后把**打乱和动作流一起**按 ρ 共轭。这等于换个
 * 角度看同一把,不是改写这把:
 *
 *   - 手数一个不多一个不少 —— 共轭是逐记号的换名,`moves[i]` 一一对应,所以下游
 *     所有 `endIdx` 仍然是原始流的下标,不需要任何映射;
 *   - 局面完全等价,OLL/PLL 识别器、参考解、错误检测拿到的是同一个魔方;
 *   - 顺带把谱子写回**人的视角**:顶层公式重新写成 U 层,回放里十字朝下 —— 那正是
 *     拧的人当时看到的。
 *
 * ρ 只取六个之一(D 面不动、U 面 x2、F/B 面 x'/x、R/L 面 z/z'),绕竖轴那一维
 * 自由度不定 —— 因为它不影响任何判据:四个槽的名字(FR/FL/BR/BL)本来就是相对的。
 *
 * ## 十字面怎么认
 *
 * 不能只看「哪个面最早出十字」:上面那把里 U 是第 6 手、R 是第 7 手,差一手。
 * 真正把它们分开的是 **F2L** —— 「十字 + 四个角 + 四个中层棱」只剩顶层自由,一个
 * 面在解法中途满足它几乎不可能是巧合,而错的面只有等到魔方全复原才「满足」。
 * 所以判据是:F2L 最早成立的那个面;都不成立(半途而废 / DNF)才退回最早的十字。
 *
 * 平局一律偏向 D:已经是标准视角的数据(键盘输入、手填、老记录)必须原样通过,
 * 这一层对它们是恒等变换。
 *
 * ## 认不出来就不动
 *
 * 含 M/E/S 或宽层记号的流不共轭 —— 那些记号的换名规则依赖朝向的另一半信息,写错
 * 比不写更糟。真机流只有六面基本转,WCA 打乱也是,所以这个退路极少走到。
 *
 * ## 和 `lib/stage_detect.ts` 的 `crossOnDRotation` 不是一回事
 *
 * 那个也把十字转到 D,但问的是**另一个问题**:给定**一个局面**,把它摆成能查指纹
 * 的规范朝向 —— 每个局面各自算一次,异步,吃 cubing.js 的 KPattern。这里问的是
 * 「**这一把**的十字在哪个面」,要的是一个贯穿整条流的固定视角,同步、跑在 timer
 * 自己那个 facelet 模型上,因为它要被每一手的判据调用。
 *
 * 判据倒是同一套道理:那边按「凑齐的对数最多」挑面,理由和这里按 F2L 挑一模一样
 * —— 光看四条棱会撞上「F2L 拧完之后侧面碰巧也凑齐四条」。两处都栽过同一个坑。
 */

import { detectCfopStage, stageRank } from './cfop-detect';
import type { CubeFaces } from './state';
import { applyScramble, solved } from './state';
import { applyOneToken } from './apply-token';
import type { SolveMove } from '../stage-segments';

export type CubeFace = 'U' | 'D' | 'F' | 'B' | 'L' | 'R';

export const CUBE_FACES: readonly CubeFace[] = ['U', 'D', 'F', 'B', 'L', 'R'];

/**
 * 把该面转到 D 的整体旋转。空串 = 已经在 D,不用转。
 *
 * 十字在 U 的那一档有两个一手就到的选择,`x2` 和 `z2`,判据是**少动一个面**:
 * 魔方在协议里恒等于「白 U 绿 F」,`z2` 把白转下去、绿留在 F,`x2` 则把绿也甩到
 * 后面去。人拿魔方也是这么拿的 —— 用户 2026-08-04 那把手写复盘第一行就是 `z2`。
 * 这一维本来就不影响任何判据(四个槽的名字是相对的),所以挑保守的那个。
 * 其余五个面各只有一个一手到位的转法,没得挑。
 */
const ROTATION_TO_D: Readonly<Record<CubeFace, string>> = Object.freeze({
  D: '',
  U: 'z2',
  F: "x'",
  B: 'x',
  R: 'z',
  L: "z'",
});

/** 面 → 面 的置换。`perm[a] = b` 读作「原来在 a 面的东西转到了 b 面」。 */
export type FacePerm = Readonly<Record<CubeFace, CubeFace>>;

const IDENTITY_PERM: FacePerm = Object.freeze({
  U: 'U', D: 'D', F: 'F', B: 'B', L: 'L', R: 'R',
});

/**
 * 旋转记号 → 面置换。一串也行(`humanize.ts` 会累积好几个转体),空串 = 恒等。
 *
 * 不手写表:把旋转作用在复原态上,读六个中心块现在是什么颜色 —— 颜色就是它原来
 * 所在的面。手写六张表是给 typo 留位置。
 */
export function facePermFor(rotation: string): FacePerm {
  const tokens = rotation.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return IDENTITY_PERM;
  let st = solved(3);
  for (const tok of tokens) st = applyOneToken(st, tok);
  const out: Record<string, CubeFace> = {};
  for (const f of CUBE_FACES) {
    // st[f][4] 是转完之后 f 面的中心色 = 原来在那个色所属面的东西。
    out[st[f][4] as CubeFace] = f;
  }
  return Object.freeze(out as Record<CubeFace, CubeFace>);
}

/** M/E/S 各自「跟着哪个面转」。共轭一个中层 = 换成跟着新面的那个中层。 */
const SLICE_FOLLOWS: Readonly<Record<string, CubeFace>> = Object.freeze({ M: 'L', E: 'D', S: 'F' });
/** 反过来:跟着这个面的中层叫什么、要不要加撇。 */
const SLICE_FOR: Readonly<Record<CubeFace, [string, boolean]>> = Object.freeze({
  L: ['M', false], R: ['M', true],
  D: ['E', false], U: ['E', true],
  F: ['S', false], B: ['S', true],
});

/** x/y/z 各自「跟着哪个面转」,以及反查。 */
const ROT_FOLLOWS: Readonly<Record<string, CubeFace>> = Object.freeze({ x: 'R', y: 'U', z: 'F' });
const ROT_FOR: Readonly<Record<CubeFace, [string, boolean]>> = Object.freeze({
  R: ['x', false], L: ['x', true],
  U: ['y', false], D: ['y', true],
  F: ['z', false], B: ['z', true],
});

/** `R2'` → `{ family:'R', wide:false, suffix:"2'" }`;认不出来返回 null。 */
function splitToken(token: string): { family: string; wide: boolean; suffix: string } | null {
  const m = /^([UDFBLRMESxyz])(w?)(2'?|'?)$/.exec(token.trim());
  if (!m) return null;
  return { family: m[1], wide: m[2] === 'w', suffix: m[3] };
}

function withSuffix(base: string, suffix: string, flip: boolean): string {
  if (!flip) return `${base}${suffix}`;
  if (suffix === "2'") return `${base}2`;
  if (suffix === '2') return `${base}2'`;
  return suffix === "'" ? base : `${base}'`;
}

/**
 * 一个记号在新视角下怎么写。看不懂的记号返回 null —— 调用方据此整把放弃共轭,
 * 而不是让一个猜出来的记号混进正确的那些里面。
 */
export function conjugateToken(token: string, perm: FacePerm): string | null {
  const t = splitToken(token);
  if (!t) return null;
  const { family, wide, suffix } = t;
  const w = wide ? 'w' : '';

  if (family in SLICE_FOLLOWS) {
    if (wide) return null;                       // Mw 之类不是我们要认的东西
    const [name, flip] = SLICE_FOR[perm[SLICE_FOLLOWS[family]]];
    return withSuffix(name, suffix, flip);
  }
  if (family in ROT_FOLLOWS) {
    if (wide) return null;
    const [name, flip] = ROT_FOR[perm[ROT_FOLLOWS[family]]];
    return withSuffix(name, suffix, flip);
  }
  return `${perm[family as CubeFace]}${w}${suffix}`;
}

/** 整串共轭;任何一个记号认不出来 → null(整串放弃)。 */
export function conjugateSequence(seq: string, perm: FacePerm): string | null {
  const out: string[] = [];
  for (const tok of seq.trim().split(/\s+/).filter(Boolean)) {
    const c = conjugateToken(tok, perm);
    if (c === null) return null;
    out.push(c);
  }
  return out.join(' ');
}

export interface CrossFaceScan {
  face: CubeFace;
  /** 该面第一次成十字的动作下标;没成过是 null。 */
  crossIdx: number | null;
  /** 该面第一次 F2L 成立的动作下标;没成过是 null。 */
  f2lIdx: number | null;
}

/**
 * 六个面各扫一遍,报每个面的十字 / F2L 首次成立下标。
 *
 * 每个面都是「把问题整体转到该面朝下,再跑现成的 D 面判据」——判据只写一份,
 * 六个面共用,不会出现某个面的十字定义和别的面不一样。
 */
export function scanCrossFaces(scramble: string, moves: SolveMove[]): CrossFaceScan[] {
  return CUBE_FACES.map((face) => {
    const blank: CrossFaceScan = { face, crossIdx: null, f2lIdx: null };
    const rotation = ROTATION_TO_D[face];
    const perm = facePermFor(rotation);
    // D needs no rewriting at all, so a stream we cannot conjugate is still
    // scanned against D — that is the old behaviour, kept exactly.
    const scr = rotation === '' ? scramble : conjugateSequence(scramble, perm);
    if (scr === null) return blank;

    let state: CubeFaces;
    try {
      state = applyScramble(3, scr);
    } catch {
      state = solved(3);
    }
    let crossIdx: number | null = null;
    let f2lIdx: number | null = null;
    for (let i = 0; i < moves.length; i++) {
      let tok: string | null = moves[i].m;
      if (rotation !== '') {
        tok = conjugateToken(tok, perm);
        // 认不出的记号 → 这个面根本没法评,别拿半条流去和别的面比。
        if (tok === null) return blank;
      }
      state = applyOneToken(state, tok);
      const rank = stageRank(detectCfopStage(state));
      if (crossIdx === null && rank >= stageRank('cross')) crossIdx = i;
      if (rank >= stageRank('f2l')) { f2lIdx = i; break; }
    }
    return { face, crossIdx, f2lIdx };
  });
}

/** 排序键:F2L 最早的赢,其次十字最早的,再平就是 D 优先(标准视角原样通过)。 */
function scanScore(s: CrossFaceScan): [number, number, number] {
  return [s.f2lIdx ?? Infinity, s.crossIdx ?? Infinity, s.face === 'D' ? 0 : 1];
}

export function pickCrossFace(scans: readonly CrossFaceScan[]): CubeFace | null {
  let best: CrossFaceScan | null = null;
  for (const s of scans) {
    if (s.crossIdx === null && s.f2lIdx === null) continue;
    if (!best) { best = s; continue; }
    const a = scanScore(s), b = scanScore(best);
    if (a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])))) best = s;
  }
  return best ? best.face : null;
}

export interface NormalizedSolve {
  scramble: string;
  moves: SolveMove[];
  /** 十字原本在哪个面(原始视角)。认不出来是 null。 */
  crossFace: CubeFace | null;
  /** 用了哪个整体旋转。`''` = 没动。 */
  rotation: string;
  /** 真的换了视角吗。false 时 scramble/moves 就是传进来那两个对象。 */
  changed: boolean;
}

/** 没换视角时的返回值 —— 保持对象同一性,免得下游 useMemo 白白重算。 */
function unchanged(scramble: string, moves: SolveMove[], crossFace: CubeFace | null): NormalizedSolve {
  return { scramble, moves, crossFace, rotation: '', changed: false };
}

/**
 * 把一把转进「十字朝下」。已经朝下(或认不出十字)就原样返回。
 *
 * 幂等:对结果再调一次,`crossFace` 是 `'D'`,`changed` 是 false。
 */
export interface NormalizeSolveOptions {
  /** Absolute physical → viewer grip recovered from the first gyro sample. It
   * is accepted only when it also puts the detected cross face on D. */
  preferredRotation?: string | null;
}

export function normalizeSolve(
  scramble: string,
  moves: SolveMove[],
  opts: NormalizeSolveOptions = {},
): NormalizedSolve {
  if (!moves || moves.length === 0) return unchanged(scramble, moves, null);
  const face = pickCrossFace(scanCrossFaces(scramble, moves));
  if (face === null) return unchanged(scramble, moves, face);

  const preferred = opts.preferredRotation;
  const preferredPerm = preferred !== undefined && preferred !== null
    ? facePermFor(preferred)
    : null;
  const rotation = preferredPerm?.[face] === 'D' ? preferred! : ROTATION_TO_D[face];
  if (rotation === '') return unchanged(scramble, moves, face);

  const perm = facePermFor(rotation);
  const scr = conjugateSequence(scramble, perm);
  if (scr === null) return unchanged(scramble, moves, face);
  const out: SolveMove[] = new Array(moves.length);
  for (let i = 0; i < moves.length; i++) {
    const c = conjugateToken(moves[i].m, perm);
    if (c === null) return unchanged(scramble, moves, face);
    out[i] = { ...moves[i], m: c };
  }
  return { scramble: scr, moves: out, crossFace: face, rotation, changed: true };
}

/**
 * 十字是什么颜色 —— 面在标准配色下的颜色名。
 *
 * 报颜色而不是报面:换过视角之后「D 面」对每把都成立,说了等于没说;而「白十字」
 * 是这把真正的事实,也是 /recon 那边一直在用的说法。
 */
export const FACE_COLOR_KEY: Readonly<Record<CubeFace, string>> = Object.freeze({
  U: 'white', D: 'yellow', F: 'green', B: 'blue', L: 'orange', R: 'red',
});
