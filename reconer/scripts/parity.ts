/**
 * parity.ts — 差分测试: TS 端口 vs 原始 Python cube_state。
 *
 * 生成 N 个确定性随机 scramble (含宽转/旋转/中间层), 在两端各自 apply,
 * 逐 sc 数组比对。任何转置表转写错误都会在此暴露。
 *
 * 运行: npx tsx scripts/parity.ts
 */
import { spawnSync } from "node:child_process";
import { CubeState } from "../src/cube-state.ts";

function findPython(): string | null {
  for (const cmd of ["python", "py", "python3"]) {
    const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    if (r.status === 0) return cmd;
  }
  return null;
}

// 确定性 RNG (mulberry32), 保证可复现
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

const MOVES = [
  "U", "U'", "U2", "D", "D'", "D2", "L", "L'", "L2", "R", "R'", "R2",
  "F", "F'", "F2", "B", "B'", "B2",
  "u", "u'", "d", "d'", "l", "l'", "r", "r'", "f", "f'", "b", "b'",
  "Uw", "Dw'", "Rw2", "Lw'", "Fw", "Bw'",
  "M", "M'", "E", "E'", "S", "S'", "M2", "E2", "S2",
  "x", "x'", "y", "y'", "z", "z'", "x2", "y2", "z2",
  "U2'", "F2'", "L2'",
];

const N = 500;
const rng = mulberry32(0x12345);
const scrambles: string[] = [];
for (let i = 0; i < N; i++) {
  const len = 5 + Math.floor(rng() * 25);
  const seq: string[] = [];
  for (let j = 0; j < len; j++) seq.push(MOVES[Math.floor(rng() * MOVES.length)]);
  scrambles.push(seq.join(" "));
}

const python = findPython();
if (!python) {
  console.error("PARITY SKIP: no python interpreter found on PATH (tried python/py/python3).");
  process.exit(3);
}

const py = spawnSync(python, ["scripts/_dump_states.py"], {
  input: scrambles.join("\n") + "\n",
  encoding: "utf8",
});
if (py.status !== 0) {
  console.error("python reference failed:", py.stderr || py.error);
  process.exit(2);
}

const refLines = py.stdout.replace(/\r/g, "").trim().split("\n");
if (refLines.length !== N) {
  console.error(`ref line count ${refLines.length} != ${N}`);
  process.exit(2);
}

let mismatches = 0;
for (let i = 0; i < N; i++) {
  const c = new CubeState();
  if (scrambles[i].trim()) c.apply(scrambles[i]);
  const tsStr = c.sc.join(",");
  if (tsStr !== refLines[i]) {
    mismatches++;
    if (mismatches <= 5) {
      console.error(`MISMATCH #${i}: "${scrambles[i]}"`);
      console.error(`  py: ${refLines[i]}`);
      console.error(`  ts: ${tsStr}`);
    }
  }
}

if (mismatches === 0) {
  console.log(`PARITY OK: ${N}/${N} scrambles match Python cube_state exactly (via ${python}).`);
} else {
  console.error(`PARITY FAIL: ${mismatches}/${N} mismatches.`);
  process.exit(1);
}
