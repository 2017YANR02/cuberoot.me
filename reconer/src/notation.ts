/**
 * notation.ts — 动作 token 级工具 (面提取 / 逆操作 / 指法剥离)。
 *
 * 约定 (见 CLAUDE.md「Notation 约定」):
 *   涉及 U D L R F r f x y; 不涉及 B E M S z。
 *   ↑↓· 是指法记号, ... 是卡顿, 解析时都剥离。
 */

/** 指法记号: ↑ (U+2191) ↓ (U+2193) · (U+00B7) */
export const FINGERING = "↑↓·";

/** 末尾朝向校正的转体 token (不对应视频段) */
export const ROTATION_TOKENS = new Set(["y", "y'", "y2", "x", "x'", "x2", "z2"]);

export const INVERSE_MAP: Record<string, string> = {
  U: "U'", "U'": "U", U2: "U2",
  D: "D'", "D'": "D", D2: "D2",
  R: "R'", "R'": "R", R2: "R2",
  L: "L'", "L'": "L", L2: "L2",
  F: "F'", "F'": "F", F2: "F2",
  B: "B'", "B'": "B", B2: "B2",
  f: "f'", "f'": "f", r: "r'", "r'": "r",
  u: "u'", "u'": "u",
  x: "x'", "x'": "x", x2: "x2",
  y: "y'", "y'": "y", y2: "y2",
  z: "z'", "z'": "z", z2: "z2",
};

export const FACE_DIRECTIONS: Record<string, string[]> = {
  U: ["U", "U'", "U2"],
  D: ["D", "D'", "D2"],
  R: ["R", "R'", "R2"],
  L: ["L", "L'", "L2"],
  F: ["F", "F'", "F2"],
  B: ["B", "B'", "B2"],
};

/** 用空格替换指法记号后按空白切分 */
export function splitByFingering(t: string): string[] {
  let s = t;
  for (const c of FINGERING) s = s.split(c).join(" ");
  return s.split(/\s+/).filter((p) => p.length > 0);
}

/**
 * 从 token 提取面名 (含 y 回退) — 与 template_cnn.getFace 一致。
 * 注意: 'udlrf' 不含 'b', 与原实现保持一致。
 */
export function getFace(token: string): string | null {
  for (const ch of token) {
    if ("UDLRFB".includes(ch)) return ch;
    if ("udlrf".includes(ch)) return ch.toUpperCase();
  }
  if (token.startsWith("y")) return "y";
  return null;
}

/** 从动作提取主面名 (无 y 回退) — 与 greedy_reverse.getMoveFace 一致 */
export function getMoveFace(move: string | null): string | null {
  if (move == null) return null;
  for (const ch of move) {
    if ("UDLRFB".includes(ch)) return ch;
    if ("udlrf".includes(ch)) return ch.toUpperCase();
  }
  return null;
}

/** 获取逆操作 (支持空格分隔的多动作) */
export function getInverse(move: string): string {
  if (move.includes(" ")) {
    return move.split(" ").map((p) => INVERSE_MAP[p] ?? p).join(" ");
  }
  return INVERSE_MAP[move] ?? move;
}
