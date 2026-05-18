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
 * GET /v1/scramble/555-rs            → { scramble: "Rw U2 ..." }            (200)
 *                                    → { error: "..." }                    (503)
 * GET /v1/scramble/555-rs/ready      → { ready: boolean }                   (200)
 */
import { Hono } from 'hono';
import { getScramble, isReady } from '../cube555/daemon.js';

export const scramble555Routes = new Hono();

const NO_CACHE = { 'Cache-Control': 'no-store' };

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
