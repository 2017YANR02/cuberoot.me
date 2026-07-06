/**
 * parity-parse.ts — 差分测试: TS 解析 vs 原始 Python greedy_reverse.parseGT。
 * 对全部 videos/*.splits.txt 逐 token/frame 比对。
 * 运行: npx tsx scripts/parity-parse.ts
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseGT, parseSplitFrames } from "../src/splits.ts";

function findPython(): string | null {
  for (const cmd of ["python", "py", "python3"]) {
    if (spawnSync(cmd, ["--version"], { encoding: "utf8" }).status === 0) return cmd;
  }
  return null;
}

const FILES = [
  "videos/1 4.448.MP4.splits.txt",
  "videos/2 4.369.MP4.splits.txt",
  "videos/3 4.375.MP4.splits.txt",
  "videos/4 4.610.MP4.splits.txt",
  "videos/5 4.067.MP4.splits.txt",
];

const python = findPython();
if (!python) {
  console.error("PARITY SKIP: no python interpreter found.");
  process.exit(3);
}

const py = spawnSync(python, ["scripts/_dump_parse.py"], { encoding: "utf8" });
if (py.status !== 0) {
  console.error("python reference failed:", py.stderr || py.error);
  process.exit(2);
}
const ref = JSON.parse(py.stdout) as Record<
  string,
  { tokens: string[]; tail: string[]; frames: number[] }
>;

let fail = 0;
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
for (const f of FILES) {
  const content = readFileSync(f, "utf8");
  const { tokens, tailRotations } = parseGT(content);
  const frames = parseSplitFrames(content);
  const r = ref[f];
  if (!eq(tokens, r.tokens)) { fail++; console.error(`${f}: tokens mismatch\n  py=${JSON.stringify(r.tokens)}\n  ts=${JSON.stringify(tokens)}`); }
  if (!eq(tailRotations, r.tail)) { fail++; console.error(`${f}: tail mismatch py=${JSON.stringify(r.tail)} ts=${JSON.stringify(tailRotations)}`); }
  if (!eq(frames, r.frames)) { fail++; console.error(`${f}: frames mismatch`); }
}

if (fail === 0) {
  console.log(`PARITY OK: ${FILES.length} splits.txt parse identical to Python (via ${python}).`);
} else {
  console.error(`PARITY FAIL: ${fail} mismatches.`);
  process.exit(1);
}
