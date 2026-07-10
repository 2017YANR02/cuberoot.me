/**
 * candidate-f-probe.ts — 量 EM 的"真实 f": vivid 首解 top-1 错候选 vs GT 的逐边界状态发散。
 *
 * f = 观测边界上 top-1 候选态色 ≠ GT 态色 的格比例。EM 抗噪探针显示 f≤25% 才可能胜 vivid;
 * f 大 → EM 从自信错种子自举 → 确认偏置。两序列都从复原态逆放取逐步中间态, B 面比。
 */
import { ROTATION_TOKENS } from "../src/notation.ts";
import { IDENTITY_PERM, invertPerm, physicalPerm } from "../src/rotation-perms.ts";

const applyTo = (sc: readonly number[], perm: readonly number[]): number[] => {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
};
// 逆放: 复原态起, 逐 token 逆作用, 收每步"该 token 起点态" (= real-eval startState 同法)
function startStates(tokensStr: string): { states: number[][]; moveTokens: string[] } {
  const tokens = tokensStr.trim().split(/\s+/);
  const states: number[][] = new Array(tokens.length);
  let cur = [...IDENTITY_PERM];
  for (let j = tokens.length - 1; j >= 0; j--) {
    cur = applyTo(cur, invertPerm(physicalPerm(tokens[j])));
    states[j] = cur;
  }
  // 只留非转体 token 的起点态 (转体是整机旋转, 边界按非转体段算)
  const moveTokens: string[] = [], moveStates: number[][] = [];
  for (let j = 0; j < tokens.length; j++) {
    if (ROTATION_TOKENS.has(tokens[j])) continue;
    moveTokens.push(tokens[j]);
    moveStates.push(states[j]);
  }
  return { states: moveStates, moveTokens };
}
// B 面 facelet 45..53 的颜色 (= facelet//9)
const bFace = (st: number[]) => Array.from({ length: 9 }, (_, i) => Math.floor(st[45 + i] / 9));

const GT = "U2 r U' r U2' R' F R U2' r2' F U2'";
const TOP1 = "U y2 R' U' R U' R U R2 U R2 U2 R'";

const g = startStates(GT), c = startStates(TOP1);
console.log(`GT ${g.moveTokens.length} 步, top-1 ${c.moveTokens.length} 步`);
console.log(`两解 LL 起点态一致? ${JSON.stringify(g.states[0]) === JSON.stringify(c.states[0]) ? "是 (同 LL case)" : "否"}`);

// 逐步 (对齐到步 index) B 面色差
const n = Math.min(g.states.length, c.states.length);
let totDiff = 0, totCell = 0;
console.log("\n步   GT-B面          top1-B面        差格");
for (let k = 0; k < n; k++) {
  const gb = bFace(g.states[k]), cb = bFace(c.states[k]);
  let d = 0;
  for (let i = 0; i < 9; i++) if (gb[i] !== cb[i]) d++;
  totDiff += d; totCell += 9;
  const nm = ["U", "R", "F", "D", "L", "B"];
  console.log(`  ${String(k).padStart(2)}  ${gb.map((x) => nm[x]).join("")}  ${cb.map((x) => nm[x]).join("")}   ${d}/9`);
}
console.log(`\nB 面逐步平均 f = ${((100 * totDiff) / totCell).toFixed(1)}% (${totDiff}/${totCell})`);
console.log("参照: EM 抗噪探针 f≤25% 才可能胜 vivid, f≥30% 跌破");
