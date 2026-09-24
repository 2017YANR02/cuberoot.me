/** WCA export incremental intake for the local scramble statistics pipeline. */
import { createReadStream, createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { wcaDir } from './local_data_paths.js';
import { downloadStatus, intakeProgress } from './intake_progress.js';

const EXPORT_META_URL = 'https://www.worldcubeassociation.org/api/v0/export/public';
const EVENTS = new Set(['333', '333oh', '333ft', '333bf', '333mbf', '333fm']);
const INFO = ['id', 'scramble', 'competition_id', 'event_id', 'round_type_id', 'group_id', 'is_extra', 'scramble_num'] as const;
type Key = typeof INFO[number];
type Row = Record<Key, string>;
type Options = { dataDir: string; exportZip?: string; tsvDir?: string; sourceCsv?: string; useCached: boolean; dryRun: boolean; minScrambleId?: number };

function parseArgs(argv: string[]): Options {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`未知参数: ${key}`);
    if (key === '--use-cached' || key === '--dry-run') args.set(key, true);
    else {
      const value = argv[++i];
      if (!value) throw new Error(`${key} 缺值`);
      args.set(key, value);
    }
  }
  const dataDir = String(args.get('--data-dir') || process.env.SCRAMBLE_DATA_DIR || wcaDir);
  const min = args.get('--min-scramble-id');
  if (min !== undefined && !/^\d+$/.test(String(min))) throw new Error('--min-scramble-id 必须是非负整数');
  return {
    dataDir: path.resolve(dataDir),
    exportZip: args.get('--export-zip') as string | undefined,
    tsvDir: args.get('--tsv-dir') as string | undefined,
    sourceCsv: args.get('--source-csv') as string | undefined,
    useCached: !!args.get('--use-cached'), dryRun: !!args.get('--dry-run'),
    minScrambleId: min === undefined ? undefined : Number(min),
  };
}

async function exists(file: string): Promise<boolean> { try { await fs.access(file); return true; } catch { return false; } }
function norm(s: string): string { return s.trim().toLowerCase().replace(/[_ ]/g, ''); }
function columns(header: string[], aliases: Record<string, string[]>): Record<string, number> {
  const lookup = new Map(header.map((h, i) => [norm(h), i]));
  const out: Record<string, number> = {};
  for (const [key, choices] of Object.entries(aliases)) {
    const found = choices.map(c => lookup.get(norm(c))).find(i => i !== undefined);
    if (found !== undefined) out[key] = found;
  }
  return out;
}
const SCRAMBLE_ALIASES = Object.fromEntries(INFO.map(key => [key, key === 'id' ? ['id', 'scramble_id'] : [key]]));
const COMP_ALIASES: Record<string, string[]> = {
  id: ['id', 'competition_id'], name: ['name', 'cell_name', 'short_name'],
  start_date: ['start_date', 'startdate'], end_date: ['end_date', 'enddate'],
  year: ['year'], month: ['month'], day: ['day'], end_year: ['end_year', 'endyear'],
  end_month: ['end_month', 'endmonth'], end_day: ['end_day', 'endday'],
};
function cell(row: string[], cm: Record<string, number>, key: string): string { return cm[key] === undefined ? '' : (row[cm[key]] ?? ''); }
async function* lines(file: string, label?: string): AsyncGenerator<string> {
  const input = createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let count = 0;
  const stop = label ? intakeProgress(label, () => `已读 ${count.toLocaleString('en-US')} 行`) : undefined;
  try { for await (const line of rl) { count++; yield line; } }
  finally { stop?.(); rl.close(); input.destroy(); }
}
function ymd(y: string, m: string, d: string): string {
  if ([y, m, d].some(s => !s || s === '0' || s === 'NULL' || !/^\d+$/.test(s))) return '';
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
async function refreshCompetitions(src: string, dest: string): Promise<void> {
  const output = createWriteStream(`${dest}.tmp`, { encoding: 'utf8' });
  let cm: Record<string, number> | undefined;
  let count = 0;
  try {
    output.write('id\tname\tstart_date\tend_date\n');
    for await (const line of lines(src)) {
      const row = line.split('\t');
      if (!cm) {
        cm = columns(row, COMP_ALIASES);
        if (cm.id === undefined || cm.name === undefined) throw new Error('Competitions.tsv 缺 id/name');
        continue;
      }
      const start = cell(row, cm, 'start_date') || ymd(cell(row, cm, 'year'), cell(row, cm, 'month'), cell(row, cm, 'day'));
      const end = cell(row, cm, 'end_date') || ymd(cell(row, cm, 'end_year'), cell(row, cm, 'end_month'), cell(row, cm, 'end_day'));
      output.write(`${cell(row, cm, 'id')}\t${cell(row, cm, 'name')}\t${start}\t${end}\n`);
      count++;
    }
    if (!cm) throw new Error('Competitions.tsv 为空');
    output.end(); await new Promise<void>((resolve, reject) => { output.on('finish', resolve); output.on('error', reject); });
    await fs.rename(`${dest}.tmp`, dest);
  } catch (error) { output.destroy(); throw error; }
  console.log(`competitions.tsv 刷新 ${count} 行 -> ${dest}`);
}

async function runTar(args: string[], stdoutFile?: string): Promise<string> {
  const child = spawn('tar', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8'); child.stderr.on('data', s => { stderr += s; });
  let result = '';
  const consume = stdoutFile
    ? pipeline(child.stdout, createWriteStream(`${stdoutFile}.tmp`))
    : (async () => { for await (const chunk of child.stdout) result += chunk.toString('utf8'); })();
  const code = await new Promise<number>((resolve, reject) => { child.on('error', reject); child.on('close', c => resolve(c ?? 1)); });
  await consume;
  if (code !== 0) throw new Error(`tar ${args[0]} 失败: ${stderr.trim()}`);
  if (stdoutFile) await fs.rename(`${stdoutFile}.tmp`, stdoutFile);
  return result;
}
async function validZip(file: string): Promise<boolean> {
  if (!await exists(file)) return false;
  const stop = intakeProgress('检查 ZIP 目录');
  try { await runTar(['-tf', file]); return true; } catch { return false; }
  finally { stop(); }
}
async function download(url: string, dest: string): Promise<void> {
  const part = `${dest}.part`;
  if (await exists(dest) && !await validZip(dest)) await fs.rename(dest, part);
  for (let attempt = 1; attempt <= 6; attempt++) {
    let done = await exists(part) ? (await fs.stat(part)).size : 0;
    let received = 0, total = 0;
    let responseAt = 0;
    let stop: (() => void) | undefined = intakeProgress(`下载 WCA export ${attempt}/6`, () => responseAt
      ? downloadStatus(done, total, received, (Date.now() - responseAt) / 1000)
      : `${(done / 1e6).toFixed(1)} MB 已缓存，等待响应`);
    const controller = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const armTimeout = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(new Error('60s 无下载数据')), 60_000);
    };
    try {
      armTimeout();
      const response = await fetch(url, { headers: done ? { Range: `bytes=${done}-` } : {}, signal: controller.signal });
      if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`);
      if (done && response.status !== 206) { done = 0; await fs.truncate(part, 0); }
      const length = Number(response.headers.get('content-length') || 0);
      total = length ? done + length : 0;
      responseAt = Date.now();
      if (!response.body) throw new Error('下载响应无 body');
      const out = createWriteStream(part, { flags: done ? 'a' : 'w' });
      const reader = response.body.getReader();
      try {
        while (true) {
          armTimeout();
          const chunk = await reader.read();
          if (chunk.done) break;
          if (!out.write(chunk.value)) await new Promise<void>(resolve => out.once('drain', resolve));
          done += chunk.value.byteLength;
          received += chunk.value.byteLength;
        }
      } finally { clearTimeout(idleTimer); out.end(); await new Promise<void>(resolve => out.once('finish', resolve)); reader.releaseLock(); }
      if (length && done !== total) throw new Error(`连接提前结束 ${done}/${total}`);
      stop(); stop = undefined;
      if (!await validZip(part)) throw new Error('下载文件不是合法 ZIP');
      await fs.rename(part, dest);
      console.log(`下载完成 ${Math.round(done / 1e6)} MB -> ${dest}`);
      return;
    } catch (error) {
      stop?.(); stop = undefined;
      console.warn(`下载中断 ${attempt}/6: ${String(error)}; 保留 .part 续传`);
      if (attempt === 6) throw error;
      await new Promise(resolve => setTimeout(resolve, 2_000 * attempt));
    } finally { clearTimeout(idleTimer); stop?.(); }
  }
}
async function fetchExport(o: Options, incr: string): Promise<{ dir: string; date: string }> {
  if (o.tsvDir) return { dir: path.resolve(o.tsvDir), date: 'manual' };
  const cache = path.join(incr, 'cache');
  await fs.mkdir(cache, { recursive: true });
  let zip = o.exportZip && path.resolve(o.exportZip);
  let date = 'manual';
  if (!zip && o.useCached) {
    const entries = (await fs.readdir(cache)).filter(name => /^WCA_export_\d{4}-\d{2}-\d{2}\.tsv\.zip$/.test(name)).sort().reverse();
    for (const name of entries) if (await validZip(path.join(cache, name))) { zip = path.join(cache, name); date = name.slice(11, 21); break; }
    if (!zip) throw new Error('--use-cached 但 cache/ 没有合法 export ZIP');
    console.log(`使用缓存 ${zip}, export_date=${date}`);
  }
  if (!zip) {
    const stop = intakeProgress('查询 WCA export 版本', () => '等待网络响应，60 秒超时');
    let meta: Record<string, string>;
    try {
      const response = await fetch(EXPORT_META_URL, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`export metadata: HTTP ${response.status}`);
      meta = await response.json() as Record<string, string>;
    } finally { stop(); }
    date = (meta.export_date || meta.exportDate || 'unknown').slice(0, 10);
    const url = meta.tsv_url || meta.tsvUrl;
    if (!url) throw new Error('export metadata 缺 tsv_url');
    zip = path.join(cache, `WCA_export_${date}.tsv.zip`);
    if (!await validZip(zip)) await download(url, zip);
  }
  if (!await validZip(zip)) throw new Error(`无效 ZIP: ${zip}`);
  const out = path.join(incr, 'tsv');
  await fs.mkdir(out, { recursive: true });
  const marker = path.join(out, '.export_date');
  const prev = await exists(marker) ? (await fs.readFile(marker, 'utf8')).trim() : '';
  if (!o.exportZip && prev === date && await exists(path.join(out, 'Scrambles.tsv')) && await exists(path.join(out, 'Competitions.tsv'))) {
    console.log(`tsv/ 已是 ${date}, 跳过解压`);
    return { dir: out, date };
  }
  const stopListing = intakeProgress('读取 ZIP 文件清单');
  let members: string[];
  try { members = (await runTar(['-tf', zip])).split(/\r?\n/).filter(Boolean); }
  finally { stopListing(); }
  for (const [fragment, file] of [['scramble', 'Scrambles.tsv'], ['competition', 'Competitions.tsv']] as const) {
    const member = members.find(name => name.toLowerCase().includes(fragment) && name.toLowerCase().endsWith('.tsv'));
    if (!member) throw new Error(`export ZIP 缺 ${file}`);
    const stop = intakeProgress(`解压 ${file}`);
    try { await runTar(['-xOf', zip, member], path.join(out, file)); }
    finally { stop(); }
    console.log(`解出 ${member} -> ${file}`);
  }
  await fs.writeFile(marker, date, 'utf8');
  return { dir: out, date };
}

async function processedIds(file: string): Promise<Set<number>> {
  const seen = new Set<number>();
  if (!await exists(file)) { console.log(`std.csv 不存在, 视为首次全量: ${file}`); return seen; }
  let first = true;
  for await (const line of lines(file, '读取已完成统计 ID')) {
    if (first) { first = false; continue; }
    const id = Number(line.slice(0, line.indexOf(',')));
    if (Number.isSafeInteger(id)) seen.add(Math.floor(id / 1000));
  }
  return seen;
}
function csvEscape(value: string): string { return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value; }
function csvRow(values: string[]): string { return values.map(csvEscape).join(',') + '\n'; }
// CSV fixture input may contain quoted newlines (MBF); TSV export does not.
async function* csvRecords(file: string): AsyncGenerator<string[]> {
  let fields: string[] = [], field = '', quoted = false, afterQuote = false;
  for await (const chunk of createReadStream(file, { encoding: 'utf8', highWaterMark: 1 << 18 })) {
    for (const ch of chunk as string) {
      if (quoted) { if (ch === '"') { quoted = false; afterQuote = true; } else field += ch; continue; }
      if (afterQuote && ch === '"') { field += '"'; quoted = true; afterQuote = false; continue; }
      afterQuote = false;
      if (ch === '"' && field === '') { quoted = true; continue; }
      if (ch === ',') { fields.push(field); field = ''; continue; }
      if (ch === '\n') { fields.push(field.replace(/\r$/, '')); yield fields; fields = []; field = ''; continue; }
      field += ch;
    }
  }
  if (quoted) throw new Error(`CSV 引号未闭合: ${file}`);
  if (field || fields.length) { fields.push(field); yield fields; }
}
async function* sourceRows(o: Options, tsvDir?: string): AsyncGenerator<Row> {
  if (o.sourceCsv) {
    let cm: Record<string, number> | undefined;
    for await (const row of csvRecords(path.resolve(o.sourceCsv))) {
      if (!cm) { cm = columns(row, SCRAMBLE_ALIASES); continue; }
      yield Object.fromEntries(INFO.map(key => [key, cell(row, cm!, key)])) as Row;
    }
    return;
  }
  const file = path.join(tsvDir!, 'Scrambles.tsv');
  let cm: Record<string, number> | undefined, scanned = 0;
  for await (const line of lines(file, '扫描 Scrambles.tsv')) {
    const row = line.split('\t');
    if (!cm) {
      cm = columns(row, SCRAMBLE_ALIASES);
      if (['id', 'scramble', 'event_id'].some(key => cm![key] === undefined)) throw new Error(`Scrambles.tsv 缺关键列: ${line}`);
      continue;
    }
    scanned++;
    if (!EVENTS.has(cell(row, cm, 'event_id'))) continue;
    yield Object.fromEntries(INFO.map(key => [key, key === 'scramble' ? cell(row, cm!, key).replaceAll('|', '\n') : cell(row, cm!, key)])) as Row;
  }
  if (!cm) throw new Error(`Scrambles.tsv 为空: ${file}`);
}

export async function runIncremental(o: Options): Promise<{ rows: number; expanded: number }> {
  const incr = path.join(o.dataDir, 'incremental');
  if (!o.dryRun) await fs.mkdir(incr, { recursive: true });
  const src = o.sourceCsv ? { dir: undefined, date: 'source-csv' } : await fetchExport(o, incr).then(v => ({ dir: v.dir, date: v.date }));
  const processed = o.minScrambleId === undefined ? await processedIds(path.join(o.dataDir, 'stats', 'std.csv')) : new Set<number>();
  console.log(`已处理 scrambleId: ${processed.size}`);
  const newRows: Row[] = [];
  const byEvent = new Map<string, number>();
  let maxSid = 0, scanned = 0;
  for await (const row of sourceRows(o, src.dir)) {
    scanned++;
    const sid = Number(row.id.split('_')[0]);
    if (!Number.isSafeInteger(sid) || (o.minScrambleId !== undefined ? sid <= o.minScrambleId : processed.has(sid))) continue;
    newRows.push(row);
    byEvent.set(row.event_id, (byEvent.get(row.event_id) || 0) + 1);
    maxSid = Math.max(maxSid, sid);
  }
  console.log(`新增 scrambleId=${newRows.length}, 按项目=${JSON.stringify(Object.fromEntries(byEvent))}, 扫描=${scanned}`);
  if (o.dryRun) return { rows: newRows.length, expanded: 0 };
  if (src.dir && await exists(path.join(src.dir, 'Competitions.tsv'))) await refreshCompetitions(path.join(src.dir, 'Competitions.tsv'), path.join(o.dataDir, 'competitions.tsv'));
  await fs.writeFile(path.join(incr, 'export_date.txt'), src.date, 'utf8');
  const splitPath = path.join(incr, 'new_split_mbf.csv');
  const txtPath = path.join(incr, 'new_no_wide_move.txt');
  const split = createWriteStream(`${splitPath}.tmp`, { encoding: 'utf8' });
  const txt = createWriteStream(`${txtPath}.tmp`, { encoding: 'utf8' });
  split.write(csvRow([...INFO]));
  let expanded = 0;
  try {
    for (const row of newRows) {
      const base = row.id.split('_')[0];
      const subs = row.event_id === '333mbf' ? row.scramble.split('\n').map(s => s.trim()).filter(Boolean) : [row.scramble.trim()];
      if (!subs.length) console.warn(`333mbf scrambleId=${base} 拆出 0 条`);
      for (let i = 0; i < subs.length; i++) {
        if (i >= 999) throw new Error(`333mbf seq >= 1000: ${base}`);
        const id = `${base}${String(i + 1).padStart(3, '0')}`;
        const normalized = normalizeWcaScramble(subs[i]);
        if (normalized === null) throw new Error(`无法归一化打乱 ${id}: ${subs[i]}`);
        split.write(csvRow([id, subs[i], ...INFO.slice(2).map(key => row[key])]));
        txt.write(`${id},${normalized}\n`);
        expanded++;
      }
    }
    split.end(); txt.end();
    await Promise.all([split, txt].map(stream => new Promise<void>((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); })));
    await fs.rename(`${splitPath}.tmp`, splitPath);
    await fs.rename(`${txtPath}.tmp`, txtPath);
  } catch (error) { split.destroy(); txt.destroy(); throw error; }
  await fs.writeFile(path.join(incr, 'new_watermark.txt'), String(maxSid), 'utf8');
  console.log(`拆多盲后 ${expanded} 行; solver 输入: ${txtPath}`);
  return { rows: newRows.length, expanded };
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  runIncremental(parseArgs(process.argv.slice(2))).catch(error => { console.error(error); process.exitCode = 1; });
}
