import { describe, it, expect } from "vitest";
import { CubeState } from "../src/cube-state.ts";
import {
  greedyReverse,
  scoreVisual,
  compareMoves,
  CUBE_COLOR_TO_NAME,
  type BFaceGrid,
  type ProbDist,
} from "../src/reconstruct.ts";
import { FACE_DIRECTIONS, getMoveFace } from "../src/notation.ts";

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由真实状态生成 one-hot B 面观测 (完美视觉预言机) */
function oneHotGrid(state: CubeState): BFaceGrid {
  const grid: BFaceGrid = Array.from({ length: 9 }, (_, i) => {
    const id = Math.floor(state.sc[45 + i] / 9);
    return { [CUBE_COLOR_TO_NAME[id]]: 1 };
  });
  return grid;
}

describe("scoreVisual", () => {
  it("solved B-face vs all-blue grid = 9", () => {
    const grid: BFaceGrid = Array.from({ length: 9 }, () => ({ B: 1 }));
    expect(scoreVisual(new CubeState(), grid)).toBe(9);
  });

  it("partial match sums per-cell probabilities", () => {
    const grid: BFaceGrid = Array.from({ length: 9 }, (_, i) => (i < 4 ? { B: 0.5 } : {}));
    expect(scoreVisual(new CubeState(), grid)).toBeCloseTo(2.0);
  });
});

describe("greedyReverse — round-trip with perfect B-face oracle", () => {
  it("recovers a random solve exactly (faces that alter the B-face)", () => {
    const rng = mulberry32(7);
    // 排除 F: F/F'/F2 不改变 B 面, 仅凭 B 面无法辨方向 (真实局限, 非 bug)
    const FACES = ["U", "D", "L", "R", "B"];
    const DIRS = ["", "'", "2"];
    const N = 25;

    const moves: string[] = [];
    for (let i = 0; i < N; i++) {
      moves.push(FACES[Math.floor(rng() * FACES.length)] + DIRS[Math.floor(rng() * 3)]);
    }

    // scramble = solved 依次应用 moves 的逆 (逆序), 使得对 scramble 正向应用 moves → solved
    const scramble = new CubeState();
    for (let t = N - 1; t >= 0; t--) scramble.apply(invert(moves[t]));

    // 正向模拟, 记录每段起始态 S_t (独立于 greedyReverse 的逆推逻辑, 无循环论证)
    const states: CubeState[] = [];
    const cur = scramble.clone();
    for (let t = 0; t < N; t++) {
      states.push(cur.clone());
      cur.apply(moves[t]);
    }
    expect(cur.isSolved()).toBe(true); // moves 确实是 scramble 的解

    const grids = states.map(oneHotGrid);
    const probs: ProbDist[] = moves.map((m) => ({ [getMoveFace(m)!]: 1 }));

    const { predicted, finalState } = greedyReverse(probs, [], grids);
    expect(predicted).toEqual(moves);
    expect(finalState.sc).toEqual(scramble.sc);

    const cmp = compareMoves(predicted, moves);
    expect(cmp.faceCorrect).toBe(N);
    expect(cmp.fullCorrect).toBe(N);
  });
});

describe("greedyReverse — probability-only (no grids)", () => {
  it("is deterministic: picks first direction of the top face each segment", () => {
    const probs: ProbDist[] = [
      { U: 0.7, R: 0.3 },
      { L: 1.0 },
      { B: 0.5, U: 0.5 },
    ];
    const { predicted } = greedyReverse(probs, []);
    expect(predicted).toHaveLength(3);
    for (let t = 0; t < 3; t++) {
      const topFace = Object.keys(probs[t])[0];
      expect(getMoveFace(predicted[t])).toBe(topFace);
      expect(predicted[t]).toBe(FACE_DIRECTIONS[topFace][0]);
    }
  });
});

describe("compareMoves", () => {
  it("counts face-level and full-move accuracy, honoring length mismatch", () => {
    const r = compareMoves(["U", "R'", "F2"], ["U", "R", "F2", "D"]);
    expect(r.total).toBe(3); // 第 4 段 pred 缺失, 不计
    expect(r.fullCorrect).toBe(2); // U, F2
    expect(r.faceCorrect).toBe(3); // U, R'~R, F2 面全对
  });
});

/** 局部逆操作 (仅用于测试构造 scramble) */
function invert(move: string): string {
  const map: Record<string, string> = {
    U: "U'", "U'": "U", U2: "U2", D: "D'", "D'": "D", D2: "D2",
    L: "L'", "L'": "L", L2: "L2", R: "R'", "R'": "R", R2: "R2",
    B: "B'", "B'": "B", B2: "B2",
  };
  return map[move] ?? move;
}
