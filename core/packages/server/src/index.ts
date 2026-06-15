import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { authRoutes } from './routes/auth.js';
import { progressRoutes } from './routes/progress.js';
import { healthRoutes } from './routes/health.js';
import { reconRoutes } from './routes/recon.js';
import { cubeRoutes } from './routes/cube.js';
import { algRoutes } from './routes/alg.js';
import { algSetsRoutes } from './routes/alg_sets.js';
import { colpiRoutes } from './routes/colpi.js';
import { historicalRanksRoutes } from './routes/historical_ranks.js';
import { wcaStatsExtraRoutes } from './routes/wca_stats_extra.js';
import { wcaFunStatsRoutes } from './routes/wca_fun_stats.js';
import { navSitesRoutes } from './routes/nav_sites.js';
import { nemesizerRoutes } from './routes/nemesizer.js';
import { cubingLiveRoutes } from './routes/cubing_live.js';
import { cnCompNamesRoutes } from './routes/cn_comp_names.js';
import { analyticsRoutes } from './routes/analytics.js';
import { wikiRoutes } from './routes/wiki.js';
import { articleRoutes } from './routes/article.js';
import { scramble555Routes } from './routes/scramble_555.js';
import { opsRoutes } from './routes/ops.js';
import { wcaFormatRoutes } from './routes/wca_format.js';
import { wcaRecentRecordsRoutes, startRecentRecordsPoller } from './routes/wca_recent_records.js';
import { timerBackupsRoutes } from './routes/timer_backups.js';
import { wcaScheduleRoutes } from './routes/wca_schedule.js';
import { wcaScramblesRoutes } from './routes/wca_scrambles.js';
import { scrambleMarksRoutes } from './routes/scramble_marks.js';
import { announcedCompsRoutes, startAnnouncedCompsPoller } from './routes/announced_comps.js';
import { sponsorsRoutes } from './routes/sponsors.js';
import { membershipRoutes } from './routes/membership.js';
import { compFollowsRoutes } from './routes/comp_follows.js';
import { wcaProxyRoutes } from './routes/wca_proxy.js';
import { wcaResultWatchRoutes } from './routes/wca_result_watch.js';
import { feedbackRoutes } from './routes/feedback.js';
import { cubeoptSolveRoutes } from './routes/cubeopt_solve.js';
import { ensureDaemon as ensureCubeoptDaemon, isEnabled as cubeoptEnabled } from './cubeopt/daemon.js';
import { startWcaPastResultsMonitor } from './monitors/wca_past_results.js';
import { loadNemesizerDataset } from './nemesizer/loader.js';
import { ensureDaemon as ensureCube555Daemon } from './cube555/daemon.js';
import { getCurrentRecords } from './utils/current_records.js';
import { warmCnCompZh } from './utils/cn_comp_zh_cache.js';
import { startPrewarmCron } from './routes/cubing_live.js';
import { startMonitors } from './monitors/index.js';

const app = new Hono();

// CORS 配置——允许前端跨域请求
// NOTE: Vercel/Next 服务的 cuberoot.me 跨域调 api.cuberoot.me,所以页面 origin 是 cuberoot.me。
// maxAge 缓存 preflight 一天,减少 edge 端的 OPTIONS 来回。
// Phase 4 (2026-05-27): 主域全员切 Next; vite.cuberoot.me 已下线。
// *.vercel.app 用 function 形式兜底,Vercel preview 每 PR 一个新 URL 全开。
app.use('*', cors({
  origin: (origin) => {
    const allowed = new Set([
      'http://localhost:3000',              // Next dev server
      'https://www.cuberoot.me',            // 主域
      'https://cuberoot.me',                // 裸域
      'https://next.cuberoot.me',           // Next 子域并行验证
      'capacitor://localhost',              // Capacitor iOS app webview origin
      'https://localhost',                  // Capacitor Android app webview origin (androidScheme: https)
    ]);
    if (!origin) return '';                 // server-side / curl
    if (allowed.has(origin)) return origin;
    // Vercel preview / production deploy URL — *.vercel.app
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return origin;
    return null;
  },
  credentials: true,                      // 兼容浏览器 sendBeacon / 默认 include 的请求;server 用 Bearer 鉴权,不读 cookie
  maxAge: 86400,
}));

// NOTE: 全局错误处理——把未捕获的 throw new Error(...) 转成 JSON 格式
// requireAuth / requireAdmin / checkRateLimit 都用 throw，没有全局处理器会变成空 500
app.onError((err, c) => {
  const msg = err instanceof Error ? err.message : String(err);
  // NOTE: 根据错误消息推断 HTTP 状态码
  let status: 400 | 401 | 403 | 429 | 500 = 500;
  if (msg.includes('Authentication required') || msg.includes('token')) status = 401;
  else if (msg.includes('Admin access required') || msg.includes('Cannot edit') || msg.includes('Cannot delete') || msg.includes('suspended')) status = 403;
  else if (msg.includes('Rate limit')) status = 429;
  else if (msg.includes('Validation') || msg.includes('No valid')) status = 400;
  console.error(`[${status}] ${msg}`);
  return c.json({ error: msg }, status);
});

// 注册路由 — 全部挂在 /v1 下，对外即 https://api.cuberoot.me/v1/*
app.route('/v1', authRoutes);
app.route('/v1', progressRoutes);
app.route('/v1', healthRoutes);
app.route('/v1', reconRoutes);
app.route('/v1', cubeRoutes);
app.route('/v1', algRoutes);
app.route('/v1', algSetsRoutes);
app.route('/v1', colpiRoutes);
app.route('/v1', historicalRanksRoutes);
app.route('/v1', wcaStatsExtraRoutes);
app.route('/v1', wcaFunStatsRoutes);
app.route('/v1', navSitesRoutes);
app.route('/v1', nemesizerRoutes);
app.route('/v1', cubingLiveRoutes);
app.route('/v1', cnCompNamesRoutes);
app.route('/v1', analyticsRoutes);
app.route('/v1', wikiRoutes);
app.route('/v1', articleRoutes);
app.route('/v1', scramble555Routes);
app.route('/v1', opsRoutes);
app.route('/v1', wcaFormatRoutes);
app.route('/v1', wcaRecentRecordsRoutes);
app.route('/v1', timerBackupsRoutes);
app.route('/v1', wcaScheduleRoutes);
app.route('/v1', wcaScramblesRoutes);
app.route('/v1', scrambleMarksRoutes);
app.route('/v1', announcedCompsRoutes);
app.route('/v1', sponsorsRoutes);
app.route('/v1', membershipRoutes);
app.route('/v1', compFollowsRoutes);
app.route('/v1', wcaProxyRoutes);
app.route('/v1', wcaResultWatchRoutes);
app.route('/v1', feedbackRoutes);
app.route('/v1', cubeoptSolveRoutes);

// Kick off nemesizer dataset load asynchronously — the worker would otherwise
// block the listener from coming up. Routes return 503 until ready (~5s).
loadNemesizerDataset().catch(err => {
  console.error('[nemesizer] startup load failed, routes will keep returning 503:', err);
});

// Kick off cube555 JVM daemon spawn in background — first-time cold table
// build is ~5 min, warm reload from disk ~3s; /v1/scramble/555-rs returns
// 503 until daemon emits READY. CUBE555_DISABLED=1 skips spawn entirely.
ensureCube555Daemon().catch(err => {
  console.error('[cube555] startup failed, /v1/scramble/555-rs will return 503:', err);
});

// cube48opt optimal-solve daemon: lazy by default — it holds a multi-GB table
// resident, and boot is the peak-memory window (current-records full scan +
// nemesizer + cubing-live prewarm all warm at once), so we do NOT want to add
// ~2GB here. The daemon spawns on the first /v1/scramble/optimal-solve request
// instead (idle-unload + memory watchdog manage it thereafter). Set
// CUBEOPT_WARM_ON_BOOT=1 to pre-warm anyway (fine for the small opt5 table).
if (cubeoptEnabled() && process.env.CUBEOPT_WARM_ON_BOOT === '1') {
  ensureCubeoptDaemon().catch(err => {
    console.error('[cubeopt] startup warm failed:', err);
  });
}

// WCA Live recentRecords 后台 60s 轮询 — 落地页右下角列表的同步源.
// 启动立即拉一次,失败不影响 listener.
startRecentRecordsPoller();

// Warm current-records cache(WR/CR/NR from wca_results_flat,首次 ~5-10s 全扫).
// 后台跑,不阻塞 listener.正常运行期 24h TTL,/comp 页 fallback 用 peekCurrentRecords()
// 立即返;若启动后 5-10s 内有请求进来,enrich 跳过(原行为)— 仅短窗影响.
getCurrentRecords().catch(err => {
  console.error('[current_records] startup warm failed:', err);
});

// 比赛中文元数据(cubing.com 地点 + 退/重开报名时间)预热:
// 启动 30s 后扫一遍 all_upcoming_comps.json 的目标比赛,DB 缺/>7d 的串行 scrape;
// 之后每天跑一次。pm2 重启即触发,新公示比赛最坏窗口 ~24h(单条 miss 仍走写穿 fallback)。
setTimeout(() => {
  warmCnCompZh();
  setInterval(warmCnCompZh, 24 * 60 * 60 * 1000);
}, 30_000);

// /v1/cubing-live L2 缓存预热:启动 90s 后扫一遍 upcoming+recent (~700 个),之后每 10min 刷一遍.
// pm2 重启 / 新部署后第一个用户访问已结束 / 报名中比赛都秒返回.
startPrewarmCron();

// wca-monitor 推送套件(WCA Live 纪录/PR + 粗饼纪录/比赛 + WCA 比赛)后台 poller.
// MONITORS_ENABLED!=1 时直接返回(休眠);MONITOR_PUSH_ENABLED!=1 时只 DRY 日志不真推.
startMonitors();

// 首页「今日公示」数据源:后台轮询 WCA announced_at(独立于监控门控).启动 90s 后首拉,之后每 20min.
startAnnouncedCompsPoller();

// 关注选手「往期成绩变更」监控(成绩取消 / 修正 / 纪录标记变动).独立门控 RESULT_WATCH_ENABLED,
// 慢周期(默认 6h)diff WCA /persons/:id/results 写入 wca_result_changes 供 /wca/result-watch 页只读.
startWcaPastResultsMonitor();

const PORT = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, () => {
  console.log(`Trainer API running on port ${PORT}`);
});
