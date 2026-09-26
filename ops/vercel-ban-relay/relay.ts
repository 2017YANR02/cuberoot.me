// Root-only server timer. Persist native WAF ban events as exact-IP rules for 30 days.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
const DAY = 86400000;
export const MANAGED_NAME = 'Rolling 30-day incident IP bans';
export const SOURCES = new Set(['rule_auto_ban_sensitive_file_scanners_for_1h_u5zqIL', 'rule_incident_rotating_browser_scraper_ban_30_days_S2oBpk']);
export type Ledger = { cursor: number; bans: Record<string, number>; ruleId?: string; lastSyncedAt?: number };
type BanEvent = { startTime: string; public_ip: string; ruleId: string; action: string };
export function absorb(state: Ledger, events: BanEvent[], now: number) {
  for (const [ip, expiry] of Object.entries(state.bans)) if (!isIP(ip) || !Number.isFinite(expiry) || expiry <= now) delete state.bans[ip];
  for (const event of events) {
    if (event.action !== 'deny' || !SOURCES.has(event.ruleId) || !isIP(event.public_ip)) continue;
    const started = Date.parse(event.startTime.replace(' ', 'T') + (/Z$|[+-]\d\d:\d\d$/.test(event.startTime) ? '' : 'Z'));
    if (!Number.isFinite(started) || started > now + 60000 || started + 30 * DAY <= now) continue;
    // Repeated API reads and native 24h renewals must not extend an active ban.
    state.bans[event.public_ip] = Math.min(state.bans[event.public_ip] ?? Infinity, started + 30 * DAY);
  }
  return state;
}
export function managedRule(ips: string[], index = 0) {
  if (ips.length > 1875) throw new Error('30-day IP list exceeds 1875 per rule: preserve existing rule; operator review required');
  return {
    name: index === 0 ? MANAGED_NAME : `${MANAGED_NAME} ${index + 1}`, description: 'Server-managed 30-day exact-IP bans from sensitive-file and incident scraper rules. CN exempt. Do not edit manually.',
    active: ips.length > 0,
    conditionGroup: Array.from({ length: Math.max(1, Math.ceil(ips.length / 75)) }, (_, i) => ({ conditions: [{ type: 'ip_address', op: 'inc', value: ips.length ? ips.slice(i * 75, (i + 1) * 75) : ['192.0.2.1'] }, { type: 'geo_country', op: 'neq', value: 'CN' }] })),
    action: { mitigate: { action: 'deny', actionDuration: null } },
  };
}
export async function run() {
  const root = process.env.CUBEROOT_BAN_STATE_DIR || '/var/lib/cuberoot-vercel-bans';
  const config = JSON.parse(readFileSync(process.env.CUBEROOT_BAN_CONFIG || '/etc/cuberoot-vercel-bans.json', 'utf8'));
  const now = Date.now();
  if (Number.isFinite(config.expiresAt) && config.expiresAt - now < 7 * DAY) await alertOnce('token-expiry', '专用令牌将在 ' + new Date(config.expiresAt).toISOString().slice(0, 10) + ' 到期，请更新令牌。到期后无法新增或解除 Vercel 的 30 天封禁。');
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
  // Persist observations before a potentially failing WAF write, so a capacity/API
  // outage cannot discard source events after Vercel retention expires.
  writeFileSync(`${root}/state.tmp`, JSON.stringify(state), { mode: 0o600 });
  renameSync(`${root}/state.tmp`, `${root}/state.json`);
  if (ips.length > 50000) throw new Error('30-day list exceeds 50000 IPs; new events saved, existing rules retained; capacity review required');
  let active = await api('config/active');
  const own = (r: {name: string}) => r.name === MANAGED_NAME || /^Rolling 30-day incident IP bans \d+$/.test(r.name);
  if (active.rules?.[0]?.id !== 'rule_china_mainland_traffic_exemption_aOC64j') throw new Error('China exemption order changed; operator review required');
  const count = Math.max(1, Math.ceil(ips.length / 1875), active.rules.filter(own).length);
  if (active.rules.filter((r: {name: string}) => !own(r)).length + count > 40) throw new Error('Custom rule capacity exceeded; preserve existing rules');
  for (let i = 0; i < count; i++) {
    const part = ips.slice(i * 1875, (i + 1) * 1875);
    const value = managedRule(part, i);
    let existing = active.rules.find((r: {name: string}) => r.name === value.name);
    if (!existing) {
      await api('config', 'PATCH', { action: 'rules.insert', value });
      active = await api('config/active');
      existing = active.rules.find((r: {name: string}) => r.name === value.name);
      if (!existing?.valid) throw new Error('Managed IP rule insertion not confirmed');
    } else {
      const liveIps = existing.conditionGroup.flatMap((g: any) => g.conditions.find((c: any) => c.type === 'ip_address')?.value || []);
      if (JSON.stringify(liveIps) !== JSON.stringify(part.length ? part : ['192.0.2.1']) || existing.active !== value.active) {
        await api('config', 'PATCH', { action: 'rules.update', id: existing.id, value });
      }
    }
    if (active.rules[i + 1]?.id !== existing.id) await api('config', 'PATCH', { action: 'rules.priority', id: existing.id, value: i + 1 });
    active = await api('config/active');
    const live = active.rules[i + 1];
    const liveIps = live?.conditionGroup?.flatMap((g: any) => g.conditions.find((c: any) => c.type === 'ip_address')?.value || []);
    if (active.rules[0]?.id !== 'rule_china_mainland_traffic_exemption_aOC64j' || live?.id !== existing.id || !live?.valid || live.active !== value.active || JSON.stringify(liveIps) !== JSON.stringify(part.length ? part : ['192.0.2.1'])) throw new Error('Managed IP rule readback mismatch');
    if (i === 0) state.ruleId = existing.id;
  }
  state.lastSyncedAt = now;
  writeFileSync(`${root}/state.tmp`, JSON.stringify(state), { mode: 0o600 });
  renameSync(`${root}/state.tmp`, `${root}/state.json`);
  console.log(JSON.stringify({ bannedIps: ips.length, through: new Date(state.cursor).toISOString(), ruleId: state.ruleId, expiryDays: 30 }));
}
async function alertOnce(kind: string, message: string) {
  const key = process.env.BARK_KEY;
  if (!key) { console.error('Notification unavailable: BARK_KEY not configured'); return; }
  const root = process.env.CUBEROOT_BAN_STATE_DIR || '/var/lib/cuberoot-vercel-bans';
  mkdirSync(root, {recursive: true, mode: 0o700});
  const path = root + '/alert-' + kind + '.json';
  let previous = 0;
  try { previous = JSON.parse(readFileSync(path, 'utf8')).sentAt; } catch {}
  if (Date.now() - previous < 6 * 3600000) return;
  const body = new URLSearchParams({title: 'CubeRoot 封禁同步需处理', body: message, group: 'cuberoot-monitor'});
  const r = await fetch('https://api.day.app/' + encodeURIComponent(key), {method: 'POST', body, signal: AbortSignal.timeout(10000)});
  if (!r.ok || (await r.json()).code !== 200) throw new Error('Ban relay alert delivery failed');
  writeFileSync(path, JSON.stringify({sentAt: Date.now()}), {mode: 0o600});
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch(async error => {
  console.error(error.message); process.exitCode = 1;
  await alertOnce('failure', 'Vercel 的 30 天封禁名单未同步成功：' + error.message + '。原有规则仍保留；新封禁与到期解除可能延迟。').catch(e => console.error(e.message));
});
