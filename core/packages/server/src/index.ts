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

// 注册路由
app.route('/', authRoutes);
app.route('/', progressRoutes);
app.route('/', healthRoutes);
app.route('/', reconRoutes);

const PORT = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, () => {
  console.log(`Trainer API running on port ${PORT}`);
});
