// Root-only server timer. Persist native WAF ban events as exact-IP rules for 30 days.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
const DAY = 86400000;
export const MANAGED_NAME = 'Rolling 30-day incident IP bans';
export const SOURCES = new Set(['rule_auto_ban_sensitive_file_scanners_for_1h_u5zqIL', 'rule_incident_rotating_browser_scraper_ban_30_days_S2oBpk']);
export type Ledger = { cursor: number; bans: Record<string, number>; ruleId?: string };
type BanEvent = { startTime: string; public_ip: string; ruleId: string; action: string };
export function absorb(state: Ledger, events: BanEvent[], now: number) {
  for (const [ip, expiry] of Object.entries(state.bans)) if (!isIP(ip) || !Number.isFinite(expiry) || expiry <= now) delete state.bans[ip];
  for (const event of events) {
    if (event.action !== 'deny' || !SOURCES.has(event.ruleId) || !isIP(event.public_ip)) continue;
    const started = Date.parse(event.startTime.replace(' ', 'T') + (/Z$|[+-]\d\d:\d\d$/.test(event.startTime) ? '' : 'Z'));
    if (!Number.isFinite(started) || started > now + 60000 || started + 30 * DAY <= now) continue;
    // Repeated API reads and native 24h renewals must not extend an active ban.
    state.bans[event.public_ip] ??= started + 30 * DAY;
  }
  return state;
}
export function managedRule(ips: string[]) {
  if (ips.length > 10000) throw new Error('30-day IP list exceeds 10000: preserve existing rule; operator review required');
  return {
    name: MANAGED_NAME, description: 'Server-managed 30-day exact-IP bans from sensitive-file and incident scraper rules. CN exempt. Do not edit manually.',
    active: ips.length > 0,
    conditionGroup: [{ conditions: [{ type: 'ip_address', op: 'inc', value: ips.length ? ips : ['192.0.2.1'] }, { type: 'geo_country', op: 'neq', value: 'CN' }] }],
    action: { mitigate: { action: 'deny', actionDuration: null } },
  };
}
export async function run() {
  const root = process.env.CUBEROOT_BAN_STATE_DIR || '/var/lib/cuberoot-vercel-bans';
  const config = JSON.parse(readFileSync(process.env.CUBEROOT_BAN_CONFIG || '/etc/cuberoot-vercel-bans.json', 'utf8'));
  const now = Date.now();
  mkdirSync(root, { recursive: true, mode: 0o700 });
  let state: Ledger;
  try { state = JSON.parse(readFileSync(`${root}/state.json`, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; state = { cursor: now - 15 * 60000, bans: {} }; }
  if (!Number.isFinite(state.cursor) || !state.bans || typeof state.bans !== 'object') throw new Error('Invalid ban ledger; preserve current rules');
  const query = new URLSearchParams({ projectId: config.projectId, teamId: config.teamId });
  async function api(path: string, method = 'GET', body?: unknown, extra?: Record<string, string>) {
    const q = new URLSearchParams(query); for (const [key, value] of Object.entries(extra || {})) q.set(key, value);
    const response = await fetch(`https://api.vercel.com/v1/security/firewall/${path}?${q}`, {
      method, headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Vercel ${method} ${path}: HTTP ${response.status}`);
    return response.json();
  }
  // One-minute windows prevent a large overlap query silently losing events.
  // Re-read two minutes for ingestion delay. A gap >24h is reported, never hidden.
  if (now - state.cursor > DAY) throw new Error('WAF event gap exceeds 24h; manual recovery required');
  let cursor = Math.max(state.cursor - 120000, now - DAY);
  let windows = 0;
  absorb(state, [], now);
  while (cursor < now && windows++ < 30) {
    const end = Math.min(cursor + 60000, now);
    const result = await api('events', 'GET', undefined, { startTimestamp: String(cursor), endTimestamp: String(end) });
    if (!Array.isArray(result.actions)) throw new Error('Invalid event response');
    if (result.actions.length >= 1000) throw new Error('Event window possibly truncated; preserve cursor and retry after review');
    absorb(state, result.actions, now);
    cursor = end;
  }
  state.cursor = Math.max(state.cursor, cursor);
  const ips = Object.keys(state.bans).sort();
  const value = managedRule(ips);
  const active = await api('config/active');
  if (active.rules?.[0]?.id !== 'rule_china_mainland_traffic_exemption_aOC64j') throw new Error('China exemption order changed; operator review required');
  let existing = active.rules.find((r: {name: string}) => r.name === MANAGED_NAME);
  if (!existing) {
    await api('config', 'PATCH', { action: 'rules.insert', value });
    const updated = await api('config/active');
    existing = updated.rules.find((r: {name: string}) => r.name === MANAGED_NAME);
    if (!existing?.valid) throw new Error('Managed IP rule insertion not confirmed');
    await api('config', 'PATCH', { action: 'rules.priority', id: existing.id, value: 1 });
  } else if (JSON.stringify(existing.conditionGroup) !== JSON.stringify(value.conditionGroup) || existing.active !== value.active) {
    await api('config', 'PATCH', { action: 'rules.update', id: existing.id, value });
  }
  const verified = await api('config/active');
  const live = verified.rules.find((r: {id: string}) => r.id === existing.id);
  const liveIps = live?.conditionGroup?.[0]?.conditions?.find((c: {type: string}) => c.type === 'ip_address')?.value;
  if (!live?.valid || live.active !== value.active || JSON.stringify(liveIps) !== JSON.stringify(ips.length ? ips : ['192.0.2.1'])) throw new Error('Managed IP rule readback mismatch');
  state.ruleId = existing.id;
  writeFileSync(`${root}/state.tmp`, JSON.stringify(state), { mode: 0o600 });
  renameSync(`${root}/state.tmp`, `${root}/state.json`);
  console.log(JSON.stringify({ bannedIps: ips.length, through: new Date(state.cursor).toISOString(), ruleId: state.ruleId, expiryDays: 30 }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch(error => { console.error(error.message); process.exitCode = 1; });
