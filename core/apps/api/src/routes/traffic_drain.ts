import { createHmac, timingSafeEqual } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

export const trafficDrainRoutes = new Hono();

type DrainRecord = Record<string, unknown>;

function signed(raw: string, header: string | undefined, secret: string): boolean {
  if (!/^[a-f0-9]{40}$/i.test(header || '')) return false;
  const expected = createHmac('sha1', secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(header!, 'hex'));
}

function groupedPath(raw: string): string | null {
  let pathname: string;
  try { pathname = new URL(raw, 'https://cuberoot.me').pathname; } catch { return null; }
  const parts = pathname.split('/').filter(Boolean);
  const locale = parts[0] === 'zh' || parts[0] === 'en' ? `/${parts.shift()}` : '';
  if (parts.length === 0) return locale || '/';
  const safeRoots = new Set(['about', 'account', 'achievements', 'alg', 'alg-trainers', 'auth', 'calc', 'calc-about', 'comp-sim', 'cstimer', 'dev', 'docs', 'frame-count', 'math', 'membership', 'memo', 'mosaic', 'music', 'pets', 'predict', 'quiz', 'recon', 'recognize', 'scramble', 'sim', 'site', 'solver', 'support', 'timer', 'tutorial', 'wca', 'wiki']);
  if (!safeRoots.has(parts[0])) return `${locale}/:other`;
  if (parts[0] === 'wca' && ['persons', 'comp'].includes(parts[1] || '') && parts[2]) return `${locale}/wca/${parts[1]}/:id`;
  const subroutes: Record<string, string[]> = {
    wca: ['results', 'comp', 'persons', 'records', 'fun-stats', 'prediction'],
    alg: ['2x2', '3x3', '4x4', '5x5', 'sq1', 'fto', 'megaminx', 'pyraminx', 'skewb'],
    scramble: ['gen', 'solver', 'analyzer', 'stats', 'batch-solver'],
    math: ['cube-graph', 'group'],
  };
  if (subroutes[parts[0]]?.includes(parts[1])) {
    return `${locale}/${parts[0]}/${parts[1]}${parts.length > 2 ? '/:detail' : ''}`;
  }
  return `${locale}/${parts[0]}${parts.length > 1 ? '/:detail' : ''}`;
}

function groupedReferrer(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? `https://${url.hostname.toLowerCase().slice(0, 120)}/` : '';
  } catch { return ''; }
}

export function sanitizeDrainRecord(record: DrainRecord): Record<string, unknown> | null {
  if (record.environment && record.environment !== 'production') return null;
  const proxy = record.proxy as DrainRecord | undefined;
  if (!proxy || proxy.host !== 'cuberoot.me' || typeof proxy.path !== 'string' || typeof proxy.timestamp !== 'number') return null;
  const id = typeof proxy.vercelId === 'string' && proxy.vercelId ? proxy.vercelId : record.id;
  if (typeof id !== 'string' || !id || id.length > 160) return null;
  const path = groupedPath(proxy.path);
  if (!path || !Number.isFinite(proxy.timestamp)) return null;
  const agent = Array.isArray(proxy.userAgent) ? proxy.userAgent[0] : proxy.userAgent;
  return {
    schema: 'cuberoot.traffic.v1', id, timestamp: proxy.timestamp,
    path, method: typeof proxy.method === 'string' ? proxy.method.slice(0, 12) : '',
    status: typeof proxy.statusCode === 'number' ? proxy.statusCode : 0,
    referrer: groupedReferrer(proxy.referer),
    userAgent: typeof agent === 'string' && /bot|spider|crawler|slurp|headless/i.test(agent) ? 'self-declared bot' : 'other',
  };
}

trafficDrainRoutes.post('/ops/traffic/drain', bodyLimit({ maxSize: 2 * 1024 * 1024, onError: c => c.json({ error: 'too_large' }, 413) }), async c => {
  const secret = process.env.VERCEL_TRAFFIC_DRAIN_SECRET;
  if (!secret) return c.json({ error: 'not_configured' }, 503);
  const raw = await c.req.text();
  if (!signed(raw, c.req.header('x-vercel-signature'), secret)) return c.json({ error: 'invalid_signature' }, 403);
  let records: unknown;
  try { records = JSON.parse(raw); } catch { return c.json({ error: 'invalid_json' }, 400); }
  if (!Array.isArray(records) || records.length > 10_000) return c.json({ error: 'invalid_batch' }, 400);
  const lines = records.map(record => record && typeof record === 'object' ? sanitizeDrainRecord(record as DrainRecord) : null).filter(Boolean);
  if (lines.length > 0) {
    const path = process.env.TRAFFIC_DRAIN_PATH || '/var/lib/cuberoot/traffic/vercel.ndjson';
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await appendFile(path, `${lines.map(line => JSON.stringify(line)).join('\n')}\n`, { mode: 0o600 });
  }
  return c.json({ accepted: lines.length });
});
