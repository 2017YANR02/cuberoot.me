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
 *                        we pass to the JVM so pruning tables read/write
 *                        from one stable path)
 *   CUBE555_WORKERS    — JVM-internal worker thread count (default 4)
 *   CUBE555_DISABLED=1 — skip spawn entirely (route returns 503;
 *                        useful for local dev when JDK isn't installed)
 *   JAVA_BIN           — java executable path (default "java")
 *
 * Wire format documented in core/cube555-daemon/Daemon.java top-of-file.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';

interface Pending {
  resolve: (s: string) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

const HOME = process.env.CUBE555_HOME ?? '/opt/cube555';
const WORKERS = process.env.CUBE555_WORKERS ?? '4';
const DISABLED = process.env.CUBE555_DISABLED === '1';
const JAVA = process.env.JAVA_BIN ?? 'java';
const REQUEST_TIMEOUT_MS = 30_000;

// Windows uses ';' as classpath separator; everything else uses ':'.
// We build the path once at module load since the platform is fixed.
const CLASSPATH = `dist${process.platform === 'win32' ? ';' : ':'}lib/twophase.jar`;

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
  return new Promise((resolve, reject) => {
    const args = ['-Xmx1g', '-cp', CLASSPATH, 'cs.cube555.Daemon'];
    console.log(`[cube555] spawn: cd ${HOME} && ${JAVA} ${args.join(' ')}`);

    let proc: ChildProcess;
    try {
      proc = spawn(JAVA, args, {
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
  bootPromise = spawnDaemon();
  return bootPromise;
}

export function isReady(): boolean {
  return ready;
}

/** Single random-state 5x5 scramble. Spawns the daemon on first call. */
export async function getScramble(): Promise<string> {
  await ensureDaemon();
  if (!child?.stdin) throw new Error('cube555 daemon stdin unavailable');

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
