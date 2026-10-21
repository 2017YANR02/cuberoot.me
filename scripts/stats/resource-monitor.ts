/** Mac statistics process-tree protection. Observation is not OS-enforced no-swap. */
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { totalmem } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProcesses } from '../../core/scripts/mac-system-recorder.mts';
import { observeStatsResources, validateStatsRun } from '../../solver/experiments/cube48opt-rust/stats-resume-review.mts';
import { statsEngine } from '../../solver/333opt/stats-engine.mts';
import { repoRoot, tableDir } from '../../core/jobs/scramble-stats-build/pipeline_paths.mjs';

export const GiB = 2 ** 30;
const reserve = GiB / 2;
const runEnv = 'CUBEROOT_STATS_RESOURCE_RUN';
const defaultStateDir = join(tableDir, 'stats-resources');
const ownFile = fileURLToPath(import.meta.url);
function observe(): Observation {
  const value = observeStatsResources();
  const boot = /sec\s*=\s*(\d+)/.exec(value.boot)?.[1];
  if (!boot) throw Error('Invalid system boot identity');
  return { ...value, boot };
}
type Observation = ReturnType<typeof observeStatsResources>;
export type Identity = { pid: number; start: string; command: string };
export type ProcessRow = ReturnType<typeof parseProcesses>[number];
export type TableBudget = { binary: string; profile: string; tableBytes: number; mapped: boolean; rssLimit: number; workingBytes?: number; files: Array<{ path: string; bytes: number; mtimeMs: number; ino: number; dev: number }> };
type Owner = { root: Identity; baseline: Observation; token: string; monitor?: Identity; priorStop?: { path: string; sha256: string }; startedAt: string };
const command = (bin: string, args: string[]) => execFileSync(bin, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 8 * 2 ** 20, env: { ...process.env, LC_ALL: 'C' } });
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8'));
function atomic(path: string, value: unknown) {
  atomicBytes(path, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
}
function atomicBytes(path: string, bytes: Buffer) {
  const temp = `${path}.new-${process.pid}`;
  const fd = openSync(temp, 'w', 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, path);
}
export function parseIdentities(text: string): Identity[] {
  return text.split('\n').flatMap(line => {
    const m = line.match(/^\s*(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(.+)$/);
    return m ? [{ pid: Number(m[1]), start: m[2].replace(/\s+/g, ' '), command: m[3] }] : [];
  });
}
export const sameIdentity = (a: Identity | undefined, b: Identity | undefined) => Boolean(a && b && a.pid === b.pid && a.start === b.start && a.command === b.command);
function identity(pid: number): Identity | undefined {
  try { return parseIdentities(command('/bin/ps', ['-p', String(pid), '-o', 'pid=,lstart=,command=']))[0]; } catch { return undefined; }
}
function snapshot() {
  return { identities: new Map(parseIdentities(command('/bin/ps', ['-axo', 'pid=,lstart=,command='])).map(p => [p.pid, p])),
    rows: parseProcesses(command('/bin/ps', ['-axo', 'pid,ppid,rss,pcpu,stat,comm'])) };
}
/** Retain verified orphan descendants; never inherit a reused PID's children. */
export function trackedTree(root: Identity, known: Map<number, Identity>, rows: ProcessRow[], current: Map<number, Identity>, excludedPid: number): ProcessRow[] {
  const excluded = new Set([excludedPid]);
  for (let changed = true; changed;) { changed = false; for (const row of rows) if (excluded.has(row.ppid) && !excluded.has(row.pid)) { excluded.add(row.pid); changed = true; } }
  const family = new Set<number>();
  if (sameIdentity(root, current.get(root.pid))) family.add(root.pid);
  for (const [pid, old] of known) if (!excluded.has(pid) && sameIdentity(old, current.get(pid))) family.add(pid);
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (family.has(row.ppid) && !family.has(row.pid) && !excluded.has(row.pid) && current.has(row.pid)) { family.add(row.pid); changed = true; }
  }
  for (const pid of family) known.set(pid, current.get(pid)!);
  return rows.filter(row => family.has(row.pid) && !excluded.has(row.pid) && sameIdentity(known.get(row.pid), current.get(row.pid)));
}

// File membership follows the corresponding solver constructors, not browser UI.
const standard = ['mt_edge2', 'mt_edge', 'mt_corn', 'mt_edge4', 'mt_edge6', 'mt_corn2', 'pt_cross', 'pt_cross_C4E0', 'pt_cross_C4C5E0E1', 'pt_cross_C4C6E0E2'];
const pseudo = ['mt_edge2', 'mt_edge4', 'mt_corn', 'mt_edge', 'mt_corn2', 'mt_edge3', 'mt_corn3', ...[0, 1, 2, 3].map(i => `pt_pscross_C4E${i}`), 'pt_pscross_E0E1', 'pt_pscross_E0E2', 'pt_pscross_C4C5', 'pt_pscross_C4C6', 'pt_pscross_E0E1E2', 'pt_pscross_C4C5C6'];
export function analyzerTableNames(binary: string, env: NodeJS.ProcessEnv, physicalBytes: number): { profile: string; names: string[] } {
  const profile = env.CUBE_TABLE_PROFILE?.trim() || 'auto';
  if (!['auto', 'default', 'high-memory'].includes(profile)) throw Error('Invalid CUBE_TABLE_PROFILE');
  const high = profile === 'high-memory' || profile === 'auto' && physicalBytes >= 56 * GiB;
  let names: string[] = [];
  switch (basename(binary).replace(/\.exe$/, '')) {
    case 'eo_cross_analyzer':
      names = ['mt_edge4', 'mt_corn', 'mt_edge', 'mt_edge6', 'mt_corn2', 'mt_ep4', 'mt_eo12_alt', 'pt_ep4eo12', 'pt_cross_C4E0',
        ...[1, 2, 3].map(i => `pt_cross_C4E0E${i}`), ...[5, 6, 7].map(i => `pt_cross_C4C${i}E0`), 'pt_cross_C4C5C6', 'pt_cross_C4C5E0E1'];
      if (env.CUBE_EO_NO_DIAG !== '1') names.push('pt_cross_C4C6E0E2');
      if (high) names.push('mt_ep5_high_memory', ...[0, 1, 2, 3].map(i => `pt_eo_xcross_slot${i}_high_memory`));
      break;
    case 'std_analyzer': case 'f2leo_analyzer': names = standard; break;
    case 'pair_analyzer': names = ['mt_edge4', 'mt_corn', 'mt_edge', 'mt_edge6', 'mt_corn2', 'pt_cross_ins_C4', 'pt_pair_C4E0', 'pt_cross_C4E0', 'pt_cross_C4C5E0E1', ...(env.CUBE_PAIR_NO_DIAG === '1' ? [] : ['pt_cross_C4C6E0E2'])]; break;
    case 'pseudo_analyzer': names = [...pseudo, 'pt_pscross']; break;
    case 'pseudo_f2leo_analyzer': names = pseudo; break;
    case 'pseudo_pair_analyzer': names = [...pseudo, ...[4, 5, 6, 7].flatMap(c => [`pt_pscross_C${c}`, ...[0, 1, 2, 3].flatMap(e => [`pt_pscross_ins_C${c}_diff${e}`, `pt_pspair_C${c}_E${e}`])])]; break;
    case 'daisy_analyzer': case 'first_layer_analyzer': names = ['mt_edge4']; break;
    case 'f2b_analyzer': names = env.CUBE_F2B_LIGHT === '1' ? [] : ['pt_f2b_be3c2']; break;
    case 'sq1_analyzer': names = env.SQ1_SLASH_VIA_WCA === '1' ? [] : ['sq1_wca_jsqfull']; break;
    case 'block222_analyzer': names = ['mt_edge3', 'mt_corn']; break;
    case 'roux_analyzer': names = ['mt_corn2', 'mt_edge3', 'mt_corn', 'mt_edge2']; break;
    case 'block223_analyzer': names = ['mt_corn2', 'mt_edge3', 'mt_edge2']; break;
    // These solvers build bounded small coordinates in memory; no large mmap.
    case 'eoline_analyzer': case 'dr_analyzer': case 'cube222_analyzer':
    case 'pyraminx_analyzer': case 'skewb_analyzer': case 'sq1_slash_mitm':
    case 'tsx': case 'tsx.cmd': case 'node': break;
    default: throw Error(`No reviewed resource plan for analyzer ${binary}`);
  }
  return { profile: high ? 'high-memory' : 'default', names: [...new Set(names)].map(name => name + '.bin') };
}
export function tableBudget(binary: string, env: NodeJS.ProcessEnv, physicalBytes = totalmem(), inspect = statSync): TableBudget {
  const { profile, names } = analyzerTableNames(binary, env, physicalBytes);
  const files = names.map(name => {
    const path = join(env.CUBE_TABLE_DIR || tableDir, name), meta = inspect(path);
    if (!meta.isFile() || !Number.isSafeInteger(meta.size) || meta.size <= 0) throw Error(`Invalid analyzer table metadata: ${path}`);
    return { path, bytes: meta.size, mtimeMs: meta.mtimeMs, ino: meta.ino, dev: meta.dev };
  });
  const tableBytes = files.reduce((n, file) => n + file.bytes, 0);
  let workingBytes = 0;
  const name = basename(binary).replace(/\.exe$/, '');
  if (name === 'sq1_analyzer') {
    // sq1_solver::tt_budget is global across threads (default 240M entries).
    // A (u128,u8) bucket uses 32B + one control byte. At 7/8 load,
    // capacity can approach twice the entry count; growth retains the old
    // half-sized allocation. Sum this bound across all globally-budgeted maps.
    // 4GiB additionally covers small maps, thread overshoot and workspaces.
    const rawEntries = env.SQ1_TT_BUDGET ?? '240000000';
    if (!/^\+?\d+$/.test(rawEntries)) throw Error('Invalid SQ1_TT_BUDGET');
    const entries = Number(rawEntries);
    if (!Number.isSafeInteger(entries) || entries < 0 || !Number.isSafeInteger(entries * 114)) throw Error('Invalid SQ1_TT_BUDGET');
    workingBytes = entries * 114;
  } else if (name === 'sq1_slash_mitm') {
    // MEM_CAP=100M/side, at most 144 inserts before a cap check. Reserve two
    // HashMaps plus one old map during growth (33B/bucket), and three Vecs of
    // 24B Sq1State. Round capacities up; this is a budget, not measured RSS.
    const buckets = 2 ** Math.ceil(Math.log2((100_000_000 + 144) / 0.875));
    const frontier = 2 ** Math.ceil(Math.log2(100_000_000 + 144));
    workingBytes = Math.ceil(buckets * 2.5 * 33 + frontier * 3 * 24);
  }
  return { binary, profile, files, tableBytes, workingBytes, mapped: name !== 'sq1_analyzer', rssLimit: tableBytes + workingBytes + 4 * GiB };
}
export function statsResourcePlan(binaries: string[], env: NodeJS.ProcessEnv, includeOptimal = false): unknown[] {
  const result: unknown[] = binaries.map(binary => {
    try { return tableBudget(binary, env); }
    catch (error) { return { binary, error: String(error) }; }
  });
  if (includeOptimal) {
    try { result.push(budgetForOptimum()); }
    catch (error) { result.push({ binary: '333opt', error: String(error) }); }
  }
  return result;
}
export function resourceLimits(baseline: Pick<Observation, 'boot' | 'swapouts'>, now: Observation, rows: ProcessRow[], budgets: Map<number, TableBudget>) {
  validateStatsRun(baseline, now);
  const values = resourceValues(now, rows, budgets);
  if (values.activeAnalyzers > 1) throw Error('Concurrent statistics analyzers are not allowed');
  if (values.rss > values.rssLimit) throw Error(`Task tree RSS ${values.rss} exceeds metadata budget ${values.rssLimit}`);
  if (values.headroom < 2 * GiB) throw Error(`Conservative headroom ${values.headroom} below 2 GiB`);
  return values;
}
export function resourceValues(now: Pick<Observation, 'available'>, rows: ProcessRow[], budgets: Map<number, TableBudget>) {
  const active = rows.filter(row => budgets.has(row.pid));
  const rss = rows.reduce((n, row) => n + row.rssBytes, 0);
  const rssLimit = active.length ? budgets.get(active[0].pid)!.rssLimit : 8 * GiB;
  // Conservative estimate, not an exact resident-file measurement. The existing
  // observer counts file-backed pages as reclaimable; do not count our own twice.
  const mappedEstimate = active.reduce((n, row) => n + (budgets.get(row.pid)!.mapped ? Math.min(row.rssBytes, budgets.get(row.pid)!.tableBytes) : 0), 0);
  const headroom = now.available - mappedEstimate - reserve;
  return { rss, rssLimit, headroom, mappedEstimate, activeAnalyzers: active.length };
}
function inheritedRun(): string | undefined {
  const dir = process.env[runEnv];
  if (!dir || process.platform !== 'darwin') return;
  const owner = read<Owner>(join(dir, 'owner.json'));
  if (!sameIdentity(owner.root, identity(owner.root.pid)) || !sameIdentity(owner.monitor, identity(owner.monitor?.pid ?? 0))) throw Error('Statistics resource monitor is not alive');
  const snap = snapshot();
  const family = trackedTree(owner.root, new Map(), snap.rows, snap.identities, owner.monitor!.pid);
  if (!family.some(row => row.pid === process.pid)) throw Error('Statistics monitor does not own this process');
  if (existsSync(join(dir, 'protected-stop.json'))) throw Error('Statistics resource protection has stopped this run');
  return dir;
}
export const startupRequiredBytes = (rssLimit: number) => rssLimit + 2 * GiB + reserve;
export function statsAnalyzerStartupDecision(available: number, rssLimit: number, optional: boolean): 'start' | 'skip' | 'reject' {
  return available >= startupRequiredBytes(rssLimit) ? 'start' : optional ? 'skip' : 'reject';
}
/** Explicit choices stay fixed, including when this is called again at spawn. */
export function selectStatsEoProfile(env: NodeJS.ProcessEnv, available: number, highRssLimit: () => number, physicalBytes = totalmem()): NodeJS.ProcessEnv {
  const requested = env.CUBE_TABLE_PROFILE?.trim() || 'auto';
  if (requested !== 'auto') return env;
  // Preserve native auto eligibility. Smaller machines need not even have the
  // optional high-memory tables, so inspect their metadata only if eligible.
  if (physicalBytes < 56 * GiB) return { ...env, CUBE_TABLE_PROFILE: 'default' };
  return { ...env, CUBE_TABLE_PROFILE: available >= startupRequiredBytes(highRssLimit()) ? 'high-memory' : 'default' };
}
/** Resolve before the checkpoint hash and keep the selected profile explicit.
 * A later startup check still rejects either profile if resources have changed.
 */
export function resolveStatsAnalyzerEnv(binary: string, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (process.platform !== 'darwin' || basename(binary) !== 'eo_cross_analyzer' || !['', 'auto'].includes(env.CUBE_TABLE_PROFILE?.trim() ?? '')) return env;
  const dir = inheritedRun();
  if (!dir) return env;
  const now = observe(), physicalBytes = totalmem();
  let highRequiredBytes: number | null = null;
  const resolved = selectStatsEoProfile(env, now.available, () => {
    const high = tableBudget(binary, { ...env, CUBE_TABLE_PROFILE: 'high-memory' });
    highRequiredBytes = startupRequiredBytes(high.rssLimit);
    return high.rssLimit;
  }, physicalBytes);
  atomic(join(dir, `profile-selection-${process.pid}.json`), { binary, requested: env.CUBE_TABLE_PROFILE ?? 'auto', selected: resolved.CUBE_TABLE_PROFILE,
    available: now.available, physicalBytes, highRequiredBytes, sampledAt: now.sampledAt, boot: now.boot, swapouts: now.swapouts });
  console.log(`[统计档位] ${basename(binary)} auto → ${resolved.CUBE_TABLE_PROFILE} (available=${now.available}, high-required=${highRequiredBytes ?? 'not-applicable'})`);
  return resolved;
}
/** Optional retry admission is not a protection failure: nothing has started.
 * Boot, swap and pressure failures still stop the run; only an insufficient
 * startup budget may skip the optional attempt without changing the baseline.
 */
export function skipOptionalStatsAnalyzer(binary: string, env: NodeJS.ProcessEnv, label: string): boolean {
  const dir = inheritedRun();
  if (!dir) return false;
  const owner = read<Owner>(join(dir, 'owner.json')), budget = tableBudget(binary, env), now = observe();
  try { validateStatsRun(owner.baseline, now); }
  catch (error) { atomic(join(dir, 'request-stop.json'), { reason: String(error) }); throw error; }
  if (statsAnalyzerStartupDecision(now.available, budget.rssLimit, true) !== 'skip') return false;
  const record = { label, binary, available: now.available, required: startupRequiredBytes(budget.rssLimit),
    budget, sampledAt: now.sampledAt, boot: now.boot, swapouts: now.swapouts };
  appendFileSync(join(dir, 'optional-skips.jsonl'), JSON.stringify(record) + '\n');
  console.warn(`[${label}] 跳过可选重试：启动需要 ${record.required} bytes，当前可用 ${record.available} bytes；保留待解状态。`);
  return true;
}
export function prepareStatsAnalyzer(binary: string, env: NodeJS.ProcessEnv): (pid: number) => () => void {
  const dir = inheritedRun();
  if (!dir) return () => () => {};
  const owner = read<Owner>(join(dir, 'owner.json')), budget = tableBudget(binary, env);
  const now = observe();
  try {
    validateStatsRun(owner.baseline, now);
    if (statsAnalyzerStartupDecision(now.available, budget.rssLimit, false) === 'reject') throw Error(`Insufficient startup memory for ${basename(binary)}: requires ${startupRequiredBytes(budget.rssLimit)} bytes`);
  } catch (error) {
    atomic(join(dir, 'request-stop.json'), { reason: String(error) });
    throw error;
  }
  const parent = identity(process.pid);
  if (!parent) throw Error('Cannot identify analyzer scheduler');
  const path = join(dir, `analyzer-${process.pid}.json`);
  // Persist the launch budget before spawn, so the observer has no default-cap
  // gap while the child initializes. The final identity atomically replaces it.
  atomic(path, { parent, budget });
  return pid => {
    const processIdentity = identity(pid);
    if (!processIdentity) throw Error(`Cannot identify analyzer PID ${pid}`);
    atomic(path, { parent, identity: processIdentity, budget });
    return () => { if (existsSync(path)) unlinkSync(path); };
  };
}
export function registerStatsSummary(path: string): void {
  const dir = inheritedRun();
  if (dir) atomic(join(dir, `summary-${process.pid}.json`), { path });
}
export function statsProtectionReason(): string | undefined {
  const dir = process.env[runEnv];
  if (dir && existsSync(join(dir, 'protected-stop.json'))) return read<{ reason: string }>(join(dir, 'protected-stop.json')).reason;
  if (dir && existsSync(join(dir, 'request-stop.json'))) return read<{ reason: string }>(join(dir, 'request-stop.json')).reason;
}

function priorStop(stateDir: string): { path: string; sha256: string; baseline: Pick<Observation, 'boot' | 'swapouts'> } | undefined {
  const permanent = join(stateDir, 'protected-stop.json');
  const path = existsSync(permanent) ? permanent : undefined;
  if (!path) return;
  const bytes = readFileSync(path), stop = JSON.parse(bytes.toString('utf8'));
  if (!stop.baseline?.boot || !Number.isSafeInteger(stop.baseline.swapouts)) throw Error('Invalid retained statistics stop');
  return { path, sha256: digest(bytes), baseline: stop.baseline };
}
export function validateResumeReview(review: unknown, stop: { path: string; sha256: string; baseline: Pick<Observation, 'boot' | 'swapouts'> }, now: Observation): void {
  const value = review as { schema?: string; stopPath?: string; stopSha256?: string; boot?: string; swapouts?: number; reason?: string; reviewedAt?: string };
  if (value?.schema !== 'cuberoot.stats-resource-review/v1' || value.stopPath !== stop.path || value.stopSha256 !== stop.sha256
    || value.boot !== stop.baseline.boot || value.swapouts !== stop.baseline.swapouts || !value.reason?.trim() || !Number.isFinite(Date.parse(value.reviewedAt ?? '')))
    throw Error('Explicit resource review must match the retained stop and original baseline');
  validateStatsRun(stop.baseline, now);
}
/** Release only the reviewed latch after the whole run has completed. Archive
 * original bytes first; a newer stop must remain active for its own review.
 */
export function archiveReviewedStatsStop(stateDir: string, runDir: string, reviewed: { path: string; sha256: string }): boolean {
  const path = join(stateDir, 'protected-stop.json');
  if (reviewed.path !== path || !existsSync(path)) return false;
  const bytes = readFileSync(path);
  if (digest(bytes) !== reviewed.sha256) return false;
  const archived = join(runDir, 'reviewed-protected-stop.json');
  if (existsSync(archived) && digest(readFileSync(archived)) !== reviewed.sha256) throw Error('Archived statistics stop differs from reviewed proof');
  atomicBytes(archived, bytes);
  const reviewPath = join(stateDir, 'resume-review.json');
  let matchingReview = false;
  if (existsSync(reviewPath)) {
    const reviewBytes = readFileSync(reviewPath), review = JSON.parse(reviewBytes.toString('utf8'));
    matchingReview = review.stopPath === reviewed.path && review.stopSha256 === reviewed.sha256;
    if (matchingReview) atomicBytes(join(runDir, 'completed-resume-review.json'), reviewBytes);
  }
  if (!existsSync(path) || digest(readFileSync(path)) !== reviewed.sha256) return false;
  unlinkSync(path);
  if (matchingReview && existsSync(reviewPath)) {
    const review = read<{ stopPath?: string; stopSha256?: string }>(reviewPath);
    if (review.stopPath === reviewed.path && review.stopSha256 === reviewed.sha256) unlinkSync(reviewPath);
  }
  return true;
}
function signalVerified(value: Identity, signal: NodeJS.Signals): boolean {
  if (!sameIdentity(value, identity(value.pid))) return false;
  try { process.kill(value.pid, signal); return true; } catch { return false; }
}
/** Freeze schedulers before killing workers: a close callback must not start a
 * successor. Repeat the snapshot to include children born during the freeze.
 * This is deliberately synchronous so the caller's action cannot continue.
 */
function terminateOwnedChildren(root: Identity, known: Map<number, Identity>, excludedPid: number): void {
  const frozen = new Set<string>();
  try {
    for (;;) {
      const snap = snapshot();
      const children = trackedTree(root, known, snap.rows, snap.identities, excludedPid).filter(row => row.pid !== root.pid);
      let discovered = false;
      for (const row of children) {
        const value = known.get(row.pid)!, key = JSON.stringify(value);
        if (frozen.has(key)) continue;
        signalVerified(value, 'SIGSTOP');
        frozen.add(key); discovered = true;
      }
      if (!discovered) break;
    }
  } catch (error) {
    console.error('Could not rescan statistics children during stop:', error);
  } finally {
    for (const child of known.values()) if (child.pid !== root.pid && child.pid !== excludedPid) signalVerified(child, 'SIGKILL');
  }
}
/** tsx keeps this non-compute service alive until its owning Node exits. */
export function isTsxService(row: ProcessRow, current: Identity | undefined): boolean {
  return row.name === 'esbuild' && Boolean(current && /[/\\]node_modules[/\\](?:[^\n]*[/\\])?@esbuild[/\\][^/\\\s]+[/\\]bin[/\\]esbuild --service=[\d.]+ --ping$/.test(current.command));
}
const delay = (ms: number) => new Promise<void>(done => setTimeout(done, ms));
export async function runWhileMonitored(action: () => Promise<void>, exited: Promise<number>, failed: () => void): Promise<void> {
  let running = true;
  try {
    await Promise.race([action(), exited.then(() => {
      if (running) { failed(); throw Error('Statistics monitor exited during the pipeline'); }
    })]);
  } finally { running = false; }
}
function updateSummaries(dir: string, reason: string) {
  let files: string[];
  try { files = readdirSync(dir); } catch (error) { console.error('Could not read statistics summaries:', error); return; }
  for (const file of files.filter(name => /^summary-\d+\.json$/.test(name))) {
    try {
      const { path } = read<{ path: string }>(join(dir, file));
      if (existsSync(path)) atomic(path, { ...read<object>(path), status: 'protected-stop', protectionReason: reason, finishedAt: new Date().toISOString() });
    } catch (error) { console.error('Could not persist statistics stop summary:', error); }
  }
}
function budgetForOptimum(): TableBudget {
  const config = statsEngine(repoRoot), meta = statSync(config.table);
  if (meta.size !== config.expectedBytes) throw Error('Optimal table metadata changed');
  return { binary: config.engine, profile: config.engine, tableBytes: meta.size, mapped: config.engine === 'c', rssLimit: meta.size + 4 * GiB,
    files: [{ path: config.table, bytes: meta.size, mtimeMs: meta.mtimeMs, ino: meta.ino, dev: meta.dev }] };
}
async function watch(dir: string): Promise<void> {
  const stateDir = resolve(dir, '../..');
  const owner = read<Owner>(join(dir, 'owner.json'));
  if (!sameIdentity(owner.root, identity(owner.root.pid))) throw Error('Statistics root identity changed before monitor startup');
  owner.monitor = identity(process.pid);
  atomic(join(dir, 'owner.json'), owner);
  const known = new Map<number, Identity>([[owner.root.pid, owner.root]]);
  const frozen = new Map<string, TableBudget>();
  let samples = 0, peakRss = 0, minimumHeadroom: number | null = null, last: unknown = null;
  const stop = async (reason: string) => {
    const record = { schema: 'cuberoot.stats-resource-stop/v1', baseline: owner.baseline, root: owner.root, reason, last,
      peakRss, minimumHeadroom, samples, stoppedAt: new Date().toISOString(), known: [...known.values()] };
    for (const path of [join(dir, 'protected-stop.json'), join(stateDir, 'protected-stop.json')]) {
      try { atomic(path, record); } catch (error) { console.error('Could not persist statistics stop:', error); }
    }
    updateSummaries(dir, reason);
    // Freeze the scheduler first, then identify new descendants. The monitor and
    // its own observation subprocesses are deliberately excluded from this tree.
    signalVerified(owner.root, 'SIGSTOP');
    terminateOwnedChildren(owner.root, known, process.pid);
    updateSummaries(dir, reason);
    try { atomic(join(dir, 'exit.json'), { ...record, status: 'protected-stop', finishedAt: new Date().toISOString() }); }
    catch (error) { console.error('Could not persist statistics monitor exit:', error); }
    // Never continue the frozen scheduler: its pending Promise could publish or
    // launch another task. The stop record and row checkpoints are already saved.
    signalVerified(owner.root, 'SIGKILL');
    updateSummaries(dir, reason);
    console.error(`[统计保护停止] ${reason}`);
    process.exitCode = 1;
  };
  process.send?.({ ready: true });
  for (;;) {
    try {
      const snap = snapshot();
      const family = trackedTree(owner.root, known, snap.rows, snap.identities, process.pid);
      if (existsSync(join(dir, 'request-stop.json'))) {
        await stop(read<{ reason: string }>(join(dir, 'request-stop.json')).reason); return;
      }
      if (!sameIdentity(owner.root, snap.identities.get(owner.root.pid))) {
        await stop('Statistics root exited without monitor completion'); return;
      }
      const budgets = new Map<number, TableBudget>();
      for (const file of readdirSync(dir).filter(name => /^analyzer-\d+\.json$/.test(name))) {
        const registration = read<{ parent: Identity; identity?: Identity; budget: TableBudget }>(join(dir, file));
        let activeIdentity = registration.identity;
        if (!activeIdentity && sameIdentity(registration.parent, snap.identities.get(registration.parent.pid))) {
          const matching = family.filter(row => row.ppid === registration.parent.pid && row.name === basename(registration.budget.binary));
          if (matching.length > 1) throw Error('Concurrent analyzer launches are not allowed');
          activeIdentity = matching.length ? snap.identities.get(matching[0].pid) : undefined;
        }
        if (!activeIdentity || !sameIdentity(activeIdentity, snap.identities.get(activeIdentity.pid)) || !family.some(p => p.pid === activeIdentity!.pid)) continue;
        const key = JSON.stringify(activeIdentity), existing = frozen.get(key);
        if (existing && JSON.stringify(existing) !== JSON.stringify(registration.budget)) throw Error('Active analyzer budget changed');
        if (!existing) {
          frozen.set(key, registration.budget);
          appendFileSync(join(dir, 'budgets.jsonl'), JSON.stringify(registration) + '\n');
        }
        budgets.set(activeIdentity.pid, registration.budget);
      }
      // Opt10 is started through its existing inner guard rather than common.ts.
      for (const row of family) if (/^(cube48opt-research|solve_h48_h10)$/.test(row.name)) {
        const key = JSON.stringify(snap.identities.get(row.pid));
        if (!frozen.has(key)) {
          const budget = budgetForOptimum(); frozen.set(key, budget);
          appendFileSync(join(dir, 'budgets.jsonl'), JSON.stringify({ identity: snap.identities.get(row.pid), budget }) + '\n');
        }
        budgets.set(row.pid, frozen.get(key)!);
      }
      const observation = observe();
      // Save the triggering raw observation too, even if validation throws.
      last = { ...observation, ...resourceValues(observation, family, budgets), pids: family.map(p => p.pid), headroomMethod: 'available-minus-active-mapped-RSS-upper-bound-minus-512MiB' };
      const values = resourceLimits(owner.baseline, observation, family, budgets);
      peakRss = Math.max(peakRss, values.rss); minimumHeadroom = Math.min(minimumHeadroom ?? Infinity, values.headroom); samples++;
      last = { ...observation, ...values, pids: family.map(p => p.pid), headroomMethod: 'available-minus-active-mapped-RSS-upper-bound-minus-512MiB' };
      appendFileSync(join(dir, 'samples.jsonl'), JSON.stringify(last) + '\n');
      atomic(join(dir, 'current.json'), { ...last as object, peakRss, minimumHeadroom, samples, known: [...known.values()] });
      if (existsSync(join(dir, 'finish.json'))) {
        if (family.some(p => p.pid !== owner.root.pid && !isTsxService(p, snap.identities.get(p.pid)))) throw Error('Statistics finished with surviving child processes');
        atomic(join(dir, 'exit.json'), { ...read<object>(join(dir, 'finish.json')), baseline: owner.baseline, last, peakRss, minimumHeadroom, samples, finishedAt: new Date().toISOString() });
        return;
      }
    } catch (error) { await stop(String(error)); return; }
    await delay(1000);
  }
}

/** One parent monitor survives every nested stage and publication subprocess.
 * stateDir is injectable for isolated lifecycle fixtures; CLI has no override.
 */
export async function withStatsResourceMonitor(action: () => Promise<void>, stateDir = defaultStateDir): Promise<void> {
  if (process.platform !== 'darwin' || inheritedRun()) { await action(); return; }
  mkdirSync(stateDir, { recursive: true });
  const now = observe(), stop = priorStop(stateDir);
  validateStatsRun(now, now);
  if (stop) {
    const reviewPath = join(stateDir, 'resume-review.json');
    if (!existsSync(reviewPath)) throw Error(`Statistics previously stopped; explicit review required for ${stop.path}. Original boot/Swapouts baseline is retained.`);
    validateResumeReview(read(reviewPath), stop, now);
  }
  if (now.computeRunning || now.lockExists) throw Error('Another solver or retained compute lock prevents statistics startup');
  if (snapshot().rows.some(row => /(?:_analyzer|sq1_slash_mitm)(?:\.exe)?$/.test(row.name))) throw Error('Another analyzer prevents statistics startup');
  if (now.available < 10 * GiB + reserve) throw Error('Insufficient statistics startup headroom');
  const root = identity(process.pid);
  if (!root) throw Error('Cannot identify statistics root');
  const lock = join(stateDir, 'active.lock');
  if (existsSync(lock) && stop) {
    const prior = read<Identity & { monitor?: Identity }>(lock);
    if (sameIdentity(prior, identity(prior.pid))) throw Error('Statistics run still owns the retained lock');
    if (prior.monitor && sameIdentity(prior.monitor, identity(prior.monitor.pid))) throw Error('Prior statistics monitor still owns the retained lock');
    // Only a reviewed protected stop can release a dead owner's retained lock.
    unlinkSync(lock);
  }
  const lockFd = openSync(lock, 'wx', 0o600);
  try { writeFileSync(lockFd, JSON.stringify(root)); fsyncSync(lockFd); } finally { closeSync(lockFd); }
  const dir = join(stateDir, 'runs', `${Date.now()}-${process.pid}-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  const owner: Owner = { root, baseline: now, token: randomUUID(), startedAt: new Date().toISOString(), ...(stop ? { priorStop: { path: stop.path, sha256: stop.sha256 } } : {}) };
  atomic(join(dir, 'owner.json'), owner);
  if (stop) atomic(join(dir, 'resume-review.json'), read(join(stateDir, 'resume-review.json')));
  const monitor = spawn(process.execPath, [...process.execArgv, ownFile, '--watch', dir], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const exited = new Promise<number>(done => { monitor.once('error', error => { console.error(error); done(1); }); monitor.once('exit', code => done(code ?? 1)); });
  let timer: NodeJS.Timeout | undefined;
  let ready = false;
  let status = 'failed';
  let unexpectedExit = false;
  const requestStop = (signal: string) => atomic(join(dir, 'request-stop.json'), { reason: `Interrupted by ${signal}` });
  const onInt = () => requestStop('SIGINT'), onTerm = () => requestStop('SIGTERM');
  try {
    await Promise.race([new Promise<void>(done => monitor.once('message', message => { if ((message as { ready?: boolean })?.ready) done(); })),
      exited.then(() => { throw Error('Statistics resource monitor exited before readiness'); }),
      new Promise<never>((_, fail) => { timer = setTimeout(() => fail(Error('Statistics monitor startup timeout')), 15000); })]);
    if (timer) clearTimeout(timer);
    ready = true;
    atomic(lock, { ...root, monitor: identity(monitor.pid!) });
    process.env[runEnv] = dir;
    process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
    console.log(`[资源监控] ${dir}`);
    await runWhileMonitored(action, exited, () => { unexpectedExit = true; });
    status = process.exitCode === 2 ? 'partial' : process.exitCode === undefined || process.exitCode === 0 ? 'complete' : 'failed';
  } finally {
    if (timer) clearTimeout(timer);
    try { atomic(join(dir, 'finish.json'), { status }); }
    catch (error) { unexpectedExit = true; console.error('Could not persist statistics completion:', error); }
    if (!ready) {
      // No work was started. Bound cleanup even when the observer never reached
      // readiness, instead of awaiting a stuck child forever.
      const childIdentity = monitor.pid ? identity(monitor.pid) : undefined;
      if (childIdentity) signalVerified(childIdentity, 'SIGTERM');
      await Promise.race([exited.catch(() => 1), delay(1000)]);
      if (childIdentity) signalVerified(childIdentity, 'SIGKILL');
    }
    let completionTimeout: NodeJS.Timeout | undefined;
    const code = await Promise.race([exited, new Promise<number>(done => {
      completionTimeout = setTimeout(() => {
        unexpectedExit = true;
        const childIdentity = monitor.pid ? identity(monitor.pid) : undefined;
        if (childIdentity) signalVerified(childIdentity, 'SIGKILL');
        done(1);
      }, 30000);
    })]);
    if (completionTimeout) clearTimeout(completionTimeout);
    process.off('SIGINT', onInt); process.off('SIGTERM', onTerm);
    if (code === 0 && !unexpectedExit) {
      if ((status === 'complete' || status === 'partial') && owner.priorStop) archiveReviewedStatsStop(stateDir, dir, owner.priorStop);
      unlinkSync(lock);
    }
    if (code !== 0 || unexpectedExit) {
      // If the observer itself crashed, fail closed rather than leaving work
      // running without protection. Never signal the monitor or a reused PID.
      const reason = existsSync(join(dir, 'protected-stop.json')) ? read<{ reason: string }>(join(dir, 'protected-stop.json')).reason : 'Statistics resource monitor failed';
      const record = { baseline: owner.baseline, root, reason, finishedAt: new Date().toISOString() };
      try {
        if (!existsSync(join(dir, 'protected-stop.json'))) atomic(join(dir, 'protected-stop.json'), record);
        if (!existsSync(join(stateDir, 'protected-stop.json'))) atomic(join(stateDir, 'protected-stop.json'), record);
        updateSummaries(dir, reason);
      } catch (error) { console.error('Could not persist statistics monitor failure:', error); }
      try {
        const known = new Map<number, Identity>();
        try {
          for (const previous of read<{ known: Identity[] }>(join(dir, 'current.json')).known) known.set(previous.pid, previous);
        } catch { /* startup may precede the first observation */ }
        terminateOwnedChildren(root, known, monitor.pid ?? -1);
      } catch (error) {
        console.error('Could not inspect statistics children during emergency stop:', error);
      }
      console.error(`Statistics monitor stopped the run; see ${dir}`);
      // Promise.race cannot cancel the action's async continuation. This root is
      // the CLI owner; exit after saving evidence and draining its child tree so
      // it cannot resume computation or publication without a live observer.
      process.exit(1);
    }
    delete process.env[runEnv];
  }
}

if (process.argv[1] && resolve(process.argv[1]) === ownFile && process.argv[2] === '--watch') {
  void watch(resolve(process.argv[3])).catch(error => { console.error(error); process.exitCode = 1; });
}
