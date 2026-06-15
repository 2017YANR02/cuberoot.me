/**
 * cube555 random-state daemon manager — spawns a long-lived JVM child that
 * pre-loads ~230 MB of pruning tables once, then serves scramble requests
 * over line-based stdio. We multiplex N parallel requests through one
 * subprocess (it has its own 4-worker thread pool internally).
 *
 * Bootstrapped from src/index.ts so the heavy pruning-table reload doesn't
 * block other Hono routes from coming up. While `ensureDaemon()` is still
 * pending, /v1/scramble/555-rs returns 503; everything else is unaffected.
 *
 * Env:
 *   CUBE555_HOME       — cube555 source tree (default /opt/cube555;
 *                        contains dist/, lib/twophase.jar, and is the CWD
 *                        we pass to the child so pruning tables read/write
 *                        from one stable path — also where the native
 *                        binary expects to find the .jpdata files)
 *   CUBE555_NATIVE_BIN — if set, spawn this path directly (GraalVM AOT
 *                        binary) instead of `java -cp ... cs.cube555.Daemon`.
 *                        ~200ms startup vs ~3s for JVM, ~150MB less RSS.
 *   CUBE555_WORKERS    — internal worker thread count (default 4)
 *   CUBE555_DISABLED=1 — skip spawn entirely (route returns 503;
 *                        useful for local dev when JDK isn't installed)
 *   JAVA_BIN           — java executable path (default "java"), ignored
 *                        when CUBE555_NATIVE_BIN is set.
 *
 * Wire format documented in core/cube555-daemon/Daemon.java top-of-file.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { registerTenant, claimMemory } from '../mem-arbiter.js';

interface Pending {
  resolve: (s: string) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

const HOME = process.env.CUBE555_HOME ?? '/opt/cube555';
const WORKERS = process.env.CUBE555_WORKERS ?? '4';
const DISABLED = process.env.CUBE555_DISABLED === '1';
const NATIVE_BIN = process.env.CUBE555_NATIVE_BIN;
const JAVA = process.env.JAVA_BIN ?? 'java';
const REQUEST_TIMEOUT_MS = 30_000;
// Idle-unload: free the JVM (~540MB) once nobody has asked for a 5x5 scramble for
// a while, so the cube48 opt6 table can use the box (see mem-arbiter.ts).
const IDLE_MS = Number(process.env.CUBE555_IDLE_MS) || 10 * 60_000;

// Windows uses ';' as classpath separator; everything else uses ':'.
// We build the path once at module load since the platform is fixed.
const CLASSPATH = `dist${process.platform === 'win32' ? ';' : ':'}lib/twophase.jar`;

let child: ChildProcess | null = null;
let ready = false;
let bootPromise: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<string, Pending>();
let lastUsed = 0;          // updated on each request; drives idle-unload
let idleStarted = false;

function rejectAllPending(reason: string): void {
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  }
  pending.clear();
}

/** Kill the JVM child to free its ~540MB; the 'exit' handler clears state, next
 * call respawns. Idempotent. */
function stopDaemon(): void {
  if (child) {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }
}

/** Idle-unload: once no scramble has been requested for IDLE_MS, free the JVM. */
function startIdleMonitor(): void {
  if (idleStarted) return;
  idleStarted = true;
  // Don't leave the JVM orphaned if core-api exits cleanly.
  process.once('exit', () => { if (child) { try { child.kill('SIGKILL'); } catch { /* gone */ } } });
  setInterval(() => {
    if (!child || !ready || pending.size > 0) return;
    if (Date.now() - lastUsed > IDLE_MS) {
      console.log('[cube555] idle — stopping daemon to free memory');
      stopDaemon();
    }
  }, 30_000).unref();
}

// Memory arbiter: stopping the JVM frees ~540MB for the opt6 table; pending.size
// guards an in-flight 5x5 from being evicted (cubeopt only evicts us with
// evictBusy, which it sets because a 3x3 solve outranks a 5x5 scramble).
registerTenant({ id: 'cube555', evict: stopDaemon, isBusy: () => pending.size > 0 });

function spawnDaemon(): Promise<void> {
  return new Promise((resolve, reject) => {
    const useNative = !!NATIVE_BIN;
    const exe = useNative ? NATIVE_BIN! : JAVA;
    // Native binary 默认 substrate VM heap policy 上限 ~80% sysmem, 1.8GB 服务器
    // 会摸到 1.4GB 跟 nginx/pg/Hono 撞 → OOM。显式 -Xmx512m: 230MB 剪枝表 + ~200MB
    // 工作区, RSS 实测 ~280-350MB, 比 JVM (-Xmx1g 用 ~540MB) 省 ~200MB。
    const args = useNative ? ['-Xmx512m'] : ['-Xmx1g', '-cp', CLASSPATH, 'cs.cube555.Daemon'];
    console.log(`[cube555] spawn (${useNative ? 'native' : 'jvm'}): cd ${HOME} && ${exe}${args.length ? ' ' + args.join(' ') : ''}`);

    let proc: ChildProcess;
    try {
      proc = spawn(exe, args, {
        cwd: HOME,
        env: { ...process.env, CUBE555_WORKERS: WORKERS },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      reject(err as Error);
      return;
    }

    child = proc;

    // Forward Java stderr to ours,但过滤掉 cube555 内部 Logger 的彩色 cube 状态图
    // 和每条 scramble 的 5x phase 时间 + reduction 总长 —— 这些是 debug 噪声,会占
    // pm2 logs 盘。保留:VERIFY-FAIL 自检 / 异常栈 / 剪枝表构建进度 / 任何未匹配
    // 的未知行(默认 surface 不丢)。
    const DROP_STDERR = [
      /\x1b\[/,                   // ANSI 彩色字符(几乎肯定是 cube 状态图)
      /^Phase[1-5] Finished in /, // 每条 scramble 的 phase 时间打印
      /^Reduction: \d+$/,         // 每条 scramble 的总长
    ];
    proc.stderr?.on('data', (chunk: Buffer) => {
      const s = chunk.toString();
      for (const line of s.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (DROP_STDERR.some((re) => re.test(line))) continue;
        console.error(`[cube555-java] ${trimmed}`);
      }
    });

    const rl = createInterface({ input: proc.stdout! });
    rl.on('line', (line) => {
      if (!ready) {
        if (line.startsWith('READY')) {
          ready = true;
          console.log(`[cube555] daemon ready (${line.replace('\t', ' workers=')})`);
          resolve();
        }
        return;
      }
      // Format: "<id>\t<scramble>\t<state>\t<OK|FAIL>"
      //      | "<id>\tERROR\t<class>:<message>"
      const tab1 = line.indexOf('\t');
      if (tab1 < 0) return;
      const id = line.slice(0, tab1);
      const rest = line.slice(tab1 + 1);
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      clearTimeout(p.timer);

      const parts = rest.split('\t');
      if (parts[0] === 'ERROR') {
        p.reject(new Error(`daemon: ${parts.slice(1).join(' ')}`));
        return;
      }
      // parts = [scramble, state, tag]
      const [scramble, , tag] = parts;
      if (tag !== 'OK') {
        p.reject(new Error(`daemon self-verify returned ${tag}`));
        return;
      }
      p.resolve(scramble);
    });

    proc.on('exit', (code, signal) => {
      console.error(`[cube555] daemon exited code=${code} signal=${signal}`);
      ready = false;
      child = null;
      bootPromise = null;
      rejectAllPending(`daemon exited (code=${code}, signal=${signal})`);
    });

    proc.on('error', (err) => {
      console.error('[cube555] spawn error:', err);
      ready = false;
      child = null;
      bootPromise = null;
      reject(err);
    });
  });
}

export function ensureDaemon(): Promise<void> {
  if (DISABLED) return Promise.reject(new Error('CUBE555_DISABLED=1'));
  if (ready) return Promise.resolve();
  if (bootPromise) return bootPromise;
  // Free the opt6 table before spawning the JVM — but YIELD to an in-progress 3x3
  // optimal solve (it's long + user-awaited; 5x5 has a client-side fallback).
  if (!claimMemory('cube555')) {
    return Promise.reject(new Error('cube555 busy: a 3x3 optimal solve holds memory, try again shortly'));
  }
  startIdleMonitor();
  bootPromise = spawnDaemon();
  return bootPromise;
}

export function isReady(): boolean {
  return ready;
}

/** Single random-state 5x5 scramble. Spawns the daemon on first call. */
export async function getScramble(): Promise<string> {
  lastUsed = Date.now();
  await ensureDaemon();
  if (!child?.stdin) throw new Error('cube555 daemon stdin unavailable');
  lastUsed = Date.now(); // the load could have taken seconds; re-stamp

  return new Promise<string>((resolve, reject) => {
    const id = `${nextId++}`;
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`cube555 timeout (id=${id}, ${REQUEST_TIMEOUT_MS}ms)`));
      }
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    child!.stdin!.write(`${id}\n`);
  });
}
