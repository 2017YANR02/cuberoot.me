/**
 * Random-state 5x5 scramble endpoint.
 *
 * Backed by cs0x7f/cube555 running as a JVM child process — see
 * src/cube555/daemon.ts for the spawn/protocol details, and
 * core/cube555-daemon/Daemon.java for the wire format.
 *
 * Cache-Control: no-store — every response must be unique. (nginx
 * proxy_cache for /v1/* would otherwise serve the same scramble repeatedly.)
 *
 * GET /v1/scramble/555-rs                  → { scramble: "Rw U2 ..." }      (200)
 *                                          → { error: "..." }              (503)
 * GET /v1/scramble/555-rs/ready            → { ready: boolean }              (200)
 * GET /v1/scramble/555-rs/batch?count=N    → SSE stream:
 *      data: {"i":<index>, "scramble":"..."}        # one per finished solve
 *      event: error  data: {"i":..., "error":"..."} # one per failed solve
 *      event: done   data: {"ok":N, "fail":N}       # terminal
 *      N is clamped to [1, 12]. Failures don't abort the stream — partial
 *      results stream as solvers finish (out of order, by id).
 */
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getScramble, isReady } from '../cube555/daemon.js';

export const scramble555Routes = new Hono();

const NO_CACHE = { 'Cache-Control': 'no-store' };
const BATCH_MAX = 12;

scramble555Routes.get('/scramble/555-rs', async (c) => {
  try {
    const scramble = await getScramble();
    return c.json({ scramble }, 200, NO_CACHE);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 503, NO_CACHE);
  }
});

scramble555Routes.get('/scramble/555-rs/ready', (c) => {
  return c.json({ ready: isReady() }, 200, NO_CACHE);
});

scramble555Routes.get('/scramble/555-rs/batch', (c) => {
  const raw = Number(c.req.query('count') ?? '1');
  const count = Math.max(1, Math.min(BATCH_MAX, Number.isFinite(raw) ? Math.floor(raw) : 1));
  return streamSSE(c, async (stream) => {
    // Serialize writes — multiple solver promises resolve concurrently, and
    // hono's stream isn't safe for parallel writeSSE() calls.
    let chain: Promise<void> = Promise.resolve();
    const safeWrite = (msg: Parameters<typeof stream.writeSSE>[0]): Promise<void> => {
      chain = chain.then(() => stream.writeSSE(msg)).catch(() => {});
      return chain;
    };
    let ok = 0;
    let fail = 0;
    const tasks = Array.from({ length: count }, (_, i) =>
      getScramble().then(
        (scramble) => {
          ok++;
          return safeWrite({ data: JSON.stringify({ i, scramble }) });
        },
        (e: unknown) => {
          fail++;
          const msg = e instanceof Error ? e.message : String(e);
          return safeWrite({ event: 'error', data: JSON.stringify({ i, error: msg }) });
        },
      ),
    );
    await Promise.all(tasks);
    await safeWrite({ event: 'done', data: JSON.stringify({ ok, fail }) });
  });
});
