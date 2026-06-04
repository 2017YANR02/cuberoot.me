/**
 * 监控套件总启动 —— 从 Python /opt/wca-monitor 的 4 个 systemd 服务移植成 core-api 进程内后台 poller。
 *   wca_live_record  纪录快讯(WCA Live recentRecords)
 *   cubing_record    中国比赛纪录(cubing.com WS sr/ar)
 *   cubing_comp      粗饼新比赛公示
 *   wca_comp         WCA 全球新比赛
 *   wca_live_pr      关注选手生涯 PR(WCA Live)+ cubing_record 内的 result.user PR
 *
 * 两道门:
 *   MONITORS_ENABLED=0     → 全部不启动(代码可随版本上线但休眠);=1 才跑。
 *   MONITOR_PUSH_ENABLED=0 → 跑但只 console.log DRY,不真发 Bark(双跑期对照旧 Python 文案);=1 真发。
 * 灰度:部署(都 0)→ MONITORS_ENABLED=1 双跑对照 → MONITOR_PUSH_ENABLED=1 真推 → 拆 /opt/wca-monitor。
 */
import { startWcaLiveRecordMonitor } from './wca_live_record.js';
import { startCubingRecordMonitor } from './cubing_record.js';
import { startCubingCompMonitor } from './cubing_comp.js';
import { startWcaCompMonitor } from './wca_comp.js';
import { startWcaLivePrMonitor } from './wca_live_pr.js';

export function startMonitors(): void {
  if (process.env.MONITORS_ENABLED !== '1') {
    console.log('[monitors] disabled (set MONITORS_ENABLED=1 to start)');
    return;
  }
  const push = process.env.MONITOR_PUSH_ENABLED === '1';
  console.log(`[monitors] starting 5 monitors (push ${push ? 'ENABLED' : 'DRY-only'})`);
  startWcaLiveRecordMonitor();
  startCubingRecordMonitor();
  startCubingCompMonitor();
  startWcaCompMonitor();
  startWcaLivePrMonitor();
}
