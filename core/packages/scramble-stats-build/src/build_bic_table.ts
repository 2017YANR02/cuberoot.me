// Bicube (bic) — OFFLINE exact optimal-distance table builder (TIER B).
//
// 铁律(solver/NONWCA_PUZZLE_LOOP.md §0.0 #10 + §0.5):bic 可达闭包恰 1,108,800 态(<2M),但浏览器现场
// string-keyed BFS 实测 ~6.4s / ~510MB 峰值 → 移动端(<480px,用户硬约束)直接崩。故落 TIER B:这里离线
// BFS 整图一次,把每个态的「精确最优距离」按一个确定性的、可逆的 RANK 索引,序列化成紧凑字节流,gzip 成
// stats/scramble/opt_bic.bin.gz(约 1.8MB,可进 repo)。浏览器只 fetch+inflate+查表+梯度下降解,可证最优。
//
// 复用求解器逻辑:直接 import packages/client/lib/bicube-solver 的 bicBuildTable()(同一份 BFS)+
// serializeBicTable()(同一份字节格式,浏览器端 deserializeBicTable 反序列化)。输出无 Date.now/Math.random,
// 故同输入逐字节可复现。
//
// 运行:
//   pnpm --filter @cuberoot/scramble-stats-build build:bic-table
//   (或) pnpm exec tsx src/build_bic_table.ts
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

interface BicTable { ranks: Float64Array; dist: Uint8Array; count: number; }

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..', '..', '..'); // src → pkg → packages → core → repo
  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'opt_bic.bin.gz');

  console.log('[bic] loading solver + BFS-ing the full closure (1,108,800 states)…');
  const m = await mod('../../client/lib/bicube-solver');
  const bicBuildTable = m.bicBuildTable as () => BicTable;
  const serializeBicTable = m.serializeBicTable as (t: BicTable) => Uint8Array;
  const BIC_DIST_HISTOGRAM = m.BIC_DIST_HISTOGRAM as readonly number[];
  const BIC_GODS_NUMBER = m.BIC_GODS_NUMBER as number;

  const t0 = Date.now();
  const table = bicBuildTable();
  const tBuild = Date.now() - t0;

  // sanity: count + histogram must match the locked constants (catches a broken move model before shipping).
  if (table.count !== 1108800) throw new Error(`[bic] expected 1,108,800 states, got ${table.count}`);
  const hist: number[] = [];
  for (let i = 0; i < table.count; i++) hist[table.dist[i]] = (hist[table.dist[i]] ?? 0) + 1;
  if (hist.length - 1 !== BIC_GODS_NUMBER) throw new Error(`[bic] God number mismatch: ${hist.length - 1} vs ${BIC_GODS_NUMBER}`);
  for (let d = 0; d <= BIC_GODS_NUMBER; d++) {
    if ((hist[d] ?? 0) !== BIC_DIST_HISTOGRAM[d]) throw new Error(`[bic] histogram[${d}] = ${hist[d]} != ${BIC_DIST_HISTOGRAM[d]}`);
  }

  const raw = serializeBicTable(table);
  const gz = zlib.gzipSync(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength), { level: 9 });
  fs.writeFileSync(outPath, gz);

  console.log(
    `[bic] wrote ${outPath} — ${table.count} states, raw ${(raw.length / 1e6).toFixed(2)}MB → gz ` +
    `${(gz.length / 1e6).toFixed(2)}MB, BFS ${(tBuild / 1000).toFixed(1)}s, God ${BIC_GODS_NUMBER}.`,
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
