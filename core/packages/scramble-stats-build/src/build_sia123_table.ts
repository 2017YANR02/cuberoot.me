// Siamese 1×2×3 (sia123) — OFFLINE pattern-database builder (TIER B).
//
// 铁律(solver/NONWCA_PUZZLE_LOOP.md §0.5 / §0.0 #10/#11):sia123 = 两 3×3×3 沿共享 1×2×3 块联体,实测是
// CLEAN 直积 G = G_A × G_B(A/B token 作用 cubie 不相交且全对易)。每半边 = 受限 ⟨U,R,r⟩ 3×3×3,带三种动块:
//   6 角(轨道 29,160,直径 27)+ 9 棱(轨道 92,897,280)+ 5 中心(内层 r 4-循环 4 个面心,POSITION 轨道 4;
//   第 5 个 R 轴面心位置固定)。中心 ORIENTATION 不可见(单色实心面),目标不约束;但中心 POSITION 与角/棱
//   奇偶耦合,必须当坐标跟踪(一张极小 4 态 PDB 折进 max 启发 + 目标)。
// 解 = 按 z2 拆 A/B 两块 → 各半独立 IDA*(角 PDB + 两张互补 6-棱 PDB + 中心位置 PDB,max 启发)最优 → 拼接 =
//   全局最优(直积结构,长度 = 两半最优之和)。
//
// 离线 BFS 一次、序列化成单张 gz(两半各 4 张表 → raw ~16.5MB → gz ~5.25MB,>2MB 仓库上限 → **发布到
// static.cuberoot.me,不进 repo**,同 sia222;§3 MANUAL scp)。浏览器 fetch+inflate(DecompressionStream)→
// 常驻 Uint8Array → IDA*。无 Date.now/Math.random → 确定可复现。
//
// 复用求解器逻辑:直接 import packages/client/lib/sia123-solver 的 sia123BuildPdbs() / serializeSia123Pdbs() /
// deserializeSia123Pdbs()。注意(实测):CUBE B = CUBE A 被 z2 共轭后, 投影距离-按-rank 与 CUBE A **不一致**
// (z2 重排 piece-id / 取向约定, 不像 sia222 的 z2 y 能共享), 故 A/B **各存一份**(两半 PDB 块串进同一张 gz)。
// 运行:
//   pnpm --filter @cuberoot/scramble-stats-build build:sia123-table
// 由 update_puzzle_stats.ps1 的「TIER B 离线表」步骤调用。

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

// client 求解器 .ts 在无 "type":"module" 的包里,tsx 当 CJS 加载 → 命名 import 不绑定;default-import 整模块再取属性。
async function mod(rel: string): Promise<Record<string, unknown>> {
  const m = (await import(rel)) as { default?: Record<string, unknown> } & Record<string, unknown>;
  const inner = (m.default && typeof m.default === 'object') ? m.default : m;
  return inner as Record<string, unknown>;
}

interface EdgePdb { def: { size: number }; dist: Uint8Array }
interface HalfPdbs { corner: Uint8Array; edges: EdgePdb[]; centers?: Uint8Array }
interface Sia123Pdbs { a: HalfPdbs; b: HalfPdbs }

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..', '..', '..'); // src → pkg → packages → core → repo
  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'opt_sia123.bin.gz');

  console.log('[sia123] loading solver + BFS-ing BOTH halves: corner (29,160) + two 6-edge + center PDBs each…');
  const m = await mod('../../client/lib/sia123-solver');
  const sia123BuildPdbs = m.sia123BuildPdbs as () => Sia123Pdbs;
  const serializeSia123Pdbs = m.serializeSia123Pdbs as (p: Sia123Pdbs) => Uint8Array;
  const deserializeSia123Pdbs = m.deserializeSia123Pdbs as (b: Uint8Array) => Sia123Pdbs;
  const SIA123_CORNER_ORBIT = m.SIA123_CORNER_ORBIT as number;
  const SIA123_CENTER_ORBIT = m.SIA123_CENTER_ORBIT as number;

  const t0 = Date.now();
  const pdbs = sia123BuildPdbs();
  const tBuild = Date.now() - t0;

  // self-check each half: corner reachable == 29,160 (diameter 14 face-turn); each edge PDB full; center == 4.
  const reach = (a: Uint8Array) => { let c = 0, mx = 0; for (let i = 0; i < a.length; i++) if (a[i] !== 255) { c++; if (a[i] > mx) mx = a[i]; } return { c, mx }; };
  for (const [name, half] of [['A', pdbs.a], ['B', pdbs.b]] as const) {
    const cs = reach(half.corner);
    if (cs.c !== SIA123_CORNER_ORBIT) throw new Error(`[sia123] cube-${name} corner PDB reachable ${cs.c} != ${SIA123_CORNER_ORBIT}`);
    // diameter 14 in the FACE-TURN metric (R2/U2/r2 each = 1 move); the measurement's "27" was the QTM figure.
    if (cs.mx !== 14) throw new Error(`[sia123] cube-${name} corner PDB diameter ${cs.mx} != 14 (face-turn)`);
    console.log(`[sia123]   cube-${name} corner PDB: ${cs.c} cells, diameter ${cs.mx} (face-turn)`);
    half.edges.forEach((e, i) => {
      const r = reach(e.dist);
      if (r.c !== e.def.size) throw new Error(`[sia123] cube-${name} edge PDB ${i} reachable ${r.c} != full ${e.def.size}`);
      console.log(`[sia123]   cube-${name} edge PDB ${i}: ${r.c} cells, diameter ${r.mx}`);
    });
    if (!half.centers) throw new Error(`[sia123] cube-${name} center PDB missing (NZ>0 model must build it)`);
    const zs = reach(half.centers);
    if (zs.c !== SIA123_CENTER_ORBIT) throw new Error(`[sia123] cube-${name} center PDB reachable ${zs.c} != ${SIA123_CENTER_ORBIT}`);
    console.log(`[sia123]   cube-${name} center PDB: ${zs.c} cells (of ${half.centers.length}), diameter ${zs.mx}`);
  }

  const raw = serializeSia123Pdbs(pdbs);
  // round-trip self-check before shipping
  const back = deserializeSia123Pdbs(raw);
  for (const [name, oh, bh] of [['A', pdbs.a, back.a], ['B', pdbs.b, back.b]] as const) {
    if (bh.corner.length !== oh.corner.length) throw new Error(`[sia123] cube-${name} round-trip corner length mismatch`);
    for (let i = 0; i < oh.corner.length; i++) if (bh.corner[i] !== oh.corner[i]) throw new Error(`[sia123] cube-${name} round-trip corner mismatch at ${i}`);
    if (!bh.centers || !oh.centers || bh.centers.length !== oh.centers.length) throw new Error(`[sia123] cube-${name} round-trip center length mismatch`);
    for (let i = 0; i < oh.centers.length; i++) if (bh.centers[i] !== oh.centers[i]) throw new Error(`[sia123] cube-${name} round-trip center mismatch at ${i}`);
    for (let e = 0; e < oh.edges.length; e++) {
      if (bh.edges[e].dist.length !== oh.edges[e].dist.length) throw new Error(`[sia123] cube-${name} round-trip edge ${e} length mismatch`);
      for (let i = 0; i < oh.edges[e].dist.length; i++) if (bh.edges[e].dist[i] !== oh.edges[e].dist[i]) throw new Error(`[sia123] cube-${name} round-trip edge ${e} mismatch at ${i}`);
    }
  }

  const gz = zlib.gzipSync(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength), { level: 9 });
  fs.writeFileSync(outPath, gz);

  console.log(
    `[sia123] wrote ${outPath} — corner+2×edge6+center PDBs, raw ${(raw.length / 1e6).toFixed(2)}MB → gz ` +
    `${(gz.length / 1e6).toFixed(2)}MB, BFS ${(tBuild / 1000).toFixed(1)}s.`,
  );
  if (gz.length > 2_000_000) console.log('[sia123] NOTE gz > 2MB → do NOT commit into repo; ship via MANUAL scp (§3 publish queue).');
  else console.log('[sia123] gz ≤ 2MB → COMMIT into repo (stats/scramble/opt_sia123.bin.gz).');
}

main().catch((err) => { console.error(err); process.exit(1); });
