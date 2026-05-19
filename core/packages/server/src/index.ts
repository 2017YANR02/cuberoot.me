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
import { navSitesRoutes } from './routes/nav_sites.js';
import { nemesizerRoutes } from './routes/nemesizer.js';
import { cubingLiveRoutes } from './routes/cubing_live.js';
import { analyticsRoutes } from './routes/analytics.js';
import { wikiRoutes } from './routes/wiki.js';
import { scramble555Routes } from './routes/scramble_555.js';
import { opsRoutes } from './routes/ops.js';
import { loadNemesizerDataset } from './nemesizer/loader.js';
import { ensureDaemon as ensureCube555Daemon } from './cube555/daemon.js';

const app = new Hono();

// CORS 配置——允许前端跨域请求
// NOTE: GH Pages 服务的 cuberoot.me 跨域调 api.cuberoot.me,所以页面 origin 是 cuberoot.me。
// maxAge 缓存 preflight 一天,减少海外用户的 OPTIONS 来回。
app.use('*', cors({
  origin: [
    'http://localhost:5173',              // Vite dev server
    'https://www.cuberoot.me',            // 生产环境（SPA）
    'https://cuberoot.me',                // 裸域 (含 GH Pages 海外线路)
  ],
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
app.route('/v1', navSitesRoutes);
app.route('/v1', nemesizerRoutes);
app.route('/v1', cubingLiveRoutes);
app.route('/v1', analyticsRoutes);
app.route('/v1', wikiRoutes);
app.route('/v1', scramble555Routes);
app.route('/v1', opsRoutes);

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

const PORT = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, () => {
  console.log(`Trainer API running on port ${PORT}`);
});
