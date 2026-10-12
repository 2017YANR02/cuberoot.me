/** Local, read-only macOS flight recorder. No process arguments, network upload or solver restart. */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import { homedir, loadavg, totalmem } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const MiB = 1024 ** 2;
export const label = 'me.cuberoot.system-recorder';
const defaultDir = join(homedir(), 'Library/Logs/CubeRoot-SystemRecorder');
const predicate = '(process == "kernel" OR process == "watchdogd" OR process == "WindowServer" OR process == "powerd" OR process == "loginwindow") AND (messageType == error OR messageType == fault OR eventMessage CONTAINS[c] "shutdown" OR eventMessage CONTAINS[c] "panic" OR eventMessage CONTAINS[c] "thermal" OR eventMessage CONTAINS[c] "stall")';

type Command = { ok: boolean; output: string; error?: string };
async function command(bin: string, args: string[], timeout = 4000): Promise<Command> {
  try {
    const r = await exec(bin, args, { timeout, maxBuffer: 2 * MiB, env: { ...process.env, LC_ALL: 'C' } });
    return { ok: true, output: r.stdout.trim() };
  } catch (e: any) {
    return { ok: false, output: String(e.stdout ?? '').slice(-2 * MiB), error: String(e.stderr || e.message).slice(0, 500) };
  }
}
async function powerLog(from: string, to: string): Promise<Command> {
  // pmset can return weeks of history. Filter during streaming instead of loading it all into RAM.
  return new Promise(resolve => {
    const child = spawn('/usr/bin/pmset', ['-g', 'log'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buffer = '', output = '', error = '', timedOut = false, truncated = false;
    const line = (value: string) => {
      if (value.slice(0, 19) >= from && value.slice(0, 19) <= to) {
        output += value + '\n';
        if (output.length > MiB) { output = output.slice(-MiB); truncated = true; }
      }
    };
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop()!.slice(-16384);
      lines.forEach(line);
    });
    child.stderr.on('data', d => { error = (error + String(d)).slice(-500); });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 8000);
    child.on('error', e => { error = String(e); });
    child.on('close', code => {
      clearTimeout(timer); line(buffer);
      resolve({ ok: code === 0 && !timedOut && !truncated, output, error: error || (timedOut ? 'Timed out' : truncated ? 'Excerpt limited to final 1 MiB' : undefined) });
    });
  });
}
function atomic(path: string, data: unknown) {
  const fd = fs.openSync(path + '.new', 'w', 0o600);
  try { fs.writeFileSync(fd, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(path + '.new', path);
}
function readJson(path: string): any { try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return null; } }
export function parseVm(text: string) {
  const pageSize = Number(text.match(/page size of (\d+) bytes/)?.[1]);
  const pages: Record<string, number> = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([^:]+):\s+(\d+)\./);
    if (m) pages[m[1].replaceAll('"', '')] = Number(m[2]);
  }
  if (!pageSize || !Number.isFinite(pages.Swapouts)) throw Error('vm_stat incomplete');
  return { pageSize, pages };
}
export function swapDelta(previous: any, next: any): number | null {
  if (!previous || previous.boot !== next.boot || !Number.isFinite(previous.vm?.pages?.Swapouts) || !Number.isFinite(next.vm?.pages?.Swapouts)) return null;
  const delta = next.vm.pages.Swapouts - previous.vm.pages.Swapouts;
  return delta >= 0 ? delta * next.vm.pageSize : null;
}
export function restartKind(previous: any, boot: string) {
  if (!previous) return 'first-install';
  if (previous.boot !== boot) return 'new-boot-cause-unknown';
  return previous.stoppedAt ? 'recorder-restart' : 'recorder-interrupted-same-boot';
}
export function memorySummary(vm: ReturnType<typeof parseVm> | null) {
  if (!vm || !Number.isFinite(vm.pages['Pages free']) || !Number.isFinite(vm.pages['File-backed pages'])) return null;
  return { freeBytes: vm.pages['Pages free'] * vm.pageSize, reclaimableEstimateBytes: (vm.pages['Pages free'] + vm.pages['File-backed pages']) * vm.pageSize };
}
export function parseProcesses(text: string) {
  return text.split('\n').flatMap(line => {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\S+)\s+(.+)$/);
    return m ? [{ pid: +m[1], ppid: +m[2], rssBytes: +m[3] * 1024, cpuPercent: +m[4], state: m[5], name: basename(m[6]) }] : [];
  });
}
function append(dir: string, kind: string, data: unknown) {
  const day = new Date().toISOString().slice(0, 10);
  let path = join(dir, `${kind}-${day}.jsonl`);
  // Each daily stream is bounded, including unusually noisy system events.
  if (fs.existsSync(path) && fs.statSync(path).size > 16 * MiB) {
    fs.renameSync(path, path + '.previous');
  }
  const fd = fs.openSync(path, 'a', 0o600);
  try { fs.writeSync(fd, JSON.stringify(data) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
function prune(dir: string) {
  // Only this recorder's generated telemetry; incident reports are retained separately.
  const files = fs.readdirSync(dir).filter(n => /^(samples|events|system)-\d{4}-\d{2}-\d{2}\.jsonl(\.previous)?$/.test(n))
    .map(n => ({ path: join(dir, n), stat: fs.statSync(join(dir, n)) })).sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  let total = 0;
  for (const file of files) {
    total += file.stat.size;
    if (Date.now() - file.stat.mtimeMs > 14 * 86400_000 || total > 256 * MiB) fs.unlinkSync(file.path);
  }
}
function tailFile(path: string, bytes = 128 * 1024) {
  const fd = fs.openSync(path, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const b = Buffer.alloc(Math.min(size, bytes));
    fs.readSync(fd, b, 0, b.length, Math.max(0, size - b.length));
    return b.toString('utf8');
  } finally { fs.closeSync(fd); }
}
async function incident(dir: string, previous: any, boot: string, suffix = '') {
  const id = new Date().toISOString().replaceAll(':', '-') + suffix;
  const target = join(dir, 'incidents', id);
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  atomic(join(target, 'previous-state.json'), previous ?? { evidence: 'No pre-incident recorder data: first installation' });
  const bootSeconds = Number(boot.match(/sec = (\d+)/)?.[1]);
  const end = new Date((bootSeconds + 180) * 1000);
  // Time bounds are explicit and include the previous last sample when available.
  const start = new Date(Math.min(previous?.at ? Date.parse(previous.at) : Infinity, bootSeconds * 1000) - (previous ? 15 : 60) * 60_000);
  const from = start.toLocaleString('sv-SE', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const to = end.toLocaleString('sv-SE', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const [logs, reboots, power] = await Promise.all([
    command('/usr/bin/log', ['show', '--start', '@' + Math.floor(+start / 1000), '--end', '@' + Math.floor(+end / 1000), '--style', 'compact', '--predicate', predicate], 8000),
    command('/usr/bin/last', ['-10', 'reboot', 'shutdown']),
    powerLog(from, to),
  ]);
  const logHasEvents = logs.output.split('\n').some(line => /^\d{4}-/.test(line));
  atomic(join(target, 'unified-log.json'), { ...logs, eventsReadable: logHasEvents, note: logHasEvents ? '' : 'No accessible events. This is an evidence gap, not proof of no fault.' });
  atomic(join(target, 'reboots.txt'), reboots.output);
  atomic(join(target, 'power-log.json'), power);
  for (const name of ['system.log', 'fsck_apfs.log', 'fsck_apfs_error.log']) {
    try { atomic(join(target, name), tailFile('/var/log/' + name)); }
    catch (e) { atomic(join(target, name + '.unavailable.txt'), String(e)); }
  }
  const diagnosticIndex: any[] = [];
  // No ProxiedDevice traversal: those reports can belong to a phone/display, not this Mac.
  for (const source of ['/Library/Logs/DiagnosticReports', '/Library/Logs/DiagnosticReports/Retired', join(homedir(), 'Library/Logs/DiagnosticReports')]) {
    try {
      for (const name of fs.readdirSync(source)) {
        if (!/\.(ips|panic|diag)$/.test(name)) continue;
        const path = join(source, name), stat = fs.statSync(path);
        if (!stat.isFile() || stat.mtimeMs < +start || stat.mtimeMs > Date.now()) continue;
        const entry: any = { path, bytes: stat.size, modified: stat.mtime.toISOString() };
        // Store header only: complete system report stays at its original private path.
        try { const fd = fs.openSync(path, 'r'); try { const b = Buffer.alloc(Math.min(4096, stat.size)); fs.readSync(fd, b); entry.header = b.toString('utf8'); } finally { fs.closeSync(fd); } }
        catch (e) { entry.error = String(e); }
        diagnosticIndex.push(entry);
      }
    } catch (e) { diagnosticIndex.push({ source, error: String(e) }); }
  }
  atomic(join(target, 'diagnostics.json'), diagnosticIndex);
  // Preserve a bounded tail of the preceding samples even after normal telemetry retention expires.
  for (const name of fs.readdirSync(dir).filter(n => /^(samples|system|events)-.*\.jsonl(\.previous)?$/.test(n)).sort().slice(-12)) {
    atomic(join(target, name), tailFile(join(dir, name), MiB));
  }
  const resourceSummary = previous?.vm ? `\n- 最后内存压力：${previous.pressure}（1 正常，2 警告，4 严重）\n- 最后 Swapouts：${previous.vm.pages.Swapouts} 页；仅同一次开机可以比较增量\n- 最后采样间隔：${previous.sampleGapSeconds ?? '未知'} 秒\n- 最后内存占用前五进程：${previous.byRam?.slice(0, 5).map((p: any) => `${p.name} ${(p.rssBytes / 1024 ** 3).toFixed(2)} GiB`).join('；')}\n` : '';
  const report = `# Mac 重启证据记录\n\n生成时间：${new Date().toLocaleString('zh-CN')}\n\n- 开机标识：${boot}\n- 上次采样：${previous?.at ?? '未安装记录器，缺少故障前采样'}\n- 上次记录器退出标记：${previous?.stoppedAt ?? '无；不能仅据此判断突然断电'}\n- 分类：${restartKind(previous, boot)}\n- 统一日志：${logHasEvents ? '取得事件，见附件' : '未读取到事件，原因未明；不能当作没有故障'}\n- 诊断报告索引：${diagnosticIndex.length} 项，需按时间与具体内容判断，不能把开机后的应用崩溃当作关机原因。\n${resourceSummary}\n**当前不能自动判定根因。** 新开机不一定是系统崩溃；断电、手动关机、内核故障和记录器中断须结合日志区分。\n\n证据目录：${target}\n\n上次内存与交换计数见 previous-state.json，故障前过程见 samples 与 system 文件。交换增量只比较同一次开机。采样间隔约 10 秒，fsync 尽力持久化，断电仍可能丢失末尾记录。\n`;
  atomic(join(target, 'report.md'), report);
  atomic(join(dir, 'latest-incident.md'), report);
  return target;
}
async function record(dir: string, once: boolean) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const bootResult = await command('/usr/sbin/sysctl', ['-n', 'kern.boottime']);
  if (!bootResult.ok || !/sec = \d+/.test(bootResult.output)) throw Error('Cannot identify boot');
  const boot = bootResult.output;
  const ownerPath = join(dir, 'owner.json'), existing = readJson(ownerPath);
  if (existing?.boot === boot) {
    let alive = false;
    try { process.kill(existing.pid, 0); alive = true; } catch {}
    if (alive) throw Error('Recorder already running');
  }
  // launchd is the single persistent owner; exclusive file also prevents a manual second instance.
  if (fs.existsSync(ownerPath)) fs.unlinkSync(ownerPath);
  fs.writeFileSync(ownerPath, JSON.stringify({ pid: process.pid, boot }), { flag: 'wx', mode: 0o600 });
  const statePath = join(dir, 'state.json');
  let previous = readJson(statePath), stopped = false, lastSlow = 0, slow: any = null;
  let stopSignal: string | undefined;
  let stream: ReturnType<typeof spawn> | undefined, streamStatus = 'not-started', streamRestartAt = 0;
  let lineBuffer = '', dropped = 0;
  const messages = new Map<string, { firstAt: string; lastAt: string; count: number }>();
  function capture(text: string) {
    lineBuffer += text;
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop()!.slice(-16384);
    for (const line of lines) {
      const at = line.match(/^\d{4}-\d\d-\d\d \S+/)?.[0];
      if (!at) continue;
      const message = line.slice(at.length).trim().slice(0, 2048);
      const old = messages.get(message);
      if (old) { old.count++; old.lastAt = at; }
      else if (messages.size < 128) messages.set(message, { firstAt: at, lastAt: at, count: 1 });
      else dropped++;
    }
  }
  function ensureStream() {
    if (once || stream || Date.now() < streamRestartAt) return;
    stream = spawn('/usr/bin/log', ['stream', '--style', 'compact', '--level', 'default', '--predicate', predicate], { stdio: ['ignore', 'pipe', 'pipe'] });
    streamStatus = 'running';
    stream.stdout!.setEncoding('utf8').on('data', capture);
    stream.stderr!.on('data', data => { streamStatus = 'stderr: ' + String(data).slice(0, 300); });
    stream.on('error', e => { streamStatus = 'error: ' + String(e); });
    stream.on('close', code => { streamStatus = 'exited: ' + code; stream = undefined; streamRestartAt = Date.now() + 60000; });
  }
  function flushStream() {
    if (messages.size || dropped) append(dir, 'system', { at: new Date().toISOString(), boot, messages: [...messages].map(([message, info]) => ({ message, ...info })), droppedUniqueLines: dropped });
    messages.clear(); dropped = 0;
  }
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { stopped = true; stopSignal = signal; });
  try {
    append(dir, 'events', { at: new Date().toISOString(), boot, event: restartKind(previous, boot), previousAt: previous?.at });
    if (!once && (!previous || previous.boot !== boot)) {
      await incident(dir, previous, boot);
      if (previous) await command('/usr/bin/osascript', ['-e', 'display notification "检测到新开机，已保存上次资源记录及诊断索引。打开 CubeRoot-SystemRecorder 的 latest-incident.md 查看。" with title "Mac 重启记录已生成"']);
    }
    while (!stopped) {
      const started = Date.now();
      ensureStream();
      const [vm, pressure, ps] = await Promise.all([
        command('/usr/bin/vm_stat', []), command('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level']),
        command('/bin/ps', ['-axo', 'pid=,ppid=,rss=,%cpu=,state=,comm=']),
      ]);
      if (started - lastSlow >= 60000) {
        const [thermal, disk, io] = await Promise.all([command('/usr/bin/pmset', ['-g', 'therm']), command('/bin/df', ['-k', dir]), command('/usr/sbin/iostat', ['-Id'])]);
        slow = { at: new Date().toISOString(), thermal, disk, io };
        lastSlow = started;
        prune(dir);
      }
      const processes = parseProcesses(ps.output);
      const byRam = [...processes].sort((a, b) => b.rssBytes - a.rssBytes).slice(0, 15);
      const byCpu = [...processes].sort((a, b) => b.cpuPercent - a.cpuPercent).slice(0, 10);
      let parsedVm: ReturnType<typeof parseVm> | null = null;
      try { if (vm.ok) parsedVm = parseVm(vm.output); } catch {}
      const sample: any = { at: new Date().toISOString(), boot, recorderUptimeSeconds: process.uptime(), totalMemoryBytes: totalmem(), vm: parsedVm, memory: memorySummary(parsedVm),
        pressure: pressure.ok ? Number(pressure.output) : null, loadavg: loadavg(), byRam, byCpu, slow,
        errors: [!parsedVm && 'vm_stat unavailable', !pressure.ok && pressure.error, !ps.ok && ps.error].filter(Boolean),
        logStreamStatus: streamStatus, recorderRssBytes: process.memoryUsage().rss, sampleDurationMs: Date.now() - started };
      sample.swapOutDeltaBytes = swapDelta(previous, sample);
      sample.sampleGapSeconds = previous?.boot === boot ? (Date.parse(sample.at) - Date.parse(previous.at)) / 1000 : null;
      const alerts = [sample.swapOutDeltaBytes > 0 && 'new-swapouts', sample.pressure !== null && sample.pressure !== 1 && 'memory-pressure', sample.sampleGapSeconds > 30 && 'sampling-gap-sleep-or-stall-or-recorder-restart'];
      if (alerts.some(Boolean)) append(dir, 'events', { at: sample.at, boot, alerts: alerts.filter(Boolean), swapOutDeltaBytes: sample.swapOutDeltaBytes, pressure: sample.pressure });
      append(dir, 'samples', sample);
      flushStream();
      atomic(statePath, sample);
      previous = sample;
      if (sample.recorderRssBytes > 192 * MiB) throw Error('Recorder memory budget exceeded');
      if (once) break;
      // Slow commands cannot accumulate: only one sampling round at a time.
      await new Promise(r => setTimeout(r, Math.max(100, 10000 - (Date.now() - started))));
    }
    atomic(statePath, { ...previous, stoppedAt: new Date().toISOString(), stopSignal: stopSignal ?? 'once-complete' });
  } finally { stream?.kill('SIGTERM'); flushStream(); fs.unlinkSync(ownerPath); }
}
async function install() {
  const { launchAgentXml } = await import('./dev-preview/autostart.ts');
  const support = join(homedir(), '.local/share/cuberoot-system-recorder');
  fs.mkdirSync(support, { recursive: true, mode: 0o700 });
  fs.mkdirSync(defaultDir, { recursive: true, mode: 0o700 });
  const entry = join(support, 'recorder.mts');
  fs.copyFileSync(fileURLToPath(import.meta.url), entry);
  const plist = join(homedir(), 'Library/LaunchAgents', label + '.plist');
  const stableNode = join(homedir(), '.local/bin/node');
  const xml = launchAgentXml(label, fs.existsSync(stableNode) ? stableNode : process.execPath, ['--max-old-space-size=96', entry, '--run'], '/usr/bin:/bin:/usr/sbin:/sbin', defaultDir)
    .replace('</dict></plist>', '<key>ProcessType</key><string>Background</string><key>Nice</key><integer>10</integer><key>ExitTimeOut</key><integer>30</integer></dict></plist>');
  atomic(plist, xml);
  const domain = `gui/${process.getuid!()}`;
  const status = await command('/bin/launchctl', ['print', `${domain}/${label}`]);
  if (status.ok) {
    const stop = await command('/bin/launchctl', ['bootout', `${domain}/${label}`], 35000);
    if (!stop.ok) throw Error(stop.error);
    // bootout may return before the old label and process have finished their graceful exit.
    for (let tries = 0; tries < 35; tries++) {
      const remaining = await command('/bin/launchctl', ['print', `${domain}/${label}`]);
      if (!remaining.ok && !fs.existsSync(join(defaultDir, 'owner.json'))) break;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  const result = await command('/bin/launchctl', ['bootstrap', domain, plist]);
  if (!result.ok) throw Error(result.error);
  console.log(JSON.stringify({ installed: true, plist, entry, directory: defaultDir }));
}
async function main() {
  if (process.platform !== 'darwin') throw Error('macOS only');
  process.umask(0o077);
  const dirArg = process.argv.find(a => a.startsWith('--directory='));
  const dir = dirArg ? resolve(dirArg.slice('--directory='.length)) : defaultDir;
  if (process.argv.includes('--install')) await install();
  else if (process.argv.includes('--incident')) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const boot = await command('/usr/sbin/sysctl', ['-n', 'kern.boottime']);
    if (!boot.ok) throw Error('Cannot identify boot');
    const saved = readJson(join(dir, 'state.json'));
    // Manual evidence collection after a reboot must not label today's sample as pre-reboot data.
    console.log(await incident(dir, saved?.boot !== boot.output ? saved : null, boot.output));
  } else if (process.argv.includes('--run') || process.argv.includes('--once')) await record(dir, process.argv.includes('--once'));
  else throw Error('Use --install, --run, --once, or --incident');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(String(e)); process.exitCode = 1; });
