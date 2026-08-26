// Long-lived cube48opt optimal-solve daemon (Node child process).
//
// Loads ONE manifest-verified cubeopt prune table into the wasm heap once
// (the manifest selects a strictly matched opt5/h5, opt6/h6, or opt8/h8 bundle),
// then serves solve requests over line-based stdio — exactly the cube555 daemon
// shape (see ../cube555/daemon.ts), but for 3x3 god's-number optimal solving.
//
// Why a child process (not in-proc in the Hono server):
//   • isolates ~1GB of table RAM from the 700MB API process,
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
//   solve_scramble() blocks this thread, so requests are processed strictly
//   FIFO one-at-a-time — that IS the global serial queue.
//
// Env:
//   CUBEOPT_ARTIFACT_DIR  required API-owned store containing current.json and
//                         one immutable, variant-consistent module / wasm / table bundle
//   CUBEOPT_THREADS       solve thread-pool size (default 2)
import { openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { loadCubeoptArtifact } from './artifact.mjs';

const artifact = await loadCubeoptArtifact(process.env.CUBEOPT_ARTIFACT_DIR);
const MJS = artifact.modulePath;
const DAT = artifact.tablePath;
const THREADS = Math.max(1, Number(process.env.CUBEOPT_THREADS) || 2);

// Validate a single scramble token-by-token: only HTM face turns (the wasm can't
// take wide moves / rotations / slices). Belt-and-suspenders — the route also
// validates, but the daemon must never feed garbage into solve_scramble.
const TOKEN = /^[URFDLB][2']?$/;
function cleanScramble(raw) {
  const toks = String(raw).trim().split(/\s+/).filter(Boolean);
  if (toks.length === 0 || toks.length > 50) return null;
  for (const t of toks) if (!TOKEN.test(t)) return null;
  return toks.join(' ');
}

async function makeSolver() {
  const state = { last: '', sol: '' };
  const createModule = (await import(pathToFileURL(MJS).href)).default;
  const m = await createModule({
    print: (t) => {
      const s = t.match(/Solution found!:\s*(.*)/);
      if (s) state.sol = s[1].trim().replace(/\s+/g, ' '); // wasm double-pads — normalize
      if (/finished in/.test(t)) state.last = t;
    },
    printErr: () => {},
  });
  const base = Number(m._get_mem_ptr());
  const fd = openSync(DAT, 'r');
  const sz = fstatSync(fd).size;
  const CH = 64 * 1024 * 1024;
  const tmp = Buffer.allocUnsafe(CH);
  for (let off = 0; off < sz;) {
    const g = readSync(fd, tmp, 0, Math.min(CH, sz - off), off);
    m.HEAPU8.set(tmp.subarray(0, g), base + off);
    off += g;
  }
  closeSync(fd);
  m.init(0, THREADS); // 0 = table already in heap
  return (scr) => {
    state.last = '';
    state.sol = '';
    m.solve_scramble(scr, THREADS, 1, true); // debug=true → prints the optimal solution
    const htm = (state.last.match(/finished in (\d+)/) || [])[1];
    return { htm, sol: state.sol };
  };
}

const solve = await makeSolver();
process.stdout.write(`READY\t${THREADS}\n`);

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const tab = line.indexOf('\t');
  if (tab < 0) return;
  const id = line.slice(0, tab);
  const scr = cleanScramble(line.slice(tab + 1));
  if (!scr) {
    process.stdout.write(`${id}\tERROR\tinvalid scramble\n`);
    return;
  }
  try {
    const { htm, sol } = solve(scr);
    if (!htm || !sol) {
      process.stdout.write(`${id}\tERROR\tno solution\n`);
      return;
    }
    process.stdout.write(`${id}\t${htm}\t${sol}\n`);
  } catch (e) {
    // Surface then die — an exception out of the wasm (e.g. emscripten unwind)
    // means this process is poisoned; the parent will respawn a fresh child.
    process.stdout.write(`${id}\tERROR\t${String((e && e.message) || e).replace(/\s+/g, ' ')}\n`);
    process.exit(1);
  }
});
