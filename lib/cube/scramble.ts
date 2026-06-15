// 纯前端无依赖的 WCA 风格打乱生成器。client 与 server 都可 import(无 node API)。
// 思路:每步从候选面里随机挑一面 + 随机修饰,规则保证可读且不出现冗余连步。

import type { CubeEventId } from "@/db/schema";

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 标准三阶规则:
// - 每步面 != 上一步面;
// - 若候选面与上一步同轴(对面,如 U/D),则也要 != 上上步面(避免 U D U 这种同轴第三步冗余)。
// face -> 轴编号:U/D=0(竖) L/R=1(横) F/B=2(纵深)
const AXIS_333: Record<string, number> = {
  U: 0,
  D: 0,
  L: 1,
  R: 1,
  F: 2,
  B: 2,
};

function buildWcaScramble(
  faces: readonly string[],
  suffixes: readonly string[],
  length: number,
  axisOf: Record<string, number>,
): string {
  const moves: string[] = [];
  let lastFace = "";
  let prevFace = ""; // 上上步面,用于同轴第三步判定
  for (let i = 0; i < length; i++) {
    let face = pick(faces);
    let guard = 0;
    while (
      (face === lastFace ||
        (axisOf[face] === axisOf[lastFace] && face === prevFace)) &&
      guard < 50
    ) {
      face = pick(faces);
      guard++;
    }
    moves.push(face + pick(suffixes));
    prevFace = lastFace;
    lastFace = face;
  }
  return moves.join(" ");
}

const FACES_NXN = ["U", "D", "L", "R", "F", "B"] as const;
const SUFFIX_NXN = ["", "'", "2"] as const;

// 高阶用宽层记法(Rw / Uw 等)增加深度感,简化处理:在 NxN 基础上随机给一部分加 w。
function buildBigCube(length: number, wideChance: number): string {
  const moves: string[] = [];
  let lastFace = "";
  let prevFace = "";
  for (let i = 0; i < length; i++) {
    let face = pick(FACES_NXN);
    let guard = 0;
    while (
      (face === lastFace ||
        (AXIS_333[face] === AXIS_333[lastFace] && face === prevFace)) &&
      guard < 50
    ) {
      face = pick(FACES_NXN);
      guard++;
    }
    const wide = Math.random() < wideChance ? "w" : "";
    moves.push(face + wide + pick(SUFFIX_NXN));
    prevFace = lastFace;
    lastFace = face;
  }
  return moves.join(" ");
}

// 金字塔(pyraminx):四个大面 U L R B + 修饰,末尾随机加 1~3 个小写顶角转动 u l r b。
const FACES_PYRA = ["U", "L", "R", "B"] as const;
const SUFFIX_PYRA = ["", "'"] as const;

function buildPyraScramble(): string {
  const moves: string[] = [];
  let lastFace = "";
  for (let i = 0; i < 8; i++) {
    let face = pick(FACES_PYRA);
    let guard = 0;
    while (face === lastFace && guard < 20) {
      face = pick(FACES_PYRA);
      guard++;
    }
    moves.push(face + pick(SUFFIX_PYRA));
    lastFace = face;
  }
  // 末尾顶角(tips)
  const tips: string[] = [];
  const tipFaces = ["u", "l", "r", "b"] as const;
  const tipCount = 1 + Math.floor(Math.random() * 4); // 1~4
  const used = new Set<string>();
  for (let i = 0; i < tipCount; i++) {
    let t = pick(tipFaces);
    let guard = 0;
    while (used.has(t) && guard < 10) {
      t = pick(tipFaces);
      guard++;
    }
    used.add(t);
    tips.push(t + pick(SUFFIX_PYRA));
  }
  return [...moves, ...tips].join(" ");
}

// Skewb:四个轴 U L R B(各 ±)。
const FACES_SKEWB = ["U", "L", "R", "B"] as const;
function buildSkewbScramble(): string {
  const moves: string[] = [];
  let lastFace = "";
  for (let i = 0; i < 9; i++) {
    let face = pick(FACES_SKEWB);
    let guard = 0;
    while (face === lastFace && guard < 20) {
      face = pick(FACES_SKEWB);
      guard++;
    }
    moves.push(face + pick(SUFFIX_PYRA));
    lastFace = face;
  }
  return moves.join(" ");
}

// 每种项目用多少步 / 用什么生成器。
const PLANS: Record<CubeEventId, () => string> = {
  "333": () => buildWcaScramble(FACES_NXN, SUFFIX_NXN, 20, AXIS_333),
  "333oh": () => buildWcaScramble(FACES_NXN, SUFFIX_NXN, 20, AXIS_333),
  "333bf": () => buildWcaScramble(FACES_NXN, SUFFIX_NXN, 20, AXIS_333),
  "222": () => buildWcaScramble(FACES_NXN, SUFFIX_NXN, 11, AXIS_333),
  "444": () => buildBigCube(40, 0.45),
  "555": () => buildBigCube(60, 0.5),
  pyram: () => buildPyraScramble(),
  skewb: () => buildSkewbScramble(),
  // clock / minx 没有简单纯文本记法,给合理 fallback(三阶式)避免空串。
  clock: () => buildWcaScramble(FACES_NXN, SUFFIX_NXN, 18, AXIS_333),
  minx: () => buildWcaScramble(FACES_NXN, SUFFIX_NXN, 30, AXIS_333),
};

/**
 * 生成指定项目的打乱字符串。未知项目退回三阶。
 */
export function scramble(event: CubeEventId): string {
  const fn = PLANS[event];
  return fn ? fn() : PLANS["333"]();
}

// 项目元信息:下拉展示名 + 是否已有专门生成器(没有的标 fallback)。
export const SCRAMBLE_EVENTS: { id: CubeEventId; label: string }[] = [
  { id: "333", label: "三阶 3x3" },
  { id: "222", label: "二阶 2x2" },
  { id: "444", label: "四阶 4x4" },
  { id: "555", label: "五阶 5x5" },
  { id: "333oh", label: "三阶单手" },
  { id: "333bf", label: "三阶盲拧" },
  { id: "pyram", label: "金字塔" },
  { id: "skewb", label: "斜转" },
  { id: "clock", label: "魔表" },
  { id: "minx", label: "五魔方" },
];

export function eventLabel(event: CubeEventId): string {
  return SCRAMBLE_EVENTS.find((e) => e.id === event)?.label ?? event;
}
