// VLM 盲读 vs 真态"任意面"匹配记分 (v1)
// 口径: 子代理读的是画面中央附近"某个面"的九宫格 (as-seen 行序), 不知道晶格窗口。
// 对每条链: 取该边界前/后两个 GT 真态 × 6 面 × 8 刚体变换 (4 旋转 × 翻转), 找最佳
// 匹配 → 每格准确率。同口径算管线 read 作对照; 位置洗牌 (同色多重集) 作噪声地板。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGT } from "../src/splits.ts";
import { ROTATION_TOKENS } from "../src/notation.ts";
import { IDENTITY_PERM, invertPerm, physicalPerm } from "../src/rotation-perms.ts";
import type { Perm } from "../src/cube-state.ts";

const COLOR_NAMES = ["W", "O", "G", "R", "B", "Y"]; // 与 real-eval 一致? 校验: omega 面心
const dir = import.meta.dirname;
const dump = JSON.parse(readFileSync(join(dir, "..", ".tmp", "obs-geo.json"), "utf8"));
const v = dump.videos.find((x: { name: string }) => x.name.startsWith("1"));
const omega: number[] = v.omega;
const n = v.bounds.length;

function applyTo(sc: readonly number[], perm: readonly number[]): number[] {
  const next = new Array<number>(54);
  for (let i = 0; i < 54; i++) next[i] = sc[perm[i]];
  return next;
}
const content = readFileSync(join(dir, "..", "videos", `${v.name}.splits.txt`), "utf8");
const { tokens: fToks, tailRotations: fTail } = parseGT(content);
const allToks = [...fToks, ...fTail];
const N = allToks.filter((t) => !ROTATION_TOKENS.has(t)).length;
const ts: Perm[] = [IDENTITY_PERM];
{
  let cur: Perm = IDENTITY_PERM;
  for (let j = allToks.length - 1; j >= 0; j--) {
    cur = applyTo(cur, invertPerm(physicalPerm(allToks[j])));
    if (!ROTATION_TOKENS.has(allToks[j])) ts.push(cur);
  }
}
console.log(`N=${N} n=${n}${N !== n ? " ⚠ 不等" : ""}`);

// 面心颜色自校验 (COLOR_NAMES 次序按 omega 推)
const centerColors = Array.from({ length: 6 }, (_, f) => Math.floor(omega[f * 9 + 4] / 9));
console.log("面心色下标:", centerColors.join(","));

const faceRead = (state: Perm, f: number): string =>
  Array.from({ length: 9 }, (_, k) => COLOR_NAMES[Math.floor(omega[state[f * 9 + k]] / 9)]).join("");

const idx = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const rot90 = (a: number[]) => [a[6], a[3], a[0], a[7], a[4], a[1], a[8], a[5], a[2]];
const flipT = (a: number[]) => [a[2], a[1], a[0], a[5], a[4], a[3], a[8], a[7], a[6]];
const transforms: number[][] = [];
{
  let t = idx;
  for (let k = 0; k < 4; k++) { transforms.push(t); transforms.push(flipT(t)); t = rot90(t); }
}
const apply = (s: string, tr: number[]) => tr.map((j) => s[j]).join("");

// 最佳匹配: 读串 vs {2 态} × {6 面} × {8 变换}
function bestMatch(read: string, states: Perm[]): { m: number; nn: number; flip: boolean } {
  let best = { m: -1, nn: 0, flip: false };
  for (const st of states) {
    for (let f = 0; f < 6; f++) {
      const truth = faceRead(st, f);
      for (let ti = 0; ti < 8; ti++) {
        const r = apply(read, transforms[ti]);
        let m = 0, nn = 0;
        for (let k = 0; k < 9; k++) if (r[k] !== ".") { nn++; if (r[k] === truth[k]) m++; }
        if (m > best.m) best = { m, nn, flip: ti % 2 === 1 };
      }
    }
  }
  return best;
}

// 洗牌地板: 同多重集随机置换 (固定种子 LCG)
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
function shuffled(s: string): string {
  const a = s.split("");
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.join("");
}

// VLM 盲读第一轮原始数据 (3 个无 GT 上下文的子代理, 2026-07-11; 协议="读画面中央最近的面")
const AGENT_READS = `
c-4-0-f943.png GYORYOBYB
c-5-0-f953.png RRG.YY.OO
c-8-0-f964.png BYYYY.ORG
c-10-0-f987.png GROBYYGYO
c-11-0-f994.png GROBY.GY.
c-13-0-f1003.png .B.GY..GO
c-14-0-f1028.png WGOBYRRGO
c-14-1-f1042.png WGOBYRGYO
c-14-2-f1056.png WGOBYRGYO
c-14-3-f1076.png WGOBYRGYO
c-14-4-f1093.png OROGYYWBG
c-15-0-f1102.png WGOBYRGYO
c-18-0-f1121.png YG.WY.BY.
c-20-0-f1130.png OG.YYBGYB
c-22-0-f1142.png YYBYYRG..
c-23-0-f1147.png YYBYYRG..
c-24-0-f1157.png YYGR.YBGR
c-24-1-f1164.png R.YBYY.Y.
c-26-0-f1169.png YYBYYR..R
c-27-0-f1178.png YYYYYYYYY
c-27-1-f1185.png YYYYYYYYY
c-27-2-f1196.png YYYYYYYYY
c-27-3-f1211.png YYYYYYYY.
c-29-0-f1221.png YYYYY....
c-30-0-f1230.png OY.OY.YYY
c-30-1-f1235.png .O..Y.YYO
c-31-0-f1240.png RYOOYOYYO
c-31-1-f1246.png YYORBRBB.
c-32-0-f1251.png R...RRB..
c-33-0-f1261.png RWWRYYGYY
c-36-0-f1277.png .WWRYG..G
c-37-0-f1281.png RYRRRRGBB
c-38-0-f1288.png YRRRRRGBB
c-38-1-f1296.png RRRRRRGBB
c-39-0-f1313.png BBRBBRY..
`;
const agent = new Map(
  AGENT_READS.trim().split("\n")
    .map((l) => l.trim().split(/\s+/)).filter((p) => p.length === 2).map(([k, val]) => [k, val] as const)
);

let vm = 0, vn = 0, pm = 0, pn = 0, sm = 0, sn = 0, flips = 0;
const rows: string[] = [];
for (let b = 0; b < n; b++) {
  for (let i = 0; i < v.bounds[b].length; i++) {
    const c = v.bounds[b][i];
    const key = `c-${b}-${i}-f${Math.floor((c.f0 + c.f1) / 2)}.png`;
    const vr = agent.get(key);
    if (!vr) continue;
    const d = n - b; // 边界 b ↔ 深度 d; 真态取动作前后两端
    const states = [ts[d], ts[d - 1]].filter(Boolean) as Perm[];
    const bv = bestMatch(vr, states);
    vm += bv.m; vn += bv.nn; if (bv.flip) flips++;
    const pr = (c.read as (string | null)[]).map((x) => x ?? ".").join("");
    const bp = bestMatch(pr, states);
    pm += bp.m; pn += bp.nn;
    // 洗牌 10 次
    let smm = 0, snn = 0;
    for (let r = 0; r < 10; r++) { const bs = bestMatch(shuffled(vr), states); smm += bs.m; snn += bs.nn; }
    sm += smm / 10; sn += snn / 10;
    rows.push(`${key}\tvlm ${bv.m}/${bv.nn}${bv.flip ? " flip" : ""}\tpipe ${bp.m}/${bp.nn}\t洗牌 ${(smm / 10).toFixed(1)}`);
  }
}
console.log(rows.join("\n"));
console.log(`\nVLM 任意面最佳: ${vm}/${vn} = ${((vm / vn) * 100).toFixed(1)}% (flip 胜出 ${flips} 链)`);
console.log(`管线同口径:     ${pm}/${pn} = ${((pm / pn) * 100).toFixed(1)}%`);
console.log(`洗牌噪声地板:   ${sm.toFixed(1)}/${sn.toFixed(1)} = ${((sm / sn) * 100).toFixed(1)}%`);
