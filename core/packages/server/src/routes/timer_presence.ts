import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getIp } from '../utils/analytics_helpers';
import { optionalAuth, requireAdmin, type WcaUser } from '../utils/recon_helpers';

/** A visible timer tab refreshes its short-lived entry every 10 seconds. */
export const TIMER_PRESENCE_TTL_MS = 30_000;
const MAX_ENTRIES = 20_000;
const MAX_RESULTS = 4;
const MAX_DEVICES = 4;
const MAX_RESULT_MS = 24 * 60 * 60 * 1000;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TimerPresenceResult {
  label?: string;
  event: string;
  timeMs: number;
  penalty: 'ok' | '+2' | 'DNF' | 'DNS' | 'dnf';
  at?: number;
}

export interface TimerPresenceDevice {
  name: string;
  id?: string;
}

export interface TimerPresenceAccount {
  ownerId: string;
  name: string;
  wcaId?: string;
}

export interface TimerPresenceSession {
  sessionId: string;
  normal: number;
  smart: number;
  mode: 'solo' | 'local' | 'net';
  ip: string;
  account: TimerPresenceAccount | null;
  results: TimerPresenceResult[];
  devices: TimerPresenceDevice[];
  seenAt: number;
}

export interface TimerPresenceSnapshot {
  normal: number;
  smart: number;
  total: number;
  sessions: TimerPresenceSession[];
}

interface PresenceEntry extends Omit<TimerPresenceSession, 'sessionId'> {}

interface TimerPresenceBody {
  id?: unknown;
  normal?: unknown;
  smart?: unknown;
  mode?: unknown;
  results?: unknown;
  devices?: unknown;
}

interface TimerPresenceRouteOptions {
  now?: () => number;
  maxEntries?: number;
  authorizeAdmin?: (c: Context) => Promise<unknown>;
  identifyUser?: (c: Context) => Promise<WcaUser | null>;
  identifyIp?: (c: Context) => string;
}

function shortString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

function parseResults(value: unknown): TimerPresenceResult[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_RESULTS) return null;
  const results: TimerPresenceResult[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const event = shortString(r.event, 32);
    const label = r.label === undefined ? undefined : shortString(r.label, 24);
    const penalty = r.penalty;
    if (!event || (r.label !== undefined && !label)) return null;
    if (!Number.isInteger(r.timeMs) || (r.timeMs as number) < 0 || (r.timeMs as number) > MAX_RESULT_MS) return null;
    if (!['ok', '+2', 'DNF', 'DNS', 'dnf'].includes(String(penalty))) return null;
    if (r.at !== undefined && (!Number.isInteger(r.at) || (r.at as number) < 0)) return null;
    results.push({
      event,
      timeMs: r.timeMs as number,
      penalty: penalty as TimerPresenceResult['penalty'],
      ...(label ? { label } : {}),
      ...(r.at === undefined ? {} : { at: r.at as number }),
    });
  }
  return results;
}

function parseDevices(value: unknown): TimerPresenceDevice[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_DEVICES) return null;
  const devices: TimerPresenceDevice[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const d = raw as Record<string, unknown>;
    const name = shortString(d.name, 128);
    const id = d.id === undefined ? undefined : shortString(d.id, 128);
    if (!name || (d.id !== undefined && !id)) return null;
    devices.push({ name, ...(id ? { id } : {}) });
  }
  return devices;
}

function accountOf(user: WcaUser | null): TimerPresenceAccount | null {
  if (!user) return null;
  return {
    ownerId: user.wcaId,
    name: user.name,
    ...(user.realWcaId ? { wcaId: user.realWcaId } : {}),
  };
}

/**
 * Process-local storage is deliberate: these are live sessions, not a history
 * archive. Restarts clear them and stale sessions disappear after 30 seconds.
 * Account and IP fields are always server-derived; the request body cannot
 * impersonate either one.
 */
export function createTimerPresenceRoutes(options: TimerPresenceRouteOptions = {}) {
  const routes = new Hono();
  const entries = new Map<string, PresenceEntry>();
  const now = options.now ?? Date.now;
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;
  const authorizeAdmin = options.authorizeAdmin ?? requireAdmin;
  const identifyUser = options.identifyUser ?? optionalAuth;
  const identifyIp = options.identifyIp ?? getIp;

  const prune = (at: number) => {
    for (const [id, entry] of entries) {
      if (at - entry.seenAt >= TIMER_PRESENCE_TTL_MS) entries.delete(id);
    }
  };

  const snapshot = (at: number): TimerPresenceSnapshot => {
    prune(at);
    let normal = 0;
    let smart = 0;
    const sessions: TimerPresenceSession[] = [];
    for (const [sessionId, entry] of entries) {
      normal += entry.normal;
      smart += entry.smart;
      sessions.push({ sessionId, ...entry });
    }
    sessions.sort((a, b) => b.seenAt - a.seenAt);
    return { normal, smart, total: normal + smart, sessions };
  };

  routes.get('/timer/presence', async (c) => {
    c.header('Cache-Control', 'no-store');
    await authorizeAdmin(c);
    return c.json(snapshot(now()));
  });

  routes.post(
    '/timer/presence',
    bodyLimit({
      maxSize: 4096,
      onError: (c) => c.json({ error: 'Payload too large' }, 413),
    }),
    async (c) => {
      c.header('Cache-Control', 'no-store');
      let body: TimerPresenceBody;
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
        return c.body(null, 204);
      }

      const mode = body.mode === undefined ? 'solo' : body.mode;
      if (!['solo', 'local', 'net'].includes(String(mode))) {
        return c.json({ error: 'invalid timer mode' }, 400);
      }
      const results = parseResults(body.results);
      const devices = parseDevices(body.devices);
      if (!results || !devices) return c.json({ error: 'invalid presence details' }, 400);
      if (!entries.has(body.id) && entries.size >= maxEntries) {
        return c.json({ error: 'presence capacity reached' }, 503);
      }

      const user = await identifyUser(c);
      entries.set(body.id, {
        normal,
        smart,
        mode: mode as TimerPresenceSession['mode'],
        ip: identifyIp(c),
        account: accountOf(user),
        results,
        devices,
        seenAt: at,
      });
      return c.body(null, 204);
    },
  );

  return routes;
}

export const timerPresenceRoutes = createTimerPresenceRoutes();
