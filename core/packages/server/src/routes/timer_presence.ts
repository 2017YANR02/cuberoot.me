import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

/** A visible timer tab refreshes its anonymous entry every 10 seconds. */
export const TIMER_PRESENCE_TTL_MS = 30_000;
const MAX_ENTRIES = 20_000;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TimerPresenceSnapshot {
  normal: number;
  smart: number;
  total: number;
}

interface PresenceEntry {
  normal: number;
  smart: number;
  seenAt: number;
}

interface TimerPresenceRouteOptions {
  now?: () => number;
  maxEntries?: number;
}

/**
 * Process-local presence is deliberate: the API runs as one process and this data
 * is short-lived. A restart clears the panel for at most one heartbeat, while no
 * account, IP address, device name, solve, or Bluetooth identifier is retained.
 */
export function createTimerPresenceRoutes(options: TimerPresenceRouteOptions = {}) {
  const routes = new Hono();
  const entries = new Map<string, PresenceEntry>();
  const now = options.now ?? Date.now;
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;

  const prune = (at: number) => {
    for (const [id, entry] of entries) {
      if (at - entry.seenAt >= TIMER_PRESENCE_TTL_MS) entries.delete(id);
    }
  };

  const snapshot = (at: number): TimerPresenceSnapshot => {
    prune(at);
    let normal = 0;
    let smart = 0;
    for (const entry of entries.values()) {
      normal += entry.normal;
      smart += entry.smart;
    }
    return { normal, smart, total: normal + smart };
  };

  routes.get('/timer/presence', (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(snapshot(now()));
  });

  routes.post(
    '/timer/presence',
    bodyLimit({
      maxSize: 1024,
      onError: (c) => c.json({ error: 'Payload too large' }, 413),
    }),
    async (c) => {
      c.header('Cache-Control', 'no-store');
      let body: { id?: unknown; normal?: unknown; smart?: unknown };
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: 'invalid json' }, 400);
      }

      if (typeof body.id !== 'string' || !ID_RE.test(body.id)) {
        return c.json({ error: 'invalid presence id' }, 400);
      }
      if (!Number.isInteger(body.normal) || !Number.isInteger(body.smart)) {
        return c.json({ error: 'normal and smart must be integers' }, 400);
      }
      const normal = body.normal as number;
      const smart = body.smart as number;
      const total = normal + smart;
      if (normal < 0 || smart < 0 || total > 4) {
        return c.json({ error: 'presence counts must total 0 to 4' }, 400);
      }

      const at = now();
      prune(at);
      if (total === 0) {
        entries.delete(body.id);
      } else {
        if (!entries.has(body.id) && entries.size >= maxEntries) {
          return c.json({ error: 'presence capacity reached' }, 503);
        }
        entries.set(body.id, { normal, smart, seenAt: at });
      }
      return c.json(snapshot(at));
    },
  );

  return routes;
}

export const timerPresenceRoutes = createTimerPresenceRoutes();
