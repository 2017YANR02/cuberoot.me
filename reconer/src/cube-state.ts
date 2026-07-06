/**
 * cube-state.ts — 魔方状态机 (54-sticker 置换)
 *
 * 置换表移植自 functions.cpp 的 moves map。每个转动 = 54 facelet 的置换。
 * 语义: newState[i] = oldState[perm[i]]。
 *
 * Facelet 编号:  U 0-8  R 9-17  F 18-26  D 27-35  L 36-44  B 45-53
 * 颜色约定:      U=0(白) R=1(红) F=2(绿) D=3(黄) L=4(橙) B=5(蓝)
 */

export type Perm = readonly number[];
export type Face = "U" | "R" | "F" | "D" | "L" | "B";

/** 18 个基础转动的 54-sticker 置换 — 直接从 functions.cpp 的 moves map 提取 */
const MOVE_PERMS: Record<string, Perm> = {
  U:  [6,3,0,7,4,1,8,5,2, 45,46,47,12,13,14,15,16,17, 9,10,11,21,22,23,24,25,26, 27,28,29,30,31,32,33,34,35, 18,19,20,39,40,41,42,43,44, 36,37,38,48,49,50,51,52,53],
  U2: [8,7,6,5,4,3,2,1,0, 36,37,38,12,13,14,15,16,17, 45,46,47,21,22,23,24,25,26, 27,28,29,30,31,32,33,34,35, 9,10,11,39,40,41,42,43,44, 18,19,20,48,49,50,51,52,53],
  "U'": [2,5,8,1,4,7,0,3,6, 18,19,20,12,13,14,15,16,17, 36,37,38,21,22,23,24,25,26, 27,28,29,30,31,32,33,34,35, 45,46,47,39,40,41,42,43,44, 9,10,11,48,49,50,51,52,53],
  D:  [0,1,2,3,4,5,6,7,8, 9,10,11,12,13,14,24,25,26, 18,19,20,21,22,23,42,43,44, 33,30,27,34,31,28,35,32,29, 36,37,38,39,40,41,51,52,53, 45,46,47,48,49,50,15,16,17],
  D2: [0,1,2,3,4,5,6,7,8, 9,10,11,12,13,14,42,43,44, 18,19,20,21,22,23,51,52,53, 35,34,33,32,31,30,29,28,27, 36,37,38,39,40,41,15,16,17, 45,46,47,48,49,50,24,25,26],
  "D'": [0,1,2,3,4,5,6,7,8, 9,10,11,12,13,14,51,52,53, 18,19,20,21,22,23,15,16,17, 29,32,35,28,31,34,27,30,33, 36,37,38,39,40,41,24,25,26, 45,46,47,48,49,50,42,43,44],
  L:  [53,1,2,50,4,5,47,7,8, 9,10,11,12,13,14,15,16,17, 0,19,20,3,22,23,6,25,26, 18,28,29,21,31,32,24,34,35, 42,39,36,43,40,37,44,41,38, 45,46,33,48,49,30,51,52,27],
  L2: [27,1,2,30,4,5,33,7,8, 9,10,11,12,13,14,15,16,17, 53,19,20,50,22,23,47,25,26, 0,28,29,3,31,32,6,34,35, 44,43,42,41,40,39,38,37,36, 45,46,24,48,49,21,51,52,18],
  "L'": [18,1,2,21,4,5,24,7,8, 9,10,11,12,13,14,15,16,17, 27,19,20,30,22,23,33,25,26, 53,28,29,50,31,32,47,34,35, 38,41,44,37,40,43,36,39,42, 45,46,6,48,49,3,51,52,0],
  R:  [0,1,20,3,4,23,6,7,26, 15,12,9,16,13,10,17,14,11, 18,19,29,21,22,32,24,25,35, 27,28,51,30,31,48,33,34,45, 36,37,38,39,40,41,42,43,44, 8,46,47,5,49,50,2,52,53],
  R2: [0,1,29,3,4,32,6,7,35, 17,16,15,14,13,12,11,10,9, 18,19,51,21,22,48,24,25,45, 27,28,2,30,31,5,33,34,8, 36,37,38,39,40,41,42,43,44, 26,46,47,23,49,50,20,52,53],
  "R'": [0,1,51,3,4,48,6,7,45, 11,14,17,10,13,16,9,12,15, 18,19,2,21,22,5,24,25,8, 27,28,20,30,31,23,33,34,26, 36,37,38,39,40,41,42,43,44, 35,46,47,32,49,50,29,52,53],
  F:  [0,1,2,3,4,5,44,41,38, 6,10,11,7,13,14,8,16,17, 24,21,18,25,22,19,26,23,20, 15,12,9,30,31,32,33,34,35, 36,37,27,39,40,28,42,43,29, 45,46,47,48,49,50,51,52,53],
  F2: [0,1,2,3,4,5,29,28,27, 44,10,11,41,13,14,38,16,17, 26,25,24,23,22,21,20,19,18, 8,7,6,30,31,32,33,34,35, 36,37,15,39,40,12,42,43,9, 45,46,47,48,49,50,51,52,53],
  "F'": [0,1,2,3,4,5,9,12,15, 29,10,11,28,13,14,27,16,17, 20,23,26,19,22,25,18,21,24, 38,41,44,30,31,32,33,34,35, 36,37,8,39,40,7,42,43,6, 45,46,47,48,49,50,51,52,53],
  B:  [11,14,17,3,4,5,6,7,8, 9,10,35,12,13,34,15,16,33, 18,19,20,21,22,23,24,25,26, 27,28,29,30,31,32,36,39,42, 2,37,38,1,40,41,0,43,44, 51,48,45,52,49,46,53,50,47],
  B2: [35,34,33,3,4,5,6,7,8, 9,10,42,12,13,39,15,16,36, 18,19,20,21,22,23,24,25,26, 27,28,29,30,31,32,2,1,0, 17,37,38,14,40,41,11,43,44, 53,52,51,50,49,48,47,46,45],
  "B'": [42,39,36,3,4,5,6,7,8, 9,10,0,12,13,1,15,16,2, 18,19,20,21,22,23,24,25,26, 27,28,29,30,31,32,17,14,11, 33,37,38,34,40,41,35,43,44, 47,50,53,46,49,52,45,48,51],
};

/** 宽转/中间层/双转别名 — 展开为 (旋转 + 基础转动) 序列 (functions.cpp move_convert) */
const MOVE_ALIASES: Record<string, string> = {
  // 双转方向无关
  "U2'": "U2", "D2'": "D2", "L2'": "L2", "R2'": "R2", "F2'": "F2", "B2'": "B2",
  // 宽转 (小写)
  "u": "y D", "u2": "y2 D2", "u2'": "y2 D2", "u'": "y' D'",
  "d": "y' U", "d2": "y2 U2", "d2'": "y2 U2", "d'": "y U'",
  "l": "x' R", "l2": "x2 R2", "l2'": "x2 R2", "l'": "x R'",
  "r": "x L",  "r2": "x2 L2", "r2'": "x2 L2", "r'": "x' L'",
  "f": "z B",  "f2": "z2 B2", "f2'": "z2 B2", "f'": "z' B'",
  "b": "z' F", "b2": "z2 F2", "b2'": "z2 F2", "b'": "z F'",
  // Uw/Dw/Lw/Rw/Fw/Bw 风格
  "Uw": "y D", "Uw2": "y2 D2", "Uw'": "y' D'",
  "Dw": "y' U", "Dw2": "y2 U2", "Dw'": "y U'",
  "Lw": "x' R", "Lw2": "x2 R2", "Lw'": "x R'",
  "Rw": "x L",  "Rw2": "x2 L2", "Rw'": "x' L'",
  "Fw": "z B",  "Fw2": "z2 B2", "Fw'": "z' B'",
  "Bw": "z' F", "Bw2": "z2 F2", "Bw'": "z F'",
  // 中间层
  "M": "x' L' R", "M2": "x2 L2 R2", "M2'": "x2 L2 R2", "M'": "x L R'",
  "E": "y' U D'", "E2": "y2 U2 D2", "E2'": "y2 U2 D2", "E'": "y U' D",
  "S": "z F' B",  "S2": "z2 F2 B2", "S2'": "z2 F2 B2", "S'": "z' F B'",
};

/**
 * 整体旋转的面映射 — 从 functions.cpp AlgConvertRotation 提取。
 * faceList[i] = 旋转后, 原本作用于面 i 的转动改为作用于面 faceList[i]。
 * 面索引顺序: U=0 D=1 L=2 R=3 F=4 B=5。
 */
const ROTATION_FACE_MAP: Record<string, readonly number[]> = {
  "x":  [5, 4, 2, 3, 0, 1],
  "x2": [1, 0, 2, 3, 5, 4],
  "x'": [4, 5, 2, 3, 1, 0],
  "y":  [0, 1, 5, 4, 2, 3],
  "y2": [0, 1, 3, 2, 5, 4],
  "y'": [0, 1, 4, 5, 3, 2],
  "z":  [3, 2, 0, 1, 4, 5],
  "z2": [1, 0, 3, 2, 4, 5],
  "z'": [2, 3, 1, 0, 4, 5],
};

// move 索引顺序: U=0 U2=1 U'=2 D=3 D2=4 D'=5 L=6 L2=7 L'=8 R=9 R2=10 R'=11 F=12 F2=13 F'=14 B=15 B2=16 B'=17
const MOVE_NAMES = ["U","U2","U'","D","D2","D'","L","L2","L'","R","R2","R'","F","F2","F'","B","B2","B'"] as const;
const MOVE_NAME_TO_INDEX = new Map<string, number>(MOVE_NAMES.map((n, i) => [n, i]));

/** 将 move 索引列表按旋转映射转换 (functions.cpp AlgConvertRotation) */
function algConvertRotation(moveIndices: number[], rotation: string): number[] {
  const faceList = ROTATION_FACE_MAP[rotation]!;
  return moveIndices.map((m) => 3 * faceList[Math.floor(m / 3)] + (m % 3));
}

const TOKEN_RE = /[A-Z]w?2?'?|[xyz]2?'?|[udlrfb]2?'?|[MES]2?'?/g;

/** 将动作字符串拆分为 token 列表, 支持 U2'/Rw/M2 等复合符号 */
export function tokenize(moveStr: string): string[] {
  return [...moveStr.matchAll(TOKEN_RE)].map((m) => m[0]);
}

/**
 * 将 token 列表展开为 54-sticker 置换序列 (functions.cpp ConvertScramble 逻辑)。
 *   1. 宽转/中间层经 MOVE_ALIASES 展开为 (旋转 + 基础转动)。
 *   2. 旋转不直接改 sticker, 而是把此前积累的基础转动做面映射 (吸收旋转)。
 *   3. 剩下的基础转动查表转为置换。
 */
function expandTokens(tokens: string[]): Perm[] {
  // 第一步: 展开别名为 (旋转 + 基础转动)
  const flatTokens: string[] = [];
  for (const token of tokens) {
    if (token in MOVE_ALIASES) {
      flatTokens.push(...MOVE_ALIASES[token].split(" "));
    } else if (token in MOVE_PERMS || token in ROTATION_FACE_MAP) {
      flatTokens.push(token);
    } else {
      throw new Error(`Unknown move: ${token}`);
    }
  }

  // 第二步: 消除旋转, 将旋转吸收进后续转动的面映射
  let accumulatedMoves: number[] = [];
  for (const token of flatTokens) {
    if (token in MOVE_PERMS) {
      accumulatedMoves.push(MOVE_NAME_TO_INDEX.get(token)!);
    } else if (token in ROTATION_FACE_MAP) {
      accumulatedMoves = algConvertRotation(accumulatedMoves, token);
    } else {
      throw new Error(`Unexpected token after expansion: ${token}`);
    }
  }

  return accumulatedMoves.map((idx) => MOVE_PERMS[MOVE_NAMES[idx]]);
}

const SOLVED: readonly number[] = Array.from({ length: 54 }, (_, i) => i);
const FACE_START: Record<Face, number> = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };

/** 魔方状态机 — 基于 54-sticker 置换 */
export class CubeState {
  /** sc[i] = facelet i 当前显示的原始 facelet 编号 (颜色 = 该编号 // 9) */
  sc: number[];

  constructor(sc?: number[]) {
    this.sc = sc ? sc.slice() : [...SOLVED];
  }

  clone(): CubeState {
    return new CubeState(this.sc);
  }

  isSolved(): boolean {
    for (let i = 0; i < 54; i++) if (this.sc[i] !== i) return false;
    return true;
  }

  /** 执行一次 54-sticker 置换 */
  applyPerm(perm: Perm): this {
    const next = new Array<number>(54);
    for (let i = 0; i < 54; i++) next[i] = this.sc[perm[i]];
    this.sc = next;
    return this;
  }

  /** 执行一个或多个动作字符串 (支持全部 WCA 符号: U U' U2 r x y M E S ...) */
  apply(moveStr: string): this {
    for (const perm of expandTokens(tokenize(moveStr))) this.applyPerm(perm);
    return this;
  }

  /** 获取 facelet 的颜色 (0-5) */
  getColor(faceletIdx: number): number {
    return Math.floor(this.sc[faceletIdx] / 9);
  }

  /** 获取某面 9 个贴纸颜色, 返回 3x3 */
  getFaceColors(face: Face): number[][] {
    const start = FACE_START[face];
    const flat = Array.from({ length: 9 }, (_, i) => this.getColor(start + i));
    return [flat.slice(0, 3), flat.slice(3, 6), flat.slice(6, 9)];
  }

  /** 返回 54 个 facelet 颜色 (0-5) */
  getAllColors(): number[] {
    return this.sc.map((v) => Math.floor(v / 9));
  }

  /** 返回 54 字符颜色字符串 (与 functions.cpp StateToInput 一致) */
  toColorString(): string {
    const faceMap = ["U", "R", "F", "D", "L", "B"];
    return this.sc.map((v) => faceMap[Math.floor(v / 9)]).join("");
  }

  /** 展开图形式打印 (调试用) */
  toString(): string {
    const cc = ["W", "R", "G", "Y", "O", "B"];
    const colors = this.getAllColors();
    const cell = (base: number, row: number) =>
      [0, 1, 2].map((i) => cc[colors[base + row * 3 + i]]).join(" ");
    const lines: string[] = [];
    for (let row = 0; row < 3; row++) lines.push("      " + cell(0, row));
    for (let row = 0; row < 3; row++) {
      lines.push([36, 18, 9, 45].map((base) => cell(base, row)).join("  "));
    }
    for (let row = 0; row < 3; row++) lines.push("      " + cell(27, row));
    return lines.join("\n");
  }
}

// ============================================================
// 逆序公式工具
// ============================================================

const MOVE_REVERSE: Record<string, string> = {
  "U": "U'", "U2": "U2", "U'": "U",
  "D": "D'", "D2": "D2", "D'": "D",
  "L": "L'", "L2": "L2", "L'": "L",
  "R": "R'", "R2": "R2", "R'": "R",
  "F": "F'", "F2": "F2", "F'": "F",
  "B": "B'", "B2": "B2", "B'": "B",
};

/** 将公式逆序 (每步取逆, 整体反转)。仅支持基础转动。 */
export function reverseAlgorithm(algStr: string): string {
  const tokens = tokenize(algStr);
  const reversed: string[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t in MOVE_REVERSE) reversed.push(MOVE_REVERSE[t]);
    else throw new Error(`reverseAlgorithm only supports basic moves, got: ${t}`);
  }
  return reversed.join(" ");
}
