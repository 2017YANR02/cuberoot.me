/** Read-only terminal presentation; never starts/stops a solver or edits checkpoints. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { WebsiteSummary } from './double-zbll-website-stats.mjs';

export interface DashboardProgress {
  total: number; verified: number; activeCompleted: number; activeTotal: number; activeBatch: number;
  stage: string; status: string; updatedAt: string; computeSeconds: number;
  currentRssGiB: number; peakRssGiB: number; availableGiB: number;
  currentSwapouts: number; baselineSwapouts: number; reviewedSwapouts?: number; histogram: number[]; meanHtm: number | null;
  ratePerSecond?: number; reason?: string;
  activeVerified?: number; memoryPressure?: number; diskGiB?: number;
  solverThreads?: number;
  solverEngine?: string;
  reservedRssGiB?: number;
  website?: WebsiteSummary;
  pairs?: { finishedPairs: number; meanBefore: number | null; meanAfter: number | null;
    latest?: { top: string; bottom: string; before: number | null; best: number; states: number;
      qtm?: number; generators?: number; stateId?: number } };
}
export const REFRESH_MS = 5000;
const number = (n: number) => n.toLocaleString('en-US');
const gib = (n: number) => Number.isFinite(n) ? n.toFixed(1) : '—';
export function renderCompletion(p: DashboardProgress, work: string): string {
  if (p.status !== 'complete' || p.verified !== p.total) throw Error('任务尚未完整完成');
  const w = p.website;
  return [
    '双底 ZBLL · 全部完成并验证',
    `已验证 ${number(p.verified)} / ${number(p.total)}（100%）`,
    ...(w ? ['', '网站候选打乱 · 不含 PLL',
      `平均 ${w.baselineMean.toFixed(3)} → ${w.bestMean.toFixed(3)} 步 · 减少 ${w.meanSaved.toFixed(3)} 步`,
      `${number(w.improvedPairs)} 对变短 · 最多减少 ${w.maxSaved} 步`,
      `含 PLL 配对：${number(w.pllKnownPairs)} / ${number(w.pllTotalPairs)} 对完成`] : []),
    '', `结果与断点：${work}`, '计算已结束，无需再次启动。',
  ].join('\n');
}
export function humanTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '采集速度中（约 10 秒）';
  const minutes = Math.ceil(Math.max(0, seconds) / 60);
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes / 60) % 24, mins = minutes % 60;
  return [days ? `${days} 天` : '', hours ? `${hours} 小时` : '', `${mins} 分钟`].filter(Boolean).join(' ');
}
export function computed(p: DashboardProgress) {
  const pending = p.stage === '核验已有断点' ? 0 : Math.max(0, p.activeCompleted - (p.activeVerified ?? 0));
  return Math.min(p.total, p.verified + pending);
}
// Derive speed from actual deltas, including old coordinators already running.
export class ObservedSpeed {
  private points: { count: number; time: number }[] = [];
  update(p: DashboardProgress): number | null {
    const time = Date.parse(p.updatedAt), count = computed(p);
    if (!Number.isFinite(time)) return null;
    const last = this.points.at(-1);
    if (last && (count < last.count || time < last.time)) this.points = [];
    if (!last || time > last.time) this.points.push({ count, time });
    while (this.points.length > 2 && time - this.points[0].time > 60_000) this.points.shift();
    if (typeof p.ratePerSecond === 'number' && p.ratePerSecond > 0) return p.ratePerSecond;
    const first = this.points[0];
    if (time > first.time && count > first.count) return (count - first.count) / ((time - first.time) / 1000);
    return null;
  }
}
export function renderDashboard(p: DashboardProgress, options: { now?: number; rate?: number | null; viewer?: boolean; columns?: number; rows?: number; color?: boolean } = {}) {
  const now = options.now ?? Date.now(), count = computed(p);
  const rate = options.rate ?? p.ratePerSecond ?? null;
  const stale = p.status === 'running' && now - Date.parse(p.updatedAt) > 15_000;
  const eta = rate && rate > 0 && !stale ? (p.total - count) / rate : null;
  const width = Math.max(36, Math.min(68, (options.columns ?? 72) - 2));
  const line = '─'.repeat(width);
  const paint = (s: string, code: string) => options.color ? `\x1b[${code}m${s}\x1b[0m` : s;
  const accent = (s: string) => paint(s, '1;36');
  const muted = (s: string) => paint(s, '2');
  const headroom = p.availableGiB - (p.reservedRssGiB ?? p.currentRssGiB);
  const swap = p.currentSwapouts - (p.reviewedSwapouts ?? p.baselineSwapouts);
  const good = !stale && p.status === 'running' && swap === 0 && headroom >= 2 && p.memoryPressure === 1;
  const barWidth = Math.max(16, width - 12), filled = Math.floor(barWidth * count / p.total);
  const website = p.website;
  const latest = p.pairs?.latest;
  const hasSelectionMetrics = latest?.qtm !== undefined && latest.generators !== undefined;
  const histogram = (website?.histogram ?? p.histogram).map((n, step) => ({ n, step })).filter(x => x.n);
  const distributionTotal = website?.pairCount ?? p.verified;
  const maximum = Math.max(1, ...histogram.map(x => x.n));
  const compact = (options.rows ?? 40) < 33 && width >= 60;
  const histogramRow = ({ n, step }: { n: number; step: number }, barSize: number) => {
    const bar = '█'.repeat(Math.max(1, Math.round(n / maximum * barSize)));
    const percent = 100 * n / Math.max(1, distributionTotal);
    const label = percent < 0.1 ? '<0.1' : percent.toFixed(1);
    return `${String(step).padStart(2)} 步  ${number(n).padStart(7)}  ${label.padStart(4)}%  ${paint(bar, n === maximum ? '1;36' : '36')}`;
  };
  const distribution = compact ? Array.from({ length: Math.ceil(histogram.length / 2) }, (_, i) => {
    const middle = Math.ceil(histogram.length / 2), left = histogramRow(histogram[i], 6);
    const right = histogram[i + middle];
    const plain = left.replace(/\x1b\[[\d;]*m/g, '');
    return left + ' '.repeat(Math.max(2, 34 - [...plain].length - 1)) + (right ? histogramRow(right, 6) : '');
  }) : histogram.map(row => histogramRow(row, Math.max(8, width - 27)));
  const rows = [
    accent('  双底 ZBLL') + muted(`  /  ${p.solverEngine === 'opt10' ? 'Rust Opt10' : p.solverEngine === 'rust' ? 'Rust H10' : '最优 HTM'} · 含 PLL · 旋转去重`),
    paint(`  ${p.status === 'running' ? '●' : '○'} ${p.stage}`, good ? '32' : '33') + (p.solverThreads ? accent(`  ·  ${p.solverThreads} 线程`) : '') + muted(options.viewer ? '  ·  只读面板' : '  ·  断点续算'), ...(compact ? [] : [muted(line)]),
    accent('━'.repeat(filled)) + muted('─'.repeat(barWidth - filled)) + accent(`  ${(100 * count / p.total).toFixed(2)}%`),
    `已计算   ${paint(number(count), '1')} / ${number(p.total)}  ·  剩余 ${number(p.total - count)}`,
    `已验证   ${number(p.verified)}  ·  待核验 ${number(count - p.verified)}`,
    p.pairs ? `已定稿   ${number(p.pairs.finishedPairs)} 对${p.pairs.meanBefore !== null ? `  ·  平均 ${p.pairs.meanBefore.toFixed(3)} → ${paint(p.pairs.meanAfter!.toFixed(3), '1;36')} 步` : ''}`
      : `本批次   ${number(p.activeCompleted)} / ${number(p.activeTotal)}  ·  第 ${p.activeBatch + 1} 批`,
    ...(latest ? hasSelectionMetrics ? [
      `最近完成 ${latest.top} × ${latest.bottom}${latest.before === null ? '' : muted(`  ·  原 ${latest.before} HTM`)}`,
      `所选解   HTM ${accent(String(latest.best))}   ·   QTM ${accent(String(latest.qtm))}   ·   Generators ${accent(String(latest.generators))}`,
    ] : [`最近完成 ${latest.top} × ${latest.bottom}  ·  ${latest.before === null ? '' : latest.before + ' → '}${accent(String(latest.best))} 步`] : []),
    ...(compact ? [] : ['']),
    accent(`预计剩余   ${p.status === 'complete' ? '已完成' : p.status === 'waiting-memory' ? '等待内存，达标后自动续算' : p.status !== 'running' ? '计算停止，暂不估算' : stale ? '数据暂未更新，暂停估算' : humanTime(eta)}`),
    `计算速度   ${rate && !stale ? rate.toFixed(2) + ' 个 / 秒' : '正在采集'}  ·  累计 ${humanTime(p.computeSeconds)}`,
    ...(compact && hasSelectionMetrics ? [] : [muted(line)]),
    `计算内存   ${gib(p.currentRssGiB)} GiB   ·   峰值 ${gib(p.peakRssGiB)} GiB`,
    `保守余量   ${paint(gib(headroom) + ' GiB', headroom >= 2 ? '32' : '31')}   ·   新增换出 ${paint(number(swap) + ' 页', swap === 0 ? '32' : '31')}`,
    `内存压力   ${p.memoryPressure === undefined ? '—' : p.memoryPressure === 1 ? '正常' : '异常'}   ·   磁盘剩余 ${gib(p.diskGiB ?? NaN)} GiB`,
    muted(line),
    ...(website ? [
      accent('网站打乱 · 每对目前最短（不含 PLL · 待安装）'),
      `平均 ${website.baselineMean.toFixed(3)} → ${paint(website.bestMean.toFixed(3), '1;36')} 步  ·  减少 ${website.meanSaved.toFixed(3)} 步`,
      `${number(website.improvedPairs)} 对变短 · 最多省 ${website.maxSaved} 步 · PLL ${number(website.pllKnownPairs)}/${number(website.pllTotalPairs)}`,
    ] : [`已验证解的步数分布   ·   平均 ${paint(p.meanHtm?.toFixed(3) ?? '—', '1')} 步`]),
    ...(!compact || !website ? ['步数       数量     占比'] : []),
    ...distribution, ...(compact ? [] : [muted(line)]),
    muted(`刷新 ${new Date(now).toLocaleTimeString('zh-CN', { hour12: false })}  ·  每 5 秒更新  ·  数据 ${new Date(p.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}`),
    ...(stale ? ['提示：数据超过 15 秒未更新，请检查计算状态。'] : []),
    p.reason || (options.viewer ? '只读面板：Control-C 关闭面板，原计算继续运行。' : 'Control-C 安全停止，断点自动保留。'),
  ];
  return rows.map(row => fitLine(row, width)).join('\n') + '\n';
}
// ANSI sequences consume no cells; CJK characters consume two. Avoid wrapping
// a whole dashboard when the user narrows the Terminal window.
export function fitLine(text: string, width: number) {
  const tokens = text.match(/\x1b\[[\d;]*m|./gu) ?? [];
  let cells = 0, result = '';
  for (const token of tokens) {
    if (token.startsWith('\x1b')) { result += token; continue; }
    const cp = token.codePointAt(0)!;
    const size = cp >= 0x2e80 && cp <= 0xffef ? 2 : 1;
    if (cells + size > width) return result + (text.includes('\x1b') ? '\x1b[0m' : '');
    result += token; cells += size;
  }
  return result;
}

/** One alternate-screen frame. Absolute positioning and no newlines prevent
 * scrolling, including at the bottom edge and after a terminal resize. */
export class TerminalDashboard {
  private opened = false;
  constructor(private readonly output: { isTTY?: boolean; columns?: number; rows?: number; write(text: string): unknown } = process.stdout) {}
  render(text: string) {
    if (!this.output.isTTY) { this.output.write(text); return; }
    const height = Math.max(1, this.output.rows || 24), width = Math.max(1, (this.output.columns || 80) - 1);
    let lines = text.replace(/\n$/, '').split('\n');
    if (lines.length > height) {
      lines = height < 4 ? lines.slice(0,height) : [
        ...lines.slice(0,height-3), '窗口较小，放大可显示完整统计', ...lines.slice(-2),
      ];
    }
    const start = this.opened ? '' : '\x1b[?1049h\x1b[?25l\x1b[2J';
    this.opened = true;
    this.output.write(start + lines.map((line,i)=>`\x1b[${i+1};1H\x1b[2K${fitLine(line,width)}`).join('') + '\x1b[0m\x1b[J');
  }
  close() {
    if (!this.opened) return;
    this.opened = false;
    this.output.write('\x1b[0m\x1b[?25h\x1b[?1049l');
  }
}
export function activeOwner(work: string): boolean {
  try {
    const pid = Number(readFileSync(resolve(work, 'owner.pid'), 'utf8'));
    if (!Number.isSafeInteger(pid) || pid < 1) return false;
    process.kill(pid, 0); return true;
  } catch { return false; }
}
export async function watchDashboard(work: string) {
  const speed = new ObservedSpeed();
  const screen = new TerminalDashboard();
  const restore = () => screen.close();
  process.once('exit', restore);
  let closing = false;
  const close = () => { closing = true; };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, close);
  try {
    while (!closing) {
      try {
        let p = JSON.parse(readFileSync(resolve(work, 'progress.json'), 'utf8')) as DashboardProgress;
        try {
          const live = JSON.parse(readFileSync(resolve(work, 'live-progress.json'), 'utf8'));
          if (live.ownerPid === Number(readFileSync(resolve(work, 'owner.pid'), 'utf8')) && activeOwner(work)) p = live;
        } catch { /* Older coordinators only write the durable snapshot. */ }
        const output = renderDashboard(p, { rate: speed.update(p), viewer: true, columns: process.stdout.columns, rows: process.stdout.rows, color: process.stdout.isTTY && !process.env.NO_COLOR });
        screen.render(output);
        if (!activeOwner(work)) { screen.close(); console.log('计算进程已结束。此面板不会自动重启计算。'); return; }
      } catch (e) { screen.render('暂时无法读取进度：' + String(e)); if (!activeOwner(work)) return; }
      // Short waits make Ctrl-C responsive without touching the real owner.
      for (let i = 0; i < 10 && !closing; i++) await delay(REFRESH_MS / 10);
    }
  } finally { screen.close(); process.off('exit', restore); for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.off(signal, close); }
}
