import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { query } from '../db/connection.js';
import { getIp } from '../utils/analytics_helpers.js';
import { checkRateLimit, requireAdminOrApiKey } from '../utils/recon_helpers.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OUTCOMES = ['attempt', 'success', 'failure'] as const;
const FAILURE_KINDS = ['network', 'chunk', 'script', 'promise', 'timeout', 'runtime', 'unknown'] as const;
const TIMER_PATHS = ['/timer', '/zh/timer'] as const;
const SUMMARY_WINDOWS = [7, 30, 90] as const;
const RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MIN_CHROMIUM_MAJOR = 111;
const MIN_GECKO_MAJOR = 111;
const MIN_WEBKIT_MAJOR = 16;
const MIN_WEBKIT_MINOR = 4;

export type TimerBootOutcome = typeof OUTCOMES[number];
export type TimerBootFailureKind = typeof FAILURE_KINDS[number];
export type TimerBootPath = typeof TIMER_PATHS[number];
export type TimerBootEngineFamily = 'chromium' | 'webkit' | 'gecko' | 'other';
export type TimerBootOsFamily = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other';
export type TimerBootContainer = 'wechat' | 'webview' | 'browser';
export type TimerBootSupportStatus = 'supported' | 'below-baseline' | 'unknown';

export interface TimerBootDimensions {
  engineFamily: TimerBootEngineFamily;
  engineMajor: number | null;
  osFamily: TimerBootOsFamily;
  osMajor: number | null;
  container: TimerBootContainer;
  supportStatus: TimerBootSupportStatus;
}

export interface TimerBootEvent {
  bootId: string;
  path: TimerBootPath;
  outcome: TimerBootOutcome;
  failureKind: TimerBootFailureKind | null;
}

export interface TimerBootCounts {
  attempts: number;
  successes: number;
  failures: number;
  incomplete: number;
  successRate: number | null;
  failureRate: number | null;
  incompleteRate: number | null;
}

export interface TimerBootMetricGroup extends TimerBootCounts {
  value: string;
  major: number | null;
}

export interface TimerBootSummary {
  generatedAt: string;
  retentionDays: number;
  windows: Array<TimerBootCounts & { days: number }>;
  breakdownDays: number;
  breakdowns: {
    supportStatus: TimerBootMetricGroup[];
    engine: TimerBootMetricGroup[];
    os: TimerBootMetricGroup[];
    container: TimerBootMetricGroup[];
  };
  failureKinds: Array<{ failureKind: TimerBootFailureKind; count: number }>;
}

export interface TimerBootTelemetryStore {
  record(event: TimerBootEvent, dimensions: TimerBootDimensions): Promise<void>;
  cleanupExpired(): Promise<void>;
  summarize(days: number, now: number): Promise<TimerBootSummary>;
}

export interface TimerBootTelemetryRouteOptions {
  store?: TimerBootTelemetryStore;
  now?: () => number;
  authorizeAdmin?: (c: Context) => Promise<unknown>;
  identifyIp?: (c: Context) => string;
  rateLimit?: (ip: string) => void;
}

interface RawTimerBootBody {
  version?: unknown;
  bootId?: unknown;
  outcome?: unknown;
  path?: unknown;
  failureKind?: unknown;
}

interface CountRow {
  days?: number | string;
  value?: string;
  major?: number | string | null;
  attempts: number | string;
  successes: number | string;
  failures: number | string;
  incomplete: number | string;
}

function majorVersion(userAgent: string, pattern: RegExp): number | null {
  const match = userAgent.match(pattern);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) ? value : null;
}

function webkitVersion(userAgent: string): { major: number; minor: number } | null {
  const match = userAgent.match(/Version\/(\d+)(?:\.(\d+))?/i);
  if (!match?.[1]) return null;
  return { major: Number(match[1]), minor: Number(match[2] ?? 0) };
}

function iosVersion(userAgent: string): { major: number; minor: number } | null {
  const match = userAgent.match(/(?:CPU (?:iPhone )?OS|iPhone OS) (\d+)[._](\d+)/i);
  if (match?.[1]) return { major: Number(match[1]), minor: Number(match[2] ?? 0) };
  return webkitVersion(userAgent);
}

export function classifyTimerBootUserAgent(userAgent: string): TimerBootDimensions {
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || /Macintosh[^)]*Mobile/i.test(userAgent);
  const android = /Android/i.test(userAgent);
  const wechat = /MicroMessenger/i.test(userAgent);
  const androidWebView = android && (/;\s*wv[;) ]/i.test(userAgent) || /Version\/4\.0[^)]*Chrome\//i.test(userAgent));
  const detectedIosVersion = ios ? iosVersion(userAgent) : null;

  let osFamily: TimerBootOsFamily = 'other';
  let osMajor: number | null = null;
  if (ios) {
    osFamily = 'ios';
    osMajor = detectedIosVersion?.major ?? null;
  } else if (android) {
    osFamily = 'android';
    osMajor = majorVersion(userAgent, /Android (\d+)/i);
  } else if (/Windows NT/i.test(userAgent)) {
    osFamily = 'windows';
    osMajor = majorVersion(userAgent, /Windows NT (\d+)/i);
  } else if (/Mac OS X/i.test(userAgent)) {
    osFamily = 'macos';
    osMajor = majorVersion(userAgent, /Mac OS X (\d+)[._]/i);
  } else if (/Linux/i.test(userAgent)) {
    osFamily = 'linux';
  }

  let engineFamily: TimerBootEngineFamily = 'other';
  let engineMajor: number | null = null;
  const safariVersion = webkitVersion(userAgent);
  if (ios) {
    engineFamily = 'webkit';
    engineMajor = safariVersion?.major ?? null;
  } else {
    const chromiumMajor = majorVersion(userAgent, /(?:EdgA?|Chrome|Chromium)\/(\d+)/i);
    const geckoMajor = majorVersion(userAgent, /Firefox\/(\d+)/i);
    if (chromiumMajor !== null) {
      engineFamily = 'chromium';
      engineMajor = chromiumMajor;
    } else if (geckoMajor !== null) {
      engineFamily = 'gecko';
      engineMajor = geckoMajor;
    } else if (/AppleWebKit/i.test(userAgent)) {
      engineFamily = 'webkit';
      engineMajor = safariVersion?.major ?? null;
    }
  }

  let supportStatus: TimerBootSupportStatus = 'unknown';
  if (ios && detectedIosVersion) {
    supportStatus = detectedIosVersion.major > MIN_WEBKIT_MAJOR
      || (detectedIosVersion.major === MIN_WEBKIT_MAJOR && detectedIosVersion.minor >= MIN_WEBKIT_MINOR)
      ? 'supported'
      : 'below-baseline';
  } else if (engineFamily === 'chromium' && engineMajor !== null) {
    supportStatus = engineMajor < MIN_CHROMIUM_MAJOR ? 'below-baseline' : 'supported';
  } else if (engineFamily === 'gecko' && engineMajor !== null) {
    supportStatus = engineMajor < MIN_GECKO_MAJOR ? 'below-baseline' : 'supported';
  } else if (engineFamily === 'webkit' && safariVersion) {
    supportStatus = safariVersion.major > MIN_WEBKIT_MAJOR
      || (safariVersion.major === MIN_WEBKIT_MAJOR && safariVersion.minor >= MIN_WEBKIT_MINOR)
      ? 'supported'
      : 'below-baseline';
  }

  return {
    engineFamily,
    engineMajor,
    osFamily,
    osMajor,
    container: wechat ? 'wechat' : androidWebView ? 'webview' : 'browser',
    supportStatus,
  };
}

function toCount(value: number | string): number {
  return Number(value);
}

function countsOf(row: CountRow): TimerBootCounts {
  const attempts = toCount(row.attempts);
  const successes = toCount(row.successes);
  const failures = toCount(row.failures);
  const incomplete = toCount(row.incomplete);
  const rate = (value: number) => attempts === 0 ? null : Number((value / attempts).toFixed(6));
  return {
    attempts,
    successes,
    failures,
    incomplete,
    successRate: rate(successes),
    failureRate: rate(failures),
    incompleteRate: rate(incomplete),
  };
}

async function queryBreakdown(
  days: number,
  valueColumn: 'support_status' | 'engine_family' | 'os_family' | 'container',
  majorColumn: 'engine_major' | 'os_major' | null,
): Promise<TimerBootMetricGroup[]> {
  const major = majorColumn ? `, ${majorColumn}` : '';
  const rows = await query<CountRow>(
    `SELECT ${valueColumn} AS value${major ? `, ${majorColumn} AS major` : ', NULL::SMALLINT AS major'},
            COUNT(*)::INTEGER AS attempts,
            COUNT(*) FILTER (WHERE outcome = 'success')::INTEGER AS successes,
            COUNT(*) FILTER (WHERE outcome = 'failure')::INTEGER AS failures,
            COUNT(*) FILTER (WHERE outcome = 'attempt')::INTEGER AS incomplete
       FROM timer_boot_events
      WHERE attempted_at >= NOW() - (? * INTERVAL '1 day')
      GROUP BY ${valueColumn}${major}
      ORDER BY attempts DESC, ${valueColumn} ASC${majorColumn ? `, ${majorColumn} ASC NULLS LAST` : ''}`,
    [days],
  );
  return rows.map((row) => ({
    value: row.value ?? 'unknown',
    major: row.major === null || row.major === undefined ? null : Number(row.major),
    ...countsOf(row),
  }));
}

export const timerBootTelemetryStore: TimerBootTelemetryStore = {
  async record(event, dimensions) {
    await query(
      `INSERT INTO timer_boot_events
         (boot_id, path, outcome, failure_kind, engine_family, engine_major,
          os_family, os_major, container, support_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (boot_id) DO UPDATE SET
         outcome = CASE
           WHEN timer_boot_events.outcome = 'failure' OR EXCLUDED.outcome = 'failure' THEN 'failure'
           WHEN timer_boot_events.outcome = 'success' OR EXCLUDED.outcome = 'success' THEN 'success'
           ELSE 'attempt'
         END,
         failure_kind = CASE
           WHEN timer_boot_events.outcome = 'failure' THEN timer_boot_events.failure_kind
           WHEN EXCLUDED.outcome = 'failure' THEN EXCLUDED.failure_kind
           ELSE NULL
         END,
         updated_at = NOW()`,
      [
        event.bootId,
        event.path,
        event.outcome,
        event.failureKind,
        dimensions.engineFamily,
        dimensions.engineMajor,
        dimensions.osFamily,
        dimensions.osMajor,
        dimensions.container,
        dimensions.supportStatus,
      ],
    );
  },

  async cleanupExpired() {
    await query(`DELETE FROM timer_boot_events WHERE attempted_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`);
  },

  async summarize(days, now) {
    const windows = await query<CountRow>(
      `WITH windows(days) AS (VALUES (7), (30), (90))
       SELECT windows.days,
              COUNT(events.boot_id)::INTEGER AS attempts,
              COUNT(events.boot_id) FILTER (WHERE events.outcome = 'success')::INTEGER AS successes,
              COUNT(events.boot_id) FILTER (WHERE events.outcome = 'failure')::INTEGER AS failures,
              COUNT(events.boot_id) FILTER (WHERE events.outcome = 'attempt')::INTEGER AS incomplete
         FROM windows
         LEFT JOIN timer_boot_events events
           ON events.attempted_at >= NOW() - (windows.days * INTERVAL '1 day')
        GROUP BY windows.days
        ORDER BY windows.days`,
    );
    const [supportStatus, engine, os, container, failureKindRows] = await Promise.all([
      queryBreakdown(days, 'support_status', null),
      queryBreakdown(days, 'engine_family', 'engine_major'),
      queryBreakdown(days, 'os_family', 'os_major'),
      queryBreakdown(days, 'container', null),
      query<{ failure_kind: TimerBootFailureKind; count: number | string }>(
        `SELECT failure_kind, COUNT(*)::INTEGER AS count
           FROM timer_boot_events
          WHERE attempted_at >= NOW() - (? * INTERVAL '1 day')
            AND outcome = 'failure'
          GROUP BY failure_kind
          ORDER BY count DESC, failure_kind ASC`,
        [days],
      ),
    ]);
    return {
      generatedAt: new Date(now).toISOString(),
      retentionDays: RETENTION_DAYS,
      windows: windows.map((row) => ({ days: Number(row.days), ...countsOf(row) })),
      breakdownDays: days,
      breakdowns: { supportStatus, engine, os, container },
      failureKinds: failureKindRows.map((row) => ({
        failureKind: row.failure_kind,
        count: Number(row.count),
      })),
    };
  },
};

function parseBody(value: unknown): TimerBootEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as RawTimerBootBody & Record<string, unknown>;
  const allowedKeys = new Set(['version', 'bootId', 'outcome', 'path', 'failureKind']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) return null;
  if (body.version !== 1 || typeof body.bootId !== 'string' || !UUID_RE.test(body.bootId)) return null;
  if (!OUTCOMES.includes(body.outcome as TimerBootOutcome)) return null;
  if (!TIMER_PATHS.includes(body.path as TimerBootPath)) return null;
  const outcome = body.outcome as TimerBootOutcome;
  if (outcome === 'failure') {
    if (!FAILURE_KINDS.includes(body.failureKind as TimerBootFailureKind)) return null;
  } else if (body.failureKind !== null && body.failureKind !== undefined) {
    return null;
  }
  return {
    bootId: body.bootId,
    path: body.path as TimerBootPath,
    outcome,
    failureKind: outcome === 'failure' ? body.failureKind as TimerBootFailureKind : null,
  };
}

export function createTimerBootTelemetryRoutes(options: TimerBootTelemetryRouteOptions = {}) {
  const routes = new Hono();
  const store = options.store ?? timerBootTelemetryStore;
  const now = options.now ?? Date.now;
  const authorizeAdmin = options.authorizeAdmin ?? requireAdminOrApiKey;
  const identifyIp = options.identifyIp ?? getIp;
  const rateLimit = options.rateLimit ?? ((ip: string) => {
    checkRateLimit(ip, { bucket: 'timer-boot-events', max: 600 });
  });
  let lastCleanupAt = Number.NEGATIVE_INFINITY;

  routes.post(
    '/timer/boot-events',
    bodyLimit({
      maxSize: 2048,
      onError: (c) => c.json({ error: 'Payload too large' }, 413),
    }),
    async (c) => {
      c.header('Cache-Control', 'no-store');
      rateLimit(identifyIp(c));
      let raw: unknown;
      try {
        raw = JSON.parse(await c.req.text());
      } catch {
        return c.json({ error: 'invalid json' }, 400);
      }
      const event = parseBody(raw);
      if (!event) return c.json({ error: 'invalid timer boot event' }, 400);

      const at = now();
      if (at - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
        lastCleanupAt = at;
        await store.cleanupExpired();
      }
      await store.record(event, classifyTimerBootUserAgent(c.req.header('User-Agent') ?? ''));
      return c.body(null, 204);
    },
  );

  routes.get('/timer/boot-stats', async (c) => {
    c.header('Cache-Control', 'no-store');
    await authorizeAdmin(c);
    const rawDays = c.req.query('days') ?? '30';
    const days = Number(rawDays);
    if (!SUMMARY_WINDOWS.includes(days as typeof SUMMARY_WINDOWS[number]) || String(days) !== rawDays) {
      return c.json({ error: 'days must be 7, 30, or 90' }, 400);
    }
    return c.json(await store.summarize(days, now()));
  });

  return routes;
}

export const timerBootTelemetryRoutes = createTimerBootTelemetryRoutes();
