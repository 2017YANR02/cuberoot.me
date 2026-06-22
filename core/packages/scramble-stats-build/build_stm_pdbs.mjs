// Offline builder for the 3×3×3 STM (Slice Turn Metric) OPTIMAL solver's pattern databases.
//
// Builds the three Korf-style PDBs rebuilt over the 27 STM generators (see core/packages/client/lib/
// stm-solver.ts for the math + admissibility proof) and writes them gzip-packed:
//   stats/scramble/stm/corner.bin.gz   — 8 corners (perm 8! × orient 3⁷ = 88,179,840 bytes)
//   stats/scramble/stm/edgeA.bin.gz    — edges UR UF UL UB DR DF (12P6 × 2⁶ = 42,577,920 bytes)
//   stats/scramble/stm/edgeB.bin.gz    — edges DL DB FR FL BL BR (same size)
//   stats/scramble/stm/manifest.json   — sizes, maxDepths, byte counts, generated_at
//
// Each .bin.gz = gzip( 16-byte header [magic 'STMPDB\0\0' + uint32 size LE + uint32 maxDepth LE] + the
// raw Uint8 dist array ). Total raw 173.4 MB; gzipped is far smaller (dist values are 0..11 / 0..9).
//
// Runtime note: these are HEAVY for a browser (173 MB resident after decompress). The recommended
// production runtime is a Node service (the repo already runs a server-side cube48opt optimal-solve
// daemon with multi-GB tables — same pattern). For browser use, the .bin.gz can be streamed + held in
// JS memory, but expect ~50 MB download + 173 MB heap.
//
// Usage (from anywhere; paths self-resolve):
//   node --max-old-space-size=4000 build_stm_pdbs.mjs            # build all three
//   node --max-old-space-size=4000 build_stm_pdbs.mjs corner     # build one
// Build cost (single process, no OOM): corner ~2.5 min, each edge ~1.5 min. Low-priority recommended.
//
// CAVEAT (see stm-solver.ts header): these 6-edge PDBs make the solver PROVABLY OPTIMAL and fast up to
// ~depth 12, but the hardest deep STM states (superflip-class) are correct yet impractically slow with
// this heuristic. Lifting that wall needs 7-edge PDBs (~510 MB each) — a future, Node-only upgrade.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const OUT_DIR = resolve(repoRoot, 'stats/scramble/stm');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// client solver lib lives in a package without "type":"module" → tsx loads it as CJS; default-import.
async function loadSolver() {
  const m = await import('../../client/lib/stm-solver.ts');
  const inner = (m.default && typeof m.default === 'object') ? m.default : m;
  return inner;
}

const MAGIC = Buffer.from('STMPDB\0\0', 'latin1'); // 8 bytes
function packPdb(pdb) {
  const header = Buffer.alloc(16);
  MAGIC.copy(header, 0);
  header.writeUInt32LE(pdb.size, 8);
  header.writeUInt32LE(pdb.maxDepth, 12);
  const body = Buffer.from(pdb.dist.buffer, pdb.dist.byteOffset, pdb.dist.byteLength);
  return gzipSync(Buffer.concat([header, body]), { level: 9 });
}

async function main() {
  const which = process.argv.slice(2);
  const all = which.length === 0;
  const S = await loadSolver();
  const manifest = { generated_at: new Date().toISOString(), tables: {} };

  const jobs = [];
  if (all || which.includes('corner')) jobs.push(['corner', () => S.buildCornerPdb({ onProgress: progress('corner') })]);
  if (all || which.includes('edgeA')) jobs.push(['edgeA', () => S.buildEdge6Pdb(S.EDGE_GROUP_A, { onProgress: progress('edgeA') })]);
  if (all || which.includes('edgeB')) jobs.push(['edgeB', () => S.buildEdge6Pdb(S.EDGE_GROUP_B, { onProgress: progress('edgeB') })]);

  for (const [name, build] of jobs) {
    const t0 = Date.now();
    console.log(`building ${name} PDB...`);
    const pdb = build();
    const gz = packPdb(pdb);
    const file = join(OUT_DIR, `${name}.bin.gz`);
    writeFileSync(file, gz);
    manifest.tables[name] = { size: pdb.size, maxDepth: pdb.maxDepth, rawBytes: pdb.size, gzBytes: gz.length };
    console.log(`  ${name}: size=${pdb.size.toLocaleString()} maxDepth=${pdb.maxDepth} gz=${(gz.length / 1e6).toFixed(1)}MB (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('wrote', OUT_DIR);
}

function progress(name) {
  let last = 0;
  return (depth, seen) => { const t = Date.now(); if (t - last > 8000) { last = t; console.log(`  [${name}] depth ${depth}: ${seen.toLocaleString()} seen`); } };
}

main().catch((e) => { console.error(e); process.exit(1); });
