// Siamese 2×2×2 (sia222) — OFFLINE pattern-database builder (TIER B).
//
// 铁律(solver/NONWCA_PUZZLE_LOOP.md §0.5 / §0.0 #10/#11):sia222 = 两 3×3×3 沿共享 2×2×2 块联体,实测是直积
// G = G_A × G_B(A/B token 作用 cubie 不相交且全对易),共享块锁死 3 面 → 每半边 = 受限 ⟨U,R,F⟩ 3×3×3。
// 解 = 按 z2 y 拆 A/B 两块 → 各半独立 IDA*(角 PDB + 两张互补 6-棱 PDB,max 启发)最优 → 拼接 = 全局最优。
// 三张 PDB 现场 build ~40–100s + 常驻 ~18.8MB,移动端发不动 → 离线 BFS 一次,序列化成单张 gz。
//
// gz ~3.0MB > 2MB 仓库上限 → **不进 repo**,发布到 static.cuberoot.me(§3 MANUAL scp,同 opt_bic 但发布而非提交)。
// 浏览器 fetch+inflate(DecompressionStream)→ 常驻 Uint8Array → IDA*。无 Date.now/Math.random → 确定可复现。
//
// 复用求解器逻辑:直接 import packages/client/lib/sia222-solver 的 sia222BuildPdbs() / serializeSia222Pdbs() /
// deserializeSia222Pdbs()(同一份 BFS + 字节格式)。运行:
//   pnpm --filter @cuberoot/scramble-stats-build build:sia222-table
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
interface Sia222Pdbs { corner: Uint8Array; edges: EdgePdb[] }

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..', '..', '..'); // src → pkg → packages → core → repo
  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'opt_sia222.bin.gz');

  console.log('[sia222] loading solver + BFS-ing the corner (3,674,160) + two 6-edge (3,870,720) PDBs…');
  const m = await mod('../../client/lib/sia222-solver');
  const sia222BuildPdbs = m.sia222BuildPdbs as () => Sia222Pdbs;
  const serializeSia222Pdbs = m.serializeSia222Pdbs as (p: Sia222Pdbs) => Uint8Array;
  const deserializeSia222Pdbs = m.deserializeSia222Pdbs as (b: Uint8Array) => Sia222Pdbs;
  const SIA222_CORNER_ORBIT = m.SIA222_CORNER_ORBIT as number;

  const t0 = Date.now();
  const pdbs = sia222BuildPdbs();
  const tBuild = Date.now() - t0;

  // self-check: corner reachable count == 3,674,160; corner diameter 11; each edge PDB full (3,870,720).
  const reach = (a: Uint8Array) => { let c = 0, mx = 0; for (let i = 0; i < a.length; i++) if (a[i] !== 255) { c++; if (a[i] > mx) mx = a[i]; } return { c, mx }; };
  const cs = reach(pdbs.corner);
  if (cs.c !== SIA222_CORNER_ORBIT) throw new Error(`[sia222] corner PDB reachable ${cs.c} != ${SIA222_CORNER_ORBIT}`);
  if (cs.mx !== 11) throw new Error(`[sia222] corner PDB diameter ${cs.mx} != 11`);
  pdbs.edges.forEach((e, i) => {
    const r = reach(e.dist);
    if (r.c !== e.def.size) throw new Error(`[sia222] edge PDB ${i} reachable ${r.c} != full ${e.def.size}`);
    console.log(`[sia222]   edge PDB ${i}: ${r.c} cells, diameter ${r.mx}`);
  });
  console.log(`[sia222]   corner PDB: ${cs.c} cells, diameter ${cs.mx}`);

  const raw = serializeSia222Pdbs(pdbs);
  // round-trip self-check before shipping
  const back = deserializeSia222Pdbs(raw);
  if (back.corner.length !== pdbs.corner.length) throw new Error('[sia222] round-trip corner length mismatch');
  for (let i = 0; i < pdbs.corner.length; i++) if (back.corner[i] !== pdbs.corner[i]) throw new Error(`[sia222] round-trip corner mismatch at ${i}`);
  for (let e = 0; e < pdbs.edges.length; e++) {
    if (back.edges[e].dist.length !== pdbs.edges[e].dist.length) throw new Error(`[sia222] round-trip edge ${e} length mismatch`);
    for (let i = 0; i < pdbs.edges[e].dist.length; i++) if (back.edges[e].dist[i] !== pdbs.edges[e].dist[i]) throw new Error(`[sia222] round-trip edge ${e} mismatch at ${i}`);
  }

  const gz = zlib.gzipSync(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength), { level: 9 });
  fs.writeFileSync(outPath, gz);

  console.log(
    `[sia222] wrote ${outPath} — corner+2×edge6 PDBs, raw ${(raw.length / 1e6).toFixed(2)}MB → gz ` +
    `${(gz.length / 1e6).toFixed(2)}MB, BFS ${(tBuild / 1000).toFixed(0)}s.`,
  );
  if (gz.length > 2_000_000) console.log('[sia222] NOTE gz > 2MB → ship via MANUAL scp (do NOT commit into repo); see NONWCA_PUZZLE_LOOP §3 publish queue.');
}

main().catch((err) => { console.error(err); process.exit(1); });
