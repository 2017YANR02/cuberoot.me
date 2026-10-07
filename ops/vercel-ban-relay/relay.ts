// Root-only server timer. Persist native WAF ban events as exact-IP rules for 30 days.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
const DAY = 86400000;
// Owner-confirmed fixed egress; mirrored by the nginx scanner policy.
export const TRUSTED_IPS = new Set(['154.44.14.212']);
export const MANAGED_NAME = 'Rolling 30-day incident IP bans';
export const SOURCES = new Set(['rule_auto_ban_sensitive_file_scanners_for_1h_u5zqIL', 'rule_incident_rotating_browser_scraper_ban_30_days_S2oBpk']);
export type Ledger = { cursor: number; bans: Record<string, number>; ruleId?: string; lastSyncedAt?: number };
type BanEvent = { startTime: string; public_ip: string; ruleId: string; action: string };
export function absorb(state: Ledger, events: BanEvent[], now: number) {
  for (const [ip, expiry] of Object.entries(state.bans)) if (TRUSTED_IPS.has(ip) || !isIP(ip) || !Number.isFinite(expiry) || expiry <= now) delete state.bans[ip];
  for (const event of events) {
    if (TRUSTED_IPS.has(event.public_ip) || event.action !== 'deny' || !SOURCES.has(event.ruleId) || !isIP(event.public_ip)) continue;
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
/** Keep existing slots, reserve two for incident rules, and queue excess IPs. */
export function planCapacity(ips: string[], otherRules: number, existingRules: number, maxManagedIps = 20000) {
  // 2026-10-05: the existing 24,000-IP config exceeded the 400 KiB metadata
  // mirror limit on edit. Owner approved 20,000 to retain update headroom.
  // This is an observed deployment budget, not a published Vercel IP limit.
  if (!Number.isSafeInteger(maxManagedIps) || maxManagedIps < 1) throw new Error('Invalid managed IP budget');
  if (otherRules + existingRules > 40) throw new Error('Custom rule capacity exceeded; preserve existing rules');
  const available = Math.max(existingRules, 40 - otherRules - 2);
  if (available < 1) throw new Error('No custom rule capacity available for IP bans');
  const capacity = Math.min(maxManagedIps, available * 1875);
  const admitted = ips.slice(0, capacity);
  const count = Math.max(1, existingRules, Math.ceil(admitted.length / 1875));
  return { count, admitted, pending: ips.length - admitted.length, capacity };
}
/** Advance only through complete windows; split busy windows instead of skipping them. */
export async function collectEvents(state: Ledger, now: number, read: (start: number, end: number) => Promise<BanEvent[]>, budget = 30) {
  let cursor = Math.max(state.cursor - 120000, now - DAY);
  const deadline = Date.now() + 45000;
  let requests = 0;
  while (cursor < now && requests < budget && Date.now() < deadline) {
    let end = Math.min(cursor + 60000, now);
    while (true) {
      if (requests >= budget || Date.now() >= deadline) return;
      requests++;
      const events = await read(cursor, end);
      if (!Array.isArray(events)) throw new Error('Invalid event response');
      absorb(state, events, now);
      if (events.length < 1000) break;
      if (end - cursor <= 1) throw new Error('WAF event millisecond exceeds response limit; cursor retained');
      end = cursor + Math.max(1, Math.floor((end - cursor) / 2));
    }
    cursor = end;
    state.cursor = Math.max(state.cursor, cursor);
  }
}
export async function run() {
  try {
    if (readFileSync('/etc/nginx/cuberoot-comp-verification-state.conf', 'utf8').trim() === 'default 0;') {
      console.log(JSON.stringify({ mode: 'open', applied: false }));
      return;
    }
  } catch { /* Existing installations retain protection until configured. */ }
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
  // Event ingestion must not prevent publishing known bans or removing expiries.
  // Re-read two minutes for ingestion delay; bounded batches catch up each minute.
  let eventError: string | undefined;
  absorb(state, [], now);
  try {
    if (now - state.cursor > DAY) throw new Error('WAF event gap exceeds 24h; manual recovery required');
    await collectEvents(state, now, async (start, end) => (await api('events', 'GET', undefined, { startTimestamp: String(start), endTimestamp: String(end) })).actions);
  } catch (error) { eventError = error instanceof Error ? error.message : String(error); }
  // Keep insertion order: new IPs append to the final rule instead of rewriting
  // every earlier bucket on each minute. Expired IPs are still removed.
  const ips = Object.keys(state.bans);
  // Persist observations before a potentially failing WAF write, so a capacity/API
  // outage cannot discard source events after Vercel retention expires.
  writeFileSync(`${root}/state.tmp`, JSON.stringify(state), { mode: 0o600 });
  renameSync(`${root}/state.tmp`, `${root}/state.json`);
  let active = await api('config/active');
  const own = (r: {name: string}) => r.name === MANAGED_NAME || /^Rolling 30-day incident IP bans \d+$/.test(r.name);
  if (active.rules?.[0]?.id !== 'rule_china_mainland_traffic_exemption_aOC64j') throw new Error('China exemption order changed; operator review required');
  // Extend the existing first bypass rule, preserving its ID and relay ordering.
  const exemption = active.rules[0];
  const ownerGroup = { conditions: [{ type: 'ip_address', op: 'inc', value: [...TRUSTED_IPS] }] };
  const isOwnerGroup = (g: { conditions: { type: string; op: string; value: unknown }[] }) => g.conditions.length === 1 && g.conditions[0].type === 'ip_address' && g.conditions[0].op === 'inc' && JSON.stringify(g.conditions[0].value) === JSON.stringify([...TRUSTED_IPS]);
  let ownerExemptionError: string | undefined;
  try {
  if (!exemption.conditionGroup.some(isOwnerGroup)) {
    await api('config', 'PATCH', { action: 'rules.update', id: exemption.id, value: {
      name: exemption.name, active: true,
      description: 'Mainland China and owner-confirmed exact IPs bypass traffic restrictions; application authentication remains required.',
      conditionGroup: [...exemption.conditionGroup, ownerGroup], action: { mitigate: { action: 'bypass' } },
    } });
    active = await api('config/active');
    if (active.rules[0]?.id !== exemption.id || !active.rules[0]?.valid || !active.rules[0]?.active
      || !active.rules[0].conditionGroup.some(isOwnerGroup)) {
      throw new Error('Owner IP exemption readback mismatch');
    }
  }
  } catch (error) {
    // A provider capacity failure must not block expiry cleanup for known bans.
    ownerExemptionError = error instanceof Error ? error.message : String(error);
  }
  const plan = planCapacity(ips, active.rules.filter((r: {name: string}) => !own(r)).length, active.rules.filter(own).length, config.maxManagedIps ?? 20000);
  const { count } = plan;
  for (let i = 0; i < count; i++) {
    const part = plan.admitted.slice(i * 1875, (i + 1) * 1875);
    const value = managedRule(part, i);
    let changed = false;
    let existing = active.rules.find((r: {name: string}) => r.name === value.name);
    if (!existing) {
      changed = true;
      await api('config', 'PATCH', { action: 'rules.insert', value });
      active = await api('config/active');
      existing = active.rules.find((r: {name: string}) => r.name === value.name);
      if (!existing?.valid) throw new Error('Managed IP rule insertion not confirmed');
    } else {
      const liveIps = existing.conditionGroup.flatMap((g: any) => g.conditions.find((c: any) => c.type === 'ip_address')?.value || []);
      if (JSON.stringify(liveIps) !== JSON.stringify(part.length ? part : ['192.0.2.1']) || existing.active !== value.active) {
        changed = true;
        await api('config', 'PATCH', { action: 'rules.update', id: existing.id, value });
      }
    }
    if (active.rules[i + 1]?.id !== existing.id) {
      changed = true;
      await api('config', 'PATCH', { action: 'rules.priority', id: existing.id, value: i + 1 });
    }
    if (changed) active = await api('config/active');
    const live = active.rules[i + 1];
    const liveIps = live?.conditionGroup?.flatMap((g: any) => g.conditions.find((c: any) => c.type === 'ip_address')?.value || []);
    if (active.rules[0]?.id !== 'rule_china_mainland_traffic_exemption_aOC64j' || live?.id !== existing.id || !live?.valid || live.active !== value.active || JSON.stringify(liveIps) !== JSON.stringify(part.length ? part : ['192.0.2.1'])) throw new Error('Managed IP rule readback mismatch');
    if (i === 0) state.ruleId = existing.id;
  }
  state.lastSyncedAt = now;
  writeFileSync(`${root}/state.tmp`, JSON.stringify(state), { mode: 0o600 });
  renameSync(`${root}/state.tmp`, `${root}/state.json`);
  console.log(JSON.stringify({ bannedIps: plan.admitted.length, pendingIps: plan.pending, capacityIps: plan.capacity, observedIps: ips.length, through: new Date(state.cursor).toISOString(), eventLagSeconds: Math.ceil((now - state.cursor) / 1000), eventError, ownerExemptionError, ruleId: state.ruleId, expiryDays: 30 }));
  if (ownerExemptionError) await alertOnce('owner-exemption', '维护者 IP 的 Vercel 白名单尚未写入：' + ownerExemptionError + '。现有名单同步继续，需核对平台容量。');
  if (eventError) await alertOnce('events', '已同步现有名单并处理到期解除，但新事件读取受阻：' + eventError + '。采集进度保留，新 IP 可能延迟加入。');
  if (plan.pending) await alertOnce('capacity', '已同步 ' + plan.admitted.length + ' 个 IP 的 30 天封禁，还有 ' + plan.pending + ' 个等待规则容量。账本保留全部记录，到期解除继续执行；排队项不能视为已获得 30 天封禁。');
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
