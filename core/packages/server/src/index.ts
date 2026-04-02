import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { authRoutes } from './routes/auth.js';
import { progressRoutes } from './routes/progress.js';
import { healthRoutes } from './routes/health.js';
import { reconRoutes } from './routes/recon.js';

const app = new Hono();

// CORS 配置——允许前端跨域请求
app.use('*', cors({
  origin: [
    'http://localhost:5173',              // Vite dev server
    'http://localhost:4000',              // Jekyll dev server
    'https://www.cuberoot.me',            // 生产环境（SPA）
    'https://cuberoot.me',                // 裸域
    'https://ruiminyan.github.io',        // GitHub Pages
  ],
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

// 注册路由
app.route('/', authRoutes);
app.route('/', progressRoutes);
app.route('/', healthRoutes);
app.route('/', reconRoutes);

const PORT = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, () => {
  console.log(`Trainer API running on port ${PORT}`);
});
