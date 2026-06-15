/**
 * cube48opt optimal-solve daemon manager.
 *
 * Spawns a long-lived Node child (./solve-daemon.mjs) that holds ONE cubeopt
 * prune table (default opt5 / 972M) in its wasm heap and solves 3x3 scrambles
 * to god's-number optimal over line-based stdio. Same shape as cube555/daemon.ts.
 *
 * Concurrency: the child's solve_scramble() is synchronous, so it processes
 * requests strictly FIFO one-at-a-time — the global serial queue is intrinsic.
 * We additionally cap how many requests may queue (MAX_QUEUE) and time each one
 * out (kill + respawn the child if a single solve hangs past the deadline).
 *
 * Env:
 *   CUBEOPT_SOLVE_ENABLED=1   enable (default OFF — the 972M table must be on
 *                             disk first; until then the route returns 503)
 *   CUBEOPT_DAEMON_SCRIPT     path to solve-daemon.mjs (default: alongside this
 *                             file in dev; set explicitly in the prod bundle)
 *   CUBEOPT_MODULE / CUBEOPT_TABLE / CUBEOPT_THREADS  forwarded to the child
 *                             (see solve-daemon.mjs for defaults)
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENABLED = process.env.CUBEOPT_SOLVE_ENABLED === '1';
const DAEMON_SCRIPT = process.env.CUBEOPT_DAEMON_SCRIPT
  ? resolve(process.env.CUBEOPT_DAEMON_SCRIPT)
  : resolve(__dirname, 'solve-daemon.mjs');

// A single optimal solve on a 2-vCPU box can take tens of seconds and, for the
// hardest scrambles, a couple of minutes. Past this we treat the child as hung
// and recycle it.
const SOLVE_TIMEOUT_MS = Number(process.env.CUBEOPT_TIMEOUT_MS) || 180_000;
// Max requests allowed to sit in the (serial) queue before we shed load.
const MAX_QUEUE = Number(process.env.CUBEOPT_MAX_QUEUE) || 8;

// ── Memory safety (the table is up to ~2GB resident on a 3.5GB box) ───────────
// Three layers, weakest→strongest:
//   1. idle-unload — drop the table after IDLE_MS of no solves (steady-state win).
//   2. memory watchdog — poll /proc/meminfo; if MemAvailable falls below the
//      floor for 2 reads, drop the table BEFORE the kernel has to OOM anything.
//   3. oom_score_adj=1000 on the child — if a spike beats the poll, the kernel
//      kills THIS process first, never core-api/postgres (set at spawn below).
const IDLE_MS = Number(process.env.CUBEOPT_IDLE_MS) || 10 * 60_000;
const MEM_FLOOR_MB = Number(process.env.CUBEOPT_MEM_FLOOR_MB) || 200;
const MEM_POLL_MS = Number(process.env.CUBEOPT_MEM_POLL_MS) || 1000;
// After a low-memory drop, refuse to reload for this long so we don't thrash
// (drop → reload 2GB → drop) while the pressure that triggered it is still there.
const COOLDOWN_MS = Number(process.env.CUBEOPT_COOLDOWN_MS) || 15_000;

export interface SolveResult {
  htm: number;
  solution: string;
}

interface Pending {
  resolve: (r: SolveResult) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

let child: ChildProcess | null = null;
let ready = false;
let bootPromise: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<string, Pending>();

let lastActivity = 0;       // updated on each solve; drives idle-unload
let cooldownUntil = 0;      // refuse reload until this time after a low-mem drop
let lowMemReads = 0;        // consecutive sub-floor MemAvailable reads (debounce)
let monitorsStarted = false;
let lastLoadMs = 0;         // wall time of the most recent table load (spawn→READY)

function rejectAllPending(reason: string): void {
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  }
  pending.clear();
}

function spawnDaemon(): Promise<void> {
  return new Promise((resolveBoot, rejectBoot) => {
    // The boot promise must settle exactly once. In particular, if the child
    // dies DURING the (multi-second) table load — the watchdog dropping it under
    // memory pressure, an OOM, a bad table — the 'exit' handler below must
    // reject this promise, or the awaiting solve hangs forever.
    let settled = false;
    const spawnStartedAt = Date.now();
    const finishOk = () => { if (!settled) { settled = true; lastLoadMs = Date.now() - spawnStartedAt; resolveBoot(); } };
    const finishErr = (e: Error) => { if (!settled) { settled = true; rejectBoot(e); } };
    console.log(`[cubeopt] spawn: node ${DAEMON_SCRIPT}`);
    let proc: ChildProcess;
    try {
      proc = spawn(process.execPath, [DAEMON_SCRIPT], {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      finishErr(err as Error);
      return;
    }
    child = proc;

    // Layer 3: make THIS process the OOM killer's first victim, so a memory
    // spike that beats the watchdog poll sacrifices the (respawnable) table
    // process instead of core-api / postgres. Linux-only, best effort.
    if (process.platform === 'linux' && proc.pid) {
      try { writeFileSync(`/proc/${proc.pid}/oom_score_adj`, '1000'); } catch { /* /proc unavailable */ }
    }

    proc.stderr?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        const t = line.trim();
        if (t) console.error(`[cubeopt-wasm] ${t}`);
      }
    });

    const rl = createInterface({ input: proc.stdout! });
    rl.on('line', (line) => {
      if (!ready) {
        if (line.startsWith('READY')) {
          ready = true;
          console.log(`[cubeopt] daemon ready (${line.replace('\t', ' threads=')})`);
          finishOk();
        }
        return;
      }
      // "<id>\t<htm>\t<solution>"  |  "<id>\tERROR\t<message>"
      const tab1 = line.indexOf('\t');
      if (tab1 < 0) return;
      const id = line.slice(0, tab1);
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      clearTimeout(p.timer);

      const rest = line.slice(tab1 + 1);
      const tab2 = rest.indexOf('\t');
      const field = tab2 < 0 ? rest : rest.slice(0, tab2);
      const tail = tab2 < 0 ? '' : rest.slice(tab2 + 1);
      if (field === 'ERROR') {
        p.reject(new Error(`solver: ${tail}`));
        return;
      }
      const htm = Number(field);
      if (!Number.isFinite(htm) || !tail) {
        p.reject(new Error('solver: malformed result'));
        return;
      }
      p.resolve({ htm, solution: tail });
    });

    proc.on('exit', (code, signal) => {
      console.error(`[cubeopt] daemon exited code=${code} signal=${signal}`);
      ready = false;
      child = null;
      bootPromise = null;
      rejectAllPending(`solver restarted (code=${code}, signal=${signal})`);
      // If it died before READY, unblock the awaiting ensureDaemon().
      finishErr(new Error(`solver exited before ready (code=${code}, signal=${signal})`));
    });

    proc.on('error', (err) => {
      console.error('[cubeopt] spawn error:', err);
      ready = false;
      child = null;
      bootPromise = null;
      finishErr(err);
    });
  });
}

export function ensureDaemon(): Promise<void> {
  if (!ENABLED) return Promise.reject(new Error('cloud optimal solve is disabled'));
  if (ready) return Promise.resolve();
  if (Date.now() < cooldownUntil) {
    return Promise.reject(new Error('Rate limit: solver cooling down after memory pressure, try again shortly'));
  }
  if (bootPromise) return bootPromise;
  startMonitors();
  bootPromise = spawnDaemon();
  return bootPromise;
}

// ── Memory monitors (idle-unload + watchdog) ─────────────────────────────────
function readMemAvailableMB(): number {
  if (process.platform !== 'linux') return -1;
  try {
    const m = readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+)\s+kB/m);
    return m ? Math.floor(Number(m[1]) / 1024) : -1;
  } catch { return -1; }
}

function startMonitors(): void {
  if (monitorsStarted) return;
  monitorsStarted = true;

  // Best-effort: don't leave the (multi-GB) child orphaned if this process
  // exits cleanly. Synchronous 'exit' only — no signal handlers, to avoid
  // interfering with the app's own shutdown.
  process.once('exit', () => { if (child) { try { child.kill('SIGKILL'); } catch { /* gone */ } } });

  // Layer 1: idle-unload — drop the resident table once nobody has solved for a
  // while, returning ~2GB to the box for the 95% of the time it's not in use.
  setInterval(() => {
    if (!child || !ready || pending.size > 0) return;
    if (Date.now() - lastActivity > IDLE_MS) {
      console.log('[cubeopt] idle — dropping table to free memory');
      recycleChild();
    }
  }, 30_000).unref();

  // Layer 2: memory watchdog — if MemAvailable dips below the floor for two
  // consecutive reads while the table is loaded, drop it pre-emptively (and
  // cool down) before the kernel is forced to OOM-kill something.
  //
  // Only while `ready`: loading a ~2GB table transiently pushes MemAvailable
  // down (the file fills page cache while the wasm heap grows), which would make
  // the watchdog kill its OWN load. During load we instead rely on Layer 3
  // (oom_score_adj) — if it genuinely can't fit, the kernel sacrifices this
  // process; if it's just a transient, let the load finish.
  setInterval(() => {
    if (!child || !ready) { lowMemReads = 0; return; }
    const avail = readMemAvailableMB();
    if (avail < 0) return; // not Linux / unreadable
    if (avail < MEM_FLOOR_MB) {
      if (++lowMemReads >= 2) {
        console.error(`[cubeopt] low memory (${avail}MB < ${MEM_FLOOR_MB}MB) — dropping table to avert OOM`);
        cooldownUntil = Date.now() + COOLDOWN_MS;
        lowMemReads = 0;
        recycleChild();
      }
    } else {
      lowMemReads = 0;
    }
  }, MEM_POLL_MS).unref();
}

export function isEnabled(): boolean {
  return ENABLED;
}

export function isReady(): boolean {
  return ready;
}

/** Wall time (ms) of the most recent table load (spawn→READY). 0 if never loaded. */
export function getLastLoadMs(): number {
  return lastLoadMs;
}

/** Kill the child; the 'exit' handler rejects pending + clears state, next call respawns. */
function recycleChild(): void {
  if (child) {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }
}

/**
 * Solve one scramble to optimal. Spawns the daemon on first call. Rejects on
 * invalid scramble, queue overflow, solver error, or timeout (which also
 * recycles the hung child).
 */
export async function solveOptimal(scramble: string): Promise<SolveResult> {
  lastActivity = Date.now();
  await ensureDaemon();
  if (!child?.stdin) throw new Error('solver stdin unavailable');
  if (pending.size >= MAX_QUEUE) throw new Error('Rate limit: solver queue full, try again shortly');
  lastActivity = Date.now();

  return new Promise<SolveResult>((resolveSolve, rejectSolve) => {
    const id = `${nextId++}`;
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        // The child is still blocking inside solve_scramble on this scramble —
        // there is no way to interrupt it but to kill the process.
        recycleChild();
        rejectSolve(new Error(`solve timeout (${SOLVE_TIMEOUT_MS}ms)`));
      }
    }, SOLVE_TIMEOUT_MS);
    pending.set(id, { resolve: resolveSolve, reject: rejectSolve, timer });
    child!.stdin!.write(`${id}\t${scramble}\n`);
  });
}
