/** Read the status written by table_generator; --watch refreshes one terminal line. */
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const solverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tableDir = path.resolve(process.env.CUBE_TABLE_DIR || path.join(solverDir, 'tables'));
const tableIndex = process.argv.indexOf('--table');
const table = tableIndex < 0 ? 'h10' : process.argv[tableIndex + 1];
if (table !== 'h7' && table !== 'h10') throw new Error('--table must be h7 or h10');
const statusPath = path.join(tableDir, `h48-nissy-core/h48${table}.dat.progress.json`);
const watch = process.argv.includes('--watch') && process.stdout.isTTY;
type Status = {
  status: string;
  stage: string;
  failedFromStage?: string | null;
  stageIndex: number;
  stagesTotal: number;
  done: number;
  total: number | null;
  percent: number | null;
  detail: number;
  elapsedSeconds: number;
  etaSeconds: number | null;
  updatedAt: string;
};
const labels: Record<string, string> = {
  'preparing file': '准备文件', 'cocsep search': '生成 cocsep',
  'clearing main table': '初始化主表', 'enumerating short states': '枚举短状态',
  'processing short states': '处理短状态', 'counting main table': '统计主表',
  'building eoesep': '生成 eoesep', 'validating table': '校验表',
  'flushing to disk': '刷盘落盘', complete: '已完成', failed: '失败',
};
function duration(seconds: number): string {
  const n = Math.max(0, Math.round(seconds));
  const days = Math.floor(n / 86400);
  const hours = Math.floor(n / 3600) % 24;
  const minutes = Math.floor(n / 60) % 60;
  const secs = n % 60;
  return `${days ? `${days}天 ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
async function show(): Promise<boolean> {
  let status: Status;
  try { status = JSON.parse(await readFile(statusPath, 'utf8')) as Status; }
  catch (error) {
    console.error(`无法读取进度文件 ${statusPath}: ${String(error)}`);
    return false;
  }
  const stageLabel = status.stage === 'flushing to disk' && status.detail === 1
    ? '同步落盘' : labels[status.stage] || status.stage;
  const failedAt = status.status === 'failed' && status.failedFromStage
    ? `（发生于${labels[status.failedFromStage] || status.failedFromStage}）` : '';
  const phase = `[H48 ${status.stageIndex}/${status.stagesTotal}] ${stageLabel}${failedAt}`;
  const percent = status.total ? 100 * status.done / status.total : null;
  const shownPercent = percent == null ? '?' : (status.done < status.total ? Math.min(percent, 99.999) : percent).toFixed(3);
  const count = status.total ? ` ${status.done.toLocaleString()}/${status.total.toLocaleString()} (${shownPercent}%)` : '';
  const early = status.total && status.done / status.total < 0.01;
  const nearEnd = status.total != null && status.done < status.total && status.total - status.done <= 1;
  const eta = nearEnd ? '收尾中（无法可靠估时）' : status.etaSeconds == null ? '估算中' : `约 ${duration(status.etaSeconds)}${early ? '（早期粗估，波动大）' : '（粗估）'}`;
  const line = `${phase}${count} | 已运行 ${duration(status.elapsedSeconds)}${status.status === 'running' ? ` | 本阶段剩余 ${eta}` : ''} | 更新 ${status.updatedAt}`;
  if (watch && process.stdout.isTTY) process.stdout.write(`\r\x1b[2K${line}`);
  else console.log(line);
  return status.status === 'running';
}
let running = await show();
if (watch && running) {
  const timer = setInterval(async () => {
    running = await show();
    if (!running) {
      clearInterval(timer);
      if (process.stdout.isTTY) process.stdout.write('\n');
    }
  }, 10_000);
  process.on('SIGINT', () => { clearInterval(timer); if (process.stdout.isTTY) process.stdout.write('\n'); });
}
