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

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENABLED = process.env.CUBEOPT_SOLVE_ENABLED === '1';
const DAEMON_SCRIPT = process.env.CUBEOPT_DAEMON_SCRIPT
  ? resolve(process.env.CUBEOPT_DAEMON_SCRIPT)
  : resolve(__dirname, 'solve-daemon.mjs');

// A single optimal solve with opt5 on a 2-vCPU box can take tens of seconds and,
// for the hardest scrambles, a couple of minutes. Past this we treat the child
// as hung and recycle it.
const SOLVE_TIMEOUT_MS = Number(process.env.CUBEOPT_TIMEOUT_MS) || 180_000;
// Max requests allowed to sit in the (serial) queue before we shed load.
const MAX_QUEUE = Number(process.env.CUBEOPT_MAX_QUEUE) || 8;

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

function rejectAllPending(reason: string): void {
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  }
  pending.clear();
}

function spawnDaemon(): Promise<void> {
  return new Promise((resolveBoot, rejectBoot) => {
    console.log(`[cubeopt] spawn: node ${DAEMON_SCRIPT}`);
    let proc: ChildProcess;
    try {
      proc = spawn(process.execPath, [DAEMON_SCRIPT], {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      rejectBoot(err as Error);
      return;
    }
    child = proc;

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
          resolveBoot();
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
    });

    proc.on('error', (err) => {
      console.error('[cubeopt] spawn error:', err);
      ready = false;
      child = null;
      bootPromise = null;
      rejectBoot(err);
    });
  });
}

export function ensureDaemon(): Promise<void> {
  if (!ENABLED) return Promise.reject(new Error('cloud optimal solve is disabled'));
  if (ready) return Promise.resolve();
  if (bootPromise) return bootPromise;
  bootPromise = spawnDaemon();
  return bootPromise;
}

export function isEnabled(): boolean {
  return ENABLED;
}

export function isReady(): boolean {
  return ready;
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
  await ensureDaemon();
  if (!child?.stdin) throw new Error('solver stdin unavailable');
  if (pending.size >= MAX_QUEUE) throw new Error('Rate limit: solver queue full, try again shortly');

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
