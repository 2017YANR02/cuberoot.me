/**
 * /v1/scramble/optimal-solve — 3x3 god's-number optimal solve, server-side.
 *
 * Backs the "云端求解" option on /scramble/solver for users who don't want to
 * download the multi-GB cubeopt prune table. The server holds opt6 (1.9G) for
 * speed (median ~4s vs opt5's ~21s); every opt level returns the SAME optimal
 * solution, only faster with a bigger table. opt6 on the small box runs under
 * memory guards (idle-unload + watchdog + oom_score_adj) in cubeopt/daemon.ts.
 *
 * Guards (all three the user asked for):
 *   • login gate     — requireAuth; anonymous users keep the local-download path.
 *   • IP rate limit   — dedicated sliding window (30 POSTs / 5 min); admins exempt.
 *                       The global 30/min writer limit is too loose for this op.
 *   • serial queue    — intrinsic to the daemon (synchronous solve) + per-request
 *                       timeout + queue-depth cap in cubeopt/daemon.ts.
 *
 * POST /v1/scramble/optimal-solve   body { scrambles: string[] (<=5) }
 *   → SSE: data {"i":idx,"htm":N,"solution":"..."}      one per solved scramble
 *          event:error data {"i":idx,"error":"..."}     one per failed scramble
 *          event:done  data {"ok":N,"fail":N}           terminal
 * GET  /v1/scramble/optimal-solve/ready → { enabled, ready }
 */
import { Hono } from 'hono';
import { getIp } from '../utils/analytics_helpers.js';
import { streamSSE } from 'hono/streaming';
import { requireAuth, ADMIN_WCA_IDS } from '../utils/recon_helpers.js';
import { solveOptimal, isEnabled, isReady, ensureDaemon, getLastLoadMs } from '../cubeopt/daemon.js';

export const cubeoptSolveRoutes = new Hono();

const NO_CACHE = { 'Cache-Control': 'no-store' };
const MAX_SCRAMBLES = 5;
const MAX_MOVES = 50;
const TOKEN = /^[URFDLB][2']?$/;

// Dedicated per-IP sliding window: at most 30 POSTs / 5 min (each <=5 scrambles).
// Solve work is bounded mostly by the global serial daemon queue; this just stops
// one client monopolising it. Admins bypass it entirely (see the route).
const POST_WINDOW_MS = 5 * 60_000;
const POST_MAX = 30;
const ipHits = new Map<string, number[]>();
function checkSolveRateLimit(ip: string): void {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > now - POST_WINDOW_MS);
  if (hits.length >= POST_MAX) throw new Error('Rate limit exceeded for cloud solve');
  hits.push(now);
  ipHits.set(ip, hits);
}

/** Normalise a scramble to plain HTM face turns, or null if it isn't one. */
function cleanScramble(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const toks = raw.trim().split(/\s+/).filter(Boolean);
  if (toks.length === 0 || toks.length > MAX_MOVES) return null;
  for (const t of toks) if (!TOKEN.test(t)) return null;
  return toks.join(' ');
}

cubeoptSolveRoutes.get('/scramble/optimal-solve/ready', (c) => {
  return c.json({ enabled: isEnabled(), ready: isReady() }, 200, NO_CACHE);
});

cubeoptSolveRoutes.post('/scramble/optimal-solve', async (c) => {
  c.header('Cache-Control', 'no-store');
  if (!isEnabled()) return c.json({ error: 'Cloud optimal solve is not available' }, 503, NO_CACHE);

  const user = await requireAuth(c); // login gate — throws → 401
  // Admins have no throttle; everyone else gets the per-IP window above. Doing
  // auth first also means anonymous/invalid probes never burn a real user's quota.
  if (!ADMIN_WCA_IDS.includes(user.wcaId)) checkSolveRateLimit(getIp(c));

  let body: { scrambles?: unknown };
  try {
    body = await c.req.json<{ scrambles?: unknown }>();
  } catch {
    throw new Error('Validation: invalid json');
  }
  const rawList = Array.isArray(body.scrambles) ? body.scrambles : [];
  if (rawList.length === 0) throw new Error('Validation: scrambles is required');
  if (rawList.length > MAX_SCRAMBLES) throw new Error(`Validation: at most ${MAX_SCRAMBLES} scrambles`);
  const scrambles = rawList.map(cleanScramble);
  if (scrambles.some((s) => s === null)) throw new Error('Validation: each scramble must be plain HTM face turns (e.g. R U R\' ...)');

  c.header('X-Accel-Buffering', 'no'); // nginx: don't buffer the SSE stream
  return streamSSE(c, async (stream) => {
    // Serialize SSE writes — the onState callback + heartbeat fire asynchronously
    // while we await a solve, and hono's stream isn't parallel-safe.
    let chain: Promise<void> = Promise.resolve();
    const safeWrite = (msg: Parameters<typeof stream.writeSSE>[0]): Promise<void> => {
      chain = chain.then(() => stream.writeSSE(msg)).catch(() => {});
      return chain;
    };
    // Heartbeat: a request can sit silent for ~1min (queued behind another solve,
    // or mid-solve with no progress events). Without bytes flowing nginx's
    // proxy_read_timeout closes the connection, killing the request just as it'd
    // finish. A 10s ping keeps it alive; the client ignores 'ping' (empty data).
    // 10s (not 15s) leaves margin: this interval runs on the main event loop,
    // which other in-process warm builds can block ~20s at a time, stretching the
    // effective gap — at 10s nominal that stays well under the client's 60s and
    // nginx's 200s thresholds even when a tick is delayed.
    const heartbeat = setInterval(() => { void safeWrite({ event: 'ping', data: '' }); }, 10_000);

    try {
      // Tell the client whether the table is already in memory (warm) or has to
      // be loaded first (cold, ~20s) — shown live instead of a frozen request.
      const wasReady = isReady();
      if (!wasReady) await safeWrite({ event: 'loading', data: JSON.stringify({}) });
      try {
        await ensureDaemon();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await safeWrite({ event: 'error', data: JSON.stringify({ i: -1, phase: 'load', error: msg }) });
        await safeWrite({ event: 'done', data: JSON.stringify({ ok: 0, fail: scrambles.length }) });
        return;
      }
      // warm: loadMs absent; cold: the real spawn→READY time of the load just done.
      await safeWrite({ event: 'ready', data: JSON.stringify(wasReady ? { warm: true } : { warm: false, loadMs: getLastLoadMs() }) });

      let ok = 0;
      let fail = 0;
      // Solve sequentially — the daemon is serial anyway, and sequential keeps the
      // queue shallow + results ordered by completion (client re-sorts by index).
      for (let i = 0; i < scrambles.length; i++) {
        try {
          const { htm, solution } = await solveOptimal(scrambles[i]!, (state) => {
            // Tell the client whether it's WAITING in the queue (behind others) or
            // its solve has actually STARTED — so "排队中" vs "求解中" is honest.
            if (state.phase === 'queued') void safeWrite({ event: 'queued', data: JSON.stringify({ i, ahead: state.ahead }) });
            else void safeWrite({ event: 'solving', data: JSON.stringify({ i }) });
          });
          ok++;
          await safeWrite({ data: JSON.stringify({ i, htm, solution }) });
        } catch (e) {
          fail++;
          const msg = e instanceof Error ? e.message : String(e);
          await safeWrite({ event: 'error', data: JSON.stringify({ i, error: msg }) });
        }
      }
      await safeWrite({ event: 'done', data: JSON.stringify({ ok, fail }) });
    } finally {
      clearInterval(heartbeat);
    }
  });
});
