// Long-lived cube48opt optimal-solve daemon (Node child process).
//
// Loads ONE manifest-verified cubeopt prune table into the wasm heap once
// (the manifest selects a strictly matched opt5/h5, opt6/h6, or opt8/h8 bundle),
// then serves solve requests over line-based stdio — exactly the cube555 daemon
// shape (see ../cube555/daemon.ts), but for 3x3 god's-number optimal solving.
//
// Why a child process (not in-proc in the Hono server):
//   • isolates variant-dependent table RAM (opt8 is ~7.25 GiB) from the API,
//   • the emscripten build leaks pthread/proxying resources and throws "unwind"
//     after a few thousand solves — the parent just respawns this child.
//
// Solve math is identical to solver/333opt/solve.mjs makeSolver(): stream the
// table into HEAPU8 in 64M chunks, init(0,K), solve_scramble(scr,K,1,true) with
// debug=true so the wasm prints "Solution found!: <moves>" + "finished in N".
//
// Wire protocol (one record per line, fields tab-separated):
//   in : "<id>\t<scramble>"
//   out: "READY\t<threads>"            once, when the table is loaded
//        "<id>\t<htm>\t<solution>"     success (solution = optimal HTM solve seq)
//        "<id>\tERROR\t<message>"      failure (bad scramble / no solution parsed)
//   Requests are awaited strictly FIFO, including asynchronous Rust workers.
//
// Env:
//   CUBEOPT_ARTIFACT_DIR  required API-owned store containing current.json and
//                         one immutable, variant-consistent module / wasm / table bundle
//   CUBEOPT_THREADS       solve thread-pool size (default 2)
import { openSync, readSync, closeSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { loadCubeoptArtifact } from './artifact.mjs';
import { checkCubeoptLoadMemory, requiredCubeoptLoadBytes, CUBEOPT_LOAD_FLOOR_BYTES } from './memory-budget.ts';
import { resolveCubeoptThreads } from './config.ts';
import { captureCubeoptOutput, initializeCubeoptSolver, serveCubeoptLines } from './solve-protocol.mjs';

const artifact = await loadCubeoptArtifact(process.env.CUBEOPT_ARTIFACT_DIR);
const MJS = artifact.modulePath;
const DAT = artifact.tablePath;
const THREADS = resolveCubeoptThreads(process.env.CUBEOPT_THREADS);
if (artifact.manifest.engine === 'rust-wasm' && THREADS > artifact.manifest.maxThreads) {
  throw new Error(`Rust CubeOpt supports at most ${artifact.manifest.maxThreads} threads`);
}

async function makeSolver() {
  // Reject before allocating the large WASM heap, including during deploy smoke.
  const sz = statSync(DAT).size;
  checkCubeoptLoadMemory(requiredCubeoptLoadBytes(sz));
  const output = captureCubeoptOutput();
  const createModule = (await import(pathToFileURL(MJS).href)).default;
  const m = await createModule({
    ...(artifact.manifest.engine === 'rust-wasm' ? {
      variant: Number(artifact.manifest.variant.slice(3)), threads: THREADS,
      wasmURL: pathToFileURL(artifact.wasmPath),
      workerURL: pathToFileURL(artifact.workerPath),
      snapshotURL: pathToFileURL(artifact.snapshotPath),
    } : {}),
    print: output.print,
    printErr: () => {},
  });
  const base = Number(m._get_mem_ptr());
  const fd = openSync(DAT, 'r');
  const CH = 64 * 1024 * 1024;
  const tmp = Buffer.allocUnsafe(CH);
  try {
    for (let off = 0; off < sz;) {
      checkCubeoptLoadMemory(CUBEOPT_LOAD_FLOOR_BYTES);
      const g = readSync(fd, tmp, 0, Math.min(CH, sz - off), off);
      if (!g) throw new Error('CubeOpt table ended before its declared size');
      m.HEAPU8.set(tmp.subarray(0, g), base + off);
      off += g;
    }
  } finally { closeSync(fd); }
  return initializeCubeoptSolver(m, THREADS, output);
}

const solve = await makeSolver();
process.stdout.write(`READY\t${THREADS}\n`);

const rl = createInterface({ input: process.stdin });
try {
  await serveCubeoptLines(rl, solve, line => process.stdout.write(line));
  process.exit(0); // Includes all worker_threads when the parent closes stdin.
} catch {
  process.exit(1); // Parent respawns the entire failed pool.
}
