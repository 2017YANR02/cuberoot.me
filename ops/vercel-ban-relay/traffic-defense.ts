// Run on the existing server as root; credentials never leave this host.
// node traffic-defense.ts status|open|protect [--apply]
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { incidentRuleLayout, LIGHTPANDA_DENY_RULE_ID, OPEN_MODE_BYPASS_RULE_ID } from './relay.ts';

const MODE = '/etc/nginx/cuberoot-comp-verification-state.conf';
const MAINTENANCE = '/etc/nginx/cuberoot-maintenance-state.conf';
const ROOT = '/var/lib/cuberoot-traffic-defense';
const timers = ['cuberoot-traffic-guard.timer', 'cuberoot-vercel-bans.timer'];
const services = ['cuberoot-traffic-guard.service', 'cuberoot-vercel-bans.service'];

type FirewallRule = {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  valid: boolean;
  conditionGroup: unknown;
  action: unknown;
};

function ruleValue(rule: FirewallRule, active: boolean) {
  const { name, description, conditionGroup, action } = rule;
  return { name, description, active, conditionGroup, action };
}

function command(name: string, args: string[]) {
  return execFileSync(name, args, { encoding: 'utf8', timeout: 60000 });
}
function atomic(file: string, content: string) {
  writeFileSync(`${file}.tmp`, content, { mode: 0o600 });
  renameSync(`${file}.tmp`, file);
}
function reload() {
  command('nginx', ['-t']);
  const pid = readFileSync('/www/server/nginx/logs/nginx.pid', 'utf8').trim();
  const before = new Set(command('pgrep', ['-P', pid]).trim().split(/\s+/));
  command('nginx', ['-s', 'reload']);
  return (async () => {
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (command('pgrep', ['-P', pid]).trim().split(/\s+/).some(p => !before.has(p))) return;
    }
    throw new Error('nginx did not start new workers');
  })();
}

export async function run(mode: string, apply: boolean) {
  if (!['status', 'open', 'protect'].includes(mode)) throw new Error('Use status, open or protect');
  const config = JSON.parse(readFileSync('/etc/cuberoot-vercel-bans.json', 'utf8'));
  const query = new URLSearchParams({ projectId: config.projectId, teamId: config.teamId });
  async function api(path: string, body?: unknown) {
    const response = await fetch(`https://api.vercel.com/v1/security/firewall/${path}?${query}`, {
      method: body ? 'PATCH' : 'GET',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Vercel ${path}: HTTP ${response.status}`);
    return response.json();
  }
  const before = await api('config/active');
  const previous = readFileSync(MODE, 'utf8');
  const previousMaintenance = readFileSync(MAINTENANCE, 'utf8');
  if (!['default 0;', 'default 1;'].includes(previous.trim())) throw new Error('Unrecognized local mode');
  const enabled = mode === 'protect';
  const hasLightpandaRule = (before.rules as FirewallRule[]).some(rule => rule.id === LIGHTPANDA_DENY_RULE_ID);
  const openModeIndex = hasLightpandaRule ? incidentRuleLayout(before.rules).openModeIndex : -1;
  const openRule: FirewallRule | undefined = before.rules[openModeIndex];
  if (hasLightpandaRule && (!before.rules[0].valid || !before.rules[0].active || !openRule?.valid)) {
    throw new Error('Vercel Lightpanda or open-mode rule is inactive or invalid');
  }
  const vercelEnabled = hasLightpandaRule || enabled;
  const openRuleActive = openRule ? !enabled : undefined;
  async function applyVercel(state: typeof before, firewallOn: boolean, bypassActive?: boolean) {
    if (!firewallOn && state.firewallEnabled) await api('config', { action: 'firewallEnabled', value: false });
    if (bypassActive !== undefined) {
      const index = incidentRuleLayout(state.rules).openModeIndex;
      const rule: FirewallRule = state.rules[index];
      if (rule.active !== bypassActive) {
        await api('config', { action: 'rules.update', id: rule.id, value: ruleValue(rule, bypassActive) });
      }
    }
    if (firewallOn && !state.firewallEnabled) await api('config', { action: 'firewallEnabled', value: true });
  }
  const comparableRules = (rules: FirewallRule[]) => rules.map(rule => openRule && rule.id === OPEN_MODE_BYPASS_RULE_ID
    ? { id: rule.id, valid: rule.valid, ...ruleValue(rule, false) }
    : rule);
  const summary = () => ({ local: readFileSync(MODE, 'utf8').trim() === 'default 1;' ? 'protect' : 'open' });
  if (mode === 'status' || !apply) {
    console.log(JSON.stringify({ ...summary(), vercelEnabled: before.firewallEnabled, vercelVersion: before.version,
      vercelIncidentProtection: before.firewallEnabled && !openRule?.active,
      maintenance: readFileSync(MAINTENANCE, 'utf8').trim() === 'default 1;',
      ...(mode !== 'status' ? { requested: mode, applied: false } : {}) }));
    return;
  }
  mkdirSync(ROOT, { recursive: true, mode: 0o700 });
  writeFileSync(`${ROOT}/${Date.now()}-before.json`, JSON.stringify({ firewall: before, local: previous,
    maintenance: readFileSync(MAINTENANCE, 'utf8') }), { mode: 0o600 });
  // Stop in-flight writers before switching. Both also honor MODE on every run,
  // so later deployments that re-enable a timer cannot re-close an open site.
  command('systemctl', ['stop', ...timers, ...services]);
  let localChanged = false;
  try {
    // Keep the sitewide Lightpanda rule active in either incident mode.
    await applyVercel(before, vercelEnabled, openRuleActive);
    const after = await api('config/active');
    if (after.firewallEnabled !== vercelEnabled || after.rules[openModeIndex]?.active !== openRuleActive) {
      throw new Error('Vercel mode readback mismatch');
    }
    if (JSON.stringify(comparableRules(after.rules)) !== JSON.stringify(comparableRules(before.rules))
      || JSON.stringify(after.managedRules) !== JSON.stringify(before.managedRules)
      || JSON.stringify(after.ips) !== JSON.stringify(before.ips)) throw new Error('Unexpected WAF rule change');
    // Never revive an old maintenance outage when protection is re-enabled.
    atomic(MAINTENANCE, 'default 0;\n');
    atomic(MODE, `default ${enabled ? 1 : 0};\n`);
    localChanged = true;
    await reload();
    // A new worker PID does not mean every old keep-alive connection has drained.
    // Confirm the public result on fresh connections during the reload window.
    let confirmed = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const response = await fetch('https://api.cuberoot.me/v1/traffic-defense', {
          cache: 'no-store', headers: { Connection: 'close' }, signal: AbortSignal.timeout(3000),
        });
        if (response.ok && (await response.json()).enabled === Number(enabled)) { confirmed = true; break; }
      } catch { /* A short reload interruption is retryable; a persistent failure rolls back. */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!confirmed) throw new Error('Public mode readback mismatch after reload window');
    // Old source events are outside retention after a long open interval. Start
    // ingestion now; preserve the existing 30-day ledger and absolute expiries.
    if (enabled && previous.trim() === 'default 0;') {
      const file = '/var/lib/cuberoot-vercel-bans/state.json';
      const ledger = JSON.parse(readFileSync(file, 'utf8'));
      ledger.cursor = Date.now();
      atomic(file, JSON.stringify(ledger));
    }
    // In open mode the relay only keeps the existing token-expiry reminder;
    // it cannot ingest events or write bans while MODE is zero.
    command('systemctl', ['start', ...(enabled ? timers : ['cuberoot-vercel-bans.timer'])]);
    console.log(JSON.stringify({ ...summary(), vercelEnabled: after.firewallEnabled,
      vercelIncidentProtection: enabled,
      vercelVersion: after.version, applied: true, propagationSeconds: 5 }));
  } catch (error) {
    if (localChanged) {
      atomic(MODE, previous);
      atomic(MAINTENANCE, previousMaintenance);
      await reload().catch(() => console.error('Local rollback reload failed; inspect nginx before retrying'));
    }
    if (before.firewallEnabled !== vercelEnabled || openRule?.active !== openRuleActive) {
      await api('config/active').then(current => applyVercel(current, before.firewallEnabled, openRule?.active))
        .catch(() => console.error('Vercel rollback failed; inspect provider status before retrying'));
    }
    // No false success and no destructive rollback of provider rules. Retain the
    // snapshot and report both states so an interrupted switch can be retried.
    console.error(JSON.stringify({ ...summary(), applied: false, recovery: 'Retry the requested mode; root-only snapshot retained' }));
    if (readFileSync(MODE, 'utf8').trim() === 'default 1;') command('systemctl', ['start', ...timers]);
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.CUBEROOT_DEFENSE_LOCKED !== '1') {
    try {
      execFileSync('flock', ['-w', '60', '/run/cuberoot-traffic-defense.lock', process.execPath, '--experimental-strip-types', process.argv[1], ...process.argv.slice(2)],
        { stdio: 'inherit', env: { ...process.env, CUBEROOT_DEFENSE_LOCKED: '1' } });
    } catch { process.exitCode = 1; }
  } else run(process.argv[2] ?? 'status', process.argv.includes('--apply')).catch(error => {
    console.error(error instanceof Error ? error.message : 'Switch failed'); process.exitCode = 1;
  });
}
