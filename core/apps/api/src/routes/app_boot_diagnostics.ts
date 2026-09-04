import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { query } from '../db/connection.js';
import { getIp } from '../utils/analytics_helpers.js';
import { checkRateLimit, requireAdminOrApiKey } from '../utils/recon_helpers.js';
import { classifyUserAgent, type UserAgentDimensions } from '../utils/user_agent.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_RE = /^(APP|TMR)-(NET|CHUNK|SCRIPT|PROMISE|TIMEOUT|RUNTIME|UNKNOWN)-[0-9A-Z]{7}$/;
const KINDS = ['network', 'chunk', 'script', 'promise', 'timeout', 'runtime', 'unknown'] as const;
const SOURCES = ['error', 'unhandledrejection', 'import', 'runtime'] as const;
const RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_PATH_LENGTH = 512;
const MAX_NAME_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 500;
const MAX_EVIDENCE = 4;

type DiagnosticKind = typeof KINDS[number];
type EvidenceSource = typeof SOURCES[number];

export interface AppBootEvidence {
  source: EvidenceSource;
  name: string;
  message: string;
  url?: string;
}

export interface AppBootDiagnosticEvent {
  eventId: string;
  code: string;
  kind: DiagnosticKind;
  path: string;
  online: boolean | null;
  errorName: string;
  errorMessage: string;
  evidence: AppBootEvidence[];
}

export interface AppBootDiagnosticStore {
  record(event: AppBootDiagnosticEvent, dimensions: UserAgentDimensions): Promise<void>;
  cleanupExpired(): Promise<void>;
  find(code: string, limit: number): Promise<unknown[]>;
}

export interface AppBootDiagnosticRouteOptions {
  store?: AppBootDiagnosticStore;
  now?: () => number;
  authorizeAdmin?: (c: Context) => Promise<unknown>;
  identifyIp?: (c: Context) => string;
  rateLimit?: (ip: string) => void;
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-token]')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanUrl(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? `${parsed.origin}${parsed.pathname}`.slice(0, MAX_MESSAGE_LENGTH)
      : null;
  } catch {
    return null;
  }
}

function parseEvent(value: unknown): AppBootDiagnosticEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const allowed = new Set(['version', 'eventId', 'code', 'kind', 'path', 'online', 'errorName', 'errorMessage', 'evidence']);
  if (Object.keys(body).some((key) => !allowed.has(key)) || body.version !== 1) return null;
  if (typeof body.eventId !== 'string' || !UUID_RE.test(body.eventId)) return null;
  if (typeof body.code !== 'string' || !CODE_RE.test(body.code)) return null;
  if (typeof body.kind !== 'string' || !KINDS.includes(body.kind as DiagnosticKind)) return null;
  const expectedTag = body.kind === 'network' ? 'NET' : body.kind.toUpperCase();
  if (!body.code.includes(`-${expectedTag}-`)) return null;
  if (typeof body.path !== 'string' || body.path.length > MAX_PATH_LENGTH
    || !body.path.startsWith('/') || /[?#\r\n]/.test(body.path)) return null;
  if (body.online !== null && typeof body.online !== 'boolean') return null;
  const errorName = cleanText(body.errorName, MAX_NAME_LENGTH);
  const errorMessage = cleanText(body.errorMessage, MAX_MESSAGE_LENGTH);
  if (!errorName || !errorMessage || !Array.isArray(body.evidence) || body.evidence.length > MAX_EVIDENCE) return null;

  const evidence: AppBootEvidence[] = [];
  for (const raw of body.evidence) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (Object.keys(item).some((key) => !['source', 'name', 'message', 'url'].includes(key))) return null;
    if (typeof item.source !== 'string' || !SOURCES.includes(item.source as EvidenceSource)) return null;
    const name = cleanText(item.name, MAX_NAME_LENGTH);
    const message = cleanText(item.message, MAX_MESSAGE_LENGTH);
    const url = cleanUrl(item.url);
    if (!name || !message || url === null) return null;
    evidence.push({ source: item.source as EvidenceSource, name, message, ...(url ? { url } : {}) });
  }

  return {
    eventId: body.eventId,
    code: body.code,
    kind: body.kind as DiagnosticKind,
    path: body.path,
    online: body.online as boolean | null,
    errorName,
    errorMessage,
    evidence,
  };
}

interface DiagnosticRow {
  event_id: string;
  diagnostic_code: string;
  kind: DiagnosticKind;
  path: string;
  online: boolean | null;
  error_name: string;
  error_message: string;
  evidence: AppBootEvidence[];
  device_type: string;
  browser_family: string;
  browser_major: number | null;
  os_family: string;
  os_major: number | null;
  received_at: string;
}

export const appBootDiagnosticStore: AppBootDiagnosticStore = {
  async record(event, dimensions) {
    await query(
      `INSERT INTO app_boot_diagnostics
         (event_id, diagnostic_code, kind, path, online, error_name, error_message, evidence,
          device_type, browser_family, browser_major, os_family, os_major)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        event.eventId, event.code, event.kind, event.path, event.online,
        event.errorName, event.errorMessage, event.evidence,
        dimensions.deviceType, dimensions.browserFamily, dimensions.browserMajor,
        dimensions.osFamily, dimensions.osMajor,
      ],
    );
  },

  async cleanupExpired() {
    await query(`DELETE FROM app_boot_diagnostics WHERE received_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`);
  },

  async find(code, limit) {
    const rows = await query<DiagnosticRow>(
      `SELECT event_id, diagnostic_code, kind, path, online, error_name, error_message, evidence,
              device_type, browser_family, browser_major, os_family, os_major, received_at
         FROM app_boot_diagnostics
        WHERE diagnostic_code = ?
        ORDER BY received_at DESC
        LIMIT ?`,
      [code, limit],
    );
    return rows.map((row) => ({
      eventId: row.event_id,
      code: row.diagnostic_code,
      kind: row.kind,
      path: row.path,
      online: row.online,
      errorName: row.error_name,
      errorMessage: row.error_message,
      evidence: row.evidence,
      device: {
        type: row.device_type,
        browser: row.browser_family,
        browserMajor: row.browser_major,
        os: row.os_family,
        osMajor: row.os_major,
      },
      receivedAt: row.received_at,
    }));
  },
};

export function createAppBootDiagnosticRoutes(options: AppBootDiagnosticRouteOptions = {}) {
  const routes = new Hono();
  const store = options.store ?? appBootDiagnosticStore;
  const now = options.now ?? Date.now;
  const authorizeAdmin = options.authorizeAdmin ?? requireAdminOrApiKey;
  const identifyIp = options.identifyIp ?? getIp;
  const rateLimit = options.rateLimit ?? ((ip: string) => checkRateLimit(ip, { bucket: 'app-boot-diagnostics', max: 120 }));
  let lastCleanupAt = Number.NEGATIVE_INFINITY;

  routes.post('/app/boot-diagnostics', bodyLimit({
    maxSize: 8192,
    onError: (c) => c.json({ error: 'Payload too large' }, 413),
  }), async (c) => {
    c.header('Cache-Control', 'no-store');
    rateLimit(identifyIp(c));
    let raw: unknown;
    try {
      raw = JSON.parse(await c.req.text());
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    const event = parseEvent(raw);
    if (!event) return c.json({ error: 'invalid app boot diagnostic' }, 400);
    const at = now();
    if (at - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
      lastCleanupAt = at;
      await store.cleanupExpired();
    }
    await store.record(event, classifyUserAgent(c.req.header('User-Agent') ?? ''));
    return c.body(null, 204);
  });

  routes.get('/app/boot-diagnostics', async (c) => {
    c.header('Cache-Control', 'no-store');
    await authorizeAdmin(c);
    const code = c.req.query('code') ?? '';
    const rawLimit = c.req.query('limit') ?? '20';
    const limit = Number(rawLimit);
    if (!CODE_RE.test(code)) return c.json({ error: 'valid diagnostic code required' }, 400);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || String(limit) !== rawLimit) {
      return c.json({ error: 'limit must be an integer from 1 to 100' }, 400);
    }
    return c.json({ code, retentionDays: RETENTION_DAYS, events: await store.find(code, limit) });
  });

  return routes;
}

export const appBootDiagnosticRoutes = createAppBootDiagnosticRoutes();
